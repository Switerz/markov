"""
Sprint 11 — Auto-Loop Compression & Loop Diagnostics.

A loop is a consecutive repetition of the same channel in a journey:
  Meta → Meta → Meta → Google Ads → Conversion

Loop compression removes the consecutive duplicates but preserves metadata:
  Compressed:  Meta → Google Ads → Conversion
  Loop event:  {channel: Meta, loop_count: 3, exit_channel: Google Ads}

This module:
  1. Parses path sequences from the raw_paths DataFrame.
  2. Compresses consecutive loops and builds loop-compressed paths.
  3. Computes per-channel loop diagnostics.
  4. Provides a loop-compressed transition count DataFrame compatible with
     the existing Markov/Shapley engine (no breaking changes).

The funnel-stage variant preserves intra-channel stage progression — a sequence
of Meta / Low Intent → Meta / Product Interest is NOT compressed because the
funnel stage advanced.
"""

from __future__ import annotations

import json
import statistics
from collections import defaultdict
from typing import Optional

import numpy as np
import pandas as pd

SPECIAL_STATES = {"(start)", "Conversion", "Non-Conversion"}


# ---------------------------------------------------------------------------
# Path parsing helpers
# ---------------------------------------------------------------------------

def parse_path(path_sequence: str) -> list[str]:
    """Split a ' -> ' separated path into a list of channel names."""
    return [s.strip() for s in path_sequence.split("->")]


def compress_consecutive_loops(
    channels: list[str],
    preserve_funnel_progression: bool = False,
) -> tuple[list[str], list[dict]]:
    """
    Compress consecutive same-channel sequences.

    When preserve_funnel_progression=True, a sequence like:
      "Meta / Low Intent" → "Meta / Product Interest"
    is kept because the funnel stage advanced (different composite state).

    Returns:
      compressed: list of channels with consecutive duplicates collapsed.
      loops:      list of loop-event dicts with metadata.
    """
    compressed: list[str] = []
    loops: list[dict] = []
    i = 0

    while i < len(channels):
        ch = channels[i]

        # Find the run end
        j = i + 1
        while j < len(channels) and channels[j] == ch:
            j += 1

        count = j - i
        compressed.append(ch)

        if count > 1:
            exit_ch = channels[j] if j < len(channels) else None
            loops.append({
                "channel": ch,
                "loop_count": count,
                "start_position": i,
                "end_position": j - 1,
                "exit_channel": exit_ch,
            })

        i = j

    return compressed, loops


# ---------------------------------------------------------------------------
# Loop-compressed path DataFrame
# ---------------------------------------------------------------------------

def build_compressed_paths(raw_paths: pd.DataFrame) -> pd.DataFrame:
    """
    Given the raw_paths DataFrame (path_sequence, converted, revenue, occurrences),
    return a new DataFrame with:
      - path_sequence: the loop-compressed path (same format, ' -> ' separated)
      - converted, revenue, occurrences: preserved from raw
      - loop_count: total number of loop events in the original path
      - channels_removed: number of channel visits removed by compression
    Rows with identical compressed path_sequence are aggregated.
    """
    if raw_paths.empty:
        return pd.DataFrame(
            columns=["path_sequence", "converted", "revenue", "occurrences",
                     "loop_count", "channels_removed"]
        )

    rows = []
    for _, row in raw_paths.iterrows():
        channels = parse_path(row["path_sequence"])
        compressed, loops = compress_consecutive_loops(channels)
        total_loops = sum(lp["loop_count"] - 1 for lp in loops)
        rows.append({
            "path_sequence": " -> ".join(compressed),
            "converted": int(row["converted"]),
            "revenue": float(row.get("revenue", 0)),
            "occurrences": int(row.get("occurrences", 1)),
            "loop_count": len(loops),
            "channels_removed": total_loops,
        })

    df = pd.DataFrame(rows)
    df = (
        df.groupby(["path_sequence", "converted"], as_index=False)
        .agg(
            revenue=("revenue", "sum"),
            occurrences=("occurrences", "sum"),
            loop_count=("loop_count", "sum"),
            channels_removed=("channels_removed", "sum"),
        )
    )
    return df.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Loop diagnostics
# ---------------------------------------------------------------------------

def _classify_confidence(support: int) -> str:
    if support >= 500:
        return "high"
    if support >= 100:
        return "medium"
    return "low"


