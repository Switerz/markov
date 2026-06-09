"""
Diagnostic script for the Markov attribution model.

Answers three open questions raised in the model review:

  (c) Loop distribution per channel — does loop-compression discard signal?
  (d) Ghost revenue — what share of purchases have NO tracked session in lookback?
  (e) Stability of T month-over-month — is fitting a single model across months
      mixing distinct regimes?

Runs against three consecutive months and prints a single summary report.

Usage:
    # 1. put credentials in .env (rotated key, not the one pasted in chat)
    # 2. run from repo root:
    python analysis/diagnostics.py

Outputs to stdout. No external writes.
"""

from __future__ import annotations

import math
import sys
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

import config
from extract import (
    _run_query,
    get_raw_paths,
    get_converting_transitions,
    get_nonconverting_transitions,
    get_total_revenue,
)
from gograph.backend.app.services.loop_service import compute_loop_diagnostics
from markov import build_transition_matrix


# ---------------------------------------------------------------------------
# (d) Ghost revenue query
# ---------------------------------------------------------------------------

_GHOST_REVENUE_SQL = """
WITH purchase_users AS (
    SELECT
        p.user_pseudo_id,
        p.purchase_date,
        sum(p.value) AS revenue
    FROM analytics.purchases_dedup_lm_v2 AS p FINAL
    WHERE p.purchase_date BETWEEN '{start_date}' AND '{end_date}'
      AND p.user_pseudo_id != ''
    GROUP BY p.user_pseudo_id, p.purchase_date
),
tracked_users AS (
    SELECT DISTINCT
        arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) AS upid
    FROM plausible_events_db.sessions_v2 FINAL
    WHERE `start` BETWEEN
            toDate('{start_date}') - INTERVAL {lookback} DAY AND '{end_date}'
      AND has(entry_meta.key, 'user_pseudo_id')
      AND arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) != ''
      AND (utm_medium != '' OR acquisition_channel != '')
)
SELECT
    countIf(pu.user_pseudo_id NOT IN (SELECT upid FROM tracked_users)) AS ghost_purchases,
    count() AS total_purchases,
    sumIf(pu.revenue, pu.user_pseudo_id NOT IN (SELECT upid FROM tracked_users))
        AS ghost_revenue,
    sum(pu.revenue) AS total_revenue
FROM purchase_users pu
"""


def query_ghost_revenue(
    database_id: int,
    start_date: str,
    end_date: str,
    lookback: int,
) -> dict:
    sql = _GHOST_REVENUE_SQL.format(
        start_date=start_date, end_date=end_date, lookback=lookback
    )
    df = _run_query(database_id, sql)
    row = df.iloc[0]
    return {
        "ghost_purchases": int(row["ghost_purchases"]),
        "total_purchases": int(row["total_purchases"]),
        "ghost_revenue": float(row["ghost_revenue"] or 0.0),
        "total_revenue": float(row["total_revenue"] or 0.0),
    }


# ---------------------------------------------------------------------------
# (e) Transition matrix similarity metrics
# ---------------------------------------------------------------------------

def frobenius(A: np.ndarray, B: np.ndarray) -> float:
    return float(np.linalg.norm(A - B, ord="fro"))


def row_kl(p: np.ndarray, q: np.ndarray, eps: float = 1e-12) -> float:
    """KL(p || q) per row, then mean over rows (skipping zero-mass rows)."""
    kls = []
    for i in range(p.shape[0]):
        pi = p[i] + eps
        qi = q[i] + eps
        pi /= pi.sum()
        qi /= qi.sum()
        if p[i].sum() == 0:
            continue
        kls.append(float(np.sum(pi * np.log(pi / qi))))
    return float(np.mean(kls)) if kls else 0.0


def align_matrices(
    T1: np.ndarray, states1: list,
    T2: np.ndarray, states2: list,
) -> tuple[np.ndarray, np.ndarray, list]:
    """Reindex both T's to the union of states, filling missing rows/cols with zeros."""
    union = sorted(set(states1) | set(states2))
    n = len(union)
    idx = {s: i for i, s in enumerate(union)}

    def reindex(T, states):
        out = np.zeros((n, n))
        old_idx = {s: i for i, s in enumerate(states)}
        for s_from in states:
            for s_to in states:
                out[idx[s_from], idx[s_to]] = T[old_idx[s_from], old_idx[s_to]]
        return out

    return reindex(T1, states1), reindex(T2, states2), union


