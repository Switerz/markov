"""
Budget allocation: current spend vs Markov-recommended split.

Loads Raw Channel Markov attribution and channel spend for the same window,
then computes a proportional reallocation across paid channels.

Notes on interpretation:
  - This is the simplest "operational" reallocation rule — keep total budget
    constant, distribute proportional to Markov attribution share among
    paid channels. It is NOT a marginal-ROAS optimizer (we don't have
    response curves), so treat the recommendation as a direction, not a
    target. Big shifts (> 30% of channel's current spend) should be ramped,
    not flipped overnight.
  - Channels with high spend but ~0 attribution are flagged separately as
    *attribution gaps* — most likely UTM/tracking issues (Paid Meta Ads in
    May/2026 is the canonical case). They should NOT be defunded based on
    this model alone; fix the gap first.

Usage:
    PYTHONPATH=. .venv/bin/python analysis/budget_allocation.py [start] [end]
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

import config
from extract import (
    get_channel_spend,
    get_conversion_rate,
    get_converting_transitions,
    get_nonconverting_transitions,
    get_total_revenue,
)
from markov import (
    build_transition_matrix,
    calibrate_nonconv_scale,
    compute_attribution,
    compute_removal_effects,
)


PAID_CHANNELS = config.PAID_CHANNELS | {"Email", "SMS", "WhatsApp CRM"}  # owned media has unit cost

# Spend ≥ this and attribution < 2% → flag as gap, don't reallocate
GAP_SPEND_FLOOR = 50_000.0
GAP_ATTRIBUTION_CEIL = 0.02


def _pct(x: float) -> str:
    if pd.isna(x):
        return "—"
    return f"{x*100:.2f}%"


def _money(x: float) -> str:
    if pd.isna(x):
        return "—"
    return f"R$ {x:,.0f}".replace(",", ".")


def _delta_money(x: float) -> str:
    sign = "+" if x >= 0 else "−"
    return f"{sign}R$ {abs(x):,.0f}".replace(",", ".")


def run(start: str, end: str) -> None:
    print(f"\nJanela: {start} a {end}")
    print(f"lookback={config.LOOKBACK_DAYS}d  decay_lambda={config.DECAY_LAMBDA}\n")

    # ----------- Extraction ------------------------------------------------
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

    if config.NON_CONV_SCALE is None:
        target = get_conversion_rate(
            database_id=config.DB_PLAUSIBLE,
            start_date=start,
            end_date=end,
            sample_pct=config.NON_CONV_SAMPLE_PCT,
            censorship_days=config.CENSORSHIP_DAYS,
        )
        scale = calibrate_nonconv_scale(conv, nconv, target_rate=target)
        print(f"  observed conv rate: {_pct(target)}  →  scale={scale:.4f}")
    else:
        scale = config.NON_CONV_SCALE

    print("\nExtraindo spend …")
    spend_df = get_channel_spend(
        db_datamart=config.DB_DATAMART, start_date=start, end_date=end
    )
    total_spend = spend_df["spend"].sum()
    print(f"  total_spend: {_money(total_spend)}")
    print(f"  total ROAS:  {total_revenue / total_spend:.2f}x" if total_spend > 0 else "")

    # ----------- Markov attribution ----------------------------------------
    T, states = build_transition_matrix(conv, nconv, scale_nonconv=scale)
    removal_effects = compute_removal_effects(T, states)
    attrib = compute_attribution(removal_effects, conv, total_revenue=total_revenue)

    # ----------- Merge + reallocate ----------------------------------------
    attrib_s = attrib[["channel", "attribution_weight", "attributed_revenue"]].copy()
    merged = attrib_s.merge(spend_df, on="channel", how="outer").fillna(0.0)

    paid_mask = merged["channel"].isin(PAID_CHANNELS)
    paid = merged[paid_mask].copy()

    # Flag attribution gaps: high spend, near-zero attribution
    paid["is_gap"] = (
        (paid["spend"] >= GAP_SPEND_FLOOR)
        & (paid["attribution_weight"] < GAP_ATTRIBUTION_CEIL)
    )

    # Reallocate within paid, EXCLUDING gap channels (don't touch them)
    paid_for_reallocation = paid[~paid["is_gap"]].copy()
    reallocation_pool = paid_for_reallocation["spend"].sum()
    gap_spend = paid.loc[paid["is_gap"], "spend"].sum()

    attr_share_sum = paid_for_reallocation["attribution_weight"].sum()
    paid_for_reallocation["attr_share_normalized"] = (
        paid_for_reallocation["attribution_weight"] / attr_share_sum
        if attr_share_sum > 0 else 0.0
    )
    paid_for_reallocation["recommended_spend"] = (
        paid_for_reallocation["attr_share_normalized"] * reallocation_pool
    )

    paid = paid.merge(
        paid_for_reallocation[["channel", "attr_share_normalized", "recommended_spend"]],
        on="channel",
        how="left",
    )
    # Gap channels keep current spend until tracking is fixed
    paid.loc[paid["is_gap"], "recommended_spend"] = paid["spend"]
    paid["delta_spend"] = paid["recommended_spend"] - paid["spend"]
    paid["delta_pct"] = np.where(
        paid["spend"] > 0,
        paid["delta_spend"] / paid["spend"],
        np.nan,
    )
    paid["current_share"] = (
        paid["spend"] / total_spend if total_spend > 0 else 0.0
    )
    paid["recommended_share"] = (
        paid["recommended_spend"] / total_spend if total_spend > 0 else 0.0
    )
    paid["roas_current"] = np.where(
        paid["spend"] > 0,
        paid["attributed_revenue"] / paid["spend"],
        np.nan,
    )
    paid = paid.sort_values("spend", ascending=False).reset_index(drop=True)

    # ----------- Report ----------------------------------------------------
    print("\n" + "=" * 96)
    print("  ALOCAÇÃO DE ORÇAMENTO — atual vs recomendado pelo Markov (raw channel)")
    print("=" * 96)
    print(
        f"  Total spend: {_money(total_spend)}  | "
        f"reallocation pool: {_money(reallocation_pool)}  | "
        f"gap (fixed): {_money(gap_spend)}"
    )
    print()

    view = paid.copy()
    view["attribution"] = view["attribution_weight"].map(_pct)
    view["roas"] = view["roas_current"].map(
        lambda v: f"{v:.2f}x" if pd.notna(v) and v > 0 else "—"
    )
    view["current"] = view["spend"].map(_money)
    view["recommended"] = view["recommended_spend"].map(_money)
    view["delta"] = view["delta_spend"].map(_delta_money)
    view["delta_pct"] = view["delta_pct"].map(
        lambda v: f"{v*100:+.1f}%" if pd.notna(v) else "—"
    )
    view["share_now"] = view["current_share"].map(_pct)
    view["share_rec"] = view["recommended_share"].map(_pct)
    view["flag"] = view["is_gap"].map(lambda b: "⚠ GAP" if b else "")

    cols = ["channel", "current", "share_now", "attribution", "roas",
            "recommended", "share_rec", "delta", "delta_pct", "flag"]
    print(view[cols].to_string(index=False))

    # ----------- Attribution gaps explained --------------------------------
    gaps = paid[paid["is_gap"]]
    if not gaps.empty:
        print("\n" + "-" * 96)
        print("  ⚠  ATTRIBUTION GAPS — não realocar até confirmar tracking")
        print("-" * 96)
        for _, r in gaps.iterrows():
            print(
                f"  {r['channel']:<25}  spend={_money(r['spend'])}  "
                f"attribution={_pct(r['attribution_weight'])}  "
                f"(spend ≥ R$ {GAP_SPEND_FLOOR:,.0f} mas atribuição < "
                f"{GAP_ATTRIBUTION_CEIL*100:.0f}%)".replace(",", ".")
            )
        print(
            "  Causa provável: UTM/source classificado em outro bucket, ou "
            "domínio paid sem rastreio de sessão. Auditar antes de mexer no budget."
        )

    # ----------- Material moves --------------------------------------------
    print("\n" + "-" * 96)
    print("  MOVIMENTOS MATERIAIS (excluindo gaps; ordenado por R$ absoluto)")
    print("-" * 96)
    movers = paid[~paid["is_gap"]].copy()
    movers = movers[movers["delta_spend"].abs() >= 10_000]
    movers = movers.sort_values("delta_spend", key=lambda s: s.abs(), ascending=False)
    if movers.empty:
        print("  (Nenhum canal com delta absoluto ≥ R$ 10.000)")
    else:
        for _, r in movers.iterrows():
            direction = "AUMENTAR" if r["delta_spend"] > 0 else "REDUZIR"
            print(
                f"  {direction:<9} {r['channel']:<25}  "
                f"de {_money(r['spend'])} → {_money(r['recommended_spend'])}  "
                f"({_delta_money(r['delta_spend'])}, "
                f"{r['delta_pct']*100:+.0f}%)  "
                f"ROAS atual: {r['roas_current']:.2f}x"
                if pd.notna(r["roas_current"]) else
                f"  {direction:<9} {r['channel']:<25}  "
                f"de {_money(r['spend'])} → {_money(r['recommended_spend'])}  "
                f"({_delta_money(r['delta_spend'])})"
            )

    # ----------- Validation ------------------------------------------------
    print("\n" + "-" * 96)
    rec_sum = paid["recommended_spend"].sum()
    print(
        f"  Validação: spend recomendado total = {_money(rec_sum)} "
        f"(diff vs atual: {_delta_money(rec_sum - total_spend)})"
    )
    if abs(rec_sum - total_spend) > 1.0:
        print("  ⚠ recommended_spend != current_spend — verifique reallocação.")
    print("\n  ✓ Fim.")


if __name__ == "__main__":
    start = sys.argv[1] if len(sys.argv) > 1 else config.START_DATE
    end = sys.argv[2] if len(sys.argv) > 2 else config.END_DATE
    run(start, end)
