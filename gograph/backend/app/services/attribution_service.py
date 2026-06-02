"""Reusable attribution functions backed by the legacy Markov engine."""

from typing import Dict, Optional

import numpy as np
import pandas as pd

import markov as legacy_markov


def build_transition_counts(
    converting: pd.DataFrame,
    nonconverting: pd.DataFrame,
) -> Dict[str, pd.DataFrame]:
    return {
        "converting": converting.copy(),
        "nonconverting": nonconverting.copy(),
    }


def build_transition_matrix(
    converting: pd.DataFrame,
    nonconverting: pd.DataFrame,
    scale_nonconv: float,
) -> tuple[np.ndarray, list[str]]:
    return legacy_markov.build_transition_matrix(
        converting=converting,
        nonconverting=nonconverting,
        scale_nonconv=scale_nonconv,
    )


def calibrate_nonconv_scale(
    converting: pd.DataFrame,
    nonconverting: pd.DataFrame,
    fixed_scale: Optional[float],
    observed_conversion_rate: Optional[float],
) -> float:
    if fixed_scale is not None:
        return float(fixed_scale)
    if observed_conversion_rate is None:
        raise ValueError(
            "observed_conversion_rate is required when non_conv_scale is not fixed."
        )
    return float(
        legacy_markov.calibrate_nonconv_scale(
            converting,
            nonconverting,
            target_rate=observed_conversion_rate,
        )
    )


def compute_model_conversion_probability(T: np.ndarray, states: list[str]) -> float:
    return legacy_markov._conversion_probability(T, states)


def compute_markov_attribution(
    T: np.ndarray,
    states: list[str],
    converting: pd.DataFrame,
    total_revenue: float,
) -> pd.DataFrame:
    removal_effects = legacy_markov.compute_removal_effects(T, states)
    attribution = legacy_markov.compute_attribution(
        removal_effects,
        converting,
        total_revenue=total_revenue,
    )
    attribution["markov_weight"] = attribution["attribution_weight"]
    attribution["markov_revenue"] = attribution["attributed_revenue"]
    return attribution


def compute_shapley_attribution(
    T: np.ndarray,
    states: list[str],
    total_revenue: float,
    n_samples: int,
    seed: int = 42,
) -> pd.DataFrame:
    shapley_values = legacy_markov.compute_shapley_values(
        T,
        states,
        n_samples=n_samples,
        seed=seed,
    )
    return legacy_markov.compute_shapley_attribution(
        shapley_values,
        total_revenue=total_revenue,
    )
