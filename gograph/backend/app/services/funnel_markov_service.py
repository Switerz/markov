"""
Sprint 13 — Funnel Stage Markov/Shapley.

States are composite: "channel / funnel_stage"
  e.g. "Paid Meta Ads / Low Intent"
       "Paid Meta Ads / Product Interest"
       "Paid Meta Ads / Cart Intent"
       "Google Ads / Cart Intent"

This model runs ALONGSIDE (not replacing) the Raw Channel Markov.

The Removal Effect in the funnel model can be computed at two levels:
  - State level:   remove "Paid Meta Ads / Low Intent" alone
  - Channel level: remove ALL states starting with "Paid Meta Ads /"

This module:
  1. Accepts funnel-enriched paths (from get_funnel_enriched_paths in extract.py).
  2. Builds a full Markov/Shapley run over the composite states.
  3. Returns attribution per state AND per channel (aggregated).
  4. Produces a comparison table between Raw Channel and Funnel Stage models.
"""

from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

import markov as legacy_markov
from gograph.backend.app.core.event_mapping import parse_funnel_state, FUNNEL_STAGES
from gograph.backend.app.services.loop_service import parse_path, build_compressed_transition_counts

SPECIAL_STATES = {"(start)", "Conversion", "Non-Conversion"}


# ---------------------------------------------------------------------------
# Build transition counts from funnel-enriched paths
# ---------------------------------------------------------------------------

def _build_funnel_transition_counts(
    funnel_paths: pd.DataFrame,
    transition_type: str,
) -> pd.DataFrame:
    """
    Build from/to transition counts from funnel-enriched path DataFrame.

    Each path_sequence uses composite states: "channel / funnel_stage".
    Adds (start) and Conversion/Non-Conversion terminal states.

    transition_type: 'converting' | 'nonconverting'
    """
    if funnel_paths.empty:
        return pd.DataFrame(columns=["from_ch", "to_ch", "n"])

    conv_flag = 1 if transition_type == "converting" else 0
    terminal = "Conversion" if transition_type == "converting" else "Non-Conversion"
    subset = funnel_paths[funnel_paths["converted"] == conv_flag]

    rows = []
    for _, row in subset.iterrows():
        channels = parse_path(row["path_sequence"])
        occ = float(row.get("occurrences", 1))
        revenue = float(row.get("revenue", 0.0))
        seq = ["(start)"] + channels + [terminal]
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
    agg = {"n": ("n", "sum")}
    if "total_revenue" in df.columns:
        agg["total_revenue"] = ("total_revenue", "sum")
    df = df.groupby(["from_ch", "to_ch"], as_index=False).agg(**agg)
    return df.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Channel-level removal (aggregated)
# ---------------------------------------------------------------------------

def _channels_in_funnel_states(states: list[str]) -> dict[str, list[str]]:
    """
    Map base channel → list of composite states that belong to it.
    e.g. "Paid Meta Ads" → ["Paid Meta Ads / Low Intent", "Paid Meta Ads / Cart Intent"]
    """
    mapping: dict[str, list[str]] = {}
    for state in states:
        if state in SPECIAL_STATES:
            continue
        channel, _ = parse_funnel_state(state)
        if channel not in mapping:
            mapping[channel] = []
        mapping[channel].append(state)
    return mapping


def _removal_effect_channel(
    T: np.ndarray,
    states: list[str],
    channel_states: list[str],
    baseline_conv: float,
) -> float:
    """
    Compute removal effect for a set of composite states (all states for one channel).
    Removes all states in channel_states simultaneously.
    """
    if not channel_states:
        return 0.0
    idx = {s: i for i, s in enumerate(states)}
    T_mod = T.copy()
    for state in channel_states:
        if state not in idx:
            continue
        k = idx[state]
        T_mod[k, :] = 0.0
        T_mod[:, k] = 0.0
    row_sums = T_mod.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    T_mod = T_mod / row_sums
    abs_states = {"Conversion", "Non-Conversion"}
    for s in abs_states:
        if s in idx:
            a = idx[s]
            T_mod[a, :] = 0.0
            T_mod[a, a] = 1.0
    new_conv = legacy_markov._conversion_probability(T_mod, states)
    return max(0.0, baseline_conv - new_conv)


# ---------------------------------------------------------------------------
# Main funnel Markov runner
# ---------------------------------------------------------------------------

