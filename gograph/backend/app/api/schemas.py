"""Pydantic request/response schemas for the GoGraph API."""

from datetime import date
from typing import Any, Dict, Generic, Literal, Optional, TypeVar

from pydantic import BaseModel, Field, model_validator

RowT = TypeVar("RowT", bound=BaseModel)


class ModelRunCreateRequest(BaseModel):
    start_date: str
    end_date: str
    lookback_days: Optional[int] = None  # None = use LOOKBACK_DAYS from .env
    decay_lambda: float = 0.05
    non_conv_sample_pct: int = 1
    non_conv_scale: Optional[float] = None
    shapley_samples: int = 5000
    db_plausible: int = 70
    db_datamart: Optional[int] = 63
    batch_mode: str = "auto"
    batch_days: int = 35
    censorship_days: Optional[int] = None  # None = use CENSORSHIP_DAYS from .env


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
    funnel_model_active: Optional[bool] = None


class TableResponse(BaseModel, Generic[RowT]):
    """Generic wrapper for endpoints returning a list of typed rows.

    Each endpoint declares `response_model=TableResponse[XRow]` where
    `XRow` is a Pydantic model defined in `api.row_schemas`.
    """

    model_run_id: int
    table: str
    rows: list[RowT] = Field(default_factory=list)


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


ScenarioActionType = Literal[
    "removeChannel",
    "reducePresence",
    "redistributeBudget",
    "compareModels",
    "path",
]


class ScenarioCreateRequest(BaseModel):
    model_run_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    action_type: ScenarioActionType = "path"
    channel: Optional[str] = None
    intensity_pct: Optional[float] = Field(default=None, ge=0, le=100)
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    nodes: list[SandboxNode] = Field(default_factory=list)
    edges: list[SandboxEdge] = Field(default_factory=list)
    path_channels: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_action_payload(self):
        if self.action_type == "removeChannel" and not self.channel:
            raise ValueError("channel is required for removeChannel scenarios.")
        if self.action_type == "reducePresence":
            if not self.channel:
                raise ValueError("channel is required for reducePresence scenarios.")
            if self.intensity_pct is None:
                raise ValueError("intensity_pct is required for reducePresence scenarios.")
        if self.action_type == "path" and (not self.nodes or not self.edges):
            raise ValueError("nodes and edges are required for path scenarios.")
        return self


class ScenarioUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    action_type: Optional[ScenarioActionType] = None
    channel: Optional[str] = None
    intensity_pct: Optional[float] = Field(default=None, ge=0, le=100)
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    nodes: Optional[list[SandboxNode]] = None
    edges: Optional[list[SandboxEdge]] = None
    path_channels: Optional[list[str]] = None


class ScenarioResponse(BaseModel):
    id: int
    model_run_id: int
    name: str
    description: Optional[str]
    action_type: str
    channel: Optional[str] = None
    intensity_pct: Optional[float] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    nodes: list[Dict[str, Any]]
    edges: list[Dict[str, Any]]
    path_channels: list[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    analysis: Optional["ScenarioAnalysisResponse"] = None


class ScenarioAnalysisResponse(BaseModel):
    scenario_id: int
    model_run_id: Optional[int] = None
    code_version: Optional[str] = None
    analyzed_at: Optional[str] = None
    path_channels: list[str]
    path_probability: Optional[float]
    conversion_probability_given_last_node: Optional[float]
    composite_conversion_probability: Optional[float]
    historical_conversion_rate: Optional[float]
    lift: Optional[float]
    expected_revenue: Optional[float]
    expected_ticket: Optional[float]
    historical_support: int
    similar_paths: list[Dict[str, Any]]
    warnings: list[str]
    confidence_score: Optional[float]


class ScenarioCompareRequest(BaseModel):
    model_run_id: Optional[int] = None
    scenario_ids: list[int] = Field(default_factory=list)
    include_baseline: bool = False
    include_top_path: bool = False
    baseline_run_id: Optional[int] = None
    compare_run_id: Optional[int] = None


class ScenarioCompareItem(BaseModel):
    source: str  # "scenario" | "baseline" | "top_real_path"
    scenario_id: Optional[int]
    name: str
    path_channels: list[str]
    path_probability: Optional[float]
    composite_conversion_probability: Optional[float]
    historical_conversion_rate: Optional[float]
    lift: Optional[float]
    expected_revenue: Optional[float]
    expected_ticket: Optional[float]
    historical_support: int
    confidence_score: Optional[float]
    warnings: list[str]


class ScenarioDelta(BaseModel):
    composite_conversion_delta: Optional[float]
    composite_conversion_pct: Optional[float]
    expected_revenue_delta: Optional[float]
    expected_revenue_pct: Optional[float]
    confidence_delta: Optional[float]
    historical_support_delta: Optional[int]


class ScenarioCompareResponse(BaseModel):
    items: list[ScenarioCompareItem]
    winner_conversion: Optional[str]
    winner_revenue: Optional[str]
    winner_confidence: Optional[str]
    delta: Optional[ScenarioDelta]
