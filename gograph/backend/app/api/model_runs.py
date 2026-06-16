"""Model run API endpoints."""

from datetime import datetime, timezone
import math
from pathlib import Path

import config
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from gograph.backend.app.api.dashboard_schemas import (
    AllocationPointData,
    BudgetChannelRow,
    BudgetDashboardResponse,
    BudgetDrawerData,
    BudgetSummaryCard,
    ConfidencePanelData,
    ConsensusMatrixData,
    ConsensusPointData,
    JourneyColumnItem,
    JourneySummaryData,
    MetricCardData,
    MetricDelta,
    OverviewDashboardResponse,
    ResponseMeta,
)
from gograph.backend.app.api.deps import get_db_session
from gograph.backend.app.api.row_schemas import (
    ChannelMetricRow,
    ChannelRecommendationRow,
    DataQualityRow,
    DiagnosticRow,
    FunnelAttributionRow,
    FunnelValidationRow,
    InsightRow,
    LoopDiagnosticRow,
    ModelRunInputRow,
    ModelRunLogRow,
    ModelRunSummaryRow,
    PathRow,
    SequentialEffectRow,
    SessionQualityRow,
    TouchpointRow,
    TransitionRow,
    recommendation_row_from_orm,
)
from gograph.backend.app.api.schemas import (
    ModelRunCreateRequest,
    ModelRunOverviewResponse,
    TableResponse,
)
from gograph.backend.app.schemas import ModelRunParams
from gograph.backend.app.db.models import (
    AttributionResult,
    ChannelDiagnostic,
    ChannelRecommendation,
    DataQualityCheck,
    ModelRun,
    ModelRunInput,
    ModelRunLog,
    ModelRunSummary,
    PathSummary,
    TransitionCount,
)
from gograph.backend.app.services.journey_insight_service import (
    compute_touchpoint_metrics,
    generate_channel_insights,
)
from gograph.backend.app.services.roas_service import compute_first_last_click_roas
from gograph.backend.app.services.journey_graph_service import build_journey_graph
from gograph.backend.app.services.log_service import run_logged_step
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


