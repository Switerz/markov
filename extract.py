"""Data extraction from Metabase/ClickHouse."""

import requests
import pandas as pd
from config import METABASE_URL, METABASE_API_KEY, TRACKED_STATES
from gograph.backend.app.core.event_mapping import (
    _funnel_stage_sql_case,
    _priority_to_stage_sql,
    EVENT_STAGE_MAPPING,
)

SPECIAL_STATES = {"Conversion", "Non-Conversion", "(start)"}
ALL_STATES = TRACKED_STATES | SPECIAL_STATES


def _run_query(database_id: int, sql: str, no_limit: bool = False) -> pd.DataFrame:
    """Execute native SQL against Metabase and return a DataFrame.

    no_limit=True routes to /api/dataset/json which bypasses the 2000-row cap
    that /api/dataset applies regardless of middleware flags. Use for raw_paths
    and state-expansion extractions where the full universe matters.
    """
    if not METABASE_URL or not METABASE_API_KEY:
        raise RuntimeError(
            "METABASE_URL and METABASE_API_KEY must be set in the environment. "
            "See .env.example for the required variables."
        )

    query_body = {
        "type": "native",
        "native": {"query": sql, "template-tags": {}},
        "database": database_id,
        "parameters": [],
    }

    if no_limit:
        # Export endpoint — returns a plain JSON array of row dicts, no cap.
        import json as _json
        resp = requests.post(
            f"{METABASE_URL}/api/dataset/json",
            headers={"x-api-key": METABASE_API_KEY},
            data={"query": _json.dumps(query_body)},
            timeout=600,
        )
        resp.raise_for_status()
        rows = resp.json()
        if isinstance(rows, dict) and (rows.get("status") == "failed" or rows.get("error")):
            error = rows.get("error") or (rows.get("via") or [{}])[-1].get("error", "unknown")
            raise RuntimeError(f"Query failed: {error}")
        return pd.DataFrame(rows)

    # Standard interactive endpoint — capped at 2000 rows for unaggregated,
    # 10000 for aggregated. Fine for transitions/spend.
    resp = requests.post(
        f"{METABASE_URL}/api/dataset",
        headers={
            "Content-Type": "application/json",
            "x-api-key": METABASE_API_KEY,
        },
        json={
            **query_body,
            "middleware": {
                "js-int-to-string?": True,
                "userland-query?": True,
                "add-default-userland-constraints?": True,
            },
        },
        timeout=600,
    )
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") == "failed" or data.get("error"):
        error = data.get("error") or (data.get("via") or [{}])[-1].get("error", "unknown")
        raise RuntimeError(f"Query failed: {error}")

    rows = data["data"]["rows"]
    cols = [c["name"] for c in data["data"]["cols"]]
    return pd.DataFrame(rows, columns=cols)


def _ensure_tracked(state: str) -> str:
    """Map any unrecognised state to Other; preserve special states as-is."""
    return state if state in ALL_STATES else "Other"


def _state_sql(alias: str) -> str:
    """
    Returns a ClickHouse multiIf(...) expression that classifies a session into
    a Markov state using utm_medium + utm_source only, with fallback to
    acquisition_channel for untagged sessions.
    utm_campaign is intentionally excluded — naming conventions are inconsistent
    and all Google CPC types share medium=cpc / source=google.
    """
    m = f"{alias}.utm_medium"
    s = f"{alias}.utm_source"
    a = f"{alias}.acquisition_channel"
    return (
        "multiIf(\n"
        f"        ({m} IN ('paid_social','paid')) AND ({s} IN ('facebook','fb','whatsapp','facebook-sitelink','instagram','ig')), 'Paid Meta Ads',\n"
        f"        {m} = 'cpc' AND {s} = 'google',                                   'Google Ads',\n"
        f"        {m} IN ('display','retargeting') AND {s} IN ('criteo','rtbhouse'), 'Display / Retargeting',\n"
        f"        {m} IN ('newsletter_email','automatic_email','architect_email','email','automatic_webpush','web_push'), 'Email',\n"
        f"        {m} IN ('automatic_whatsapp','newsletter_whatsapp') OR ({m} = 'paid_social' AND {s} = 'automatic_whatsapp'), 'WhatsApp CRM',\n"
        f"        {m} IN ('newsletter_sms','automatic_sms') OR ({m} = 'paid_social' AND {s} IN ('sms','automatic_sms')), 'SMS',\n"
        f"        {m} IN ('organic_social','organic_live','organic_broadcast') AND {s} = 'instagram', 'Organic Social / Instagram',\n"
        f"        {m} = 'organic_social' AND {s} = 'facebook',                      'Organic Social / Facebook',\n"
        f"        {m} = 'influencers',                                               'Influencers',\n"
        f"        {m} = 'clube_gocase',                                              'Clube GoCase',\n"
        f"        {m} IN ('network_affiliates','network_parcerias','referral'),      'Referral',\n"
        f"        {a} = 'Direct',          'Direct',\n"
        f"        {a} = 'Organic Search',  'Organic Search',\n"
        f"        {a} = 'Referral',        'Referral',\n"
        "        'Other'\n"
        "    )"
    )