def run_funnel_markov(
    funnel_paths: pd.DataFrame,
    total_revenue: float,
    non_conv_scale: float,
    shapley_samples: int = 2000,
    shapley_seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Run Markov/Shapley attribution on funnel-enriched paths.

    Returns:
      state_df   — attribution per composite state (channel/stage)
      channel_df — attribution aggregated by base channel
    """
    if funnel_paths.empty:
        return pd.DataFrame(), pd.DataFrame()

    converting = _build_funnel_transition_counts(funnel_paths, "converting")
    nonconverting = _build_funnel_transition_counts(funnel_paths, "nonconverting")

    if converting.empty:
        return pd.DataFrame(), pd.DataFrame()

    # Build transition matrix
    T, states = legacy_markov.build_transition_matrix(
        converting, nonconverting, scale_nonconv=non_conv_scale
    )
    baseline_conv = legacy_markov._conversion_probability(T, states)

    # State-level removal effects
    removal_effects = legacy_markov.compute_removal_effects(T, states)
    total_effect = sum(removal_effects.values())

    # Shapley values (fewer samples — this is diagnostic)
    shapley_values = legacy_markov.compute_shapley_values(
        T, states, n_samples=shapley_samples, seed=shapley_seed
    )
    total_shapley = sum(max(v, 0.0) for v in shapley_values.values())

    # Presence metrics
    conv_presence: dict[str, float] = {}
    nconv_presence: dict[str, float] = {}
    if not converting.empty:
        conv_total = converting["n"].sum()
        for state in states:
            if state in SPECIAL_STATES:
                continue
            n_conv = converting[converting["from_ch"] == state]["n"].sum()
            conv_presence[state] = float(n_conv) / conv_total if conv_total > 0 else 0.0
    if not nonconverting.empty:
        nconv_total = nonconverting["n"].sum()
        for state in states:
            if state in SPECIAL_STATES:
                continue
            n_nconv = nonconverting[nonconverting["from_ch"] == state]["n"].sum()
            nconv_presence[state] = float(n_nconv) / nconv_total if nconv_total > 0 else 0.0

    # --- State-level DataFrame ---
    state_rows = []
    channel_states = _channels_in_funnel_states(states)

    for state in states:
        if state in SPECIAL_STATES:
            continue
        channel, funnel_stage = parse_funnel_state(state)
        re = removal_effects.get(state, 0.0)
        sv = shapley_values.get(state, 0.0)
        markov_w = re / total_effect if total_effect > 0 else 0.0
        shapley_w = max(sv, 0.0) / total_shapley if total_shapley > 0 else 0.0
        support = int(
            converting[converting["from_ch"] == state]["n"].sum() +
            nonconverting[nonconverting["from_ch"] == state]["n"].sum()
        )
        state_rows.append({
            "state": state,
            "channel": channel,
            "funnel_stage": funnel_stage if funnel_stage else "Unknown",
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

    state_df = pd.DataFrame(state_rows).sort_values("markov_weight", ascending=False).reset_index(drop=True)

    # --- Channel-level aggregation ---
    channel_rows = []
    for ch, ch_states in channel_states.items():
        ch_re = _removal_effect_channel(T, states, ch_states, baseline_conv)
        ch_re_normalized = ch_re / total_effect if total_effect > 0 else 0.0
        # Shapley aggregated: sum of constituent states
        ch_sv = sum(max(shapley_values.get(s, 0.0), 0.0) for s in ch_states)
        ch_sv_w = ch_sv / total_shapley if total_shapley > 0 else 0.0
        # Stage breakdown
        stage_breakdown = {}
        for stage in FUNNEL_STAGES:
            state_name = f"{ch} / {stage}"
            mw = next(
                (r["markov_weight"] for r in state_rows if r["state"] == state_name), 0.0
            )
            stage_breakdown[f"markov_weight_{stage.lower().replace(' ', '_')}"] = mw

        channel_rows.append({
            "channel": ch,
            "markov_weight": ch_re_normalized,
            "markov_revenue": ch_re_normalized * total_revenue,
            "removal_effect": ch_re,
            "shapley_weight": ch_sv_w,
            "shapley_revenue": ch_sv_w * total_revenue,
            **stage_breakdown,
        })

    channel_df = (
        pd.DataFrame(channel_rows)
        .sort_values("markov_weight", ascending=False)
        .reset_index(drop=True)
    )
    return state_df, channel_df


# ---------------------------------------------------------------------------
# Model comparison
# ---------------------------------------------------------------------------

def compare_models(
    raw_attribution: pd.DataFrame,
    funnel_channel_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Compare Raw Channel Markov vs Funnel Stage Markov per channel.

    raw_attribution: columns [channel, markov_weight, shapley_weight]
    funnel_channel_df: output of run_funnel_markov() channel_df
    """
    if raw_attribution.empty or funnel_channel_df.empty:
        return pd.DataFrame()

    raw = raw_attribution[["channel", "markov_weight", "shapley_weight"]].copy()
    raw = raw.rename(columns={
        "markov_weight": "raw_markov_weight",
        "shapley_weight": "raw_shapley_weight",
    })
    funnel = funnel_channel_df[["channel", "markov_weight", "shapley_weight"]].copy()
    funnel = funnel.rename(columns={
        "markov_weight": "funnel_markov_weight",
        "shapley_weight": "funnel_shapley_weight",
    })
    merged = raw.merge(funnel, on="channel", how="outer").fillna(0.0)
    merged["markov_delta_pp"] = (
        merged["funnel_markov_weight"] - merged["raw_markov_weight"]
    ) * 100
    merged["shapley_delta_pp"] = (
        merged["funnel_shapley_weight"] - merged["raw_shapley_weight"]
    ) * 100
    return merged.sort_values("raw_markov_weight", ascending=False).reset_index(drop=True)
