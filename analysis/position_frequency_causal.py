"""
PFC — Position-Frequency-Causal Attribution.

Objetivo: dar peso a um canal pela combinação de (a) onde ele aparece na
jornada, (b) quantas vezes aparece, e (c) o quanto sua presença é
discriminativa para a conversão. Resolve o cego do Markov para canais
ubíquos (Meta, Direct) sem virar puramente first/last-click.

Por path convertedor de tamanho N (c_1, ..., c_N):
  - N=1: 100% pro único toque
  - N=2: 50% first, 50% last
  - N≥3: 40% first, 40% last, 20% / (N-2) por toque no meio  ← freq natural
        cada ocorrência soma sua fatia, então uma cadeia 3x no meio acumula
        3 × (0.20/m).

Crédito agregado: Σ paths conv: position_weight(ch, p) × revenue(p)

Ajuste causal: causal_factor(ch) = lift(ch) ** α
  lift = share_conv(ch) / share_nconv(ch)
  α = 0.3 (suave) — preserva ordem mas reconcilia presença com sinal causal
    α=0: pura posicional
    α=1: lift linear (distorce demais)

Normaliza para 100%.

Saída: tabela canal × {Markov, First, Last, Blended, USF, PFC} com receita
e ROAS por canal, e diff vs Markov.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

import config
from extract import get_channel_spend
from markov import (
    build_transition_matrix,
    compute_attribution,
    compute_removal_effects,
)


CACHE = Path("/tmp/markov_cache")

ALPHA = 0.3  # exponent on lift; controls causal influence
INF_LIFT_CAP = 5.0  # cap lift when share_nconv == 0

UBIQUITY_BAND = (0.7, 1.3)  # for blended (same as H2)
UBIQUITY_MIN_SHARE = 0.02


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_path(s: str) -> list[str]:
    """Path separator in raw_paths is ' -> ' (ASCII), not ' → ' (unicode)."""
    if not s or pd.isna(s):
        return []
    return [c.strip() for c in s.split(" -> ") if c.strip()]


def position_credit(channels: list[str]) -> dict[str, float]:
    """Retorna {channel: credit} somando 1.0 ao todo. Por posição, com
    contagem nativa (canal repetido no meio acumula peso).
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
    middle = channels[1:-1]
    per_mid = 0.20 / len(middle)
    for ch in middle:
        d[ch] = d.get(ch, 0.0) + per_mid
    return d


def _pct(x: float) -> str:
    if pd.isna(x):
        return "—"
    return f"{x*100:.2f}%"


def _money(x: float) -> str:
    if pd.isna(x) or x == 0:
        return "R$ 0"
    return f"R$ {x:,.0f}".replace(",", ".")


# ---------------------------------------------------------------------------
# Build per-channel signals
# ---------------------------------------------------------------------------

def build_positional(raw: pd.DataFrame) -> tuple[dict, dict, float]:
    """Returns (usf_credit, first_credit, last_credit) all in revenue units."""
    converting = raw[raw["converted"] == 1]
    usf: dict[str, float] = {}
    first: dict[str, float] = {}
    last: dict[str, float] = {}
    rev_total = 0.0
    for _, row in converting.iterrows():
        chs = parse_path(row["path_sequence"])
        if not chs:
            continue
        revenue = float(row.get("revenue", 0.0))
        # Positional with frequency
        d = position_credit(chs)
        for ch, w in d.items():
            usf[ch] = usf.get(ch, 0.0) + w * revenue
        # First-click and last-click
        first[chs[0]] = first.get(chs[0], 0.0) + revenue
        last[chs[-1]] = last.get(chs[-1], 0.0) + revenue
        rev_total += revenue
    return usf, first, last, rev_total


def build_lift(raw: pd.DataFrame) -> tuple[dict, dict, dict]:
    """Returns (share_conv, share_nconv, lift) per channel based on raw_paths
    occurrence counts (count each toque, not each path)."""
    conv_count: dict[str, float] = {}
    nconv_count: dict[str, float] = {}
    for _, row in raw.iterrows():
        chs = parse_path(row["path_sequence"])
        target = conv_count if row["converted"] == 1 else nconv_count
        occ = float(row.get("occurrences", 1))
        for ch in chs:
            target[ch] = target.get(ch, 0.0) + occ

    conv_total = sum(conv_count.values())
    nconv_total = sum(nconv_count.values())
    share_c: dict[str, float] = {}
    share_n: dict[str, float] = {}
    lift: dict[str, float] = {}
    channels = set(conv_count) | set(nconv_count)
    for ch in channels:
        sc = conv_count.get(ch, 0.0) / conv_total if conv_total > 0 else 0.0
        sn = nconv_count.get(ch, 0.0) / nconv_total if nconv_total > 0 else 0.0
        share_c[ch] = sc
        share_n[ch] = sn
        if sn > 0:
            lift[ch] = sc / sn
        elif sc > 0:
            lift[ch] = float("inf")
        else:
            lift[ch] = 0.0
    return share_c, share_n, lift


