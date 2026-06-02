"""Markov Chain Attribution Model + Shapley Values.

Markov algorithm:
  1. Build a transition matrix T from observed (from, to) counts.
  2. Model has absorbing states: Conversion and Non-Conversion.
  3. Solve for P(Conversion | start) using the fundamental matrix.
  4. For each channel c, zero-out its row and column in T (remove the channel),
     re-normalize, and re-solve. The drop in conversion probability is the
     removal effect of channel c.
  5. Attribution weight = removal_effect_c / sum(all removal_effects).

Shapley algorithm (Monte Carlo):
  For n_samples random orderings of channels, compute the marginal contribution
  of each channel as it is added to the coalition. Average across all orderings.
  Shapley values satisfy efficiency (sum = total conversion lift), symmetry,
  and dummy axioms — making them fairer for awareness channels than removal effects.
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple


START = "(start)"
CONV  = "Conversion"
NCONV = "Non-Conversion"
ABSORBING = {CONV, NCONV}


def _build_states(transitions_df: pd.DataFrame) -> list:
    channels = set(transitions_df["from_ch"]) | set(transitions_df["to_ch"])
    channels -= ABSORBING
    channels.discard(START)
    states = [START] + sorted(channels) + [CONV, NCONV]
    return states


def build_transition_matrix(
    converting: pd.DataFrame,
    nonconverting: pd.DataFrame,
    scale_nonconv: float = 5.0,
) -> Tuple[np.ndarray, list]:
    """
    Build normalized transition probability matrix.

    scale_nonconv: multiply non-converting counts by this factor so that the
    implied conversion rate roughly matches reality.  A value of 5 means
    non-converting paths are 5× more frequent than converting paths.

    Returns: (T, states)
      T[i, j] = P(go to state j | currently in state i)
      states   = ordered list of state names matching T's row/col indices.
    """
    # Combine both path types
    conv_df   = converting[["from_ch", "to_ch", "n"]].copy()
    nconv_df  = nonconverting[["from_ch", "to_ch", "n"]].copy()
    nconv_df["n"] = (nconv_df["n"] * scale_nonconv).round().astype(int)

    all_df = pd.concat([conv_df, nconv_df], ignore_index=True)
    all_df = all_df.groupby(["from_ch", "to_ch"], as_index=False).agg(n=("n", "sum"))

    states  = _build_states(all_df)
    idx     = {s: i for i, s in enumerate(states)}
    n       = len(states)
    counts  = np.zeros((n, n))

    for _, row in all_df.iterrows():
        i = idx.get(row["from_ch"])
        j = idx.get(row["to_ch"])
        if i is not None and j is not None:
            counts[i, j] += row["n"]

    # Absorbing states self-loop
    for s in ABSORBING:
        if s in idx:
            k = idx[s]
            counts[k, k] = 1.0

    # Row-normalize (states with no outgoing transitions → self-loop)
    row_sums = counts.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    T = counts / row_sums
    return T, states


def _conversion_probability(T: np.ndarray, states: list) -> float:
    """
    P(reach Conversion | start) using the fundamental matrix of an
    absorbing Markov chain.
    """
    idx = {s: i for i, s in enumerate(states)}
    transient = [s for s in states if s not in ABSORBING]
    absorbing = [s for s in states if s in ABSORBING]

    if CONV not in absorbing:
        return 0.0

    t_idx = [idx[s] for s in transient]
    a_idx = [idx[s] for s in absorbing]

    Q = T[np.ix_(t_idx, t_idx)]
    R = T[np.ix_(t_idx, a_idx)]

    # N = (I - Q)^{-1}  — fundamental matrix
    try:
        N = np.linalg.inv(np.eye(len(transient)) - Q)
    except np.linalg.LinAlgError:
        N = np.linalg.pinv(np.eye(len(transient)) - Q)

    B = N @ R  # absorption probabilities: B[i, j] = P(absorbed by j | start at i)

    start_t = transient.index(START)
    conv_a  = absorbing.index(CONV)
    return float(B[start_t, conv_a])


def compute_removal_effects(
    T: np.ndarray,
    states: list,
) -> Dict[str, float]:
    """
    For each non-absorbing, non-start channel:
      removal_effect = baseline_conv_rate - conv_rate_without_channel
    """
    baseline = _conversion_probability(T, states)
    channels = [s for s in states if s not in ABSORBING and s != START]
    idx      = {s: i for i, s in enumerate(states)}

    effects = {}
    for ch in channels:
        k = idx[ch]
        T_mod = T.copy()
        # Remove channel: zero row and column, then re-normalize rows
        T_mod[k, :] = 0.0
        T_mod[:, k] = 0.0
        row_sums = T_mod.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0
        # Absorbing states must keep their self-loop
        for s in ABSORBING:
            if s in idx:
                a = idx[s]
                row_sums[a] = 1.0  # will be overwritten below
        T_mod = T_mod / row_sums
        for s in ABSORBING:
            if s in idx:
                a = idx[s]
                T_mod[a, :] = 0.0
                T_mod[a, a] = 1.0

        new_conv = _conversion_probability(T_mod, states)
        effects[ch] = max(0.0, baseline - new_conv)

    return effects


# ---------------------------------------------------------------------------
# Shapley Values (Monte Carlo)
# ---------------------------------------------------------------------------

def _conv_prob_subset(
    T: np.ndarray,
    states: list,
    all_channels: List[str],
    idx: Dict[str, int],
    abs_indices: List[int],
    coalition: set,
) -> float:
    """P(Conversion | start) with only the channels in `coalition` available."""
    if not coalition:
        return 0.0

    removed_idx = [idx[ch] for ch in all_channels if ch not in coalition]
    if not removed_idx:
        return _conversion_probability(T, states)

    T_mod = T.copy()
    T_mod[np.ix_(removed_idx, range(T_mod.shape[1]))] = 0.0
    T_mod[np.ix_(range(T_mod.shape[0]), removed_idx)] = 0.0

    row_sums = T_mod.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0
    T_mod /= row_sums
    for a in abs_indices:
        T_mod[a, :] = 0.0
        T_mod[a, a] = 1.0

    return _conversion_probability(T_mod, states)


def compute_shapley_values(
    T: np.ndarray,
    states: list,
    n_samples: int = 5000,
    seed: int = 42,
) -> Dict[str, float]:
    """
    Monte Carlo Shapley attribution values (raw, not normalised).
    For n_samples random channel orderings, each channel gets credit for its
    marginal conversion-probability lift when it joins the coalition.

    Returns: {channel: shapley_value}  (values sum to ~baseline conv probability)
    """
    rng = np.random.default_rng(seed)
    channels = [s for s in states if s not in ABSORBING and s != START]
    idx = {s: i for i, s in enumerate(states)}
    abs_indices = [idx[s] for s in ABSORBING if s in idx]
    shapley: Dict[str, float] = {ch: 0.0 for ch in channels}

    for _ in range(n_samples):
        perm: List[str] = rng.permutation(channels).tolist()
        coalition: set = set()
        prev_v = 0.0
        for ch in perm:
            coalition.add(ch)
            new_v = _conv_prob_subset(T, states, channels, idx, abs_indices, coalition)
            shapley[ch] += new_v - prev_v
            prev_v = new_v

    return {ch: v / n_samples for ch, v in shapley.items()}


def compute_shapley_attribution(
    shapley_values: Dict[str, float],
    total_revenue: float,
) -> pd.DataFrame:
    """Attribution weights and attributed revenue from Shapley values."""
    total = sum(max(v, 0.0) for v in shapley_values.values())
    rows = []
    for ch, sv in shapley_values.items():
        weight = max(sv, 0.0) / total if total > 0 else 1.0 / len(shapley_values)
        rows.append({
            "channel": ch,
            "shapley_value": sv,
            "shapley_weight": weight,
            "shapley_revenue": weight * total_revenue,
        })
    df = pd.DataFrame(rows).sort_values("shapley_weight", ascending=False)
    return df.reset_index(drop=True)


# ---------------------------------------------------------------------------
# NON_CONV_SCALE auto-calibration
# ---------------------------------------------------------------------------

def calibrate_nonconv_scale(
    conv_df: pd.DataFrame,
    nconv_df: pd.DataFrame,
    target_rate: float,
    tol: float = 1e-4,
    max_iter: int = 60,
) -> float:
    """
    Binary-search for the NON_CONV_SCALE that makes P(Conversion | start)
    match `target_rate` (the observed real-world conversion rate).
    """
    lo, hi = 0.01, 5000.0
    scale = 1.0
    for _ in range(max_iter):
        mid = (lo + hi) / 2.0
        T, states = build_transition_matrix(conv_df, nconv_df, scale_nonconv=mid)
        p = _conversion_probability(T, states)
        if abs(p - target_rate) < tol:
            return mid
        scale = mid
        if p > target_rate:
            lo = mid
        else:
            hi = mid
    return scale


# ---------------------------------------------------------------------------
# Markov attribution weights
# ---------------------------------------------------------------------------

def compute_attribution(
    removal_effects: Dict[str, float],
    converting_df: pd.DataFrame,
    total_revenue: float = None,
) -> pd.DataFrame:
    """
    Returns a DataFrame with attribution weights and attributed revenue
    per channel.

    total_revenue: pass the true revenue from unique purchases; if None,
    falls back to converting_df sum (which double-counts multi-touch paths).
    """
    if total_revenue is None:
        total_revenue = converting_df["total_revenue"].sum()
    total_effect  = sum(removal_effects.values())

    if total_effect == 0:
        # Fallback: equal attribution
        n = len(removal_effects)
        weights = {ch: 1.0 / n for ch in removal_effects}
    else:
        weights = {ch: v / total_effect for ch, v in removal_effects.items()}

    rows = []
    for ch, weight in weights.items():
        rows.append({
            "channel": ch,
            "removal_effect": removal_effects[ch],
            "attribution_weight": weight,
            "attributed_revenue": weight * total_revenue,
        })

    df = pd.DataFrame(rows).sort_values("attribution_weight", ascending=False)
    df["total_revenue"] = total_revenue
    return df.reset_index(drop=True)
