"""Hypothesis 3 — Frequency-deduped Markov.

Tests whether reducing Meta's (and Direct's) ubiquity in the path data lets
the standard Markov model recognize them.

For each target channel, keep only the FIRST occurrence in every user path,
then rebuild the transition tables and re-run Markov. Compare against a
baseline that uses the same code path but with no dedupe targets.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

import markov

CACHE_DIR = Path("/tmp/markov_cache")
RAW_PATHS_PKL = CACHE_DIR / "raw_paths.pkl"
PARAMS_JSON = CACHE_DIR / "params.json"

START = "(start)"
CONV = "Conversion"
NCONV = "Non-Conversion"

TARGETS = {"Paid Meta Ads", "Direct"}


def parse_path(path_sequence: str) -> list[str]:
    """Mirror of gograph.backend.app.services.loop_service.parse_path."""
    return [s.strip() for s in path_sequence.split("->")]


def dedupe_channels(channels: list[str], targets: set[str]) -> list[str]:
    """
    For each channel name in `targets`, keep only its FIRST occurrence in the path
    and drop subsequent ones. Channels not in `targets` are untouched.
    """
    if not targets:
        return list(channels)
    seen: set[str] = set()
    out: list[str] = []
    for ch in channels:
        if ch in targets:
            if ch in seen:
                continue
            seen.add(ch)
            out.append(ch)
        else:
            out.append(ch)
    return out


def build_transition_counts(
    raw_paths: pd.DataFrame,
    targets: set[str],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Build (converting, nonconverting) transition count DataFrames from raw_paths,
    applying optional first-occurrence dedupe for `targets`.

    Returns DataFrames with columns: from_ch, to_ch, n  (+ total_revenue on conv).
    """
    conv_rows: list[dict] = []
    nconv_rows: list[dict] = []

    for _, row in raw_paths.iterrows():
        channels = parse_path(row["path_sequence"])
        channels = dedupe_channels(channels, targets)
        if not channels:
            continue
        occ = float(row.get("occurrences", 1))
        revenue = float(row.get("revenue", 0.0))
        converted = int(row["converted"]) == 1
        terminal = CONV if converted else NCONV
        seq = [START] + channels + [terminal]
        bucket = conv_rows if converted else nconv_rows
        for i in range(len(seq) - 1):
            entry = {"from_ch": seq[i], "to_ch": seq[i + 1], "n": occ}
            if converted:
                entry["total_revenue"] = revenue
            bucket.append(entry)

    def _agg(rows: list[dict], with_revenue: bool) -> pd.DataFrame:
        if not rows:
            cols = ["from_ch", "to_ch", "n"]
            if with_revenue:
                cols.append("total_revenue")
            return pd.DataFrame(columns=cols)
        df = pd.DataFrame(rows)
        agg_spec = {"n": ("n", "sum")}
        if with_revenue:
            agg_spec["total_revenue"] = ("total_revenue", "sum")
        return (
            df.groupby(["from_ch", "to_ch"], as_index=False)
            .agg(**agg_spec)
            .reset_index(drop=True)
        )

    conv_df = _agg(conv_rows, with_revenue=True)
    nconv_df = _agg(nconv_rows, with_revenue=False)
    return conv_df, nconv_df


def run_markov(
    conv_df: pd.DataFrame,
    nconv_df: pd.DataFrame,
    non_conv_scale: float,
    total_revenue: float,
) -> pd.DataFrame:
    T, states = markov.build_transition_matrix(
        conv_df, nconv_df, scale_nonconv=non_conv_scale
    )
    effects = markov.compute_removal_effects(T, states)
    attr = markov.compute_attribution(effects, conv_df, total_revenue=total_revenue)
    return attr