def _raw_paths_sql(
    start_date: str,
    end_date: str,
    lookback: int,
    nonconv_sample_pct: int = 100,
) -> str:
    """
    SQL to extract full user-level path sequences for Sprint 7 path analysis.

    Converting paths: only sessions that occurred on or before the purchase date
    are included. This prevents post-purchase CRM messages (WhatsApp confirmations,
    shipping updates) from inflating single-channel converting paths.

    Non-converting paths: sessions in the analysis window for users who made
    no purchase. `nonconv_sample_pct` (1-100) downsamples non-converting users
    deterministically via cityHash64 — required for full extractions to avoid
    ClickHouse OOM on multi-million user windows.
    """
    state_expr = _state_sql("s_all")
    return f"""
    WITH purchase_info AS (
        SELECT
            p.user_pseudo_id,
            sum(p.value)        AS revenue,
            max(s_conv.`start`) AS conv_start
        FROM analytics.purchases_dedup_lm_v2 AS p FINAL
        INNER JOIN plausible_events_db.sessions_v2 AS s_conv FINAL
            ON p.session_id = s_conv.session_id
        WHERE p.purchase_date BETWEEN '{start_date}' AND '{end_date}'
          AND p.user_pseudo_id != ''
        GROUP BY p.user_pseudo_id
    ),
    converting_journeys AS (
        -- Only pre-purchase sessions: prevents post-purchase CRM from inflating paths
        SELECT
            s_all.upid AS user_id,
            arrayStringConcat(
                arrayMap(x -> x.2,
                    arraySort(x -> x.1,
                        groupArray((toUnixTimestamp(s_all.`start`), {state_expr}))
                    )
                ),
                ' -> '
            ) AS path_sequence,
            1          AS converted,
            pi.revenue AS revenue
        FROM (
            SELECT
                arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) AS upid,
                `start`, utm_medium, utm_source, utm_campaign, acquisition_channel
            FROM plausible_events_db.sessions_v2 FINAL
            WHERE `start` BETWEEN toDate('{start_date}') - INTERVAL {lookback} DAY AND '{end_date}'
              AND has(entry_meta.key, 'user_pseudo_id')
              AND arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) != ''
        ) AS s_all
        INNER JOIN purchase_info pi
            ON  s_all.upid = pi.user_pseudo_id
            AND s_all.`start` <= pi.conv_start
        GROUP BY s_all.upid, pi.revenue
    ),
    nonconverting_journeys AS (
        SELECT
            s_all.upid          AS user_id,
            arrayStringConcat(
                arrayMap(x -> x.2,
                    arraySort(x -> x.1,
                        groupArray((toUnixTimestamp(s_all.`start`), {state_expr}))
                    )
                ),
                ' -> '
            ) AS path_sequence,
            0            AS converted,
            toFloat64(0) AS revenue
        FROM (
            SELECT
                arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) AS upid,
                `start`, utm_medium, utm_source, utm_campaign, acquisition_channel
            FROM plausible_events_db.sessions_v2 FINAL
            WHERE `start` BETWEEN '{start_date}' AND '{end_date}'
              AND has(entry_meta.key, 'user_pseudo_id')
              AND arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) != ''
        ) AS s_all
        WHERE s_all.upid NOT IN (SELECT user_pseudo_id FROM purchase_info)
          AND cityHash64(s_all.upid) % 100 < {nonconv_sample_pct}
        GROUP BY s_all.upid
    )
    SELECT path_sequence, converted, sum(revenue) AS revenue, count() AS occurrences
    FROM (
        SELECT path_sequence, converted, revenue FROM converting_journeys
        UNION ALL
        SELECT path_sequence, converted, revenue FROM nonconverting_journeys
    )
    GROUP BY path_sequence, converted
    ORDER BY occurrences DESC
    """

