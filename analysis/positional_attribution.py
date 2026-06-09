"""Hypothesis 1: First-click + Last-click attribution.

Markov gives ubiquitous channels (Meta, Direct) near-zero weight because
removing them barely changes baseline conversion when they appear in both
converting and non-converting paths. First-click and last-click ignore
that and credit by position only — useful as a triangulation check for
the ubiquity-bias hypothesis.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import pandas as pd

from gograph.backend.app.services.loop_service import parse_path
from markov import (
    build_transition_matrix,
    compute_attribution,
    compute_removal_effects,
)

CACHE = Path("/tmp/markov_cache")


def positional_credit(raw_paths: pd.DataFrame) -> tuple[dict[str, float], dict[str, float]]:
    """Walk converting paths once, accumulate first/last channel revenue."""
    first_rev: dict[str, float] = defaultdict(float)
    last_rev: dict[str, float] = defaultdict(float)

    conv = raw_paths[raw_paths["converted"] == 1]
    for _, row in conv.iterrows():
        channels = parse_path(row["path_sequence"])
        if not channels:
            continue
        credit = float(row["revenue"]) * int(row["occurrences"])
        first_rev[channels[0]] += credit
        last_rev[channels[-1]] += credit

    return dict(first_rev), dict(last_rev)


def to_weights(rev_by_ch: dict[str, float]) -> dict[str, float]:
    total = sum(rev_by_ch.values())
    if total == 0:
        return {c: 0.0 for c in rev_by_ch}
    return {c: v / total for c, v in rev_by_ch.items()}


def main() -> None:
    raw = pd.read_pickle(CACHE / "raw_paths.pkl")
    conv_df = pd.read_pickle(CACHE / "conv.pkl")
    nconv_df = pd.read_pickle(CACHE / "nconv.pkl")
    params = json.loads((CACHE / "params.json").read_text())
    total_revenue = float(params["total_revenue"])
    non_conv_scale = float(params["non_conv_scale"])

    print(f"Loaded raw_paths: {len(raw)} rows ({(raw['converted']==1).sum()} converting)")
    print(f"total_revenue = {total_revenue:,.2f} | non_conv_scale = {non_conv_scale:.4f}\n")

    # Positional attribution
    first_rev, last_rev = positional_credit(raw)
    first_w = to_weights(first_rev)
    last_w = to_weights(last_rev)

    # Markov
    T, states = build_transition_matrix(conv_df, nconv_df, scale_nonconv=non_conv_scale)
    effects = compute_removal_effects(T, states)
    markov_df = compute_attribution(effects, conv_df, total_revenue=total_revenue)

    markov_w = dict(zip(markov_df["channel"], markov_df["attribution_weight"]))
    markov_rev = dict(zip(markov_df["channel"], markov_df["attributed_revenue"]))

    # Union of channel names across schemes
    all_channels = set(markov_w) | set(first_w) | set(last_w)

    rows = []
    for ch in all_channels:
        rows.append({
            "channel": ch,
            "markov_w": markov_w.get(ch, 0.0),
            "first_w": first_w.get(ch, 0.0),
            "last_w": last_w.get(ch, 0.0),
            "first_revenue": first_rev.get(ch, 0.0),
            "last_revenue": last_rev.get(ch, 0.0),
            "markov_revenue": markov_rev.get(ch, 0.0),
        })

    df = pd.DataFrame(rows).sort_values("markov_w", ascending=False).reset_index(drop=True)

    # ── Side-by-side table ───────────────────────────────────────────────
    print("=" * 120)
    print("ATTRIBUTION COMPARISON: Markov vs First-Click vs Last-Click")
    print("=" * 120)
    header = (
        f"{'channel':<28} | {'markov_w':>9} | {'first_w':>9} | {'last_w':>9} | "
        f"{'first_revenue':>15} | {'last_revenue':>15} | {'markov_revenue':>15}"
    )
    print(header)
    print("-" * len(header))
    for _, r in df.iterrows():
        print(
            f"{r['channel']:<28} | "
            f"{r['markov_w']:>9.4f} | {r['first_w']:>9.4f} | {r['last_w']:>9.4f} | "
            f"{r['first_revenue']:>15,.2f} | {r['last_revenue']:>15,.2f} | {r['markov_revenue']:>15,.2f}"
        )

    # ── Totals sanity check ──────────────────────────────────────────────
    print("-" * len(header))
    print(
        f"{'TOTAL':<28} | "
        f"{df['markov_w'].sum():>9.4f} | {df['first_w'].sum():>9.4f} | {df['last_w'].sum():>9.4f} | "
        f"{df['first_revenue'].sum():>15,.2f} | {df['last_revenue'].sum():>15,.2f} | "
        f"{df['markov_revenue'].sum():>15,.2f}"
    )

    # ── Divergence section ───────────────────────────────────────────────
    print("\n" + "=" * 120)
    print("DIVERGENCE: |first_w - markov_w| > 5pp  OR  |last_w - markov_w| > 5pp")
    print("=" * 120)

    div_rows = []
    for _, r in df.iterrows():
        d_first = r["first_w"] - r["markov_w"]
        d_last = r["last_w"] - r["markov_w"]
        if abs(d_first) > 0.05 or abs(d_last) > 0.05:
            div_rows.append((r["channel"], r["markov_w"], r["first_w"], r["last_w"], d_first, d_last))

    if not div_rows:
        print("(no channels exceed the 5pp threshold)")
    else:
        h = f"{'channel':<28} | {'markov_w':>9} | {'first_w':>9} | {'last_w':>9} | {'Δfirst':>8} | {'Δlast':>8} | interpretation"
        print(h)
        print("-" * len(h))
        for ch, mw, fw, lw, df_, dl in div_rows:
            # Interpretation: which scheme finds value Markov misses, or vice versa?
            tags = []
            if df_ > 0.05:
                tags.append("first-click gains → likely AWARENESS / entry-point role hidden by Markov")
            if dl > 0.05:
                tags.append("last-click gains → CLOSER role hidden by Markov")
            if df_ < -0.05:
                tags.append("Markov > first-click → mid-funnel transit role")
            if dl < -0.05:
                tags.append("Markov > last-click → mid-funnel transit role")
            interp = "; ".join(tags) if tags else ""
            print(
                f"{ch:<28} | {mw:>9.4f} | {fw:>9.4f} | {lw:>9.4f} | "
                f"{df_:>+8.4f} | {dl:>+8.4f} | {interp}"
            )


if __name__ == "__main__":
    main()
