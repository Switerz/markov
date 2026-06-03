"""Sandbox API — scenario CRUD and path analysis."""

from fastapi import APIRouter, Depends, HTTPException
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

router = APIRouter(prefix="/sandbox", tags=["sandbox"])


@router.post("/scenarios", response_model=ScenarioResponse, status_code=201)
def create(payload: ScenarioCreateRequest, session: Session = Depends(get_db_session)):
    return create_scenario(
        model_run_id=payload.model_run_id,
        name=payload.name,
        description=payload.description,
        nodes=[n.model_dump() for n in payload.nodes],
        edges=[e.model_dump() for e in payload.edges],
        path_channels=payload.path_channels,
        session=session,
    )


@router.get("/scenarios", response_model=list[ScenarioResponse])
def list_by_run(model_run_id: int, session: Session = Depends(get_db_session)):
    return list_scenarios(model_run_id=model_run_id, session=session)


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
    row = update_scenario(
        scenario_id=scenario_id,
        name=payload.name,
        description=payload.description,
        nodes=nodes,
        edges=edges,
        path_channels=payload.path_channels,
        session=session,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    return row


@router.delete("/scenarios/{scenario_id}", status_code=204)
def delete(scenario_id: int, session: Session = Depends(get_db_session)):
    if not delete_scenario(scenario_id, session=session):
        raise HTTPException(status_code=404, detail="Scenario not found.")


@router.post("/scenarios/{scenario_id}/analyze", response_model=ScenarioAnalysisResponse)
def analyze(scenario_id: int, session: Session = Depends(get_db_session)):
    try:
        return analyze_scenario(scenario_id=scenario_id, session=session)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/compare", response_model=ScenarioCompareResponse)
def compare(payload: ScenarioCompareRequest, session: Session = Depends(get_db_session)):
    try:
        return compare_scenarios(
            model_run_id=payload.model_run_id,
            scenario_ids=payload.scenario_ids,
            include_baseline=payload.include_baseline,
            include_top_path=payload.include_top_path,
            session=session,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