def get_raw_paths(
    database_id: int,
    start_date: str,
    end_date: str,
    lookback: int = 30,
    no_limit: bool = False,
    nonconv_sample_pct: int = 100,
) -> pd.DataFrame:
    """Returns aggregated path sequences for Path Intelligence (Sprint 7).

    no_limit=True bypasses Metabase's default 2000-row cap (routes to
    /api/dataset/json). Required for state-expansion models where rare
    path patterns matter.

    nonconv_sample_pct in [1, 100] downsamples non-converting users to keep
    the GROUP BY tractable in ClickHouse. The legacy default 100 preserves
    backward compatibility; pass NON_CONV_SAMPLE_PCT (typically 1-5) when
    doing full extractions of large windows.
    """
    sql = _raw_paths_sql(start_date, end_date, lookback, nonconv_sample_pct)
    return _run_query(database_id, sql, no_limit=no_limit)


# ---------------------------------------------------------------------------
# Converting transitions
# ---------------------------------------------------------------------------

def _converting_sql(start_date: str, end_date: str, lookback: int, decay_lambda: float = 0.0) -> str:
    state_expr = _state_sql("s_all")
    # Sessions on LEFT (scan), purchase_info on RIGHT (small hash table ~30K rows).
    # This avoids OOM. Tested feasible for single-month windows (~20M sessions).
    # decay_lambda: each session's weight = exp(-decay_lambda * days_before_conversion).
    # 0 = uniform (original behaviour). day_deltas array stores days-to-conversion per session.
    return f"""
WITH purchase_info AS (
    SELECT
        p.session_id AS conv_session_id,
        p.user_pseudo_id,
        sum(p.value)        AS revenue,
        max(s_conv.`start`) AS conv_start
    FROM analytics.purchases_dedup_lm_v2 AS p FINAL
    INNER JOIN plausible_events_db.sessions_v2 AS s_conv FINAL
        ON p.session_id = s_conv.session_id
    WHERE p.purchase_date BETWEEN '{start_date}' AND '{end_date}'
      AND p.user_pseudo_id != ''
    GROUP BY p.session_id, p.user_pseudo_id
),
journeys_raw AS (
    SELECT
        pi.conv_session_id AS session_id,
        arraySort(x -> x.1,
            groupArray((
                toUnixTimestamp(s_all.`start`),
                {state_expr},
                toFloat64(toUnixTimestamp(pi.conv_start) - toUnixTimestamp(s_all.`start`)) / 86400.0
            ))
        ) AS sorted_sessions,
        pi.revenue
    FROM (
        SELECT
            arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) AS upid,
            `start`, utm_medium, utm_source, utm_campaign, acquisition_channel
        FROM plausible_events_db.sessions_v2 FINAL
        WHERE `start` BETWEEN toDate('{start_date}') - INTERVAL {lookback} DAY AND '{end_date}'
          AND has(entry_meta.key, 'user_pseudo_id')
          AND arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) != ''
          AND (utm_medium != '' OR acquisition_channel != '')
    ) AS s_all
    INNER JOIN purchase_info AS pi ON s_all.upid = pi.user_pseudo_id
    WHERE s_all.`start` <= pi.conv_start
      AND s_all.`start` >= pi.conv_start - INTERVAL {lookback} DAY
    GROUP BY pi.conv_session_id, pi.conv_start, pi.revenue
),
journeys AS (
    SELECT
        session_id,
        arrayMap(x -> x.2, sorted_sessions) AS channels,
        arrayMap(x -> x.3, sorted_sessions) AS day_deltas,
        revenue
    FROM journeys_raw
),
transitions AS (
    SELECT
        t.1 AS from_ch,
        t.2 AS to_ch,
        exp(-{decay_lambda} * t.3) AS decay_weight,
        revenue
    FROM journeys
    ARRAY JOIN arrayZip(
        arrayConcat(['(start)'], channels),
        arrayConcat(channels, ['Conversion']),
        arrayConcat(day_deltas, [toFloat64(0)])
    ) AS t
)
SELECT from_ch, to_ch, sum(decay_weight) AS n, sum(revenue) AS total_revenue
FROM transitions
GROUP BY from_ch, to_ch
ORDER BY n DESC
"""


