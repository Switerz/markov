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


def compute_first_last_click_roas(
    transitions_df: pd.DataFrame,
    spend_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    First-click: 100% credit to the first channel in each converting journey.
    Last-click:  100% credit to the last channel before Conversion.

    Both derived from transition_counts (converting rows only):
      (start) -> channel   = first touch
      channel -> Conversion = last touch
    Revenue in total_revenue column is the actual spend from those journeys.
    """
    if transitions_df.empty or "transition_type" not in transitions_df.columns:
        return pd.DataFrame(columns=[
            "channel", "first_click_revenue", "first_click_roas",
            "last_click_revenue", "last_click_roas",
        ])

    converting = transitions_df[transitions_df["transition_type"] == "converting"]

    first = (
        converting[converting["from_state"] == "(start)"]
        [["to_state", "total_revenue"]]
        .rename(columns={"to_state": "channel"})
        .groupby("channel", as_index=False)
        .agg(first_click_revenue=("total_revenue", "sum"))
    )

    last = (
        converting[converting["to_state"] == "Conversion"]
        [["from_state", "total_revenue"]]
        .rename(columns={"from_state": "channel"})
        .groupby("channel", as_index=False)
        .agg(last_click_revenue=("total_revenue", "sum"))
    )

    result = first.merge(last, on="channel", how="outer")

    if not spend_df.empty and "spend" in spend_df.columns:
        result = result.merge(spend_df[["channel", "spend"]], on="channel", how="left")
        result["first_click_roas"] = (
            result["first_click_revenue"] / result["spend"]
        ).where(result["spend"].fillna(0) > 0)
        result["last_click_roas"] = (
            result["last_click_revenue"] / result["spend"]
        ).where(result["spend"].fillna(0) > 0)
    else:
        result["first_click_roas"] = None
        result["last_click_roas"] = None

    return result[[
        "channel", "first_click_revenue", "first_click_roas",
        "last_click_revenue", "last_click_roas",
    ]]
