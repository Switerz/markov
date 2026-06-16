"""
PFC — Position-Frequency-Causal attribution service.

Computes a channel attribution weight that combines:
  1. Positional credit  — 40% first, 40% last, 20% split across middle touches.
     Channels appearing multiple times in the middle accumulate their share.
  2. Causal adjustment — multiplies positional credit by lift^alpha where
     lift(c) = share_conv(c) / share_nconv(c) and alpha=0.3 (soft).

The result is a normalized weight per channel that is meaningful even for
ubiquitous channels (Meta, Direct) that Markov assigns 0% because their
removal barely changes the matrix probabilities.

Designed to run alongside Markov/Shapley as a diagnostic signal.
pfc_delta_pp = (pfc_weight - markov_weight) * 100 is the key output:
  positive delta → Markov underestimates this channel (ubiquity blind spot)
  negative delta → Markov overestimates (channel is over-indexed on closers)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

ALPHA: float = 0.3        # lift exponent — 0=pure positional, 1=lift-linear
INF_LIFT_CAP: float = 5.0  # cap for channels absent in non-converting paths


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_path(s: str) -> list[str]:
    if not s or (isinstance(s, float) and np.isnan(s)):
        return []
    return [c.strip() for c in str(s).split(" -> ") if c.strip()]


def _position_credit(channels: list[str]) -> dict[str, float]:
    """Distribute 1.0 unit of credit across channels by position.

    N=1 → 100% to sole touch.
    N=2 → 50% first, 50% last.
    N≥3 → 40% first, 40% last, 20%/(N-2) per middle touch.
    A channel repeated in the middle accumulates its fractional weight.
    """
    n = len(channels)
    if n == 0:
        return {}
    if n == 1:
        return {channels[0]: 1.0}
    if n == 2:
        d: dict[str, float] = {}
        d[channels[0]] = d.get(channels[0], 0.0) + 0.5
        d[channels[-1]] = d.get(channels[-1], 0.0) + 0.5
        return d
    d = {}
    d[channels[0]] = d.get(channels[0], 0.0) + 0.40
    d[channels[-1]] = d.get(channels[-1], 0.0) + 0.40
    per_mid = 0.20 / (n - 2)
    for ch in channels[1:-1]:
        d[ch] = d.get(ch, 0.0) + per_mid
    return d


def _normalize(d: dict[str, float]) -> dict[str, float]:
    total = sum(d.values())
    if total <= 0:
        return {k: 0.0 for k in d}
    return {k: v / total for k, v in d.items()}


# ---------------------------------------------------------------------------
# Signal builders
# ---------------------------------------------------------------------------

def _build_positional_credit(raw_paths: pd.DataFrame) -> dict[str, float]:
    """Sum positional credit × revenue across all converting paths."""
    credit: dict[str, float] = {}
    converting = raw_paths[raw_paths["converted"] == 1]
    for _, row in converting.iterrows():
        channels = _parse_path(row["path_sequence"])
        if not channels:
            continue
        revenue = float(row.get("revenue", 0.0))
        for ch, w in _position_credit(channels).items():
            credit[ch] = credit.get(ch, 0.0) + w * revenue
    return credit


def _build_lift(raw_paths: pd.DataFrame) -> dict[str, float]:
    """lift(c) = share of touches in converting / share of touches in non-converting."""
    conv_count: dict[str, float] = {}
    nconv_count: dict[str, float] = {}
    for _, row in raw_paths.iterrows():
        channels = _parse_path(row["path_sequence"])
        occ = float(row.get("occurrences", 1))
        target = conv_count if row["converted"] == 1 else nconv_count
        for ch in channels:
            target[ch] = target.get(ch, 0.0) + occ

    conv_total = sum(conv_count.values()) or 1.0
    nconv_total = sum(nconv_count.values()) or 1.0
    lift: dict[str, float] = {}
    for ch in set(conv_count) | set(nconv_count):
        sc = conv_count.get(ch, 0.0) / conv_total
        sn = nconv_count.get(ch, 0.0) / nconv_total
        if sn > 0:
            lift[ch] = sc / sn
        elif sc > 0:
            lift[ch] = float("inf")
        else:
            lift[ch] = 0.0
    return lift


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_pfc_attribution(
    raw_paths: pd.DataFrame,
    markov_weights: dict[str, float],
    total_revenue: float,
    alpha: float = ALPHA,
) -> pd.DataFrame:
    """Compute PFC attribution and delta vs Markov.

    Parameters
    ----------
    raw_paths      : DataFrame with columns path_sequence, converted,
                     revenue, occurrences (output of get_raw_paths).
    markov_weights : {channel: markov_weight} from the current model run.
    total_revenue  : total converting revenue for the run window.
    alpha          : lift exponent (default 0.3).

    Returns
    -------
    DataFrame with columns: channel, pfc_weight, pfc_delta_pp.
    Empty DataFrame if raw_paths is empty or has no converting rows.
    """
    if raw_paths.empty or (raw_paths["converted"] == 1).sum() == 0:
        return pd.DataFrame(columns=["channel", "pfc_weight", "pfc_delta_pp"])

    positional = _build_positional_credit(raw_paths)
    lift = _build_lift(raw_paths)

    # Apply causal adjustment: credit × lift^alpha
    adjusted: dict[str, float] = {}
    for ch, pc in positional.items():
        lv = lift.get(ch, 1.0)
        if np.isinf(lv):
            lv = INF_LIFT_CAP
        elif lv <= 0:
            lv = 1e-3
        adjusted[ch] = pc * (lv ** alpha)

    pfc_w = _normalize(adjusted)

    rows = []
    all_channels = set(pfc_w) | set(markov_weights)
    for ch in all_channels:
        pw = pfc_w.get(ch, 0.0)
        mw = markov_weights.get(ch, 0.0)
        rows.append({
            "channel": ch,
            "pfc_weight": pw,
            "pfc_delta_pp": (pw - mw) * 100.0,
        })

    return pd.DataFrame(rows).sort_values("pfc_weight", ascending=False).reset_index(drop=True)
