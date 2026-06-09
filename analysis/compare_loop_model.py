"""
Compare Raw Channel Markov vs Loop-State Markov on real data.

Pulls raw_paths (no Metabase row cap), runs both models with the same
total_revenue and non_conv_scale, and prints a side-by-side channel table
plus the loop-share breakdown.

Usage:
    python analysis/compare_loop_model.py [YYYY-MM-DD] [YYYY-MM-DD]
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

import config
from extract import (
    get_converting_transitions,
    get_nonconverting_transitions,
    get_raw_paths,
    get_total_revenue,
    get_conversion_rate,
)
from markov import (
    build_transition_matrix,
    calibrate_nonconv_scale,
    compute_attribution,
    compute_removal_effects,
)
from gograph.backend.app.services.loop_state_service import run_loop_state_markov


def _pct(x: float) -> str:
    if pd.isna(x):
        return "—"
    return f"{x*100:.2f}%"


def _money(x: float) -> str:
    return f"R$ {x:,.0f}".replace(",", ".")


def main(start: str, end: str) -> None:
    print(f"\nJanela: {start} a {end}")
    print(f"lookback={config.LOOKBACK_DAYS}d  decay_lambda={config.DECAY_LAMBDA}\n")

    # ----------- Extraction ------------------------------------------------
    print("Extraindo raw paths (no_limit=True) …")
    raw_paths = get_raw_paths(
        database_id=config.DB_PLAUSIBLE,
        start_date=start,
        end_date=end,
        lookback=config.LOOKBACK_DAYS,
        no_limit=True,
        nonconv_sample_pct=config.NON_CONV_SAMPLE_PCT,
    )
    print(f"  raw_paths rows: {len(raw_paths):,}")

    print("Extraindo transitions agregadas …")
    conv = get_converting_transitions(
        database_id=config.DB_PLAUSIBLE,
        start_date=start,
        end_date=end,
        lookback=config.LOOKBACK_DAYS,
        decay_lambda=config.DECAY_LAMBDA,
    )
    nconv = get_nonconverting_transitions(
        database_id=config.DB_PLAUSIBLE,
        start_date=start,
        end_date=end,
        sample_pct=config.NON_CONV_SAMPLE_PCT,
        censorship_days=config.CENSORSHIP_DAYS,
    )
    total_revenue = get_total_revenue(
        database_id=config.DB_PLAUSIBLE, start_date=start, end_date=end
    )
    print(f"  total_revenue: {_money(total_revenue)}")

    # ----------- Calibrate non_conv_scale ----------------------------------
    if config.NON_CONV_SCALE is None:
        target = get_conversion_rate(
            database_id=config.DB_PLAUSIBLE,
            start_date=start,
            end_date=end,
            sample_pct=config.NON_CONV_SAMPLE_PCT,
            censorship_days=config.CENSORSHIP_DAYS,
        )
        print(f"  observed conversion rate: {_pct(target)}")
        scale = calibrate_nonconv_scale(conv, nconv, target_rate=target)
        print(f"  calibrated non_conv_scale: {scale:.4f}")
    else:
        scale = config.NON_CONV_SCALE
        print(f"  fixed non_conv_scale: {scale:.4f}")

    # ----------- Raw channel Markov ----------------------------------------
    print("\nRodando Raw Channel Markov …")
    T_raw, states_raw = build_transition_matrix(conv, nconv, scale_nonconv=scale)
    re_raw = compute_removal_effects(T_raw, states_raw)
    raw_attrib = compute_attribution(re_raw, conv, total_revenue=total_revenue)
    print(f"  estados: {len(states_raw)}")

    # ----------- Loop-state Markov -----------------------------------------
    print("Rodando Loop-State Markov (mesma raw_paths) …")
    state_df, channel_df = run_loop_state_markov(
        raw_paths=raw_paths,
        total_revenue=total_revenue,
        non_conv_scale=scale,
        shapley_samples=1000,
    )
    print(f"  estados compostos: {len(state_df) if not state_df.empty else 0}")

    # ----------- Channel-level comparison ----------------------------------
    print("\n" + "=" * 82)
    print("  COMPARAÇÃO POR CANAL — Raw Markov vs Loop-State Markov")
    print("=" * 82)
    raw_simple = raw_attrib[["channel", "attribution_weight", "attributed_revenue"]].rename(
        columns={
            "attribution_weight": "raw_w",
            "attributed_revenue": "raw_revenue",
        }
    )
    loop_simple = channel_df[
        ["channel", "markov_weight", "markov_revenue",
         "markov_weight_single", "markov_weight_loop",
         "loop_share_of_value_markov"]
    ].rename(columns={"markov_weight": "loop_w", "markov_revenue": "loop_revenue"})
    merged = raw_simple.merge(loop_simple, on="channel", how="outer").fillna(0.0)
    merged["delta_pp"] = (merged["loop_w"] - merged["raw_w"]) * 100
    merged = merged.sort_values("raw_w", ascending=False)

    view = merged.copy()
    view["raw_w"] = view["raw_w"].map(_pct)
    view["loop_w"] = view["loop_w"].map(_pct)
    view["delta_pp"] = view["delta_pp"].map(lambda v: f"{v:+.2f}pp")
    view["raw_revenue"] = view["raw_revenue"].map(_money)
    view["loop_revenue"] = view["loop_revenue"].map(_money)
    view["markov_weight_single"] = view["markov_weight_single"].map(_pct)
    view["markov_weight_loop"] = view["markov_weight_loop"].map(_pct)
    view["loop_share_of_value_markov"] = view["loop_share_of_value_markov"].map(_pct)

    show_cols = [
        "channel", "raw_w", "loop_w", "delta_pp",
        "markov_weight_single", "markov_weight_loop", "loop_share_of_value_markov",
    ]
    print(view[show_cols].to_string(index=False))

    # ----------- State-level breakdown -------------------------------------
    print("\n" + "=" * 82)
    print("  STATE-LEVEL (top 20 por removal_effect)")
    print("=" * 82)
    if not state_df.empty:
        st = state_df.nlargest(20, "removal_effect").copy()
        st["markov_weight"] = st["markov_weight"].map(_pct)
        st["shapley_weight"] = st["shapley_weight"].map(_pct)
        st["presence_converting"] = st["presence_converting"].map(_pct)
        st["presence_nonconverting"] = st["presence_nonconverting"].map(_pct)
        st["removal_effect"] = st["removal_effect"].map(lambda v: f"{v:.5f}")
        print(st[
            ["state", "markov_weight", "shapley_weight", "removal_effect",
             "presence_converting", "presence_nonconverting", "support", "confidence"]
        ].to_string(index=False))

    # ----------- Diagnostic notes ------------------------------------------
    print("\n" + "=" * 82)
    print("  NOTAS")
    print("=" * 82)
    # Aggregation paradox check — only triggers if someone reverts to joint
    # removal effect at channel level. With additive aggregation this should
    # never fire; left in as a regression sentinel.
    state_sum_by_channel = (
        state_df.groupby("channel")["markov_weight"].sum().to_dict()
        if not state_df.empty else {}
    )
    paradox = []
    for _, r in channel_df.iterrows():
        s_sum = state_sum_by_channel.get(r["channel"], 0.0)
        if s_sum > 0.005 and r["markov_weight"] < 0.5 * s_sum:
            paradox.append((r["channel"], r["markov_weight"], s_sum))
    if paradox:
        print(
            f"  ⚠  {len(paradox)} canais com agregado de canal < 50% da soma dos "
            "estados — paradoxo de removal effect ainda presente:"
        )
        for ch, agg, ssum in paradox[:5]:
            print(f"     {ch:<30}  channel={_pct(agg)}  state_sum={_pct(ssum)}")
    else:
        print("  ✓ Sem paradoxo de agregação — channel = Σ state-level weights.")

    big_shifts = merged[merged["delta_pp"].abs() > 5.0] if "delta_pp" in merged else pd.DataFrame()
    if not big_shifts.empty:
        print(
            f"\n  Deltas Raw → Loop > 5pp em {len(big_shifts)} canais "
            "— compressão de loop mudava o peso destes:"
        )
        for _, r in big_shifts.iterrows():
            print(f"     {r['channel']:<30}  delta={r['delta_pp']:+.2f}pp")

    print("\n  ✓ Fim da comparação.")


if __name__ == "__main__":
    start = sys.argv[1] if len(sys.argv) > 1 else config.START_DATE
    end = sys.argv[2] if len(sys.argv) > 2 else config.END_DATE
    main(start, end)
