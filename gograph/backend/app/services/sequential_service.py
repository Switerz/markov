"""
Sprint 14 — Order-2 Sequential Diagnostics.

Computes P(Conversion | previous_channel, current_channel) for all observed
bigram pairs and compares against the baseline P(Conversion | current_channel).

Sequential lift:
  lift = P(Conv | prev, curr) / P(Conv | curr)

  lift > 1 → prev positively assists curr (positive_assist)
  lift < 1 → prev negatively influences curr (negative_assist)
  lift ≈ 1 → neutral

This layer is diagnostic only — it does NOT replace the Raw Markov attribution.
It answers: "Does Google convert better when preceded by Meta?"

Inputs:
  raw_paths — from path_summary table or extract.get_raw_paths().
              Columns: path_sequence, converted, revenue, occurrences

Outputs:
  sequential_effects DataFrame with one row per (previous_channel, current_channel).
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from gograph.backend.app.services.loop_service import parse_path

SPECIAL_STATES = {"(start)", "Conversion", "Non-Conversion"}
MIN_SUPPORT_FOR_RECOMMENDATION = 30


def _classify_label(
    lift: Optional[float],
    support: int,
    prev: str,
    curr: str,
) -> str:
    if support < MIN_SUPPORT_FOR_RECOMMENDATION:
        return "low_support"
    if prev == curr:
        return "possible_loop"
    if lift is None:
        return "no_baseline"
    if lift > 1.15:
        return "positive_assist"
    if lift < 0.85:
        return "negative_assist"
    return "neutral"


def _classify_confidence(support: int) -> str:
    if support >= 500:
        return "high"
    if support >= 100:
        return "medium"
    return "low"


def compute_sequential_effects(raw_paths: pd.DataFrame) -> pd.DataFrame:
    """
    Build the order-2 sequential effects table from raw path sequences.

    For each path in raw_paths:
      - Reconstruct the full sequence: (start) → ch1 → ch2 → ... → Conversion/NC
      - Emit every consecutive bigram (prev, curr) where neither is a special state
      - Track occurrences and revenue for conversion paths

    Returns a DataFrame with columns:
      previous_channel, current_channel, pair_count, conversion_count,
      nonconversion_count, conversion_probability_pair,
      conversion_probability_baseline, lift_vs_baseline,
      avg_ticket, revenue, support, confidence, diagnostic_label
    """
    if raw_paths.empty:
        return pd.DataFrame()

    # Accumulate bigram statistics
    pair_conv: dict[tuple[str, str], float] = {}
    pair_nonconv: dict[tuple[str, str], float] = {}
    pair_revenue: dict[tuple[str, str], float] = {}
    pair_conv_revenue: dict[tuple[str, str], float] = {}

    # Current-channel baseline (independent of prev)
    curr_conv: dict[str, float] = {}
    curr_nonconv: dict[str, float] = {}

    for _, row in raw_paths.iterrows():
        channels = parse_path(row["path_sequence"])
        occ = float(row.get("occurrences", 1))
        conv = int(row["converted"])
        revenue = float(row.get("revenue", 0.0))
        revenue_per_occ = revenue / occ if occ > 0 else 0.0

        terminal = "Conversion" if conv else "Non-Conversion"
        full = ["(start)"] + channels + [terminal]

        for i in range(1, len(full) - 1):
            prev = full[i - 1]
            curr = full[i]
            if prev in SPECIAL_STATES or curr in SPECIAL_STATES:
                continue

            key = (prev, curr)
            if conv:
                pair_conv[key] = pair_conv.get(key, 0.0) + occ
                pair_revenue[key] = pair_revenue.get(key, 0.0) + revenue
                pair_conv_revenue[key] = pair_conv_revenue.get(key, 0.0) + revenue_per_occ * occ
            else:
                pair_nonconv[key] = pair_nonconv.get(key, 0.0) + occ

            # Update current-channel baseline
            curr_conv[curr] = curr_conv.get(curr, 0.0) + (occ if conv else 0.0)
            curr_nonconv[curr] = curr_nonconv.get(curr, 0.0) + (occ if not conv else 0.0)

    # Build baseline conversion rate per current channel
    all_curr = set(curr_conv) | set(curr_nonconv)
    baseline: dict[str, float] = {}
    for ch in all_curr:
        total = curr_conv.get(ch, 0.0) + curr_nonconv.get(ch, 0.0)
        baseline[ch] = curr_conv.get(ch, 0.0) / total if total > 0 else 0.0

    # Assemble rows
    all_keys = set(pair_conv) | set(pair_nonconv)
    rows = []
    for key in all_keys:
        prev, curr = key
        conv_cnt = pair_conv.get(key, 0.0)
        nonconv_cnt = pair_nonconv.get(key, 0.0)
        total = conv_cnt + nonconv_cnt
        rev = pair_revenue.get(key, 0.0)
        avg_ticket = rev / conv_cnt if conv_cnt > 0 else None

        conv_rate = conv_cnt / total if total > 0 else 0.0
        base_rate = baseline.get(curr)
        lift = conv_rate / base_rate if base_rate and base_rate > 0 else None

        support = int(total)
        confidence = _classify_confidence(support)
        label = _classify_label(lift, support, prev, curr)

        rows.append({
            "previous_channel": prev,
            "current_channel": curr,
            "pair_count": total,
            "conversion_count": conv_cnt,
            "nonconversion_count": nonconv_cnt,
            "conversion_probability_pair": conv_rate,
            "conversion_probability_baseline": base_rate,
            "lift_vs_baseline": lift,
            "avg_ticket": avg_ticket,
            "revenue": rev,
            "support": support,
            "confidence": confidence,
            "diagnostic_label": label,
        })

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df = df.sort_values("pair_count", ascending=False).reset_index(drop=True)
    return df


def filter_meta_diagnostics(effects: pd.DataFrame, meta_channel: str = "Paid Meta Ads") -> pd.DataFrame:
    """
    Filter sequential effects to show only pairs where Meta is the previous channel.
    Returns rows sorted by lift descending.
    """
    if effects.empty:
        return pd.DataFrame()
    mask = effects["previous_channel"] == meta_channel
    return effects[mask].sort_values("lift_vs_baseline", ascending=False, na_position="last").reset_index(drop=True)


def get_top_assists(effects: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """Top positive-assist bigrams by lift (min support enforced)."""
    if effects.empty:
        return pd.DataFrame()
    mask = (
        (effects["diagnostic_label"] == "positive_assist") &
        (effects["support"] >= MIN_SUPPORT_FOR_RECOMMENDATION)
    )
    return effects[mask].sort_values("lift_vs_baseline", ascending=False).head(n).reset_index(drop=True)


def get_worst_assists(effects: pd.DataFrame, n: int = 10) -> pd.DataFrame:
    """Top negative-assist bigrams by lift (min support enforced)."""
    if effects.empty:
        return pd.DataFrame()
    mask = (
        (effects["diagnostic_label"] == "negative_assist") &
        (effects["support"] >= MIN_SUPPORT_FOR_RECOMMENDATION)
    )
    return effects[mask].sort_values("lift_vs_baseline", ascending=True).head(n).reset_index(drop=True)