@router.get("/{model_run_id}/summary", response_model=ModelRunSummaryRow)
def get_summary(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> ModelRunSummaryRow:
    _ensure_run_exists(model_run_id, session)
    row = session.get(ModelRunSummary, model_run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Model run summary not found.")
    return ModelRunSummaryRow.model_validate(row)


@router.get("/{model_run_id}/recommendations", response_model=list[ChannelRecommendationRow])
def get_recommendations(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> list[ChannelRecommendationRow]:
    _ensure_run_exists(model_run_id, session)
    rows = session.execute(
        select(ChannelRecommendation)
        .where(ChannelRecommendation.model_run_id == model_run_id)
        .order_by(ChannelRecommendation.priority_rank)
    ).scalars().all()
    return [recommendation_row_from_orm(row) for row in rows]


@router.get("/{model_run_id}/dashboard/overview", response_model=OverviewDashboardResponse)
def get_dashboard_overview(
    model_run_id: int,
    compare_run_id: int | None = None,
    session: Session = Depends(get_db_session),
) -> OverviewDashboardResponse:
    run = _get_completed_run_or_404(model_run_id, session)
    compare_summary = _validate_compare_run(compare_run_id, session) if compare_run_id else None
    summary = _get_summary_or_404(model_run_id, session)
    recs = _get_recommendation_rows(model_run_id, session)
    metrics = _primary_attribution_rows(model_run_id, session)
    diagnostics = _diagnostic_map(model_run_id, session)
    paths = _top_paths(model_run_id, session)
    transitions = _transition_rows(model_run_id, session)

    return OverviewDashboardResponse(
        meta=_response_meta(run.id, compare_run_id),
        summary=ModelRunSummaryRow.model_validate(summary),
        metric_strip=_metric_strip(summary, recs, compare_summary),
        priority_decisions=recs[:5],
        model_consensus=_consensus_matrix(metrics, recs),
        journey_summary=_journey_summary(transitions, paths),
        analysis_confidence=_confidence_panel(summary, model_run_id, session),
        footer_note="Valores calculados a partir da execucao persistida do modelo; deltas usam compare_run_id quando informado.",
    )


@router.get("/{model_run_id}/dashboard/budget", response_model=BudgetDashboardResponse)
def get_dashboard_budget(
    model_run_id: int,
    compare_run_id: int | None = None,
    channel: str | None = None,
    session: Session = Depends(get_db_session),
) -> BudgetDashboardResponse:
    run = _get_completed_run_or_404(model_run_id, session)
    _validate_compare_run(compare_run_id, session) if compare_run_id else None
    summary = _get_summary_or_404(model_run_id, session)
    recs = _get_recommendation_rows(model_run_id, session)
    metrics = _primary_attribution_rows(model_run_id, session)
    diagnostics = _diagnostic_map(model_run_id, session)
    channels = _budget_channel_rows(metrics, recs, diagnostics)
    selected = channel or (channels[0].channel if channels else None)

    return BudgetDashboardResponse(
        meta=_response_meta(run.id, compare_run_id),
        summary_cards=_budget_summary_cards(recs),
        allocation_matrix=_allocation_matrix(metrics, recs, summary),
        opportunities_and_risks={
            "opportunities": [rec for rec in recs if (rec.suggested_budget_delta_value or 0) > 0][:3],
            "risks": [rec for rec in recs if (rec.suggested_budget_delta_value or 0) < 0][:2],
        },
        channels_table=channels,
        selected_channel_drawer=_budget_drawer(selected, recs) if selected else None,
    )


def _get_channels_by_type(
    model_run_id: int,
    model_type: str,
    session: Session,
) -> TableResponse[ChannelMetricRow]:
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

    records: list[dict] = [] if primary.empty else primary.to_dict("records")
    return TableResponse[ChannelMetricRow](
        model_run_id=model_run_id,
        table="attribution_results",
        rows=_rows_to_models(records, ChannelMetricRow),
    )


@router.get("/{model_run_id}/channels", response_model=TableResponse[ChannelMetricRow])
def get_channels(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[ChannelMetricRow]:
    """Primary attribution — funnel model when active, raw otherwise.

    Includes PFC fields (`pfc_weight`, `pfc_delta_pp`) when persisted on
    AttributionResult; `None` otherwise.
    """
    return _get_channels_by_type(model_run_id, "funnel", session)


@router.get("/{model_run_id}/raw-channels", response_model=TableResponse[ChannelMetricRow])
def get_raw_channels(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[ChannelMetricRow]:
    """Raw Channel Markov baseline (always order-1, no event enrichment)."""
    return _get_channels_by_type(model_run_id, "raw", session)


@router.get("/{model_run_id}/diagnostics", response_model=TableResponse[DiagnosticRow])
def get_diagnostics(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[DiagnosticRow]:
    return _typed_table_response(model_run_id, "channel_diagnostics", session, DiagnosticRow)


@router.get("/{model_run_id}/insights", response_model=TableResponse[InsightRow])
def get_insights(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[InsightRow]:
    _ensure_run_exists(model_run_id, session)
    attribution = get_model_run_table(model_run_id, "attribution_results", session=session)
    transitions = get_model_run_table(model_run_id, "transition_counts", session=session)
    touchpoints = compute_touchpoint_metrics(transitions)
    insights = generate_channel_insights(attribution, touchpoints)
    records: list[dict] = [] if insights.empty else insights.to_dict("records")
    return TableResponse[InsightRow](
        model_run_id=model_run_id,
        table="insights",
        rows=_rows_to_models(records, InsightRow),
    )


@router.get("/{model_run_id}/touchpoints", response_model=TableResponse[TouchpointRow])
def get_touchpoints(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[TouchpointRow]:
    _ensure_run_exists(model_run_id, session)
    transitions = get_model_run_table(model_run_id, "transition_counts", session=session)
    touchpoints = compute_touchpoint_metrics(transitions)
    records: list[dict] = [] if touchpoints.empty else touchpoints.to_dict("records")
    return TableResponse[TouchpointRow](
        model_run_id=model_run_id,
        table="touchpoints",
        rows=_rows_to_models(records, TouchpointRow),
    )


@router.get("/{model_run_id}/transitions", response_model=TableResponse[TransitionRow])
def get_transitions(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[TransitionRow]:
    return _typed_table_response(model_run_id, "transition_counts", session, TransitionRow)


@router.get("/{model_run_id}/paths", response_model=TableResponse[PathRow])
def get_paths(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[PathRow]:
    return _typed_table_response(model_run_id, "path_summary", session, PathRow)


@router.get("/{model_run_id}/loops", response_model=TableResponse[PathRow])
def get_loops(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[PathRow]:
    _ensure_run_exists(model_run_id, session)
    paths = get_model_run_table(model_run_id, "path_summary", session=session)
    if paths.empty or "contains_loop" not in paths.columns:
        records: list[dict] = []
    else:
        records = paths[paths["contains_loop"].fillna(0).astype(int) == 1].to_dict("records")
    return TableResponse[PathRow](
        model_run_id=model_run_id,
        table="loops",
        rows=_rows_to_models(records, PathRow),
    )


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


@router.get("/{model_run_id}/data-quality", response_model=TableResponse[DataQualityRow])
def get_data_quality(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[DataQualityRow]:
    return _typed_table_response(model_run_id, "data_quality_checks", session, DataQualityRow)


@router.get("/{model_run_id}/inputs", response_model=list[ModelRunInputRow])
def get_inputs(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> list[ModelRunInputRow]:
    _ensure_run_exists(model_run_id, session)
    rows = session.execute(
        select(ModelRunInput)
        .where(ModelRunInput.model_run_id == model_run_id)
        .order_by(ModelRunInput.extracted_at.asc(), ModelRunInput.id.asc())
    ).scalars().all()
    return [ModelRunInputRow.model_validate(_orm_public_dict(row)) for row in rows]


@router.get("/{model_run_id}/logs", response_model=list[ModelRunLogRow])
def get_logs(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> list[ModelRunLogRow]:
    _ensure_run_exists(model_run_id, session)
    rows = session.execute(
        select(ModelRunLog)
        .where(ModelRunLog.model_run_id == model_run_id)
        .order_by(ModelRunLog.created_at.asc(), ModelRunLog.id.asc())
    ).scalars().all()
    return [ModelRunLogRow.model_validate(_orm_public_dict(row)) for row in rows]


# ---------------------------------------------------------------------------
# Sprint 11 — Loop diagnostics
# ---------------------------------------------------------------------------

@router.get("/{model_run_id}/loop-diagnostics", response_model=TableResponse[LoopDiagnosticRow])
def get_loop_diagnostics(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[LoopDiagnosticRow]:
    """Per-channel loop statistics: self-loop rates, conversion lift, exit distribution."""
    return _typed_table_response(model_run_id, "loop_diagnostics", session, LoopDiagnosticRow)


# ---------------------------------------------------------------------------
# Sprint 13 — Funnel Stage Attribution
# ---------------------------------------------------------------------------

@router.get("/{model_run_id}/funnel-attribution", response_model=TableResponse[FunnelAttributionRow])
def get_funnel_attribution(
    model_run_id: int,
    channel: str | None = None,
    session: Session = Depends(get_db_session),
) -> TableResponse[FunnelAttributionRow]:
    """Markov/Shapley attribution per composite state (channel / funnel_stage)."""
    _ensure_run_exists(model_run_id, session)
    df = get_model_run_table(model_run_id, "funnel_state_attribution", session=session)
    if not df.empty and channel:
        df = df[df["channel"] == channel]
    records: list[dict] = [] if df.empty else df.to_dict("records")
    return TableResponse[FunnelAttributionRow](
        model_run_id=model_run_id,
        table="funnel_state_attribution",
        rows=_rows_to_models(records, FunnelAttributionRow),
    )


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


@router.get("/{model_run_id}/funnel-validation", response_model=TableResponse[FunnelValidationRow])
def get_funnel_validation(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[FunnelValidationRow]:
    """
    Sprint 16 — Funnel Attribution Validation.

    Per-channel intent composition: low_intent_drag_score, qualified_intent_share,
    per-stage weights, and markov_excl_low_intent (weight without Low Intent states).
    """
    import pandas as pd  # noqa: F401

    _ensure_run_exists(model_run_id, session)
    state_df = get_model_run_table(model_run_id, "funnel_state_attribution", session=session)
    if state_df.empty:
        return TableResponse[FunnelValidationRow](
            model_run_id=model_run_id, table="funnel_validation", rows=[]
        )

    raw_df = get_model_run_table(model_run_id, "attribution_results", session=session)
    raw_map: dict = {}
    if not raw_df.empty and "model_type" in raw_df.columns:
        raw_rows = raw_df[raw_df["model_type"] == "raw"]
        if not raw_rows.empty:
            raw_map = dict(zip(raw_rows["channel"], raw_rows["markov_weight"].fillna(0.0)))

    records = _compute_funnel_validation(state_df, raw_map)
    return TableResponse[FunnelValidationRow](
        model_run_id=model_run_id,
        table="funnel_validation",
        rows=_rows_to_models(records, FunnelValidationRow),
    )


# ---------------------------------------------------------------------------
# Sprint 14 — Sequential Effects
# ---------------------------------------------------------------------------

@router.get("/{model_run_id}/session-quality", response_model=TableResponse[SessionQualityRow])
def get_session_quality(
    model_run_id: int,
    session: Session = Depends(get_db_session),
) -> TableResponse[SessionQualityRow]:
    """Per-channel session engagement metrics: duration, pageviews, bounce rate, events."""
    return _typed_table_response(model_run_id, "session_quality", session, SessionQualityRow)


@router.get("/{model_run_id}/sequential-effects", response_model=TableResponse[SequentialEffectRow])
def get_sequential_effects(
    model_run_id: int,
    previous_channel: str | None = None,
    label: str | None = None,
    session: Session = Depends(get_db_session),
) -> TableResponse[SequentialEffectRow]:
    """Order-2 conditional conversion probabilities for all bigram pairs."""
    _ensure_run_exists(model_run_id, session)
    df = get_model_run_table(model_run_id, "sequential_effects", session=session)
    if not df.empty and previous_channel:
        df = df[df["previous_channel"] == previous_channel]
    if not df.empty and label:
        df = df[df["diagnostic_label"] == label]
    records: list[dict] = [] if df.empty else df.to_dict("records")
    return TableResponse[SequentialEffectRow](
        model_run_id=model_run_id,
        table="sequential_effects",
        rows=_rows_to_models(records, SequentialEffectRow),
    )


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


def _get_completed_run_or_404(model_run_id: int, session: Session) -> ModelRun:
    run = session.get(ModelRun, model_run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Model run not found.")
    if run.status != "completed":
        raise HTTPException(status_code=422, detail="model_run_id is not a completed run")
    return run


def _validate_compare_run(compare_run_id: int | None, session: Session) -> ModelRunSummary | None:
    if compare_run_id is None:
        return None
    run = session.get(ModelRun, compare_run_id)
    if run is None:
        raise HTTPException(status_code=422, detail="compare_run_id not found")
    if run.status != "completed":
        raise HTTPException(status_code=422, detail="compare_run_id is not a completed run")
    return session.get(ModelRunSummary, compare_run_id)


def _get_summary_or_404(model_run_id: int, session: Session) -> ModelRunSummary:
    summary = session.get(ModelRunSummary, model_run_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Model run summary not found.")
    return summary


def _get_recommendation_rows(model_run_id: int, session: Session) -> list[ChannelRecommendationRow]:
    rows = session.execute(
        select(ChannelRecommendation)
        .where(ChannelRecommendation.model_run_id == model_run_id)
        .order_by(ChannelRecommendation.priority_rank)
    ).scalars().all()
    return [recommendation_row_from_orm(row) for row in rows]


def _response_meta(run_id: int, compare_run_id: int | None) -> ResponseMeta:
    return ResponseMeta(
        model_version="markov-shapley-pfc/v1",
        code_version="local",
        generated_at=datetime.now(timezone.utc).isoformat(),
        run_id=run_id,
        compare_run_id=compare_run_id,
    )


def _metric_strip(
    summary: ModelRunSummary,
    recs: list[ChannelRecommendationRow],
    compare: ModelRunSummary | None,
) -> list[MetricCardData]:
    roas = summary.total_revenue / summary.total_spend if summary.total_spend else None
    compare_roas = (
        compare.total_revenue / compare.total_spend
        if compare is not None and compare.total_spend
        else None
    )
    opportunities = sum(max(rec.estimated_revenue_delta or 0.0, 0.0) for rec in recs)
    misallocated = sum(
        abs(rec.suggested_budget_delta_value or 0.0)
        for rec in recs
        if (rec.suggested_budget_delta_value or 0.0) < 0
    )
    return [
        _metric("revenue", "Receita analisada", summary.total_revenue, "blue", compare.total_revenue if compare else None),
        _metric("spend", "Investimento em midia", summary.total_spend, "indigo", compare.total_spend if compare else None),
        _metric("roas", "ROAS atribuido", roas, "cyan", compare_roas),
        _metric(
            "conversion_rate",
            "Taxa de conversao modelada",
            summary.model_conversion_rate,
            "blue",
            compare.model_conversion_rate if compare else None,
        ),
        _metric("scale_opportunities", "Oportunidades de escala", opportunities, "green", None),
        _metric("misallocated_budget", "Budget mal alocado", misallocated, "orange", None),
    ]


def _metric(
    metric_id: str,
    label: str,
    value: float | None,
    tone: str,
    compare_value: float | None,
) -> MetricCardData:
    return MetricCardData(
        id=metric_id,
        label=label,
        value=value,
        tone=tone,
        delta=_delta(value, compare_value) if compare_value is not None else None,
    )


def _delta(value: float | None, compare_value: float | None) -> MetricDelta:
    if value is None or compare_value is None:
        return MetricDelta(value=None, pct=None)
    diff = value - compare_value
    pct = diff / compare_value if compare_value else None
    return MetricDelta(value=diff, pct=pct)


def _primary_attribution_rows(model_run_id: int, session: Session) -> list[AttributionResult]:
    run = session.get(ModelRun, model_run_id)
    preferred = "funnel" if run and run.funnel_model_active else "raw"
    rows = session.execute(
        select(AttributionResult).where(
            AttributionResult.model_run_id == model_run_id,
            AttributionResult.model_type == preferred,
        )
    ).scalars().all()
    if rows:
        return rows
    return session.execute(
        select(AttributionResult).where(AttributionResult.model_run_id == model_run_id)
    ).scalars().all()


def _diagnostic_map(model_run_id: int, session: Session) -> dict[str, ChannelDiagnostic]:
    rows = session.execute(
        select(ChannelDiagnostic).where(ChannelDiagnostic.model_run_id == model_run_id)
    ).scalars().all()
    return {row.channel: row for row in rows}


def _top_paths(model_run_id: int, session: Session) -> list[PathSummary]:
    return session.execute(
        select(PathSummary)
        .where(PathSummary.model_run_id == model_run_id)
        .order_by(PathSummary.count.desc().nullslast())
        .limit(5)
    ).scalars().all()


def _transition_rows(model_run_id: int, session: Session) -> list[TransitionCount]:
    return session.execute(
        select(TransitionCount).where(TransitionCount.model_run_id == model_run_id)
    ).scalars().all()


def _consensus_matrix(
    metrics: list[AttributionResult],
    recs: list[ChannelRecommendationRow],
) -> ConsensusMatrixData:
    tones = {rec.channel: rec.recommendation_tone for rec in recs}
    points = [
        ConsensusPointData(
            channel=row.channel,
            markov_weight_pct=(row.markov_weight or 0.0) * 100,
            shapley_weight_pct=(row.shapley_weight or 0.0) * 100,
            spend=row.spend or 0.0,
            revenue=row.markov_revenue or 0.0,
            recommendation_tone=tones.get(row.channel),
        )
        for row in metrics
    ]
    return ConsensusMatrixData(
        axes={"x": "Markov", "y": "Shapley"},
        points=points,
    )


def _journey_summary(
    transitions: list[TransitionCount],
    paths: list[PathSummary],
) -> JourneySummaryData:
    converting = [row for row in transitions if row.transition_type == "converting"]
    entries = _ranked_transition_share(
        [(row.to_state, row.n) for row in converting if row.from_state == "(start)"]
    )
    assistants = _ranked_transition_share(
        [
            (row.to_state, row.n)
            for row in converting
            if row.from_state != "(start)" and row.to_state not in {"Conversion", "Non-Conversion"}
        ]
    )
    closers = _ranked_transition_share(
        [(row.from_state, row.n) for row in converting if row.to_state == "Conversion"]
    )
    total = sum(row.n or 0.0 for row in converting)
    entry_total = sum(row.n or 0.0 for row in converting if row.from_state == "(start)")
    assisted_total = sum(
        row.n or 0.0
        for row in converting
        if row.from_state != "(start)" and row.to_state not in {"Conversion", "Non-Conversion"}
    )
    closer_total = sum(row.n or 0.0 for row in converting if row.to_state == "Conversion")
    return JourneySummaryData(
        top_entries=entries,
        top_assistants=assistants,
        top_closers=closers,
        flow_stages=[
            JourneyColumnItem(name="Entrada", value=1.0 if entry_total else 0.0),
            JourneyColumnItem(name="Assistidos", value=assisted_total / total if total else 0.0),
            JourneyColumnItem(name="Conversoes", value=closer_total / total if total else 0.0),
        ],
        top_paths=[
            {
                "path_text": row.path_text,
                "count": row.count,
                "conversion_rate": row.conversion_rate,
                "revenue": row.revenue,
            }
            for row in paths
        ],
    )


def _ranked_transition_share(items: list[tuple[str, float | None]]) -> list[JourneyColumnItem]:
    totals: dict[str, float] = {}
    for name, value in items:
        if name in {"(start)", "Conversion", "Non-Conversion"}:
            continue
        totals[name] = totals.get(name, 0.0) + float(value or 0.0)
    denom = sum(totals.values())
    return [
        JourneyColumnItem(name=name, value=value / denom if denom else 0.0)
        for name, value in sorted(totals.items(), key=lambda item: item[1], reverse=True)[:5]
    ]


def _confidence_panel(
    summary: ModelRunSummary,
    model_run_id: int,
    session: Session,
) -> ConfidencePanelData:
    gap = None
    if summary.observed_conversion_rate is not None:
        gap = (summary.observed_conversion_rate - summary.model_conversion_rate) * 100
    checks = session.execute(
        select(DataQualityCheck).where(DataQualityCheck.model_run_id == model_run_id)
    ).scalars().all()
    if checks:
        ok = sum(1 for check in checks if check.status.lower() in {"pass", "passed", "ok", "green", "success"})
        data_quality = ok / len(checks)
    else:
        data_quality = None
    return ConfidencePanelData(
        score=summary.confidence_score,
        label=summary.confidence_label,
        calibration_gap_pp=gap,
        data_quality_score=data_quality,
    )


def _budget_summary_cards(recs: list[ChannelRecommendationRow]) -> list[BudgetSummaryCard]:
    specs = [
        ("scale", "Escalar", "green"),
        ("defend", "Defender", "orange"),
        ("investigate", "Investigar", "blue"),
        ("reduce", "Reduzir", "red"),
    ]
    cards: list[BudgetSummaryCard] = []
    for card_id, label, tone in specs:
        selected = [rec for rec in recs if rec.recommendation == label]
        cards.append(
            BudgetSummaryCard(
                id=card_id,
                label=label,
                count=len(selected),
                estimated_revenue_delta=sum(rec.estimated_revenue_delta or 0.0 for rec in selected),
                tone=tone,
            )
        )
    return cards


def _allocation_matrix(
    metrics: list[AttributionResult],
    recs: list[ChannelRecommendationRow],
    summary: ModelRunSummary,
) -> list[AllocationPointData]:
    rec_map = {rec.channel: rec for rec in recs}
    total_spend = summary.total_spend or sum(row.spend or 0.0 for row in metrics)
    total_revenue = summary.total_revenue or sum(row.markov_revenue or 0.0 for row in metrics)
    points: list[AllocationPointData] = []
    for row in metrics:
        rec = rec_map.get(row.channel)
        revenue = row.markov_revenue or 0.0
        points.append(
            AllocationPointData(
                channel=row.channel,
                spend_share_pct=((row.spend or 0.0) / total_spend * 100) if total_spend else 0.0,
                revenue_share_pct=(revenue / total_revenue * 100) if total_revenue else 0.0,
                revenue=revenue,
                recommendation=rec.recommendation if rec else "Investigar",
                tone=rec.recommendation_tone if rec else "blue",
            )
        )
    return points


def _budget_channel_rows(
    metrics: list[AttributionResult],
    recs: list[ChannelRecommendationRow],
    diagnostics: dict[str, ChannelDiagnostic],
) -> list[BudgetChannelRow]:
    rec_map = {rec.channel: rec for rec in recs}
    rows: list[BudgetChannelRow] = []
    for metric in metrics:
        rec = rec_map.get(metric.channel)
        diagnostic = diagnostics.get(metric.channel)
        markov = metric.markov_weight or 0.0
        shapley = metric.shapley_weight or 0.0
        consensus = max(0.0, min(1.0, 1.0 - abs(markov - shapley) * 5.0))
        presence = max(
            diagnostic.presence_converting or 0.0 if diagnostic else 0.0,
            diagnostic.presence_nonconverting or 0.0 if diagnostic else 0.0,
        )
        rows.append(
            BudgetChannelRow(
                channel=metric.channel,
                recommendation=rec.recommendation if rec else "Investigar",
                tone=rec.recommendation_tone if rec else "blue",
                spend=metric.spend or 0.0,
                revenue=metric.markov_revenue or 0.0,
                roas_markov=metric.roas_markov,
                roas_shapley=metric.roas_shapley,
                consensus_score=consensus,
                role=diagnostic.channel_role if diagnostic else None,
                presence_score=presence,
                suggested_budget_delta_pct=rec.suggested_budget_delta_pct if rec else None,
                suggested_budget_delta_value=rec.suggested_budget_delta_value if rec else None,
                estimated_revenue_delta=rec.estimated_revenue_delta if rec else None,
            )
        )
    rows.sort(key=lambda row: abs(row.estimated_revenue_delta or 0.0), reverse=True)
    return rows


def _budget_drawer(
    channel: str,
    recs: list[ChannelRecommendationRow],
) -> BudgetDrawerData | None:
    rec = next((item for item in recs if item.channel == channel), None)
    if rec is None:
        return None
    return BudgetDrawerData(
        channel=rec.channel,
        recommendation=rec.recommendation,
        tone=rec.recommendation_tone,
        rationale=rec.rationale,
        risks=rec.risks,
        best_practices=rec.best_practices,
        suggested_budget_delta_pct=rec.suggested_budget_delta_pct,
        suggested_budget_delta_value=rec.suggested_budget_delta_value,
        estimated_revenue_delta=rec.estimated_revenue_delta,
        estimated_roas_min=rec.estimated_roas_min,
        estimated_roas_max=rec.estimated_roas_max,
    )


def _clean_row(row: dict) -> dict:
    """Replace NaN / pandas NA scalars with None so Pydantic Optional fields accept them."""
    cleaned: dict = {}
    for key, value in row.items():
        if isinstance(value, float) and math.isnan(value):
            cleaned[key] = None
        else:
            cleaned[key] = value
    return cleaned


def _orm_public_dict(row: object) -> dict:
    data = {}
    for column in row.__table__.columns:  # type: ignore[attr-defined]
        value = getattr(row, column.name)
        if hasattr(value, "isoformat"):
            value = value.isoformat()
        data[column.name] = value
    return data


def _rows_to_models(records: list[dict], model: type[BaseModel]) -> list[BaseModel]:
    return [model.model_validate(_clean_row(r)) for r in records]


def _typed_table_response(
    model_run_id: int,
    table: str,
    session: Session,
    row_model: type[BaseModel],
) -> TableResponse:
    """Generic helper: fetch table, validate rows against `row_model`, return TableResponse."""
    _ensure_run_exists(model_run_id, session)
    df = get_model_run_table(model_run_id, table, session=session)
    records: list[dict] = [] if df.empty else df.to_dict("records")
    return TableResponse[row_model](  # type: ignore[valid-type]
        model_run_id=model_run_id,
        table=table,
        rows=_rows_to_models(records, row_model),
    )


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
        result = run_model(
            params=params,
            model_run_id=model_run_id,
            database_url=database_url,
        )
        run_logged_step(
            database_url=database_url,
            model_run_id=model_run_id,
            step="persistence",
            fn=lambda: save_model_run(
                result,
                model_run_id=model_run_id,
                database_url=database_url,
            ),
        )
    except Exception as exc:
        mark_model_run_failed(
            model_run_id,
            error_message=str(exc),
            database_url=database_url,
        )