def main() -> None:
    print("=" * 80)
    print("Hypothesis 3 — Frequency-deduped Markov")
    print("Targets to dedupe (first-occurrence only):", sorted(TARGETS))
    print("=" * 80)

    raw_paths = pd.read_pickle(RAW_PATHS_PKL)
    params = json.loads(PARAMS_JSON.read_text())
    non_conv_scale = float(params["non_conv_scale"])
    total_revenue = float(params["total_revenue"])
    print(f"\nLoaded raw_paths: {raw_paths.shape}")
    print(f"non_conv_scale: {non_conv_scale:.4f}")
    print(f"total_revenue : {total_revenue:,.2f}")
    print(
        f"converted rows: {(raw_paths['converted'] == 1).sum()} | "
        f"non-converted rows: {(raw_paths['converted'] == 0).sum()}"
    )

    # ------------------------------------------------------------------
    # Baseline (no dedupe) — rebuild from raw_paths using SAME code path
    # ------------------------------------------------------------------
    print("\n[1/2] Building baseline transitions (no dedupe)…")
    conv_base, nconv_base = build_transition_counts(raw_paths, targets=set())
    print(f"  conv transitions : {len(conv_base):>6} rows  "
          f"({conv_base['n'].sum():,.0f} total n)")
    print(f"  nconv transitions: {len(nconv_base):>6} rows  "
          f"({nconv_base['n'].sum():,.0f} total n)")

    print("  Running Markov on baseline…")
    attr_base = run_markov(conv_base, nconv_base, non_conv_scale, total_revenue)

    # ------------------------------------------------------------------
    # Deduped run
    # ------------------------------------------------------------------
    print("\n[2/2] Building DEDUPED transitions (first-occurrence-only for "
          f"{sorted(TARGETS)})…")
    conv_dd, nconv_dd = build_transition_counts(raw_paths, targets=TARGETS)
    print(f"  conv transitions : {len(conv_dd):>6} rows  "
          f"({conv_dd['n'].sum():,.0f} total n)")
    print(f"  nconv transitions: {len(nconv_dd):>6} rows  "
          f"({nconv_dd['n'].sum():,.0f} total n)")

    # Quick before/after sanity for self-loops on targets
    print("\n  Self-loop reduction (target -> target):")
    for tgt in sorted(TARGETS):
        base_self = conv_base[
            (conv_base["from_ch"] == tgt) & (conv_base["to_ch"] == tgt)
        ]["n"].sum() + nconv_base[
            (nconv_base["from_ch"] == tgt) & (nconv_base["to_ch"] == tgt)
        ]["n"].sum()
        dd_self = conv_dd[
            (conv_dd["from_ch"] == tgt) & (conv_dd["to_ch"] == tgt)
        ]["n"].sum() + nconv_dd[
            (nconv_dd["from_ch"] == tgt) & (nconv_dd["to_ch"] == tgt)
        ]["n"].sum()
        print(f"    {tgt:<20s}  baseline={base_self:>12,.0f}  "
              f"deduped={dd_self:>12,.0f}")

    print("\n  Running Markov on deduped…")
    attr_dd = run_markov(conv_dd, nconv_dd, non_conv_scale, total_revenue)

    # ------------------------------------------------------------------
    # Side-by-side comparison
    # ------------------------------------------------------------------
    base_w = attr_base.set_index("channel")["attribution_weight"]
    dd_w = attr_dd.set_index("channel")["attribution_weight"]
    base_re = attr_base.set_index("channel")["removal_effect"]
    dd_re = attr_dd.set_index("channel")["removal_effect"]

    channels = sorted(set(base_w.index) | set(dd_w.index))
    cmp_rows = []
    for ch in channels:
        b = float(base_w.get(ch, 0.0))
        d = float(dd_w.get(ch, 0.0))
        cmp_rows.append({
            "channel": ch,
            "markov_baseline_%": b * 100,
            "markov_deduped_%": d * 100,
            "delta_pp": (d - b) * 100,
            "removal_baseline": float(base_re.get(ch, 0.0)),
            "removal_deduped": float(dd_re.get(ch, 0.0)),
        })

    cmp_df = pd.DataFrame(cmp_rows).sort_values(
        "markov_baseline_%", ascending=False
    ).reset_index(drop=True)

    print("\n" + "=" * 80)
    print("RESULTS — Markov attribution weights (%)")
    print("=" * 80)
    with pd.option_context("display.max_rows", None,
                            "display.width", 160,
                            "display.float_format", lambda x: f"{x:>10.4f}"):
        print(cmp_df.to_string(index=False))

    # ------------------------------------------------------------------
    # Interpretation
    # ------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("INTERPRETATION")
    print("=" * 80)
    for tgt in sorted(TARGETS):
        b = float(base_w.get(tgt, 0.0)) * 100
        d = float(dd_w.get(tgt, 0.0)) * 100
        b_re = float(base_re.get(tgt, 0.0))
        d_re = float(dd_re.get(tgt, 0.0))
        print(f"\n  {tgt}:")
        print(f"    baseline attribution = {b:.4f}%   (removal_effect = {b_re:.6e})")
        print(f"    deduped  attribution = {d:.4f}%   (removal_effect = {d_re:.6e})")
        print(f"    delta                = {d - b:+.4f} pp")
        if b_re == 0 and d_re > 0:
            print(f"    => UNHIDDEN: channel went from 0% to {d:.4f}% under dedupe.")
        elif d_re > b_re and b_re > 0:
            factor = d_re / b_re
            print(f"    => boosted {factor:.2f}x in removal effect under dedupe.")
        elif d_re == 0:
            print(f"    => STILL HIDDEN: removal effect remains 0 even after dedupe.")
        else:
            print(f"    => weight changed; see numbers above.")


if __name__ == "__main__":
    main()