def get_converting_transitions(
    database_id: int,
    start_date: str,
    end_date: str,
    lookback: int = 30,
    decay_lambda: float = 0.0,
) -> pd.DataFrame:
    """
    Returns transition weights from converting journeys.
    Columns: from_ch, to_ch, n (float decay-weight sum), total_revenue

    Journey identity: user_pseudo_id (cookie-based, stable cross-day).
    State classification: utm_medium + utm_source + utm_campaign, fallback to acquisition_channel.
    decay_lambda: exp decay applied per session by days-to-conversion (0 = uniform).
    """
    sql = _converting_sql(start_date, end_date, lookback, decay_lambda)
    df = _run_query(database_id, sql)
    df["n"] = df["n"].astype(float)
    df["total_revenue"] = df["total_revenue"].astype(float)
    df["from_ch"] = df["from_ch"].apply(_ensure_tracked)
    df["to_ch"] = df["to_ch"].apply(_ensure_tracked)
    df = (
        df.groupby(["from_ch", "to_ch"], as_index=False)
        .agg(n=("n", "sum"), total_revenue=("total_revenue", "sum"))
    )
    return df


# ---------------------------------------------------------------------------
# Non-converting transitions
# ---------------------------------------------------------------------------

def _nonconverting_sql(
    start_date: str,
    end_date: str,
    sample_pct: int,
    censorship_days: int = 0,
) -> str:
    """
    SQL for non-converting transition counts.

    censorship_days: exclude users whose last session was within this many days
    of end_date — their outcome is unknown (right-censored). 0 = no filtering
    (backward-compatible default). Recommended values to experiment: 7, 14, 30.

    The mature_journeys CTE always runs the filter:
      last_session <= toDate(end_date) - INTERVAL censorship_days DAY
    When censorship_days=0 the cutoff equals end_date, which all sessions satisfy.
    """
    state_expr = _state_sql("s")
    return f"""
WITH converters AS (
    SELECT DISTINCT s_conv.user_id
    FROM analytics.purchases_dedup_lm_v2 AS p FINAL
    INNER JOIN plausible_events_db.sessions_v2 AS s_conv FINAL
        ON p.session_id = s_conv.session_id
    WHERE p.purchase_date BETWEEN '{start_date}' AND '{end_date}'
),
sampled_users AS (
    SELECT DISTINCT user_id
    FROM plausible_events_db.sessions_v2 FINAL
    WHERE `start` BETWEEN '{start_date}' AND '{end_date}'
      AND (utm_medium != '' OR acquisition_channel != '')
      AND user_id NOT IN (SELECT user_id FROM converters)
      AND cityHash64(user_id) % 100 < {sample_pct}
),
journeys AS (
    SELECT
        s.user_id,
        arrayMap(x -> x.2,
            arraySort(x -> x.1,
                groupArray((toUnixTimestamp(s.`start`), {state_expr}))
            )
        ) AS channels,
        max(s.`start`) AS last_session
    FROM plausible_events_db.sessions_v2 AS s FINAL
    WHERE s.user_id IN (SELECT user_id FROM sampled_users)
      AND s.`start` BETWEEN '{start_date}' AND '{end_date}'
      AND (s.utm_medium != '' OR s.acquisition_channel != '')
    GROUP BY s.user_id
),
mature_journeys AS (
    -- Exclude censored journeys: outcome still unknown within the analysis window.
    -- When censorship_days=0 the condition is always true (backward-compatible).
    SELECT user_id, channels
    FROM journeys
    WHERE last_session <= toDate('{end_date}') - INTERVAL {censorship_days} DAY
),
transitions AS (
    SELECT
        t.1 AS from_ch,
        t.2 AS to_ch
    FROM mature_journeys
    ARRAY JOIN arrayZip(
        arrayConcat(['(start)'], channels),
        arrayConcat(channels, ['Non-Conversion'])
    ) AS t
)
SELECT from_ch, to_ch, count() AS n
FROM transitions
GROUP BY from_ch, to_ch
ORDER BY n DESC
"""