def apply_causal(positional: dict, lift: dict, alpha: float) -> dict:
    """positional_credit × lift^alpha (inf lift → cap)."""
    out: dict[str, float] = {}
    for ch, pc in positional.items():
        l = lift.get(ch, 1.0)
        if np.isinf(l):
            l_eff = INF_LIFT_CAP
        elif l <= 0:
            l_eff = 0.001  # avoid power(0, 0.3) edge
        else:
            l_eff = l
        out[ch] = pc * (l_eff ** alpha)
    return out


def normalize(d: dict) -> dict:
    total = sum(d.values())
    if total <= 0:
        return {k: 0.0 for k in d}
    return {k: v / total for k, v in d.items()}


# ---------------------------------------------------------------------------
# Comparison runner
# ---------------------------------------------------------------------------

def main() -> None:
    if not (CACHE / "raw_paths.pkl").exists():
        print(
            f"Cache não encontrado em {CACHE}. Rode "
            "analysis/_cache_extract.py primeiro.",
            file=sys.stderr,
        )
        sys.exit(1)

    raw = pd.read_pickle(CACHE / "raw_paths.pkl")
    conv_tx = pd.read_pickle(CACHE / "conv.pkl")
    nconv_tx = pd.read_pickle(CACHE / "nconv.pkl")
    spend_df = pd.read_pickle(CACHE / "spend.pkl")
    params = json.loads((CACHE / "params.json").read_text())
    total_revenue = float(params["total_revenue"])
    scale = float(params["non_conv_scale"])

    print(f"\nJanela: {params['start']} a {params['end']}")
    print(f"total_revenue: {_money(total_revenue)}  |  scale={scale:.2f}")
    print(f"PFC: alpha={ALPHA}\n")

    # --- Markov (baseline) ---
    T, states = build_transition_matrix(conv_tx, nconv_tx, scale_nonconv=scale)
    re = compute_removal_effects(T, states)
    markov_attrib = compute_attribution(re, conv_tx, total_revenue=total_revenue)
    markov_w = dict(zip(markov_attrib["channel"], markov_attrib["attribution_weight"]))

    # --- Positional (USF / first / last) ---
    usf_credit, first_credit, last_credit, _ = build_positional(raw)
    usf_w = normalize(usf_credit)
    first_w = normalize(first_credit)
    last_w = normalize(last_credit)

    # --- Lift signals ---
    share_c, share_n, lift = build_lift(raw)

    # --- Blended (H2 logic) ---
    blended_credit: dict[str, float] = {}
    for ch in set(list(markov_w.keys()) + list(lift.keys())):
        l = lift.get(ch, 1.0)
        sc = share_c.get(ch, 0.0)
        in_band = (
            (UBIQUITY_BAND[0] <= l <= UBIQUITY_BAND[1])
            and sc >= UBIQUITY_MIN_SHARE
        )
        blended_credit[ch] = sc if in_band else markov_w.get(ch, 0.0)
    blended_w = normalize(blended_credit)

    # --- PFC (positional × lift^alpha) ---
    pfc_credit = apply_causal(usf_credit, lift, ALPHA)
    pfc_w = normalize(pfc_credit)

    # --- Spend lookup ---
    spend_lookup = dict(zip(spend_df["channel"], spend_df["spend"]))

    # --- Consolidate table ---
    channels = sorted(
        set(list(markov_w.keys()) + list(usf_w.keys()) + list(lift.keys()))
    )
    rows = []
    for ch in channels:
        mw = markov_w.get(ch, 0.0)
        fw = first_w.get(ch, 0.0)
        lw = last_w.get(ch, 0.0)
        bw = blended_w.get(ch, 0.0)
        uw = usf_w.get(ch, 0.0)
        pw = pfc_w.get(ch, 0.0)
        l = lift.get(ch, 0.0)
        sp = float(spend_lookup.get(ch, 0.0))
        pfc_rev = pw * total_revenue
        rows.append({
            "channel": ch,
            "markov_w": mw,
            "first_w": fw,
            "last_w": lw,
            "blended_w": bw,
            "usf_w": uw,
            "pfc_w": pw,
            "delta_pfc_vs_markov_pp": (pw - mw) * 100,
            "lift": l,
            "share_conv": share_c.get(ch, 0.0),
            "pfc_revenue": pfc_rev,
            "spend": sp,
            "roas_pfc": pfc_rev / sp if sp > 0 else float("nan"),
        })
    df = pd.DataFrame(rows).sort_values("pfc_w", ascending=False)

    # --- Print: full model comparison ---
    print("=" * 110)
    print("  COMPARAÇÃO POR CANAL — Markov | First | Last | Blended | USF | PFC")
    print("=" * 110)
    view = df.copy()
    for col in ["markov_w", "first_w", "last_w", "blended_w", "usf_w", "pfc_w",
                "share_conv"]:
        view[col] = view[col].map(_pct)
    view["delta"] = view["delta_pfc_vs_markov_pp"].map(lambda v: f"{v:+.2f}pp")
    view["lift"] = view["lift"].map(
        lambda v: "∞" if np.isinf(v) else (f"{v:.2f}x" if v > 0 else "—")
    )
    print(view[[
        "channel", "markov_w", "first_w", "last_w",
        "blended_w", "usf_w", "pfc_w", "delta", "lift",
    ]].to_string(index=False))

    # --- Revenue + ROAS view ---
    print("\n" + "=" * 110)
    print("  RECEITA E ROAS POR CANAL (sob PFC)")
    print("=" * 110)
    rev_view = df.copy()
    rev_view["pfc_revenue_fmt"] = rev_view["pfc_revenue"].map(_money)
    rev_view["spend_fmt"] = rev_view["spend"].map(_money)
    rev_view["roas_fmt"] = rev_view["roas_pfc"].map(
        lambda v: f"{v:.2f}x" if pd.notna(v) and v > 0 else "—"
    )
    rev_view["share"] = rev_view["pfc_w"].map(_pct)
    print(rev_view[[
        "channel", "share", "pfc_revenue_fmt",
        "spend_fmt", "roas_fmt",
    ]].rename(columns={
        "pfc_revenue_fmt": "receita_atribuida",
        "spend_fmt": "spend",
        "roas_fmt": "ROAS",
    }).to_string(index=False))

    # --- Budget reallocation (PFC-based) ---
    paid_channels = config.PAID_CHANNELS | {"Email", "SMS", "WhatsApp CRM"}
    bud = df[df["channel"].isin(paid_channels)].copy()
    bud = bud[bud["spend"] > 0].copy()
    total_paid_spend = bud["spend"].sum()
    paid_attr_sum = bud["pfc_w"].sum()
    bud["recommended_spend"] = np.where(
        paid_attr_sum > 0,
        bud["pfc_w"] / paid_attr_sum * total_paid_spend,
        bud["spend"],
    )
    bud["delta_spend"] = bud["recommended_spend"] - bud["spend"]
    bud["delta_pct"] = np.where(
        bud["spend"] > 0, bud["delta_spend"] / bud["spend"], np.nan
    )

    print("\n" + "=" * 110)
    print(
        f"  REALOCAÇÃO DE BUDGET — pool: {_money(total_paid_spend)} "
        "(canais pagos com spend > 0)"
    )
    print("=" * 110)
    bud_view = bud.copy().sort_values("spend", ascending=False)
    bud_view["share_now"] = bud_view["spend"] / total_paid_spend
    bud_view["share_rec"] = bud_view["recommended_spend"] / total_paid_spend
    bud_view["share_now"] = bud_view["share_now"].map(_pct)
    bud_view["share_rec"] = bud_view["share_rec"].map(_pct)
    bud_view["spend_fmt"] = bud_view["spend"].map(_money)
    bud_view["rec_fmt"] = bud_view["recommended_spend"].map(_money)
    bud_view["delta_fmt"] = bud_view["delta_spend"].map(
        lambda v: f"{'+' if v >= 0 else '−'}R$ {abs(v):,.0f}".replace(",", ".")
    )
    bud_view["delta_pct"] = bud_view["delta_pct"].map(
        lambda v: f"{v*100:+.0f}%" if pd.notna(v) else "—"
    )
    bud_view["pfc_share"] = bud_view["pfc_w"].map(_pct)
    print(bud_view[[
        "channel", "spend_fmt", "share_now", "pfc_share",
        "rec_fmt", "share_rec", "delta_fmt", "delta_pct",
    ]].rename(columns={
        "spend_fmt": "spend_atual",
        "rec_fmt": "spend_rec",
        "pfc_share": "PFC_w",
    }).to_string(index=False))

    print(
        "\nValidação: Σ recomendado = "
        f"{_money(bud['recommended_spend'].sum())}  vs  pool atual {_money(total_paid_spend)}"
    )
    print("\n  ✓ Fim.")


if __name__ == "__main__":
    main()
