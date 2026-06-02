"""Sprint 7: tests for path_service — path intelligence functions."""

import pandas as pd
import pytest

from gograph.backend.app.services.path_service import (
    compute_path_avg_ticket,
    compute_path_probability,
    compute_path_revenue,
    detect_cycles,
    detect_repeated_nodes,
    enrich_raw_paths,
    rank_paths_by_conversion,
    rank_paths_by_dropoff,
    rank_paths_by_revenue,
)


def _raw_paths():
    """Sample dataset matching the SQL output format (path_sequence, converted, revenue, occurrences)."""
    return pd.DataFrame([
        # Google Ads -> Email: 50 converting, 20 non-converting
        {"path_sequence": "Google Ads -> Email", "converted": 1, "occurrences": 50, "revenue": 5000.0},
        {"path_sequence": "Google Ads -> Email", "converted": 0, "occurrences": 20, "revenue": 0.0},
        # Google Ads only: 30 converting, 70 non-converting
        {"path_sequence": "Google Ads", "converted": 1, "occurrences": 30, "revenue": 2400.0},
        {"path_sequence": "Google Ads", "converted": 0, "occurrences": 70, "revenue": 0.0},
        # Email only: 5 converting, 2 non-converting (high conversion rate, low volume)
        {"path_sequence": "Email", "converted": 1, "occurrences": 5, "revenue": 500.0},
        {"path_sequence": "Email", "converted": 0, "occurrences": 2, "revenue": 0.0},
        # Loop path: Google Ads -> Email -> Google Ads
        {"path_sequence": "Google Ads -> Email -> Google Ads", "converted": 1, "occurrences": 3, "revenue": 300.0},
        {"path_sequence": "Google Ads -> Email -> Google Ads", "converted": 0, "occurrences": 1, "revenue": 0.0},
    ])


def _transition_matrix():
    states = ["(start)", "Google Ads", "Email", "Conversion", "Non-Conversion"]
    data = [
        [0.0, 0.6, 0.1, 0.0, 0.3],  # (start)
        [0.0, 0.0, 0.5, 0.3, 0.2],  # Google Ads
        [0.0, 0.0, 0.0, 0.8, 0.2],  # Email
        [0.0, 0.0, 0.0, 1.0, 0.0],  # Conversion
        [0.0, 0.0, 0.0, 0.0, 1.0],  # Non-Conversion
    ]
    return pd.DataFrame(data, index=states, columns=states)


# ---------------------------------------------------------------------------
# enrich_raw_paths
# ---------------------------------------------------------------------------

def test_enrich_raw_paths_returns_one_row_per_path():
    result = enrich_raw_paths(_raw_paths())
    assert len(result) == 4  # 4 unique paths


def test_enrich_raw_paths_conversion_counting_is_correct():
    result = enrich_raw_paths(_raw_paths())
    ga_email = result[result["path_sequence"] == "Google Ads -> Email"].iloc[0]
    assert ga_email["conversions"] == 50
    assert ga_email["nonconversion_count"] == 20
    assert ga_email["occurrences"] == 70


def test_enrich_raw_paths_conversion_rate():
    result = enrich_raw_paths(_raw_paths())
    ga_email = result[result["path_sequence"] == "Google Ads -> Email"].iloc[0]
    assert abs(ga_email["conversion_rate"] - 50 / 70) < 1e-6


def test_enrich_raw_paths_contains_loop_flag():
    result = enrich_raw_paths(_raw_paths())
    loop_row = result[result["path_sequence"] == "Google Ads -> Email -> Google Ads"].iloc[0]
    no_loop_row = result[result["path_sequence"] == "Google Ads"].iloc[0]
    assert loop_row["contains_loop"] == True  # noqa: E712 — numpy bool
    assert no_loop_row["contains_loop"] == False  # noqa: E712


def test_enrich_raw_paths_path_length():
    result = enrich_raw_paths(_raw_paths())
    ga_email = result[result["path_sequence"] == "Google Ads -> Email"].iloc[0]
    assert ga_email["path_length"] == 2


def test_enrich_raw_paths_path_probability_with_matrix():
    result = enrich_raw_paths(_raw_paths(), transition_matrix=_transition_matrix())
    ga_email = result[result["path_sequence"] == "Google Ads -> Email"].iloc[0]
    # P((start)->Google Ads) * P(Google Ads->Email) * P(Email->Conversion)
    expected = 0.6 * 0.5 * 0.8
    assert abs(ga_email["path_probability"] - expected) < 1e-6


def test_enrich_raw_paths_path_probability_none_without_matrix():
    result = enrich_raw_paths(_raw_paths())
    assert result["path_probability"].isna().all()


def test_enrich_raw_paths_top_n_limits_rows():
    result = enrich_raw_paths(_raw_paths(), top_n=2)
    assert len(result) <= 2


def test_enrich_raw_paths_empty_returns_empty():
    result = enrich_raw_paths(pd.DataFrame())
    assert result.empty


# ---------------------------------------------------------------------------
# rank_paths_by_conversion
# ---------------------------------------------------------------------------

def test_rank_paths_by_conversion_sorted_desc():
    result = rank_paths_by_conversion(_raw_paths(), top_n=10)
    assert not result.empty
    rates = result["conversion_rate"].tolist()
    assert rates == sorted(rates, reverse=True)


