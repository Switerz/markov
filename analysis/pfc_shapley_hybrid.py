"""
PFC + Shapley assist boost — atribuição híbrida.

Combina PFC (Position-Frequency-Causal) com Shapley aditivamente, de forma a:
  - PRESERVAR o crédito que PFC dá a canais ubíquos (Meta, Direct) —
    porque Shapley herda o blind spot do Markov para esses.
  - ADICIONAR crédito quando Shapley enxerga valor que PFC não vê
    (canais de puro assist como Referral, Clube GoCase).

Fórmula:
  assist_signal(c) = max(0, shapley(c) - pfc(c))   # só lift, nunca corte
  hybrid(c) = pfc(c) + γ × assist_signal(c)
  normalize.

γ controla quanto valorizar o assist signal:
  γ=0:  pura PFC
  γ=0.5 (default): assist puro vira ~2x do PFC para canais como Referral
  γ=1.0: assist signal pleno

Importante: NÃO usa multiplicação. PFC × Shapley zeraria Meta de volta
(porque Shapley(Meta)=0). A operação max + soma garante que a "perna PFC"
nunca seja apagada.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

import config
from markov import (
    build_transition_matrix,
    compute_attribution,
    compute_removal_effects,
    compute_shapley_values,
)
from analysis.position_frequency_causal import (
    apply_causal,
    build_lift,
    build_positional,
    normalize,
)


CACHE = Path("/tmp/markov_cache")
GAMMA = 0.5  # assist boost strength
ALPHA = 0.3  # same as PFC
SHAPLEY_SAMPLES = 3000
SPECIAL_STATES = {"(start)", "Conversion", "Non-Conversion"}


def _pct(x: float) -> str:
    if pd.isna(x):
        return "—"
    return f"{x*100:.2f}%"


def _money(x: float) -> str:
    if pd.isna(x) or x == 0:
        return "R$ 0"
    return f"R$ {x:,.0f}".replace(",", ".")


def main() -> None:
    if not (CACHE / "raw_paths.pkl").exists():
        print("Cache ausente; rode analysis/_cache_extract.py.", file=sys.stderr)
        sys.exit(1)

    raw = pd.read_pickle(CACHE / "raw_paths.pkl")
    conv_tx = pd.read_pickle(CACHE / "conv.pkl")
    nconv_tx = pd.read_pickle(CACHE / "nconv.pkl")
    spend_df = pd.read_pickle(CACHE / "spend.pkl")
    params = json.loads((CACHE / "params.json").read_text())
    total_revenue = float(params["total_revenue"])
    scale = float(params["non_conv_scale"])

    print(f"\nJanela: {params['start']} a {params['end']}")
    print(
        f"total_revenue: {_money(total_revenue)}  |  scale={scale:.2f}  |  "
        f"α(PFC)={ALPHA}  γ(assist)={GAMMA}\n"
    )

    # --- Markov + Shapley (raw channel) ---
    T, states = build_transition_matrix(conv_tx, nconv_tx, scale_nonconv=scale)
    removal_effects = compute_removal_effects(T, states)
    markov_attrib = compute_attribution(removal_effects, conv_tx, total_revenue=total_revenue)
    markov_w = dict(zip(markov_attrib["channel"], markov_attrib["attribution_weight"]))

    print(f"Calculando Shapley ({SHAPLEY_SAMPLES} samples) …")
    shapley_raw = compute_shapley_values(T, states, n_samples=SHAPLEY_SAMPLES, seed=42)
    # Drop special states, clip negatives, normalize
    sh_filtered = {
        s: max(v, 0.0)
        for s, v in shapley_raw.items()
        if s not in SPECIAL_STATES
    }
    shapley_w = normalize(sh_filtered)

    # --- PFC ---
    usf_credit, _, _, _ = build_positional(raw)
    _, _, lift = build_lift(raw)
    pfc_credit = apply_causal(usf_credit, lift, ALPHA)
    pfc_w = normalize(pfc_credit)

    # --- Hybrid: PFC + γ × max(0, Shapley − PFC) ---
    channels = set(pfc_w) | set(shapley_w) | set(markov_w)
    hybrid_raw: dict[str, float] = {}
    assist_signal: dict[str, float] = {}
    for c in channels:
        pfc = pfc_w.get(c, 0.0)
        sh = shapley_w.get(c, 0.0)
        ay = max(0.0, sh - pfc)
        assist_signal[c] = ay
        hybrid_raw[c] = pfc + GAMMA * ay
    hybrid_w = normalize(hybrid_raw)

    # --- Spend lookup ---
    spend_lookup = dict(zip(spend_df["channel"], spend_df["spend"]))

    # --- Master table ---
    rows = []
    for c in sorted(channels):
        rows.append({
            "channel": c,
            "markov_w": markov_w.get(c, 0.0),
            "shapley_w": shapley_w.get(c, 0.0),
            "pfc_w": pfc_w.get(c, 0.0),
            "assist_pp": assist_signal[c] * 100,
            "hybrid_w": hybrid_w.get(c, 0.0),
            "delta_vs_pfc_pp": (hybrid_w.get(c, 0.0) - pfc_w.get(c, 0.0)) * 100,
            "hybrid_revenue": hybrid_w.get(c, 0.0) * total_revenue,
            "spend": float(spend_lookup.get(c, 0.0)),
        })
    df = pd.DataFrame(rows).sort_values("hybrid_w", ascending=False)

    # --- Comparison view ---
    print("\n" + "=" * 110)
    print("  COMPARAÇÃO — Markov | Shapley | PFC | Assist signal | Hybrid")
    print("=" * 110)
    view = df.copy()
    for col in ["markov_w", "shapley_w", "pfc_w", "hybrid_w"]:
        view[col] = view[col].map(_pct)
    view["assist_pp"] = view["assist_pp"].map(
        lambda v: f"+{v:.2f}pp" if v > 0.01 else "—"
    )
    view["delta_vs_pfc_pp"] = view["delta_vs_pfc_pp"].map(
        lambda v: f"{v:+.2f}pp" if abs(v) > 0.01 else "—"
    )
    print(view[[
        "channel", "markov_w", "shapley_w", "pfc_w",
        "assist_pp", "hybrid_w", "delta_vs_pfc_pp",
    ]].rename(columns={
        "assist_pp": "assist",
        "delta_vs_pfc_pp": "Δ vs PFC",
    }).to_string(index=False))

    # --- Revenue + ROAS view ---
    print("\n" + "=" * 110)
    print("  RECEITA E ROAS (sob Hybrid)")
    print("=" * 110)
    rev_view = df.copy()
    rev_view["share"] = rev_view["hybrid_w"].map(_pct)
    rev_view["receita"] = rev_view["hybrid_revenue"].map(_money)
    rev_view["spend_fmt"] = rev_view["spend"].map(_money)
    rev_view["roas"] = rev_view.apply(
        lambda r: f"{r['hybrid_revenue']/r['spend']:.2f}x" if r["spend"] > 0 else "—",
        axis=1,
    )
    print(rev_view[["channel", "share", "receita", "spend_fmt", "roas"]]
          .rename(columns={"spend_fmt": "spend"})
          .to_string(index=False))

    # --- Budget reallocation ---
    paid_channels = config.PAID_CHANNELS | {"Email", "SMS", "WhatsApp CRM"}
    bud = df[df["channel"].isin(paid_channels) & (df["spend"] > 0)].copy()
    total_pool = bud["spend"].sum()
    attr_sum = bud["hybrid_w"].sum()
    bud["recommended_spend"] = (
        bud["hybrid_w"] / attr_sum * total_pool if attr_sum > 0 else bud["spend"]
    )
    bud["delta_spend"] = bud["recommended_spend"] - bud["spend"]
    bud["delta_pct"] = np.where(
        bud["spend"] > 0, bud["delta_spend"] / bud["spend"], np.nan
    )

    print("\n" + "=" * 110)
    print(f"  REALOCAÇÃO DE BUDGET (Hybrid) — pool: {_money(total_pool)}")
    print("=" * 110)
    bud = bud.sort_values("spend", ascending=False)
    bud_view = bud.copy()
    bud_view["share_now"] = (bud["spend"] / total_pool).map(_pct)
    bud_view["share_rec"] = (bud["recommended_spend"] / total_pool).map(_pct)
    bud_view["spend_fmt"] = bud["spend"].map(_money)
    bud_view["rec_fmt"] = bud["recommended_spend"].map(_money)
    bud_view["delta_fmt"] = bud["delta_spend"].map(
        lambda v: f"{'+' if v >= 0 else '−'}R$ {abs(v):,.0f}".replace(",", ".")
    )
    bud_view["delta_pct"] = bud["delta_pct"].map(
        lambda v: f"{v*100:+.0f}%" if pd.notna(v) else "—"
    )
    bud_view["hybrid_share"] = bud["hybrid_w"].map(_pct)
    print(bud_view[[
        "channel", "spend_fmt", "share_now", "hybrid_share",
        "rec_fmt", "share_rec", "delta_fmt", "delta_pct",
    ]].rename(columns={
        "spend_fmt": "spend_atual",
        "rec_fmt": "spend_rec",
        "hybrid_share": "Hybrid_w",
    }).to_string(index=False))

    print(
        f"\nValidação: Σ rec = {_money(bud['recommended_spend'].sum())}  "
        f"vs pool {_money(total_pool)}"
    )

    # --- Sanity: zero protection ---
    print("\n" + "-" * 110)
    print("  Sanidade — canais que dependem do floor PFC (Shapley=0, PFC>0):")
    protected = df[(df["shapley_w"] < 0.001) & (df["pfc_w"] >= 0.01)].copy()
    if not protected.empty:
        for _, r in protected.iterrows():
            print(
                f"    {r['channel']:<30}  "
                f"shapley={_pct(r['shapley_w'])}  "
                f"pfc={_pct(r['pfc_w'])}  "
                f"hybrid={_pct(r['hybrid_w'])}  "
                "(preservado por construção)"
            )
    print("\n  ✓ Fim.")


if __name__ == "__main__":
    main()
