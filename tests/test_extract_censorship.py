"""Unit tests for right-censorship logic in extract.py.

These tests do NOT require a real Metabase/ClickHouse connection.
They validate:
  - SQL structure for _nonconverting_sql with and without censorship_days
  - SQL structure for _nconv_sample_count_sql
  - get_censored_count returns (0, 0) when censorship_days <= 0
  - Backward compatibility: censorship_days=0 produces equivalent SQL
"""

import pytest
from extract import (
    _censored_count_sql,
    _nconv_sample_count_sql,
    _nonconverting_sql,
    get_censored_count,
)


# ---------------------------------------------------------------------------
# _nonconverting_sql
# ---------------------------------------------------------------------------

def test_nonconverting_sql_baseline_contains_mature_journeys_cte():
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=0)
    assert "mature_journeys" in sql


def test_nonconverting_sql_baseline_transitions_from_mature():
    """transitions CTE must read from mature_journeys, not from journeys."""
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=0)
    # The ARRAY JOIN must reference mature_journeys
    assert "FROM mature_journeys" in sql


def test_nonconverting_sql_censorship_0_interval():
    """When censorship_days=0, cutoff = end_date - INTERVAL 0 DAY (always passes)."""
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=0)
    assert "INTERVAL 0 DAY" in sql
    assert "last_session" in sql


def test_nonconverting_sql_censorship_7_interval():
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=7)
    assert "INTERVAL 7 DAY" in sql


def test_nonconverting_sql_censorship_14_interval():
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=14)
    assert "INTERVAL 14 DAY" in sql


def test_nonconverting_sql_censorship_30_interval():
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=30)
    assert "INTERVAL 30 DAY" in sql


def test_nonconverting_sql_last_session_tracked():
    """journeys CTE must compute max(start) as last_session."""
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1)
    assert "max(s.`start`) AS last_session" in sql


def test_nonconverting_sql_absorbing_state_unchanged():
    """Non-Conversion must still be the absorbing state in transitions."""
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=7)
    assert "'Non-Conversion'" in sql


def test_nonconverting_sql_end_date_in_filter():
    """The maturation cutoff must use the correct end_date."""
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=7)
    assert "toDate('2026-03-31')" in sql


def test_nonconverting_sql_sample_pct_applied():
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=5, censorship_days=0)
    assert "< 5" in sql


# ---------------------------------------------------------------------------
# _nconv_sample_count_sql
# ---------------------------------------------------------------------------

def test_nconv_count_sql_default_no_censorship():
    sql = _nconv_sample_count_sql("2026-03-01", "2026-03-31", sample_pct=1)
    assert "INTERVAL 0 DAY" in sql


def test_nconv_count_sql_censorship_7():
    sql = _nconv_sample_count_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=7)
    assert "INTERVAL 7 DAY" in sql
    assert "last_session" in sql


def test_nconv_count_sql_consistent_with_nonconv_sql():
    """Both SQLs should reference the same end_date cutoff formula."""
    end = "2026-03-31"
    days = 14
    sql_trans = _nonconverting_sql("2026-03-01", end, sample_pct=1, censorship_days=days)
    sql_count = _nconv_sample_count_sql("2026-03-01", end, sample_pct=1, censorship_days=days)
    expected_clause = f"toDate('{end}') - INTERVAL {days} DAY"
    assert expected_clause in sql_trans
    assert expected_clause in sql_count


# ---------------------------------------------------------------------------
# _censored_count_sql
# ---------------------------------------------------------------------------

def test_censored_count_sql_has_censored_count_column():
    sql = _censored_count_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=7)
    assert "censored_count" in sql
    assert "total_count" in sql


def test_censored_count_sql_uses_countIf():
    sql = _censored_count_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=7)
    assert "countIf" in sql


def test_censored_count_sql_censorship_boundary():
    sql = _censored_count_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=7)
    # Censored = last_session > cutoff (inside the horizon)
    assert "last_session > toDate('2026-03-31') - INTERVAL 7 DAY" in sql


# ---------------------------------------------------------------------------
# get_censored_count — no-DB shortcut path
# ---------------------------------------------------------------------------

def test_get_censored_count_returns_zeros_when_disabled():
    """get_censored_count must return (0, 0) without hitting the DB when days=0."""
    result = get_censored_count(
        database_id=99,  # invalid — would fail if query ran
        start_date="2026-03-01",
        end_date="2026-03-31",
        sample_pct=1,
        censorship_days=0,
    )
    assert result == (0, 0)


def test_get_censored_count_returns_zeros_when_negative():
    result = get_censored_count(
        database_id=99,
        start_date="2026-03-01",
        end_date="2026-03-31",
        sample_pct=1,
        censorship_days=-1,
    )
    assert result == (0, 0)


# ---------------------------------------------------------------------------
# Backward-compatibility invariant
# ---------------------------------------------------------------------------

def test_censorship_0_produces_no_extra_filtering_logic():
    """
    With censorship_days=0, every journey satisfies the maturation filter
    because toDate(end_date) - INTERVAL 0 DAY = end_date, and all sessions
    in the window are <= end_date. Confirmed by INTERVAL 0 DAY presence.
    """
    sql = _nonconverting_sql("2026-03-01", "2026-03-31", sample_pct=1, censorship_days=0)
    # Should have the cutoff but with 0 days (no filtering effect)
    assert "INTERVAL 0 DAY" in sql
    # Should NOT have any other day-based INTERVAL
    import re
    intervals = re.findall(r"INTERVAL (\d+) DAY", sql)
    assert all(int(d) == 0 for d in intervals), f"Unexpected non-zero intervals: {intervals}"
