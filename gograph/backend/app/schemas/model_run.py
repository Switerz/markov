"""Shared result contracts for the GoGraph analytical engine."""

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional

import pandas as pd


@dataclass(frozen=True)
class ModelRunParams:
    start_date: str
    end_date: str
    db_plausible: int
    db_datamart: Optional[int] = None
    lookback_days: int = 30
    non_conv_sample_pct: int = 1
    non_conv_scale: Optional[float] = None
    decay_lambda: float = 0.05
    shapley_samples: int = 5000
    shapley_seed: int = 42
    batch_mode: str = "auto"
    batch_days: int = 35
    # Right-censorship: exclude non-converters whose last session is within
    # this many days of end_date (outcome still unknown). 0 = off.
    censorship_days: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ModelRunResult:
    parameters: ModelRunParams
    transition_counts: Dict[str, pd.DataFrame]
    transition_matrix: pd.DataFrame
    states: List[str]
    markov_results: pd.DataFrame
    shapley_results: pd.DataFrame
    roas_results: pd.DataFrame
    diagnostics: pd.DataFrame
    top_paths: pd.DataFrame
    data_quality: pd.DataFrame
    observed_conversion_rate: Optional[float]
    model_conversion_rate: float
    total_revenue: float
    total_spend: float
    non_conv_scale: float
    runtime_seconds: float
    # Sprint 11 — Loop diagnostics (optional, None if paths unavailable)
    loop_diagnostics: Optional[pd.DataFrame] = None
    # Sprint 13 — Funnel Stage Markov (optional, None if Events V2 unavailable)
    funnel_state_attribution: Optional[pd.DataFrame] = None
    funnel_channel_attribution: Optional[pd.DataFrame] = None
    # Sprint 14 — Sequential effects (optional, None if paths unavailable)
    sequential_effects: Optional[pd.DataFrame] = None

    def summary(self) -> Dict[str, Any]:
        return {
            "start_date": self.parameters.start_date,
            "end_date": self.parameters.end_date,
            "model_conversion_rate": self.model_conversion_rate,
            "observed_conversion_rate": self.observed_conversion_rate,
            "total_revenue": self.total_revenue,
            "total_spend": self.total_spend,
            "non_conv_scale": self.non_conv_scale,
            "runtime_seconds": self.runtime_seconds,
            "n_states": len(self.states),
            "n_channels": max(len(self.states) - 3, 0),
            "n_converting_transitions": len(self.transition_counts["converting"]),
            "n_nonconverting_transitions": len(self.transition_counts["nonconverting"]),
        }
