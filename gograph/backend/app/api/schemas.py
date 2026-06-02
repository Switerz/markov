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