# ---------------------------------------------------------------------------
# Pretty printing
# ---------------------------------------------------------------------------

def hr(title: str = "") -> None:
    bar = "=" * 78
    print(f"\n{bar}")
    if title:
        print(f"  {title}")
        print(bar)


def _pct(x: float) -> str:
    return f"{x*100:.2f}%"


def _money(x: float) -> str:
    return f"R$ {x:,.0f}".replace(",", ".")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

@dataclass
class MonthWindow:
    label: str
    start: str
    end: str


# Three consecutive months ending in the most recent complete month.
# Adjust if you want a different window — these are sensible defaults given
# config.START_DATE / END_DATE in the project.
DEFAULT_WINDOWS = [
    MonthWindow("2026-03", "2026-03-01", "2026-03-31"),
    MonthWindow("2026-04", "2026-04-01", "2026-04-30"),
    MonthWindow("2026-05", "2026-05-01", "2026-05-31"),
]


def run(windows: list[MonthWindow] = DEFAULT_WINDOWS) -> None:
    if not config.METABASE_URL or not config.METABASE_API_KEY:
        print(
            "ERRO: METABASE_URL/METABASE_API_KEY ausentes. "
            "Configure .env e rode novamente.",
            file=sys.stderr,
        )
        sys.exit(1)

    db_p = config.DB_PLAUSIBLE
    lookback = config.LOOKBACK_DAYS

    # -----------------------------------------------------------------------
    # (c) Loop diagnostics — most recent month only (cheapest, most signal)
    # -----------------------------------------------------------------------
    target = windows[-1]
    hr(f"(c) LOOP DISTRIBUTION POR CANAL — {target.label}")
    print(f"  Janela: {target.start} a {target.end} | lookback={lookback}d")
    raw = get_raw_paths(
        database_id=db_p,
        start_date=target.start,
        end_date=target.end,
        lookback=lookback,
    )
    print(f"  Path records extraídos: {len(raw):,}")
    if raw.empty:
        print("  Sem paths — pulando.")
    else:
        loops = compute_loop_diagnostics(raw)
        if loops.empty:
            print("  Sem loops detectados.")
        else:
            cols = [
                "channel", "self_loop_rate", "avg_consecutive_repeats",
                "max_consecutive_repeats", "loop_conversion_rate",
                "nonloop_conversion_rate", "loop_conversion_lift", "support",
                "confidence",
            ]
            view = loops[cols].copy()
            view["self_loop_rate"] = view["self_loop_rate"].map(_pct)
            view["loop_conversion_rate"] = view["loop_conversion_rate"].map(
                lambda v: _pct(v) if pd.notna(v) else "—"
            )
            view["nonloop_conversion_rate"] = view["nonloop_conversion_rate"].map(
                lambda v: _pct(v) if pd.notna(v) else "—"
            )
            view["loop_conversion_lift"] = view["loop_conversion_lift"].map(
                lambda v: f"{v:.2f}x" if pd.notna(v) else "—"
            )
            view["avg_consecutive_repeats"] = view["avg_consecutive_repeats"].map(
                lambda v: f"{v:.2f}" if pd.notna(v) else "—"
            )
            print(view.to_string(index=False))

            print("\n  Interpretação:")
            high_loop = loops[loops["self_loop_rate"] >= 0.10]
            if not high_loop.empty:
                print(
                    f"  • {len(high_loop)} canais com self_loop_rate ≥ 10% — "
                    "loop_compression descarta volume material; vale virar feature."
                )
            else:
                print(
                    "  • Nenhum canal com self_loop_rate ≥ 10% — compression "
                    "tem custo informacional baixo, manter como diagnóstico OK."
                )

    # -----------------------------------------------------------------------
    # (d) Ghost revenue — same month
    # -----------------------------------------------------------------------
    hr(f"(d) RECEITA FANTASMA — {target.label}")
    print(
        f"  Janela: {target.start} a {target.end} | "
        f"lookback={lookback}d (período onde busco sessão prévia)"
    )
    g = query_ghost_revenue(db_p, target.start, target.end, lookback)
    ghost_share_purchases = (
        g["ghost_purchases"] / g["total_purchases"] if g["total_purchases"] else 0.0
    )
    ghost_share_revenue = (
        g["ghost_revenue"] / g["total_revenue"] if g["total_revenue"] else 0.0
    )
    print(f"  Compras totais:           {g['total_purchases']:,}")
    print(
        f"  Compras fantasma:         {g['ghost_purchases']:,} "
        f"({_pct(ghost_share_purchases)})"
    )
    print(f"  Receita total:            {_money(g['total_revenue'])}")
    print(
        f"  Receita fantasma:         {_money(g['ghost_revenue'])} "
        f"({_pct(ghost_share_revenue)})"
    )
    print("\n  Interpretação:")
    if ghost_share_revenue > 0.20:
        print(
            f"  • {_pct(ghost_share_revenue)} da receita não tem sessão trackada "
            "no lookback — o modelo redistribui essa massa para canais que talvez "
            "nem tenham participado. Considere: (1) reportar attribution sobre "
            "receita rastreada, não total; (2) aumentar lookback; (3) investigar "
            "se compras orgânicas/diretas estão sem sessão por bug de tracking."
        )
    elif ghost_share_revenue > 0.10:
        print(
            f"  • {_pct(ghost_share_revenue)} de receita fantasma — moderado, "
            "vale acompanhar mas não invalida atribuição."
        )
    else:
        print(
            f"  • {_pct(ghost_share_revenue)} de receita fantasma — baixo, "
            "atribuição cobre quase toda receita rastreável."
        )

    # -----------------------------------------------------------------------
    # (e) T stability across months
    # -----------------------------------------------------------------------
    hr("(e) ESTABILIDADE DE T MÊS A MÊS")
    print(
        "  Construo T para cada mês (raw channel model, mesmo non_conv_scale "
        "default=1.0) e comparo via Frobenius e KL médio por linha."
    )
    monthly_T: list[tuple[str, np.ndarray, list]] = []
    for w in windows:
        print(f"\n  Extraindo {w.label} ({w.start} a {w.end}) …")
        conv = get_converting_transitions(
            database_id=db_p,
            start_date=w.start,
            end_date=w.end,
            lookback=lookback,
            decay_lambda=config.DECAY_LAMBDA,
        )
        nconv = get_nonconverting_transitions(
            database_id=db_p,
            start_date=w.start,
            end_date=w.end,
            sample_pct=config.NON_CONV_SAMPLE_PCT,
            censorship_days=config.CENSORSHIP_DAYS,
        )
        T, states = build_transition_matrix(conv, nconv, scale_nonconv=1.0)
        monthly_T.append((w.label, T, states))
        print(
            f"    converting={len(conv):>5} | nonconverting={len(nconv):>5} | "
            f"states={len(states)}"
        )

    print("\n  Comparações par-a-par:")
    header = f"  {'par':<20} {'frobenius':>12} {'KL médio/linha':>16}  {'interpretação':<30}"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for i in range(len(monthly_T)):
        for j in range(i + 1, len(monthly_T)):
            l1, T1, s1 = monthly_T[i]
            l2, T2, s2 = monthly_T[j]
            A, B, union = align_matrices(T1, s1, T2, s2)
            fro = frobenius(A, B)
            kl = row_kl(A, B)
            if kl < 0.05:
                tag = "muito estável"
            elif kl < 0.15:
                tag = "estável"
            elif kl < 0.30:
                tag = "drift moderado"
            else:
                tag = "regime distinto"
            print(f"  {l1} vs {l2:<11} {fro:>12.3f} {kl:>16.4f}  {tag:<30}")

    print("\n  Interpretação:")
    print(
        "  • KL < 0.05: T essencialmente igual → fittar trimestral é seguro.\n"
        "  • 0.05–0.15: drift baixo → trimestral aceitável, monitorar.\n"
        "  • 0.15–0.30: drift moderado → preferir mensal para decisão tática.\n"
        "  • > 0.30: regimes distintos → NÃO consolidar; sazonalidade ou\n"
        "    campanha específica está mudando o comportamento."
    )

    hr("FIM")


if __name__ == "__main__":
    run()
