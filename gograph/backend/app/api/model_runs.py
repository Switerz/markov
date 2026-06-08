"""Model run API endpoints."""

from pathlib import Path

import config
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from gograph.backend.app.api.deps import get_db_session
from gograph.backend.app.api.schemas import (
    ModelRunCreateRequest,
    ModelRunOverviewResponse,
    TableResponse,
)
from gograph.backend.app.schemas import ModelRunParams
from gograph.backend.app.services.journey_insight_service import (
    compute_touchpoint_metrics,
    generate_channel_insights,
)
from gograph.backend.app.services.roas_service import compute_first_last_click_roas
from gograph.backend.app.services.journey_graph_service import build_journey_graph
from gograph.backend.app.services.model_service import run_model
from gograph.backend.app.services.persistence_service import (
    create_pending_model_run,
    get_model_run,
    get_model_run_table,
    list_model_runs,
    mark_model_run_failed,
    mark_model_run_running,
    register_export,
    save_model_run,
)

router = APIRouter(prefix="/model-runs", tags=["model-runs"])


@router.post("", response_model=ModelRunOverviewResponse)
def create_model_run(
    payload: ModelRunCreateRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    params = ModelRunParams(
        start_date=payload.start_date,
        end_date=payload.end_date,
        db_plausible=payload.db_plausible,
        db_datamart=payload.db_datamart,
        lookback_days=payload.lookback_days if payload.lookback_days is not None else config.LOOKBACK_DAYS,
        non_conv_sample_pct=payload.non_conv_sample_pct,
        non_conv_scale=payload.non_conv_scale,
        decay_lambda=payload.decay_lambda,
        shapley_samples=payload.shapley_samples,
        batch_mode=payload.batch_mode,
        batch_days=payload.batch_days,
        censorship_days=payload.censorship_days if payload.censorship_days is not None else config.CENSORSHIP_DAYS,
    )
    database_url = request.app.state.database_url
    model_run_id = create_pending_model_run(
        params.to_dict(),
        database_url=database_url,
    )
    background_tasks.add_task(_run_model_in_background, model_run_id, params, database_url)
    saved = get_model_run(model_run_id, database_url=database_url)
    if saved is None:
        raise HTTPException(status_code=500, detail="Model run was not persisted.")
    return saved


@router.get("", response_model=list[ModelRunOverviewResponse])
def list_runs(
    limit: int = 50,
    session: Session = Depends(get_db_session),
):
    return list_model_runs(session=session, limit=limit)


@router.get("/{model_run_id}", response_model=ModelRunOverviewResponse)
def get_run(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    run = get_model_run(model_run_id, session=session)
    if run is None:
        raise HTTPException(status_code=404, detail="Model run not found.")
    return run


@router.get("/{model_run_id}/overview", response_model=ModelRunOverviewResponse)
def get_overview(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    return get_run(model_run_id, session=session)


def _get_channels_by_type(
    model_run_id: int,
    model_type: str,
    session: Session,
) -> dict:
    """Shared logic: fetch attribution rows filtered by model_type, add first/last click."""
    import pandas as pd
    _ensure_run_exists(model_run_id, session)
    attribution = get_model_run_table(model_run_id, "attribution_results", session=session)

    if not attribution.empty and "model_type" in attribution.columns:
        primary = attribution[attribution["model_type"] == model_type]
        # Fallback to raw if requested type doesn't exist
        if primary.empty and model_type != "raw":
            primary = attribution[attribution["model_type"] == "raw"]
    else:
        primary = attribution

    transitions = get_model_run_table(model_run_id, "transition_counts", session=session)
    spend_df = (
        primary[["channel", "spend"]].copy()
        if not primary.empty and "spend" in primary.columns
        else pd.DataFrame(columns=["channel", "spend"])
    )
    first_last = compute_first_last_click_roas(transitions, spend_df)
    if not first_last.empty and not primary.empty:
        primary = primary.merge(first_last, on="channel", how="left")

    return {
        "model_run_id": model_run_id,
        "table": "attribution_results",
        "rows": primary.to_dict("records") if not primary.empty else [],
    }


@router.get("/{model_run_id}/channels", response_model=TableResponse)
def get_channels(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    """Primary attribution — funnel model when active, raw otherwise."""
    return _get_channels_by_type(model_run_id, "funnel", session)


@router.get("/{model_run_id}/raw-channels", response_model=TableResponse)
def get_raw_channels(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    """Raw Channel Markov baseline (always order-1, no event enrichment)."""
    return _get_channels_by_type(model_run_id, "raw", session)


@router.get("/{model_run_id}/diagnostics", response_model=TableResponse)
def get_diagnostics(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    return _table_response(model_run_id, "channel_diagnostics", session)


@router.get("/{model_run_id}/insights", response_model=TableResponse)
def get_insights(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    _ensure_run_exists(model_run_id, session)
    attribution = get_model_run_table(model_run_id, "attribution_results", session=session)
    transitions = get_model_run_table(model_run_id, "transition_counts", session=session)
    touchpoints = compute_touchpoint_metrics(transitions)
    insights = generate_channel_insights(attribution, touchpoints)
    return {
        "model_run_id": model_run_id,
        "table": "insights",
        "rows": [] if insights.empty else insights.to_dict("records"),
    }


@router.get("/{model_run_id}/touchpoints", response_model=TableResponse)
def get_touchpoints(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    _ensure_run_exists(model_run_id, session)
    transitions = get_model_run_table(model_run_id, "transition_counts", session=session)
    touchpoints = compute_touchpoint_metrics(transitions)
    return {
        "model_run_id": model_run_id,
        "table": "touchpoints",
        "rows": [] if touchpoints.empty else touchpoints.to_dict("records"),
    }


@router.get("/{model_run_id}/transitions", response_model=TableResponse)
def get_transitions(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    return _table_response(model_run_id, "transition_counts", session)


@router.get("/{model_run_id}/paths", response_model=TableResponse)
def get_paths(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    return _table_response(model_run_id, "path_summary", session)


@router.get("/{model_run_id}/loops", response_model=TableResponse)
def get_loops(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    paths = get_model_run_table(model_run_id, "path_summary", session=session)
    if paths.empty:
        rows = []
    elif "contains_loop" in paths.columns:
        rows = paths[paths["contains_loop"].fillna(0).astype(int) == 1].to_dict("records")
    else:
        rows = []
    return {"model_run_id": model_run_id, "table": "loops", "rows": rows}


@router.get("/{model_run_id}/graph")
def get_graph(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    transitions = get_model_run_table(model_run_id, "transition_counts", session=session)
    matrix = get_model_run_table(model_run_id, "transition_matrix", session=session)
    if transitions.empty and matrix.empty:
        _ensure_run_exists(model_run_id, session)
    return build_journey_graph(transitions, matrix)


@router.get("/{model_run_id}/data-quality", response_model=TableResponse)
def get_data_quality(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    return _table_response(model_run_id, "data_quality_checks", session)


# ---------------------------------------------------------------------------
# Sprint 11 — Loop diagnostics
# ---------------------------------------------------------------------------

@router.get("/{model_run_id}/loop-diagnostics", response_model=TableResponse)
def get_loop_diagnostics(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    """Per-channel loop statistics: self-loop rates, conversion lift, exit distribution."""
    return _table_response(model_run_id, "loop_diagnostics", session)


# ---------------------------------------------------------------------------
# Sprint 13 — Funnel Stage Attribution
# ---------------------------------------------------------------------------

@router.get("/{model_run_id}/funnel-attribution", response_model=TableResponse)
def get_funnel_attribution(
    model_run_id: int,
    channel: str | None = None,
    session: Session = Depends(get_db_session),
):
    """Markov/Shapley attribution per composite state (channel / funnel_stage)."""
    _ensure_run_exists(model_run_id, session)
    df = get_model_run_table(model_run_id, "funnel_state_attribution", session=session)
    if not df.empty and channel:
        df = df[df["channel"] == channel]
    rows = [] if df.empty else df.to_dict("records")
    return {"model_run_id": model_run_id, "table": "funnel_state_attribution", "rows": rows}


# ---------------------------------------------------------------------------
# Sprint 16 — Funnel Attribution Validation
# ---------------------------------------------------------------------------

def _compute_funnel_validation(
    state_df: "pd.DataFrame",
    raw_map: "dict[str, float]",
) -> "list[dict]":
    """
    Aggregate funnel_state_attribution by channel.

    Returns per-channel: per-stage Markov weights, low_intent_drag_score,
    qualified_intent_share (Cart + Checkout + Purchase), and
    markov_excl_low_intent (weight renormalized after removing LI states).
    """
    STAGE_KEYS = {
        "Low Intent": "low_intent",
        "Product Interest": "product_interest",
        "Cart Intent": "cart_intent",
        "Checkout": "checkout",
        "Purchase": "purchase",
    }

    channels: dict = {}
    for _, row in state_df.iterrows():
        ch = str(row.get("channel", "") or "")
        stage = str(row.get("funnel_stage", "") or "")
        weight = float(row.get("markov_weight") or 0.0)
        if not ch:
            continue
        if ch not in channels:
            channels[ch] = {k: 0.0 for k in STAGE_KEYS.values()}
        key = STAGE_KEYS.get(stage)
        if key:
            channels[ch][key] += weight

    rows = []
    for ch, s in channels.items():
        li, pi, ci, co, pu = s["low_intent"], s["product_interest"], s["cart_intent"], s["checkout"], s["purchase"]
        total = li + pi + ci + co + pu
        qualified = ci + co + pu
        rows.append({
            "channel": ch,
            "funnel_markov_weight": total,
            "raw_markov_weight": raw_map.get(ch, 0.0),
            "low_intent_weight": li,
            "product_interest_weight": pi,
            "cart_intent_weight": ci,
            "checkout_weight": co,
            "purchase_weight": pu,
            "qualified_weight": qualified,
            "low_intent_drag_score": li / total if total > 0 else 0.0,
            "qualified_intent_share": qualified / total if total > 0 else 0.0,
            "markov_excl_low_intent": 0.0,  # filled below
        })

    # Renormalize weights excluding Low Intent states
    total_excl_li = sum(r["funnel_markov_weight"] - r["low_intent_weight"] for r in rows)
    for r in rows:
        excl = r["funnel_markov_weight"] - r["low_intent_weight"]
        r["markov_excl_low_intent"] = excl / total_excl_li if total_excl_li > 0 else 0.0

    return sorted(rows, key=lambda r: r["funnel_markov_weight"], reverse=True)


@router.get("/{model_run_id}/funnel-validation", response_model=TableResponse)
def get_funnel_validation(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    """
    Sprint 16 — Funnel Attribution Validation.

    Per-channel intent composition: low_intent_drag_score, qualified_intent_share,
    per-stage weights, and markov_excl_low_intent (weight without Low Intent states).
    """
    import pandas as pd  # noqa: F401

    _ensure_run_exists(model_run_id, session)
    state_df = get_model_run_table(model_run_id, "funnel_state_attribution", session=session)
    if state_df.empty:
        return {"model_run_id": model_run_id, "table": "funnel_validation", "rows": []}

    raw_df = get_model_run_table(model_run_id, "attribution_results", session=session)
    raw_map: dict = {}
    if not raw_df.empty and "model_type" in raw_df.columns:
        raw_rows = raw_df[raw_df["model_type"] == "raw"]
        if not raw_rows.empty:
            raw_map = dict(zip(raw_rows["channel"], raw_rows["markov_weight"].fillna(0.0)))

    rows = _compute_funnel_validation(state_df, raw_map)
    return {"model_run_id": model_run_id, "table": "funnel_validation", "rows": rows}


# ---------------------------------------------------------------------------
# Sprint 14 — Sequential Effects
# ---------------------------------------------------------------------------

@router.get("/{model_run_id}/sequential-effects", response_model=TableResponse)
def get_sequential_effects(
    model_run_id: int,
    previous_channel: str | None = None,
    label: str | None = None,
    session: Session = Depends(get_db_session),
):
    """Order-2 conditional conversion probabilities for all bigram pairs."""
    _ensure_run_exists(model_run_id, session)
    df = get_model_run_table(model_run_id, "sequential_effects", session=session)
    if not df.empty and previous_channel:
        df = df[df["previous_channel"] == previous_channel]
    if not df.empty and label:
        df = df[df["diagnostic_label"] == label]
    rows = [] if df.empty else df.to_dict("records")
    return {"model_run_id": model_run_id, "table": "sequential_effects", "rows": rows}


@router.get("/{model_run_id}/export")
def get_export(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    _ensure_run_exists(model_run_id, session)
    exports = get_model_run_table(model_run_id, "exports", session=session)
    return JSONResponse(
        {
            "model_run_id": model_run_id,
            "exports": [] if exports.empty else exports.to_dict("records"),
            "note": "Excel generation from persisted rows will be completed after API MVP.",
        }
    )


@router.post("/{model_run_id}/export")
def register_model_run_export(
    model_run_id: int,
    export_type: str,
    file_path: str,
    session: Session = Depends(get_db_session),
):
    _ensure_run_exists(model_run_id, session)
    export_id = register_export(
        model_run_id=model_run_id,
        export_type=export_type,
        file_path=str(Path(file_path)),
        session=session,
    )
    return {"id": export_id, "model_run_id": model_run_id}


def _table_response(model_run_id: int, table: str, session: Session) -> dict:
    _ensure_run_exists(model_run_id, session)
    df = get_model_run_table(model_run_id, table, session=session)
    rows = [] if df.empty else df.to_dict("records")
    return {"model_run_id": model_run_id, "table": table, "rows": rows}


def _ensure_run_exists(model_run_id: int, session: Session) -> None:
    if get_model_run(model_run_id, session=session) is None:
        raise HTTPException(status_code=404, detail="Model run not found.")


def _run_model_in_background(
    model_run_id: int,
    params: ModelRunParams,
    database_url: str,
) -> None:
    try:
        mark_model_run_running(model_run_id, database_url=database_url)
        result = run_model(params=params)
        save_model_run(result, model_run_id=model_run_id, database_url=database_url)
    except Exception as exc:
        mark_model_run_failed(
            model_run_id,
            error_message=str(exc),
            database_url=database_url,
        )