def get_nonconverting_transitions(
    database_id: int,
    start_date: str,
    end_date: str,
    sample_pct: int = 1,
    censorship_days: int = 0,
) -> pd.DataFrame:
    """
    Returns transition counts from non-converting journeys (sampled).
    Columns: from_ch, to_ch, n

    censorship_days: users whose last session is within this many days of
    end_date are excluded (right-censored — outcome still unknown). 0 = off.
    """
    sql = _nonconverting_sql(start_date, end_date, sample_pct, censorship_days)
    df = _run_query(database_id, sql)
    df["n"] = df["n"].astype(int)
    df["from_ch"] = df["from_ch"].apply(_ensure_tracked)
    df["to_ch"] = df["to_ch"].apply(_ensure_tracked)
    df = df.groupby(["from_ch", "to_ch"], as_index=False).agg(n=("n", "sum"))
    return df


def _censored_count_sql(
    start_date: str,
    end_date: str,
    sample_pct: int,
    censorship_days: int,
) -> str:
    """Returns censored and total sampled non-converting journey counts."""
    return f"""
WITH converters AS (
    SELECT DISTINCT s_conv.user_id
    FROM analytics.purchases_dedup_lm_v2 AS p FINAL
    INNER JOIN plausible_events_db.sessions_v2 AS s_conv FINAL
        ON p.session_id = s_conv.session_id
    WHERE p.purchase_date BETWEEN '{start_date}' AND '{end_date}'
),
sampled_users AS (
    SELECT DISTINCT user_id
    FROM plausible_events_db.sessions_v2 FINAL
    WHERE `start` BETWEEN '{start_date}' AND '{end_date}'
      AND (utm_medium != '' OR acquisition_channel != '')
      AND user_id NOT IN (SELECT user_id FROM converters)
      AND cityHash64(user_id) % 100 < {sample_pct}
),
last_sessions AS (
    SELECT user_id, max(`start`) AS last_session
    FROM plausible_events_db.sessions_v2 FINAL
    WHERE user_id IN (SELECT user_id FROM sampled_users)
      AND `start` BETWEEN '{start_date}' AND '{end_date}'
    GROUP BY user_id
)
SELECT
    countIf(last_session > toDate('{end_date}') - INTERVAL {censorship_days} DAY) AS censored_count,
    count()                                                                          AS total_count
FROM last_sessions
"""


def get_censored_count(
    database_id: int,
    start_date: str,
    end_date: str,
    sample_pct: int,
    censorship_days: int,
) -> tuple[int, int]:
    """
    Returns (censored_sample_count, total_sample_count) for non-converting
    sampled journeys. Useful for transparency reporting.

    censored_sample_count: journeys excluded because last session < cutoff.
    total_sample_count: all sampled non-converting journeys before censorship.
    Returns (0, 0) when censorship_days <= 0.
    """
    if censorship_days <= 0:
        return 0, 0
    sql = _censored_count_sql(start_date, end_date, sample_pct, censorship_days)
    df = _run_query(database_id, sql)
    return int(df["censored_count"].iloc[0]), int(df["total_count"].iloc[0])


# ---------------------------------------------------------------------------
# Conversion rate estimation (for NON_CONV_SCALE auto-calibration)
# ---------------------------------------------------------------------------

_CONV_COUNT_SQL = """
SELECT count(DISTINCT user_pseudo_id) AS n
FROM analytics.purchases_dedup_lm_v2 FINAL
WHERE purchase_date BETWEEN '{start_date}' AND '{end_date}'
  AND user_pseudo_id != ''
"""


def _nconv_sample_count_sql(
    start_date: str,
    end_date: str,
    sample_pct: int,
    censorship_days: int = 0,
) -> str:
    """
    Count of sampled non-converting users (mature journeys only).

    When censorship_days > 0, users whose last session is within
    censorship_days of end_date are excluded — matching the censorship applied
    in _nonconverting_sql so that NON_CONV_SCALE auto-calibration is consistent.
    """
    return f"""
WITH converters AS (
    SELECT DISTINCT s.user_id
    FROM analytics.purchases_dedup_lm_v2 AS p FINAL
    INNER JOIN plausible_events_db.sessions_v2 AS s FINAL
        ON p.session_id = s.session_id
    WHERE p.purchase_date BETWEEN '{start_date}' AND '{end_date}'
),
user_sessions AS (
    SELECT user_id, max(`start`) AS last_session
    FROM plausible_events_db.sessions_v2 FINAL
    WHERE `start` BETWEEN '{start_date}' AND '{end_date}'
      AND (utm_medium != '' OR acquisition_channel != '')
      AND user_id NOT IN (SELECT user_id FROM converters)
      AND cityHash64(user_id) % 100 < {sample_pct}
    GROUP BY user_id
)
SELECT count() AS n
FROM user_sessions
WHERE last_session <= toDate('{end_date}') - INTERVAL {censorship_days} DAY
"""


