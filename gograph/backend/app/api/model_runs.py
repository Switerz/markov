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


@router.get("/{model_run_id}/channels", response_model=TableResponse)
def get_channels(
    model_run_id: int,
    session: Session = Depends(get_db_session),
):
    _ensure_run_exists(model_run_id, session)
    import pandas as pd
    attribution = get_model_run_table(model_run_id, "attribution_results", session=session)
    transitions = get_model_run_table(model_run_id, "transition_counts", session=session)

    spend_df = (
        attribution[["channel", "spend"]].copy()
        if not attribution.empty and "spend" in attribution.columns
        else pd.DataFrame(columns=["channel", "spend"])
    )
    first_last = compute_first_last_click_roas(transitions, spend_df)

    if not first_last.empty and not attribution.empty:
        attribution = attribution.merge(first_last, on="channel", how="left")

    return {
        "model_run_id": model_run_id,
        "table": "attribution_results",
        "rows": attribution.to_dict("records") if not attribution.empty else [],
    }


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
