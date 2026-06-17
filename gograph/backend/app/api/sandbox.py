"""Scenario API: typed sandbox CRUD, analysis and comparison."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from gograph.backend.app.api.deps import get_db_session
from gograph.backend.app.api.schemas import (
    ScenarioAnalysisResponse,
    ScenarioCompareRequest,
    ScenarioCompareResponse,
    ScenarioCreateRequest,
    ScenarioResponse,
    ScenarioUpdateRequest,
)
from gograph.backend.app.services.sandbox_service import (
    analyze_scenario,
    compare_scenarios,
    create_scenario,
    delete_scenario,
    get_scenario,
    list_scenarios,
    update_scenario,
)

router = APIRouter(tags=["scenarios"])


@router.get(
    "/model-runs/{model_run_id}/scenarios",
    response_model=list[ScenarioResponse],
)
def list_by_run(model_run_id: int, session: Session = Depends(get_db_session)):
    return list_scenarios(model_run_id=model_run_id, session=session)


@router.post(
    "/model-runs/{model_run_id}/scenarios",
    response_model=ScenarioResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_for_run(
    model_run_id: int,
    payload: ScenarioCreateRequest,
    session: Session = Depends(get_db_session),
):
    try:
        return create_scenario(
            model_run_id=model_run_id,
            name=payload.name,
            description=payload.description,
            nodes=[n.model_dump() for n in payload.nodes],
            edges=[e.model_dump() for e in payload.edges],
            path_channels=payload.path_channels,
            action_type=payload.action_type,
            channel=payload.channel,
            intensity_pct=payload.intensity_pct,
            period_start=payload.period_start,
            period_end=payload.period_end,
            session=session,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/scenarios/{scenario_id}", response_model=ScenarioResponse)
def get(scenario_id: int, session: Session = Depends(get_db_session)):
    row = get_scenario(scenario_id, session=session)
    if row is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    return row


@router.put("/scenarios/{scenario_id}", response_model=ScenarioResponse)
def update(
    scenario_id: int,
    payload: ScenarioUpdateRequest,
    session: Session = Depends(get_db_session),
):
    nodes = [n.model_dump() for n in payload.nodes] if payload.nodes is not None else None
    edges = [e.model_dump() for e in payload.edges] if payload.edges is not None else None
    try:
        row = update_scenario(
            scenario_id=scenario_id,
            name=payload.name,
            description=payload.description,
            nodes=nodes,
            edges=edges,
            path_channels=payload.path_channels,
            action_type=payload.action_type,
            channel=payload.channel,
            intensity_pct=payload.intensity_pct,
            period_start=payload.period_start,
            period_end=payload.period_end,
            session=session,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if row is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    return row


@router.delete("/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(scenario_id: int, session: Session = Depends(get_db_session)):
    if not delete_scenario(scenario_id, session=session):
        raise HTTPException(status_code=404, detail="Scenario not found.")


@router.post("/scenarios/{scenario_id}/analyze", response_model=ScenarioAnalysisResponse)
def analyze(scenario_id: int, session: Session = Depends(get_db_session)):
    try:
        return analyze_scenario(scenario_id=scenario_id, session=session)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post(
    "/model-runs/{model_run_id}/scenarios/compare",
    response_model=ScenarioCompareResponse,
)
def compare(
    model_run_id: int,
    payload: ScenarioCompareRequest,
    session: Session = Depends(get_db_session),
):
    try:
        return compare_scenarios(
            model_run_id=model_run_id,
            scenario_ids=payload.scenario_ids,
            include_baseline=payload.include_baseline,
            include_top_path=payload.include_top_path,
            baseline_run_id=payload.baseline_run_id,
            compare_run_id=payload.compare_run_id,
            session=session,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# Legacy `/sandbox/*` aliases. Kept as 308 redirects for one release.
@router.post("/sandbox/scenarios", include_in_schema=False)
def legacy_create(payload: ScenarioCreateRequest):
    if payload.model_run_id is None:
        raise HTTPException(status_code=422, detail="model_run_id is required.")
    return RedirectResponse(
        url=f"/model-runs/{payload.model_run_id}/scenarios",
        status_code=status.HTTP_308_PERMANENT_REDIRECT,
    )


@router.get("/sandbox/scenarios", include_in_schema=False)
def legacy_list(model_run_id: int):
    return RedirectResponse(
        url=f"/model-runs/{model_run_id}/scenarios",
        status_code=status.HTTP_308_PERMANENT_REDIRECT,
    )


@router.get("/sandbox/scenarios/{scenario_id}", include_in_schema=False)
def legacy_get(scenario_id: int):
    return RedirectResponse(
        url=f"/scenarios/{scenario_id}",
        status_code=status.HTTP_308_PERMANENT_REDIRECT,
    )


@router.put("/sandbox/scenarios/{scenario_id}", include_in_schema=False)
def legacy_update(scenario_id: int):
    return RedirectResponse(
        url=f"/scenarios/{scenario_id}",
        status_code=status.HTTP_308_PERMANENT_REDIRECT,
    )


@router.delete("/sandbox/scenarios/{scenario_id}", include_in_schema=False)
def legacy_delete(scenario_id: int):
    return RedirectResponse(
        url=f"/scenarios/{scenario_id}",
        status_code=status.HTTP_308_PERMANENT_REDIRECT,
    )


@router.post("/sandbox/scenarios/{scenario_id}/analyze", include_in_schema=False)
def legacy_analyze(scenario_id: int):
    return RedirectResponse(
        url=f"/scenarios/{scenario_id}/analyze",
        status_code=status.HTTP_308_PERMANENT_REDIRECT,
    )


@router.post("/sandbox/compare", include_in_schema=False)
def legacy_compare(payload: ScenarioCompareRequest):
    if payload.model_run_id is None:
        raise HTTPException(status_code=422, detail="model_run_id is required.")
    return RedirectResponse(
        url=f"/model-runs/{payload.model_run_id}/scenarios/compare",
        status_code=status.HTTP_308_PERMANENT_REDIRECT,
    )