def get_conversion_rate(
    database_id: int,
    start_date: str,
    end_date: str,
    sample_pct: int,
    censorship_days: int = 0,
) -> float:
    """
    Estimate real conversion rate: n_converters / (n_converters + n_nonconverters).

    When censorship_days > 0, mature non-converters only (last session >= cutoff)
    are used as the denominator — consistent with what goes into the transition
    matrix. This ensures NON_CONV_SCALE auto-calibration targets the right rate.

    Note: mixes two identity spaces (user_pseudo_id for converters vs user_id for
    non-converters) — a known limitation until user_pseudo_id is fully materialised.
    """
    n_conv = int(
        _run_query(database_id, _CONV_COUNT_SQL.format(
            start_date=start_date, end_date=end_date))["n"].iloc[0]
    )
    n_nconv_sample = int(
        _run_query(database_id, _nconv_sample_count_sql(
            start_date, end_date, sample_pct, censorship_days))["n"].iloc[0]
    )
    n_nconv = n_nconv_sample * (100 / sample_pct)
    total = n_conv + n_nconv
    return n_conv / total if total > 0 else 0.01


# ---------------------------------------------------------------------------
# True total revenue (unique purchases, no double-counting)
# ---------------------------------------------------------------------------

TOTAL_REVENUE_SQL = """
SELECT sum(value) AS total_revenue
FROM analytics.purchases_dedup_lm_v2 FINAL
WHERE purchase_date BETWEEN '{start_date}' AND '{end_date}'
"""


def get_total_revenue(
    database_id: int,
    start_date: str,
    end_date: str,
) -> float:
    """
    Returns true total revenue — one row per purchase, not inflated by
    multi-touch transition counts.
    """
    sql = TOTAL_REVENUE_SQL.format(start_date=start_date, end_date=end_date)
    df = _run_query(database_id, sql)
    value = df["total_revenue"].iloc[0]
    if value is None:
        raise RuntimeError(
            f"get_total_revenue returned NULL for {start_date}–{end_date}. "
            "A tabela de compras pode estar temporariamente indisponível."
        )
    return float(value)


# ---------------------------------------------------------------------------
# Channel spend (Google + Meta)
# ---------------------------------------------------------------------------

GOOGLE_COST_SQL = """
SELECT
    'Google Ads' AS channel,
    sum(cost) AS spend
FROM raw.gogroup_google_ads
WHERE company = 'Gocase'
  AND date BETWEEN '{start_date}' AND '{end_date}'
"""

# Meta spend is at account level (no FB/IG platform split available).
# Total Meta spend is assigned to 'Paid Meta Ads'.
# Instagram will show NaN ROAS — a known data limitation.
META_COST_SQL = """
SELECT
    'Paid Meta Ads' AS channel,
    sum(spend) AS spend
FROM raw.gogroup_meta_segments_clientes
WHERE company = 'Gocase'
  AND date_start >= '{start_date}'
  AND date_start < CAST('{end_date}' AS date) + INTERVAL '1 day'
"""

# SMS: fixed cost of R$0.04 per message sent via Insider.
SMS_COST_SQL = """
SELECT
    'SMS' AS channel,
    sum(sent) * 0.04 AS spend
FROM raw.insider_journey_channels
WHERE brand = 'gocase'
  AND channel = 'sms'
  AND stat_date BETWEEN '{start_date}' AND '{end_date}'
"""

# WhatsApp CRM: fixed cost of R$0.40 per message sent via Insider.
WHATSAPP_CRM_COST_SQL = """
SELECT
    'WhatsApp CRM' AS channel,
    sum(sent) * 0.40 AS spend
FROM raw.insider_journey_channels
WHERE brand = 'gocase'
  AND channel = 'whatsapp'
  AND stat_date BETWEEN '{start_date}' AND '{end_date}'
"""


