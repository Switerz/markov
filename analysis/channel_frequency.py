"""
Channel frequency vs discriminative power diagnostic.

Tests two competing hypotheses for channels with ~0 Markov attribution:

  H1 — Ubiquity bias (the channel is "everywhere", so removing it doesn't move
       P(conversion). High support, lift ≈ 1.0, model can't distinguish.)
  H2 — Tracking gap (the channel isn't classified by _state_sql, so it's
       absent from raw_paths regardless of real spend.)

For each channel, prints:
  - support: total times it shows up as 'from' state in any transition
  - %conv_journeys:    share of distinct converting journey transitions
                       originating from this state
  - %nonconv_journeys: same for non-converting
  - lift = %conv / %nonconv (>1 = pro-conversion, ~1 = ubiquitous, <1 = anti)
  - markov_weight (raw channel model)

A channel with HIGH support, lift ≈ 1.0, and markov_weight ≈ 0 is the textbook
ubiquity-bias case — the channel is causally relevant but Markov can't see it.

Usage:
    PYTHONPATH=. .venv/bin/python analysis/channel_frequency.py [start] [end]
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

import config
from extract import (
    get_converting_transitions,
    get_nonconverting_transitions,
    get_total_revenue,
    get_conversion_rate,
)
from markov import (
    build_transition_matrix,
    calibrate_nonconv_scale,
    compute_attribution,
    compute_removal_effects,
)


SPECIAL_STATES = {"(start)", "Conversion", "Non-Conversion"}


def _pct(x: float) -> str:
    if pd.isna(x):
        return "—"
    return f"{x*100:.2f}%"


def run(start: str, end: str) -> None:
    print(f"\nJanela: {start} a {end}")
    print(f"lookback={config.LOOKBACK_DAYS}d  decay_lambda={config.DECAY_LAMBDA}\n")

    print("Extraindo transitions …")
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

    if config.NON_CONV_SCALE is None:
        target = get_conversion_rate(
            database_id=config.DB_PLAUSIBLE,
            start_date=start,
            end_date=end,
            sample_pct=config.NON_CONV_SAMPLE_PCT,
            censorship_days=config.CENSORSHIP_DAYS,
        )
        scale = calibrate_nonconv_scale(conv, nconv, target_rate=target)
    else:
        scale = config.NON_CONV_SCALE

    T, states = build_transition_matrix(conv, nconv, scale_nonconv=scale)
    removal_effects = compute_removal_effects(T, states)
    attrib = compute_attribution(removal_effects, conv, total_revenue=total_revenue)
    mw_by_ch = dict(zip(attrib["channel"], attrib["attribution_weight"]))

    # Per-channel frequency in each universe (using transition origin)
    conv_total = conv["n"].sum()
    nconv_total = nconv["n"].sum()

    channels = sorted(
        (set(conv["from_ch"]) | set(nconv["from_ch"])) - SPECIAL_STATES
    )
    rows = []
    for ch in channels:
        n_conv = float(conv[conv["from_ch"] == ch]["n"].sum())
        n_nconv = float(nconv[nconv["from_ch"] == ch]["n"].sum())
        share_conv = n_conv / conv_total if conv_total > 0 else 0.0
        share_nconv = n_nconv / nconv_total if nconv_total > 0 else 0.0
        if share_nconv > 0 and share_conv > 0:
            lift = share_conv / share_nconv
        elif share_conv > 0:
            lift = float("inf")
        else:
            lift = 0.0
        rows.append({
            "channel": ch,
            "support": int(n_conv + n_nconv),
            "n_conv": int(n_conv),
            "n_nconv": int(n_nconv),
            "share_conv": share_conv,
            "share_nconv": share_nconv,
            "lift": lift,
            "markov_w": mw_by_ch.get(ch, 0.0),
        })

    df = pd.DataFrame(rows).sort_values("support", ascending=False)

    # ----------- Output table ----------------------------------------------
    print("\n" + "=" * 110)
    print("  FREQUÊNCIA DE CANAL vs PESO MARKOV — teste de ubiquidade")
    print("=" * 110)
    view = df.copy()
    view["share_conv"] = view["share_conv"].map(_pct)
    view["share_nconv"] = view["share_nconv"].map(_pct)
    view["lift"] = view["lift"].map(
        lambda v: "∞" if np.isinf(v) else (f"{v:.2f}x" if v > 0 else "—")
    )
    view["markov_w"] = view["markov_w"].map(_pct)
    view["support"] = view["support"].map(lambda v: f"{v:>9,}".replace(",", "."))
    view["n_conv"] = view["n_conv"].map(lambda v: f"{v:>7,}".replace(",", "."))
    view["n_nconv"] = view["n_nconv"].map(lambda v: f"{v:>9,}".replace(",", "."))

    print(view[[
        "channel", "support", "n_conv", "n_nconv",
        "share_conv", "share_nconv", "lift", "markov_w",
    ]].to_string(index=False))

    # ----------- Classification of zero-weight channels --------------------
    print("\n" + "=" * 110)
    print("  CLASSIFICAÇÃO DE CANAIS COM markov_w ≈ 0  (ubiquidade vs gap)")
    print("=" * 110)
    zeros = df[df["markov_w"] < 0.005]
    if zeros.empty:
        print("  Nenhum canal com peso ~0. Modelo está discriminando bem.")
    else:
        for _, r in zeros.iterrows():
            ch = r["channel"]
            support = int(r["support"])
            lift = r["lift"]
            sc = r["share_conv"]
            snc = r["share_nconv"]

            # Heuristics
            HIGH_SUPPORT = 5_000
            UBIQUITY_LIFT_BAND = (0.7, 1.3)

            if support < 500:
                tag = "GAP DE TRACKING (support muito baixo — canal quase ausente)"
            elif (
                support >= HIGH_SUPPORT
                and UBIQUITY_LIFT_BAND[0] <= lift <= UBIQUITY_LIFT_BAND[1]
            ):
                tag = (
                    "VIÉS DE UBIQUIDADE — high support, lift ≈ 1.0, "
                    "Markov não consegue discriminar"
                )
            elif support >= HIGH_SUPPORT and lift < UBIQUITY_LIFT_BAND[0]:
                tag = (
                    "PRESENÇA NEGATIVA — aparece mais em não-converters; "
                    "Markov correto em não atribuir"
                )
            elif support >= HIGH_SUPPORT and lift > UBIQUITY_LIFT_BAND[1]:
                tag = (
                    "ANOMALIA — lift > 1 mas peso 0; "
                    "interação não-aditiva, investigar paths"
                )
            else:
                tag = f"Support moderado ({support}), inconclusivo"

            print(
                f"  {ch:<28}  support={support:>9,}  "
                f"lift={('%.2fx' % lift) if not np.isinf(lift) else '∞':<7}  "
                f"share(c/nc)={_pct(sc)}/{_pct(snc)}  →  {tag}".replace(",", ".")
            )

    print("\n  ✓ Fim.")


if __name__ == "__main__":
    start = sys.argv[1] if len(sys.argv) > 1 else config.START_DATE
    end = sys.argv[2] if len(sys.argv) > 2 else config.END_DATE
    run(start, end)