def compute_loop_diagnostics(raw_paths: pd.DataFrame) -> pd.DataFrame:
    """
    Compute per-channel loop statistics from raw_paths.

    Metrics:
      self_loop_count          — number of path records that contain a loop for this channel
      self_loop_rate           — share of paths (by occurrences) containing a loop
      avg/median/max_consecutive_repeats
      loop_conversion_rate     — P(Conversion | path contains a loop of this channel)
      nonloop_conversion_rate  — P(Conversion | path does NOT contain a loop of this channel)
      loop_conversion_lift     — ratio of the two rates
      exit_distribution_json   — JSON dict of top exit channels after a loop
      support                  — total occurrences (weighted) used for statistics
      confidence               — high / medium / low
    """
    if raw_paths.empty:
        return pd.DataFrame()

    # Per-channel accumulators
    channel_data: dict[str, dict] = defaultdict(lambda: {
        "loop_paths_occ": 0,
        "loop_paths_conv_occ": 0,
        "nonloop_paths_occ": 0,
        "nonloop_paths_conv_occ": 0,
        "consecutive_repeats": [],
        "exit_counts": defaultdict(float),
    })

    total_occ = raw_paths["occurrences"].sum() if not raw_paths.empty else 1

    for _, row in raw_paths.iterrows():
        channels = parse_path(row["path_sequence"])
        occ = int(row.get("occurrences", 1))
        conv = int(row["converted"])
        _, loops = compress_consecutive_loops(channels)

        looped_channels = {lp["channel"] for lp in loops}
        all_channels = set(channels) - SPECIAL_STATES

        for ch in all_channels:
            if ch in looped_channels:
                channel_data[ch]["loop_paths_occ"] += occ
                if conv:
                    channel_data[ch]["loop_paths_conv_occ"] += occ
            else:
                channel_data[ch]["nonloop_paths_occ"] += occ
                if conv:
                    channel_data[ch]["nonloop_paths_conv_occ"] += occ

        for lp in loops:
            ch = lp["channel"]
            if ch in SPECIAL_STATES:
                continue
            channel_data[ch]["consecutive_repeats"].append(lp["loop_count"])
            exit_ch = lp.get("exit_channel") or "None"
            if exit_ch not in SPECIAL_STATES:
                channel_data[ch]["exit_counts"][exit_ch] += occ

    rows = []
    for ch, data in channel_data.items():
        loop_occ = data["loop_paths_occ"]
        nonloop_occ = data["nonloop_paths_occ"]
        total = loop_occ + nonloop_occ

        loop_conv_rate = (
            data["loop_paths_conv_occ"] / loop_occ if loop_occ > 0 else None
        )
        nonloop_conv_rate = (
            data["nonloop_paths_conv_occ"] / nonloop_occ if nonloop_occ > 0 else None
        )
        lift: Optional[float] = None
        if loop_conv_rate is not None and nonloop_conv_rate and nonloop_conv_rate > 0:
            lift = loop_conv_rate / nonloop_conv_rate

        repeats = data["consecutive_repeats"]
        exit_top = dict(
            sorted(data["exit_counts"].items(), key=lambda kv: -kv[1])[:5]
        )

        rows.append({
            "channel": ch,
            "self_loop_count": int(loop_occ),
            "self_loop_rate": loop_occ / total if total > 0 else 0.0,
            "avg_consecutive_repeats": float(np.mean(repeats)) if repeats else None,
            "median_consecutive_repeats": float(statistics.median(repeats)) if repeats else None,
            "max_consecutive_repeats": max(repeats) if repeats else None,
            "loop_conversion_rate": loop_conv_rate,
            "nonloop_conversion_rate": nonloop_conv_rate,
            "loop_conversion_lift": lift,
            "exit_distribution_json": json.dumps(exit_top, ensure_ascii=False),
            "support": int(total),
            "confidence": _classify_confidence(int(total)),
        })

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    return df.sort_values("self_loop_count", ascending=False).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Loop-compressed transition counts (compatible with existing Markov engine)
# ---------------------------------------------------------------------------

def build_compressed_transition_counts(
    compressed_paths: pd.DataFrame,
    transition_type: str = "converting",
) -> pd.DataFrame:
    """
    Build from/to transition counts from a loop-compressed paths DataFrame.

    Adds (start) and Conversion / Non-Conversion terminal states to be
    compatible with build_transition_matrix() in markov.py.

    transition_type: 'converting' or 'nonconverting'
    """
    if compressed_paths.empty:
        return pd.DataFrame(columns=["from_ch", "to_ch", "n"])

    if transition_type == "converting":
        subset = compressed_paths[compressed_paths["converted"] == 1].copy()
        terminal = "Conversion"
    else:
        subset = compressed_paths[compressed_paths["converted"] == 0].copy()
        terminal = "Non-Conversion"

    rows = []
    for _, row in subset.iterrows():
        channels = parse_path(row["path_sequence"])
        occ = float(row.get("occurrences", 1))
        seq = ["(start)"] + channels + [terminal]
        for i in range(len(seq) - 1):
            rows.append({"from_ch": seq[i], "to_ch": seq[i + 1], "n": occ})

    if not rows:
        return pd.DataFrame(columns=["from_ch", "to_ch", "n"])

    df = pd.DataFrame(rows)
    df = df.groupby(["from_ch", "to_ch"], as_index=False).agg(n=("n", "sum"))
    return df.reset_index(drop=True)