def _session_events_sql(start_date: str, end_date: str) -> str:
    """
    Aggregates events_v2 by session_id, returning the highest funnel-stage
    priority reached in each session.

    Table:  plausible_events_db.events_v2
    Columns used: session_id (UInt64), name, timestamp
    Funnel priority: 4=Purchase, 3=Cart Intent, 2=Product Interest, 1=Low Intent
    """
    all_events = [k for k in EVENT_STAGE_MAPPING.keys()]
    quoted = ", ".join(f"'{e}'" for e in all_events)
    stage_case = _funnel_stage_sql_case("name")
    stage_label = _priority_to_stage_sql("max_stage_priority")
    return f"""
SELECT
    session_id,
    max({stage_case}) AS max_stage_priority,
    {stage_label}     AS funnel_stage,
    count()           AS event_count
FROM plausible_events_db.events_v2
WHERE timestamp BETWEEN '{start_date}' AND '{end_date}'
  AND name IN ({quoted})
GROUP BY session_id
"""


def get_session_events(
    database_id: int,
    start_date: str,
    end_date: str,
) -> pd.DataFrame:
    """
    Returns the highest funnel stage reached per session in the given window.
    Columns: session_id, funnel_stage, event_count
    """
    sql = _session_events_sql(start_date, end_date)
    df = _run_query(database_id, sql)
    if "funnel_stage" not in df.columns:
        return pd.DataFrame(columns=["session_id", "funnel_stage", "event_count"])
    df["session_id"] = df["session_id"].astype(int)
    df["event_count"] = df["event_count"].astype(int)
    return df


def _funnel_enriched_paths_sql(
    start_date: str,
    end_date: str,
    lookback: int,
) -> str:
    """
    Builds converting + non-converting paths where each channel touch is
    enriched with the funnel stage reached during that session.

    State format: "channel / funnel_stage"
      e.g. "Paid Meta Ads / Product Interest", "Google Ads / Cart Intent"

    Sessions without events in Events V2 fall back to 'Low Intent'.
    """
    state_expr = _state_sql("s_all")
    stage_case = _funnel_stage_sql_case("ev.name")
    all_events = list(EVENT_STAGE_MAPPING.keys())
    quoted = ", ".join(f"'{e}'" for e in all_events)
    # stage label subquery reused in both journey CTEs
    stage_label_subq = (
        f"SELECT session_id, {_priority_to_stage_sql('max_stage_priority')} AS stage_label "
        f"FROM session_stages"
    )

    return f"""
WITH purchase_info AS (
    SELECT
        p.user_pseudo_id,
        sum(p.value)        AS revenue,
        max(s_conv.`start`) AS conv_start
    FROM analytics.purchases_dedup_lm_v2 AS p FINAL
    INNER JOIN plausible_events_db.sessions_v2 AS s_conv FINAL
        ON p.session_id = s_conv.session_id
    WHERE p.purchase_date BETWEEN '{start_date}' AND '{end_date}'
      AND p.user_pseudo_id != ''
    GROUP BY p.user_pseudo_id
),
session_stages AS (
    -- Max funnel-stage priority per session from events_v2 (UInt64 session_id)
    SELECT
        session_id,
        max({stage_case}) AS max_stage_priority
    FROM plausible_events_db.events_v2 AS ev
    WHERE ev.timestamp BETWEEN toDate('{start_date}') - INTERVAL {lookback} DAY AND '{end_date}'
      AND ev.name IN ({quoted})
    GROUP BY session_id
),
converting_journeys AS (
    SELECT
        s_all.upid AS user_id,
        arrayStringConcat(
            arrayMap(x -> x.2,
                arraySort(x -> x.1,
                    groupArray((
                        toUnixTimestamp(s_all.`start`),
                        concat(
                            {state_expr},
                            ' / ',
                            coalesce(nullIf(se.stage_label, ''), 'Low Intent')
                        )
                    ))
                )
            ),
            ' -> '
        ) AS path_sequence,
        1          AS converted,
        pi.revenue AS revenue
    FROM (
        SELECT
            arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) AS upid,
            session_id,
            `start`, utm_medium, utm_source, utm_campaign, acquisition_channel
        FROM plausible_events_db.sessions_v2 FINAL
        WHERE `start` BETWEEN toDate('{start_date}') - INTERVAL {lookback} DAY AND '{end_date}'
          AND has(entry_meta.key, 'user_pseudo_id')
          AND arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) != ''
    ) AS s_all
    LEFT JOIN ({stage_label_subq}) AS se ON s_all.session_id = se.session_id
    INNER JOIN purchase_info pi
        ON  s_all.upid = pi.user_pseudo_id
        AND s_all.`start` <= pi.conv_start
    GROUP BY s_all.upid, pi.revenue
),
nonconverting_journeys AS (
    -- 1% sample of non-converters (mirrors the existing non-converting SQL logic)
    SELECT
        s_all.upid          AS user_id,
        arrayStringConcat(
            arrayMap(x -> x.2,
                arraySort(x -> x.1,
                    groupArray((
                        toUnixTimestamp(s_all.`start`),
                        concat(
                            {state_expr},
                            ' / ',
                            coalesce(nullIf(se.stage_label, ''), 'Low Intent')
                        )
                    ))
                )
            ),
            ' -> '
        ) AS path_sequence,
        0            AS converted,
        toFloat64(0) AS revenue
    FROM (
        SELECT
            arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) AS upid,
            session_id,
            `start`, utm_medium, utm_source, utm_campaign, acquisition_channel
        FROM plausible_events_db.sessions_v2 FINAL
        WHERE `start` BETWEEN '{start_date}' AND '{end_date}'
          AND has(entry_meta.key, 'user_pseudo_id')
          AND arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id')) != ''
          AND cityHash64(arrayElement(entry_meta.value, indexOf(entry_meta.key, 'user_pseudo_id'))) % 100 < 1
    ) AS s_all
    LEFT JOIN ({stage_label_subq}) AS se ON s_all.session_id = se.session_id
    WHERE s_all.upid NOT IN (SELECT user_pseudo_id FROM purchase_info)
    GROUP BY s_all.upid
)
SELECT path_sequence, converted, sum(revenue) AS revenue, count() AS occurrences
FROM (
    SELECT path_sequence, converted, revenue FROM converting_journeys
    UNION ALL
    SELECT path_sequence, converted, revenue FROM nonconverting_journeys
)
GROUP BY path_sequence, converted
ORDER BY occurrences DESC
"""


