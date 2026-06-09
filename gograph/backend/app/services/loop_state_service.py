"""
Loop-aware Markov/Shapley attribution.

States are composite: 'channel / segment' where segment ∈ {Single, Loop}.

This service mirrors funnel_markov_service.py but uses loop intensity as the
dimension rather than funnel stage. Use it alongside (not instead of) the raw
channel Markov to expose how much of each channel's value comes from
repetition vs. one-shot impacts.

Path transformation:
  1. Annotate each position with 'Single' or 'Loop' (annotate_loop_states).
  2. Collapse a Loop run into a single node (compress_loop_runs).
     → 'Meta Meta Meta Google' becomes 'Meta / Loop → Google / Single'.
  3. Build the standard Markov transition matrix over the expanded state space.
  4. Compute removal effects and Shapley values per composite state.
  5. Aggregate back at the channel level for budget recommendations.

Why collapse Loop runs to a single node?
  Each Loop run becomes one state visit. Otherwise self-loops on 'c / Loop'
  inflate the chain by the loop length and you double-count what's already
  encoded in the state label itself.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

import markov as legacy_markov
from gograph.backend.app.core.loop_state import (
    LOOP_SEGMENTS,
    annotate_loop_states,
    compress_loop_runs,
    parse_loop_state,
)
from gograph.backend.app.services.loop_service import parse_path

SPECIAL_STATES = {"(start)", "Conversion", "Non-Conversion"}


# ---------------------------------------------------------------------------
# Path → loop-aware transition counts
# ---------------------------------------------------------------------------

def _build_loop_state_transition_counts(
    raw_paths: pd.DataFrame,
    transition_type: str,
) -> pd.DataFrame:
    """Build from/to transition counts where each non-terminal state is
    'channel / segment'.

    transition_type: 'converting' | 'nonconverting'
    """
    if raw_paths.empty:
        return pd.DataFrame(columns=["from_ch", "to_ch", "n", "total_revenue"])

    conv_flag = 1 if transition_type == "converting" else 0
    terminal = "Conversion" if transition_type == "converting" else "Non-Conversion"
    subset = raw_paths[raw_paths["converted"] == conv_flag]

    rows = []
    for _, row in subset.iterrows():
        channels = parse_path(row["path_sequence"])
        if not channels:
            continue
        labels = annotate_loop_states(channels)
        compressed = compress_loop_runs(labels)
        occ = float(row.get("occurrences", 1))
        revenue = float(row.get("revenue", 0.0))
        seq = ["(start)"] + compressed + [terminal]
        for i in range(len(seq) - 1):
            rows.append({
                "from_ch": seq[i],
                "to_ch": seq[i + 1],
                "n": occ,
                "total_revenue": revenue if transition_type == "converting" else 0.0,
            })

    if not rows:
        return pd.DataFrame(columns=["from_ch", "to_ch", "n", "total_revenue"])

    df = pd.DataFrame(rows)
    df = df.groupby(["from_ch", "to_ch"], as_index=False).agg(
        n=("n", "sum"),
        total_revenue=("total_revenue", "sum"),
    )
    return df.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Channel-level aggregation helpers
# ---------------------------------------------------------------------------

def _channels_in_loop_states(states: list[str]) -> dict[str, list[str]]:
    """Map base channel → list of composite states ('c / Single', 'c / Loop')."""
    mapping: dict[str, list[str]] = {}
    for state in states:
        if state in SPECIAL_STATES:
            continue
        channel, segment = parse_loop_state(state)
        if not channel or not segment:
            continue
        mapping.setdefault(channel, []).append(state)
    return mapping


# Channel-level aggregation is ADDITIVE over state-level weights, not a
# joint removal effect. Removing 'channel / Single' AND 'channel / Loop'
# simultaneously can interact (mass redistributes through paths that
# happen to favor Conversion), producing a paradoxical zero — see Direct
# in the May/2026 run where state-level Loop weight is 4.6% but channel
# weight collapsed to 0. Summing the independent state-level removal
# effects matches the additive Shapley convention used elsewhere and
# avoids the paradox.


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

def run_loop_state_markov(
    raw_paths: pd.DataFrame,
    total_revenue: float,
    non_conv_scale: float,
    shapley_samples: int = 2000,
    shapley_seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Run Markov/Shapley attribution on loop-aware composite states.

    Returns:
      state_df   — attribution per composite state ('channel / segment')
      channel_df — attribution aggregated back at the base channel level,
                   with loop-share columns showing what fraction of the
                   channel's value comes from the Loop segment.
    """
    if raw_paths.empty:
        return pd.DataFrame(), pd.DataFrame()

    converting = _build_loop_state_transition_counts(raw_paths, "converting")
    nonconverting = _build_loop_state_transition_counts(raw_paths, "nonconverting")
    if converting.empty:
        return pd.DataFrame(), pd.DataFrame()

    T, states = legacy_markov.build_transition_matrix(
        converting, nonconverting, scale_nonconv=non_conv_scale
    )

    removal_effects = legacy_markov.compute_removal_effects(T, states)
    total_effect = sum(removal_effects.values())

    shapley_values = legacy_markov.compute_shapley_values(
        T, states, n_samples=shapley_samples, seed=shapley_seed
    )
    total_shapley = sum(max(v, 0.0) for v in shapley_values.values())

    # Presence per state — fraction of all non-terminal outgoing transitions
    # that originate from this state, split by converting/non-converting.
    conv_presence: dict[str, float] = {}
    nconv_presence: dict[str, float] = {}
    conv_total = converting["n"].sum() if not converting.empty else 0
    nconv_total = nonconverting["n"].sum() if not nonconverting.empty else 0
    for state in states:
        if state in SPECIAL_STATES:
            continue
        if conv_total > 0:
            conv_presence[state] = float(
                converting[converting["from_ch"] == state]["n"].sum()
            ) / conv_total
        if nconv_total > 0:
            nconv_presence[state] = float(
                nonconverting[nonconverting["from_ch"] == state]["n"].sum()
            ) / nconv_total

    # --- State-level DataFrame ---
    state_rows = []
    for state in states:
        if state in SPECIAL_STATES:
            continue
        channel, segment = parse_loop_state(state)
        if not channel or not segment:
            continue
        re = removal_effects.get(state, 0.0)
        sv = shapley_values.get(state, 0.0)
        markov_w = re / total_effect if total_effect > 0 else 0.0
        shapley_w = max(sv, 0.0) / total_shapley if total_shapley > 0 else 0.0
        support = int(
            converting[converting["from_ch"] == state]["n"].sum()
            + nonconverting[nonconverting["from_ch"] == state]["n"].sum()
        )
        state_rows.append({
            "state": state,
            "channel": channel,
            "segment": segment,
            "markov_weight": markov_w,
            "markov_revenue": markov_w * total_revenue,
            "removal_effect": re,
            "shapley_weight": shapley_w,
            "shapley_revenue": shapley_w * total_revenue,
            "presence_converting": conv_presence.get(state, 0.0),
            "presence_nonconverting": nconv_presence.get(state, 0.0),
            "support": support,
            "confidence": "high" if support >= 500 else ("medium" if support >= 100 else "low"),
        })

    state_df = (
        pd.DataFrame(state_rows)
        .sort_values("markov_weight", ascending=False)
        .reset_index(drop=True)
    )

    # --- Channel-level aggregation (additive) ---
    channel_states = _channels_in_loop_states(states)
    channel_rows = []
    for ch, ch_states in channel_states.items():
        seg_markov = {seg: 0.0 for seg in LOOP_SEGMENTS}
        seg_shapley = {seg: 0.0 for seg in LOOP_SEGMENTS}
        seg_removal_effect = 0.0
        for s in ch_states:
            _, seg = parse_loop_state(s)
            mw = next((r["markov_weight"] for r in state_rows if r["state"] == s), 0.0)
            sw = next((r["shapley_weight"] for r in state_rows if r["state"] == s), 0.0)
            seg_markov[seg] += mw
            seg_shapley[seg] += sw
            seg_removal_effect += removal_effects.get(s, 0.0)

        ch_markov_w = seg_markov["Single"] + seg_markov["Loop"]
        ch_shapley_w = seg_shapley["Single"] + seg_shapley["Loop"]

        loop_markov_share = (
            seg_markov["Loop"] / ch_markov_w if ch_markov_w > 0 else 0.0
        )
        loop_shapley_share = (
            seg_shapley["Loop"] / ch_shapley_w if ch_shapley_w > 0 else 0.0
        )

        channel_rows.append({
            "channel": ch,
            "markov_weight": ch_markov_w,
            "markov_revenue": ch_markov_w * total_revenue,
            "removal_effect": seg_removal_effect,
            "shapley_weight": ch_shapley_w,
            "shapley_revenue": ch_shapley_w * total_revenue,
            "markov_weight_single": seg_markov["Single"],
            "markov_weight_loop": seg_markov["Loop"],
            "loop_share_of_value_markov": loop_markov_share,
            "shapley_weight_single": seg_shapley["Single"],
            "shapley_weight_loop": seg_shapley["Loop"],
            "loop_share_of_value_shapley": loop_shapley_share,
        })

    channel_df = (
        pd.DataFrame(channel_rows)
        .sort_values("markov_weight", ascending=False)
        .reset_index(drop=True)
    )
    return state_df, channel_df
