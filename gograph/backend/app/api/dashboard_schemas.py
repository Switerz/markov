"""Aggregate dashboard response schemas."""

from __future__ import annotations

from pydantic import BaseModel

from gograph.backend.app.api.row_schemas import ChannelRecommendationRow, ModelRunSummaryRow


class ResponseMeta(BaseModel):
    model_version: str
    code_version: str
    generated_at: str
    run_id: int
    compare_run_id: int | None = None


class MetricDelta(BaseModel):
    value: float | None = None
    pct: float | None = None


class MetricCardData(BaseModel):
    id: str
    label: str
    value: float | None = None
    delta: MetricDelta | None = None
    tone: str


class ConsensusPointData(BaseModel):
    channel: str
    markov_weight_pct: float
    shapley_weight_pct: float
    spend: float
    revenue: float
    recommendation_tone: str | None = None


class ConsensusMatrixData(BaseModel):
    axes: dict[str, str]
    points: list[ConsensusPointData]


class JourneyColumnItem(BaseModel):
    name: str
    value: float


class JourneySummaryData(BaseModel):
    top_entries: list[JourneyColumnItem]
    top_assistants: list[JourneyColumnItem]
    top_closers: list[JourneyColumnItem]
    flow_stages: list[JourneyColumnItem]
    top_paths: list[dict[str, float | int | str | None]]


class ConfidencePanelData(BaseModel):
    score: float
    label: str
    calibration_gap_pp: float | None = None
    data_quality_score: float | None = None


class OverviewDashboardResponse(BaseModel):
    meta: ResponseMeta
    summary: ModelRunSummaryRow
    metric_strip: list[MetricCardData]
    priority_decisions: list[ChannelRecommendationRow]
    model_consensus: ConsensusMatrixData
    journey_summary: JourneySummaryData
    analysis_confidence: ConfidencePanelData
    footer_note: str


class BudgetSummaryCard(BaseModel):
    id: str
    label: str
    count: int
    estimated_revenue_delta: float
    tone: str


class AllocationPointData(BaseModel):
    channel: str
    spend_share_pct: float
    revenue_share_pct: float
    revenue: float
    recommendation: str
    tone: str


class BudgetChannelRow(BaseModel):
    channel: str
    recommendation: str
    tone: str
    spend: float
    revenue: float
    roas_markov: float | None = None
    roas_shapley: float | None = None
    consensus_score: float
    role: str | None = None
    presence_score: float
    suggested_budget_delta_pct: float | None = None
    suggested_budget_delta_value: float | None = None
    estimated_revenue_delta: float | None = None


class BudgetDrawerData(BaseModel):
    channel: str
    recommendation: str
    tone: str
    rationale: list[str]
    risks: list[str]
    best_practices: list[str]
    suggested_budget_delta_pct: float | None = None
    suggested_budget_delta_value: float | None = None
    estimated_revenue_delta: float | None = None
    estimated_roas_min: float | None = None
    estimated_roas_max: float | None = None


class BudgetDashboardResponse(BaseModel):
    meta: ResponseMeta
    summary_cards: list[BudgetSummaryCard]
    allocation_matrix: list[AllocationPointData]
    opportunities_and_risks: dict[str, list[ChannelRecommendationRow]]
    channels_table: list[BudgetChannelRow]
    selected_channel_drawer: BudgetDrawerData | None = None
