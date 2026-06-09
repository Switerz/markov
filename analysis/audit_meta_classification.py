"""
Sanity check para classificação do Paid Meta Ads no _state_sql.

Pergunta: o Markov dá 0% a Meta por viés de ubiquidade — mas seria possível
que parte do tráfego Meta esteja sendo classificado como "Other" / "Direct" /
"Organic Social / Instagram" por causa de UTM mal-formado? Esse script
quantifica isso.

Saída: tabela com utm_medium × utm_source × acquisition_channel, contagem de
sessões, conversion rate, classificação atual no _state_sql. Filtra para
combinações suspeitas (qualquer coisa que cheire a Meta).
"""

from __future__ import annotations

import sys

import pandas as pd

import config
from extract import _run_query, _state_sql


# Buckets suspeitos: anything that looks like Meta-origin
META_LIKE_FILTER = """
(
  positionCaseInsensitive(s.utm_source, 'facebook') > 0
  OR positionCaseInsensitive(s.utm_source, 'fb') > 0
  OR positionCaseInsensitive(s.utm_source, 'instagram') > 0
  OR positionCaseInsensitive(s.utm_source, 'ig') > 0
  OR positionCaseInsensitive(s.utm_source, 'meta') > 0
  OR positionCaseInsensitive(s.utm_medium, 'paid_social') > 0
  OR positionCaseInsensitive(s.utm_medium, 'paid') > 0
  OR positionCaseInsensitive(s.utm_medium, 'social') > 0
  OR position(s.entry_page, 'fbclid') > 0
  OR s.acquisition_channel = 'Paid Social'
)
"""


def audit_sql(start_date: str, end_date: str) -> str:
    state_expr = _state_sql("s")
    return f"""
SELECT
    s.utm_medium AS utm_medium,
    s.utm_source AS utm_source,
    s.acquisition_channel AS acq_channel,
    {state_expr} AS classified_as,
    count() AS sessions,
    countIf(s.is_bounce = 0) AS engaged_sessions,
    sum(s.events) AS total_events
FROM plausible_events_db.sessions_v2 s FINAL
WHERE s.start BETWEEN '{start_date}' AND '{end_date}'
  AND has(s.entry_meta.key, 'user_pseudo_id')
  AND arrayElement(s.entry_meta.value, indexOf(s.entry_meta.key, 'user_pseudo_id')) != ''
  AND {META_LIKE_FILTER}
GROUP BY utm_medium, utm_source, acq_channel, classified_as
ORDER BY sessions DESC
LIMIT 200
"""


def fbclid_audit_sql(start_date: str, end_date: str) -> str:
    """Sessions com fbclid no path mas SEM UTM Meta — proxy claro de Meta
    tracking quebrado."""
    state_expr = _state_sql("s")
    return f"""
SELECT
    s.utm_medium AS utm_medium,
    s.utm_source AS utm_source,
    s.acquisition_channel AS acq_channel,
    {state_expr} AS classified_as,
    count() AS sessions
FROM plausible_events_db.sessions_v2 s FINAL
WHERE s.start BETWEEN '{start_date}' AND '{end_date}'
  AND has(s.entry_meta.key, 'user_pseudo_id')
  AND position(s.entry_page, 'fbclid') > 0
  AND {state_expr} != 'Paid Meta Ads'
GROUP BY utm_medium, utm_source, acq_channel, classified_as
ORDER BY sessions DESC
LIMIT 50
"""


def main(start: str, end: str) -> None:
    print(f"\nAuditoria de classificação Meta — Janela: {start} a {end}\n")

    print("→ Combinações UTM/acq_channel 'tipo Meta' (top 200) …")
    df = _run_query(config.DB_PLAUSIBLE, audit_sql(start, end))
    df["sessions"] = df["sessions"].astype(int)
    df["engaged_sessions"] = df["engaged_sessions"].astype(int)

    # Bucket por classificação atual
    by_class = df.groupby("classified_as", as_index=False).agg(
        sessions=("sessions", "sum"),
        engaged_sessions=("engaged_sessions", "sum"),
    ).sort_values("sessions", ascending=False)
    total = by_class["sessions"].sum()
    by_class["share"] = by_class["sessions"] / total if total > 0 else 0
    by_class["share"] = by_class["share"].map(lambda v: f"{v*100:.2f}%")
    by_class["sessions"] = by_class["sessions"].map(
        lambda v: f"{v:>10,}".replace(",", ".")
    )
    by_class["engaged_sessions"] = by_class["engaged_sessions"].map(
        lambda v: f"{v:>10,}".replace(",", ".")
    )

    print("\n" + "=" * 80)
    print("  Tráfego 'tipo Meta' por classificação atual")
    print("=" * 80)
    print(by_class.to_string(index=False))

    # Top combinações que NÃO viraram Paid Meta Ads
    leak = df[df["classified_as"] != "Paid Meta Ads"].copy()
    if not leak.empty:
        leak = leak.sort_values("sessions", ascending=False).head(30)
        leak["sessions_fmt"] = leak["sessions"].map(
            lambda v: f"{v:>9,}".replace(",", ".")
        )
        print("\n" + "=" * 100)
        print("  Top 30 combinações 'tipo Meta' que NÃO viraram Paid Meta Ads")
        print("=" * 100)
        print(
            leak[["utm_medium", "utm_source", "acq_channel",
                  "classified_as", "sessions_fmt"]]
            .rename(columns={"sessions_fmt": "sessions"})
            .to_string(index=False)
        )

    print("\n→ fbclid presente mas classificado ≠ Paid Meta Ads …")
    fb = _run_query(config.DB_PLAUSIBLE, fbclid_audit_sql(start, end))
    if fb.empty:
        print("  Nenhuma sessão com fbclid escapando de Paid Meta Ads. OK.")
    else:
        fb["sessions"] = fb["sessions"].astype(int)
        total_fb = fb["sessions"].sum()
        print(f"\n  Total de sessões com fbclid mal-classificadas: {total_fb:,}".replace(",", "."))
        fb["sessions"] = fb["sessions"].map(lambda v: f"{v:>9,}".replace(",", "."))
        print(fb.to_string(index=False))

    print("\n  ✓ Fim.")


if __name__ == "__main__":
    start = sys.argv[1] if len(sys.argv) > 1 else config.START_DATE
    end = sys.argv[2] if len(sys.argv) > 2 else config.END_DATE
    main(start, end)