def test_rank_paths_by_conversion_only_converting_paths():
    result = rank_paths_by_conversion(_raw_paths(), top_n=10)
    assert (result["conversions"] > 0).all()


# ---------------------------------------------------------------------------
# rank_paths_by_revenue
# ---------------------------------------------------------------------------

def test_rank_paths_by_revenue_sorted_desc():
    result = rank_paths_by_revenue(_raw_paths(), top_n=10)
    assert not result.empty
    revenues = result["total_revenue"].tolist()
    assert revenues == sorted(revenues, reverse=True)


def test_rank_paths_by_revenue_first_is_highest():
    result = rank_paths_by_revenue(_raw_paths(), top_n=1)
    assert result.iloc[0]["path_sequence"] == "Google Ads -> Email"


# ---------------------------------------------------------------------------
# rank_paths_by_dropoff
# ---------------------------------------------------------------------------

def test_rank_paths_by_dropoff_sorted_desc():
    result = rank_paths_by_dropoff(_raw_paths(), top_n=10)
    assert not result.empty
    dropoffs = result["nonconversion_count"].tolist()
    assert dropoffs == sorted(dropoffs, reverse=True)


def test_rank_paths_by_dropoff_only_nonconverting():
    result = rank_paths_by_dropoff(_raw_paths(), top_n=10)
    assert (result["nonconversion_count"] > 0).all()


# ---------------------------------------------------------------------------
# detect_repeated_nodes
# ---------------------------------------------------------------------------

def test_detect_repeated_nodes_finds_repeat():
    path = ["Google Ads", "Email", "Google Ads"]
    assert detect_repeated_nodes(path) == ["Google Ads"]


def test_detect_repeated_nodes_no_repeat():
    path = ["Google Ads", "Email", "Conversion"]
    assert detect_repeated_nodes(path) == []


def test_detect_repeated_nodes_excludes_terminal_states():
    path = ["(start)", "Google Ads", "(start)"]
    assert detect_repeated_nodes(path) == []


def test_detect_repeated_nodes_consecutive_not_cycle():
    # A -> A is a self-loop, not "repeated in path" for detect_repeated_nodes
    # It does show up as repeated because the same node appears twice
    path = ["Google Ads", "Google Ads"]
    assert detect_repeated_nodes(path) == ["Google Ads"]


# ---------------------------------------------------------------------------
# detect_cycles
# ---------------------------------------------------------------------------

def test_detect_cycles_finds_aba_pattern():
    path = ["Google Ads", "Email", "Google Ads"]
    cycles = detect_cycles(path)
    assert len(cycles) == 1
    assert cycles[0][0] == "Google Ads"
    assert cycles[0][1] == 0
    assert cycles[0][2] == 2


def test_detect_cycles_ignores_consecutive_self_loops():
    # A -> A: only one step between, index diff == 1 so NOT a cycle
    path = ["Google Ads", "Google Ads"]
    assert detect_cycles(path) == []


def test_detect_cycles_no_cycle():
    path = ["Google Ads", "Email"]
    assert detect_cycles(path) == []


def test_detect_cycles_excludes_terminal_states():
    path = ["(start)", "Google Ads", "Email", "(start)"]
    assert detect_cycles(path) == []


# ---------------------------------------------------------------------------
# compute_path_probability
# ---------------------------------------------------------------------------

def test_compute_path_probability_known_value():
    # P((start)->GA) * P(GA->Email) * P(Email->Conversion) = 0.6 * 0.5 * 0.8
    prob = compute_path_probability(["Google Ads", "Email"], _transition_matrix())
    assert abs(prob - 0.6 * 0.5 * 0.8) < 1e-9


def test_compute_path_probability_missing_transition():
    # Email -> Non-Conversion is not in the path via Conversion endpoint
    # (start) -> Email has P=0.1; Email -> Conversion has P=0.8
    prob = compute_path_probability(["Email"], _transition_matrix())
    assert abs(prob - 0.1 * 0.8) < 1e-9


def test_compute_path_probability_unknown_channel_returns_zero():
    prob = compute_path_probability(["Unknown Channel"], _transition_matrix())
    assert prob == 0.0


def test_compute_path_probability_empty_path():
    # Empty path = (start) -> Conversion directly
    prob = compute_path_probability([], _transition_matrix())
    # (start) -> Conversion has P=0.0 in our matrix
    assert prob == 0.0


# ---------------------------------------------------------------------------
# compute_path_revenue / compute_path_avg_ticket
# ---------------------------------------------------------------------------

def test_compute_path_revenue_summary():
    enriched = enrich_raw_paths(_raw_paths())
    stats = compute_path_revenue(enriched)
    assert stats["total_revenue"] == pytest.approx(5000 + 2400 + 500 + 300)
    assert stats["max_revenue"] == pytest.approx(5000.0)


def test_compute_path_revenue_empty():
    stats = compute_path_revenue(pd.DataFrame())
    assert stats["total_revenue"] == 0.0


def test_compute_path_avg_ticket():
    enriched = enrich_raw_paths(_raw_paths())
    avg = compute_path_avg_ticket(enriched)
    assert avg > 0.0


def test_compute_path_avg_ticket_empty():
    assert compute_path_avg_ticket(pd.DataFrame()) == 0.0
