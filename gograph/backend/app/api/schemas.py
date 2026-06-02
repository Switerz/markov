"""Pydantic request/response schemas for the GoGraph API."""

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ModelRunCreateRequest(BaseModel):
    start_date: str
    end_date: str
    lookback_days: int = 30
    decay_lambda: float = 0.05
    non_conv_sample_pct: int = 1
    non_conv_scale: Optional[float] = None
    shapley_samples: int = 5000
    db_plausible: int = 70
    db_datamart: Optional[int] = 63
    batch_mode: str = "auto"
    batch_days: int = 35


class ModelRunOverviewResponse(BaseModel):
    id: int
    start_date: str
    end_date: str
    created_at: Optional[str]
    status: str
    parameters: Dict[str, Any]
    observed_conversion_rate: Optional[float]
    model_conversion_rate: float
    total_revenue: float
    total_spend: float
    runtime_seconds: float
    error_message: Optional[str] = None


class TableResponse(BaseModel):
    model_run_id: int
    table: str
    rows: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Sandbox schemas
# ---------------------------------------------------------------------------

class SandboxNode(BaseModel):
    id: str
    label: str
    is_hypothetical: bool = False
    position: Optional[Dict[str, Any]] = None


class SandboxEdge(BaseModel):
    id: str
    source: str
    target: str


class ScenarioCreateRequest(BaseModel):
    model_run_id: int
    name: str
    description: Optional[str] = None
    nodes: list[SandboxNode] = Field(default_factory=list)
    edges: list[SandboxEdge] = Field(default_factory=list)
    path_channels: list[str] = Field(default_factory=list)


class ScenarioUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[list[SandboxNode]] = None
    edges: Optional[list[SandboxEdge]] = None
    path_channels: Optional[list[str]] = None


class ScenarioResponse(BaseModel):
    id: int
    model_run_id: int
    name: str
    description: Optional[str]
    nodes: list[Dict[str, Any]]
    edges: list[Dict[str, Any]]
    path_channels: list[str]
    created_at: Optional[str]
    updated_at: Optional[str]


class ScenarioAnalysisResponse(BaseModel):
    scenario_id: int
    path_channels: list[str]
    path_probability: Optional[float]
    conversion_probability_given_last_node: Optional[float]
    composite_conversion_probability: Optional[float]
    expected_revenue: Optional[float]
    expected_ticket: Optional[float]
    historical_support: int
    similar_paths: list[Dict[str, Any]]
    warnings: list[str]
    confidence_score: Optional[float]