def get_funnel_enriched_paths(
    database_id: int,
    start_date: str,
    end_date: str,
    lookback: int = 30,
) -> pd.DataFrame:
    """
    Returns path sequences where each touch is labeled 'channel / funnel_stage'.
    Used to build the Funnel Stage Markov/Shapley model (Sprint 13).
    Falls back to an empty DataFrame on any query failure.
    Columns: path_sequence, converted, revenue, occurrences
    """
    sql = _funnel_enriched_paths_sql(start_date, end_date, lookback)
    df = _run_query(database_id, sql)
    if "path_sequence" not in df.columns:
        return pd.DataFrame(columns=["path_sequence", "converted", "revenue", "occurrences"])
    df["converted"] = df["converted"].astype(int)
    df["revenue"] = df["revenue"].astype(float)
    df["occurrences"] = df["occurrences"].astype(int)
    return df


def get_channel_spend(
    db_datamart: int,
    start_date: str,
    end_date: str,
) -> pd.DataFrame:
    """
    Returns spend per channel from Google Ads, Meta, SMS and WhatsApp CRM.
    SMS and WhatsApp CRM are derived from Insider send counts × fixed unit costs
    (R$0.04/msg and R$0.40/msg respectively).
    Columns: channel, spend
    """
    google = _run_query(
        db_datamart,
        GOOGLE_COST_SQL.format(start_date=start_date, end_date=end_date),
    )
    google["spend"] = google["spend"].astype(float)

    meta = _run_query(
        db_datamart,
        META_COST_SQL.format(start_date=start_date, end_date=end_date),
    )
    meta["spend"] = meta["spend"].astype(float)

    sms = _run_query(
        db_datamart,
        SMS_COST_SQL.format(start_date=start_date, end_date=end_date),
    )
    sms["spend"] = sms["spend"].astype(float)

    wpp = _run_query(
        db_datamart,
        WHATSAPP_CRM_COST_SQL.format(start_date=start_date, end_date=end_date),
    )
    wpp["spend"] = wpp["spend"].astype(float)

    spend = pd.concat([google, meta, sms, wpp], ignore_index=True)
    spend = spend.groupby("channel", as_index=False).agg(spend=("spend", "sum"))
    return spend
