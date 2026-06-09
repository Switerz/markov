"""
Hypothesis 2: Blended Markov + presence attribution.

For ubiquitous channels (lift in [0.7, 1.3] AND share_conv >= 0.02), substitute
the Markov weight (≈0 due to no discriminative power) with the channel's
share of converting journey origins (presence credit). For discriminative
channels, keep the Markov weight. Then renormalize so weights sum to 1.0.

Inputs (read-only): /tmp/markov_cache/{conv,nconv}.pkl and params.json.

Usage:
    PYTHONPATH=. /home/pedrorocha/markov/.venv/bin/python analysis/blended_attribution.py
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd

from markov import (
    build_transition_matrix,
    compute_attribution,
    compute_removal_effects,
)


CACHE_DIR = Path("/tmp/markov_cache")
SPECIAL_STATES = {"(start)", "Conversion", "Non-Conversion"}

# Ubiquity band: channels with lift inside this AND share_conv >= MIN_SHARE_CONV
# get presence-based credit (share_conv) instead of Markov weight.
UBIQUITY_BAND = (0.7, 1.3)
MIN_SHARE_CONV = 0.02


def _pct(x: float) -> str:
    if pd.isna(x):
        return "—"
    return f"{x * 100:.2f}%"


def _money(x: float) -> str:
    return f"R$ {x:>15,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _load_inputs() -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    with open(CACHE_DIR / "conv.pkl", "rb") as f:
        conv = pickle.load(f)
    with open(CACHE_DIR / "nconv.pkl", "rb") as f:
        nconv = pickle.load(f)
    with open(CACHE_DIR / "params.json") as f:
        params = json.load(f)
    return conv, nconv, params


def _channel_frequency_stats(
    conv: pd.DataFrame, nconv: pd.DataFrame
) -> pd.DataFrame:
    """Per-channel share_conv, share_nconv, lift (from-origin counts)."""
    conv_total = float(conv["n"].sum())
    nconv_total = float(nconv["n"].sum())

    channels = sorted(
        (set(conv["from_ch"]) | set(nconv["from_ch"])) - SPECIAL_STATES
    )

    rows = []
    for ch in channels:
        n_conv = float(conv.loc[conv["from_ch"] == ch, "n"].sum())
        n_nconv = float(nconv.loc[nconv["from_ch"] == ch, "n"].sum())
        share_conv = n_conv / conv_total if conv_total > 0 else 0.0
        share_nconv = n_nconv / nconv_total if nconv_total > 0 else 0.0
        if share_nconv > 0 and share_conv > 0:
            lift = share_conv / share_nconv
        elif share_conv > 0:
            lift = float("inf")
        else:
            lift = 0.0
        rows.append(
            {
                "channel": ch,
                "share_conv": share_conv,
                "share_nconv": share_nconv,
                "lift": lift,
            }
        )
    return pd.DataFrame(rows)


def _blend(
    markov_df: pd.DataFrame,
    freq_df: pd.DataFrame,
    band: tuple[float, float],
    min_share_conv: float,
) -> pd.DataFrame:
    """
    Blend Markov + presence:
      - If band[0] <= lift <= band[1] AND share_conv >= min_share_conv:
          raw_blend = share_conv (presence credit)  [source="presence"]
      - Else:
          raw_blend = markov_w                       [source="markov"]
    Then renormalize so sum(blended_w) = 1.0.
    """
    df = markov_df.merge(freq_df, on="channel", how="outer").fillna(
        {"markov_w": 0.0, "share_conv": 0.0, "share_nconv": 0.0, "lift": 0.0}
    )

    lo, hi = band

    def classify(row: pd.Series) -> str:
        lift = row["lift"]
        if (
            np.isfinite(lift)
            and lo <= lift <= hi
            and row["share_conv"] >= min_share_conv
        ):
            return "presence"
        return "markov"

    df["source"] = df.apply(classify, axis=1)
    df["raw_blend"] = np.where(
        df["source"] == "presence", df["share_conv"], df["markov_w"]
    )

    total = float(df["raw_blend"].sum())
    if total > 0:
        df["blended_w"] = df["raw_blend"] / total
    else:
        df["blended_w"] = 0.0

    return df


def run() -> None:
    print("\n" + "=" * 110)
    print("  HIPOTESE 2 — Atribuicao Blended (Markov + Presenca)")
    print("=" * 110)

    print("\n[1/4] Carregando cache …")
    conv, nconv, params = _load_inputs()
    total_revenue = float(params["total_revenue"])
    non_conv_scale = float(params["non_conv_scale"])
    print(f"      conv rows={len(conv):,}  nconv rows={len(nconv):,}")
    print(f"      total_revenue={_money(total_revenue)}")
    print(f"      non_conv_scale={non_conv_scale:.4f}")

    print("\n[2/4] Markov padrao (removal effects + atribuicao) …")
    T, states = build_transition_matrix(conv, nconv, scale_nonconv=non_conv_scale)
    removal_effects = compute_removal_effects(T, states)
    attrib = compute_attribution(
        removal_effects, conv, total_revenue=total_revenue
    )
    markov_df = attrib[["channel", "attribution_weight"]].rename(
        columns={"attribution_weight": "markov_w"}
    )

    print("\n[3/4] Estatisticas de frequencia por canal …")
    freq_df = _channel_frequency_stats(conv, nconv)

    print(
        f"\n[4/4] Blending — band={UBIQUITY_BAND}, "
        f"min share_conv={MIN_SHARE_CONV:.2%} …"
    )
    blended = _blend(markov_df, freq_df, UBIQUITY_BAND, MIN_SHARE_CONV)
    blended = blended.sort_values("blended_w", ascending=False).reset_index(
        drop=True
    )

    # ------------------------------------------------------------------
    # Table 1 — full per-channel breakdown
    # ------------------------------------------------------------------
    print("\n" + "=" * 110)
    print("  TABELA 1 — Todos os canais (Markov vs Presenca vs Blended)")
    print("=" * 110)

    view = blended.copy()
    view["markov_w_str"] = view["markov_w"].map(_pct)
    view["share_conv_str"] = view["share_conv"].map(_pct)
    view["share_nconv_str"] = view["share_nconv"].map(_pct)
    view["lift_str"] = view["lift"].map(
        lambda v: "inf" if np.isinf(v) else (f"{v:.2f}x" if v > 0 else "—")
    )
    view["blended_w_str"] = view["blended_w"].map(_pct)

    print(
        view.rename(
            columns={
                "markov_w_str": "markov_w",
                "share_conv_str": "share_conv",
                "share_nconv_str": "share_nconv",
                "lift_str": "lift",
                "blended_w_str": "blended_w",
            }
        )[
            [
                "channel",
                "markov_w",
                "share_conv",
                "share_nconv",
                "lift",
                "blended_w",
                "source",
            ]
        ].to_string(index=False)
    )

    sanity = float(blended["blended_w"].sum())
    print(f"\n  sum(blended_w) = {sanity:.6f}  (should be ~1.0)")

    # ------------------------------------------------------------------
    # Table 2 — top movers
    # ------------------------------------------------------------------
    print("\n" + "=" * 110)
    print("  TABELA 2 — TOP MOVERS  (|blended_w - markov_w| > 3pp)")
    print("=" * 110)

    blended["delta"] = blended["blended_w"] - blended["markov_w"]
    movers = blended[blended["delta"].abs() > 0.03].copy()
    movers = movers.reindex(
        movers["delta"].abs().sort_values(ascending=False).index
    )

    if movers.empty:
        print("  (sem movers acima de 3pp — blending nao alterou o modelo)")
    else:
        m_view = movers.copy()
        m_view["markov_w"] = m_view["markov_w"].map(_pct)
        m_view["blended_w"] = m_view["blended_w"].map(_pct)
        m_view["delta_str"] = m_view["delta"].map(
            lambda v: f"{'+' if v >= 0 else ''}{v * 100:.2f}pp"
        )
        m_view["lift_str"] = m_view["lift"].map(
            lambda v: "inf" if np.isinf(v) else (f"{v:.2f}x" if v > 0 else "—")
        )
        print(
            m_view.rename(columns={"delta_str": "delta", "lift_str": "lift"})[
                ["channel", "markov_w", "blended_w", "delta", "lift", "source"]
            ].to_string(index=False)
        )

    # ------------------------------------------------------------------
    # Table 3 — blended revenue
    # ------------------------------------------------------------------
    print("\n" + "=" * 110)
    print("  TABELA 3 — Receita atribuida (blended)")
    print("=" * 110)

    blended["blended_revenue"] = blended["blended_w"] * total_revenue
    blended["markov_revenue"] = blended["markov_w"] * total_revenue
    blended["revenue_delta"] = (
        blended["blended_revenue"] - blended["markov_revenue"]
    )

    rev_view = blended.copy()
    rev_view = rev_view.sort_values("blended_revenue", ascending=False)
    rev_view["markov_revenue_str"] = rev_view["markov_revenue"].map(_money)
    rev_view["blended_revenue_str"] = rev_view["blended_revenue"].map(_money)
    rev_view["revenue_delta_str"] = rev_view["revenue_delta"].map(
        lambda v: f"{'+' if v >= 0 else ''}{_money(v).strip()}"
    )

    print(
        rev_view.rename(
            columns={
                "markov_revenue_str": "markov_revenue",
                "blended_revenue_str": "blended_revenue",
                "revenue_delta_str": "delta",
            }
        )[
            [
                "channel",
                "source",
                "markov_revenue",
                "blended_revenue",
                "delta",
            ]
        ].to_string(index=False)
    )

    print(
        f"\n  total markov  = {_money(float(blended['markov_revenue'].sum()))}"
    )
    print(
        f"  total blended = {_money(float(blended['blended_revenue'].sum()))}"
    )
    print(f"  total real    = {_money(total_revenue)}")

    print("\n  ✓ Fim.\n")


if __name__ == "__main__":
    run()
