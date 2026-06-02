"""ROAS and recommendation service wrappers."""

from typing import Optional, Set

import pandas as pd

import roas as legacy_roas


def compute_channel_diagnostics(
    converting: pd.DataFrame,
    nonconverting: pd.DataFrame,
) -> pd.DataFrame:
    return legacy_roas.build_channel_diagnostics(converting, nonconverting)


def compute_roas(
    markov_results: pd.DataFrame,
    shapley_results: pd.DataFrame,
    spend: pd.DataFrame,
    diagnostics: pd.DataFrame,
    paid_channels: Optional[Set[str]] = None,
) -> pd.DataFrame:
    markov_roas = legacy_roas.compute_roas(markov_results, spend)
    merged = legacy_roas.merge_shapley_roas(markov_roas, shapley_results, spend)
    merged = legacy_roas.merge_channel_diagnostics(merged, diagnostics)
    return legacy_roas.generate_recommendations(
        merged,
        paid_channels=paid_channels,
    )


def extract_top_paths(converting: pd.DataFrame, top_n: int = 20) -> pd.DataFrame:
    return legacy_roas.top_converting_journeys(converting, top_n=top_n)
