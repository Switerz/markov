"""Tests for sandbox_service: CRUD and path analysis."""

import json
import pytest
import pandas as pd

from gograph.backend.app.db.session import create_db_and_tables, get_session_factory
from gograph.backend.app.db.models import ModelRun
from gograph.backend.app.services import sandbox_service as svc


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def db_session(tmp_path):
    url = f"sqlite:///{tmp_path}/test_sandbox.db"
    create_db_and_tables(url)
    factory = get_session_factory(url)
    session = factory()
    # Create a minimal ModelRun so FK is satisfied
    run = ModelRun(
        start_date="2026-03-01",
        end_date="2026-03-31",
        status="completed",
        parameters_json="{}",
        observed_conversion_rate=0.02,
        model_conversion_rate=0.02,
        total_revenue=100000.0,
        total_spend=10000.0,
        runtime_seconds=5.0,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    yield session, run.id
    session.close()


# ---------------------------------------------------------------------------
# CRUD tests
# ---------------------------------------------------------------------------

def test_create_and_get_scenario(db_session):
    session, run_id = db_session
    created = svc.create_scenario(
        model_run_id=run_id,
        name="Test path",
        description="A simple test",
        nodes=[{"id": "n1", "label": "Google Ads"}, {"id": "n2", "label": "Email"}],
        edges=[{"id": "e1", "source": "n1", "target": "n2"}],
        path_channels=["Google Ads", "Email"],
        session=session,
    )
    session.commit()
    assert created["id"] is not None
    assert created["name"] == "Test path"
    assert created["path_channels"] == ["Google Ads", "Email"]

    fetched = svc.get_scenario(created["id"], session=session)
    assert fetched is not None
    assert fetched["name"] == "Test path"


def test_list_scenarios(db_session):
    session, run_id = db_session
    svc.create_scenario(run_id, "A", None, [], [], ["Google Ads"], session)
    svc.create_scenario(run_id, "B", None, [], [], ["Email"], session)
    session.commit()
    results = svc.list_scenarios(run_id, session=session)
    assert len(results) == 2


def test_update_scenario(db_session):
    session, run_id = db_session
    created = svc.create_scenario(run_id, "Old name", None, [], [], ["Google Ads"], session)
    session.commit()

    updated = svc.update_scenario(
        scenario_id=created["id"],
        name="New name",
        description="desc",
        nodes=None,
        edges=None,
        path_channels=["Email", "Google Ads"],
        session=session,
    )
    session.commit()
    assert updated["name"] == "New name"
    assert updated["path_channels"] == ["Email", "Google Ads"]


def test_delete_scenario(db_session):
    session, run_id = db_session
    created = svc.create_scenario(run_id, "To delete", None, [], [], [], session)
    session.commit()

    ok = svc.delete_scenario(created["id"], session=session)
    session.commit()
    assert ok is True
    assert svc.get_scenario(created["id"], session=session) is None


def test_delete_nonexistent(db_session):
    session, _ = db_session
    assert svc.delete_scenario(9999, session=session) is False


# ---------------------------------------------------------------------------
# Analysis tests
# ---------------------------------------------------------------------------

MATRIX = pd.DataFrame([
    {"from_state": "(start)",   "to_state": "Google Ads",  "probability": 0.4},
    {"from_state": "(start)",   "to_state": "Email",       "probability": 0.3},
    {"from_state": "(start)",   "to_state": "Non-Conversion", "probability": 0.3},
    {"from_state": "Google Ads","to_state": "Email",       "probability": 0.5},
    {"from_state": "Google Ads","to_state": "Conversion",  "probability": 0.3},
    {"from_state": "Google Ads","to_state": "Non-Conversion","probability": 0.2},
    {"from_state": "Email",     "to_state": "Conversion",  "probability": 0.6},
    {"from_state": "Email",     "to_state": "Non-Conversion","probability": 0.4},
    {"from_state": "Conversion","to_state": "Conversion",  "probability": 1.0},
    {"from_state": "Non-Conversion","to_state": "Non-Conversion","probability": 1.0},
])


def test_path_probability():
    # (start)→Google Ads→Email→Conversion = 0.4 × 0.5 × 0.6
    p = svc._path_probability(["Google Ads", "Email"], MATRIX)
    assert abs(p - 0.4 * 0.5 * 0.6) < 1e-9


def test_path_probability_missing_step():
    p = svc._path_probability(["Paid Meta Ads"], MATRIX)
    assert p == 0.0


def test_conv_prob_given_last():
    p = svc._conv_prob_given_last("Email", MATRIX)
    assert abs(p - 0.6) < 1e-9


def test_conv_prob_eventually():
    # From Email: directly → Conversion with 0.6
    p = svc._conv_prob_eventually("Email", MATRIX)
    assert 0.5 < p < 0.7


def test_is_subsequence():
    assert svc._is_subsequence(["A", "B"], ["A", "X", "B", "Y"])
    assert not svc._is_subsequence(["B", "A"], ["A", "X", "B"])


def test_analyze_scenario_empty_path(db_session):
    session, run_id = db_session
    created = svc.create_scenario(run_id, "Empty", None, [], [], [], session)
    session.commit()
    result = svc.analyze_scenario(created["id"], session=session)
    assert result["warnings"]
    assert result["path_probability"] is None


def test_analyze_scenario_with_hypothetical(db_session):
    session, run_id = db_session
    created = svc.create_scenario(
        run_id, "Hypo", None, [], [], ["Canal Novo"], session
    )
    session.commit()
    result = svc.analyze_scenario(created["id"], session=session)
    assert any("hipotético" in w for w in result["warnings"])


def test_analyze_scenario_returns_scenario_id(db_session):
    session, run_id = db_session
    created = svc.create_scenario(run_id, "With ID", None, [], [], ["Google Ads"], session)
    session.commit()
    result = svc.analyze_scenario(created["id"], session=session)
    assert result["scenario_id"] == created["id"]


# ---------------------------------------------------------------------------
# compare_scenarios tests
# ---------------------------------------------------------------------------

def test_compare_two_scenarios(db_session):
    session, run_id = db_session
    s1 = svc.create_scenario(run_id, "Path A", None, [], [], ["Google Ads", "Email"], session)
    s2 = svc.create_scenario(run_id, "Path B", None, [], [], ["Email"], session)
    session.commit()

    result = svc.compare_scenarios(
        model_run_id=run_id,
        scenario_ids=[s1["id"], s2["id"]],
        include_baseline=False,
        include_top_path=False,
        session=session,
    )
    assert len(result["items"]) == 2
    assert result["items"][0]["name"] == "Path A"
    assert result["items"][1]["name"] == "Path B"
    assert result["delta"] is not None
    assert "composite_conversion_delta" in result["delta"]


def test_compare_with_baseline(db_session):
    session, run_id = db_session
    s1 = svc.create_scenario(run_id, "Path A", None, [], [], ["Google Ads"], session)
    session.commit()

    result = svc.compare_scenarios(
        model_run_id=run_id,
        scenario_ids=[s1["id"]],
        include_baseline=True,
        include_top_path=False,
        session=session,
    )
    assert len(result["items"]) == 2
    sources = [it["source"] for it in result["items"]]
    assert "baseline" in sources
    assert result["delta"] is not None


def test_compare_with_top_path_no_path_summary(db_session):
    """When path_summary is empty, top_path is skipped; needs at least 2 items."""
    session, run_id = db_session
    s1 = svc.create_scenario(run_id, "A", None, [], [], ["Google Ads"], session)
    s2 = svc.create_scenario(run_id, "B", None, [], [], ["Email"], session)
    session.commit()

    result = svc.compare_scenarios(
        model_run_id=run_id,
        scenario_ids=[s1["id"], s2["id"]],
        include_baseline=False,
        include_top_path=True,  # will be skipped (empty path_summary)
        session=session,
    )
    # top_path skipped → still 2 items from scenarios
    assert len(result["items"]) == 2


def test_compare_too_few_items_raises(db_session):
    session, run_id = db_session
    s1 = svc.create_scenario(run_id, "Solo", None, [], [], ["Google Ads"], session)
    session.commit()

    with pytest.raises(ValueError, match="pelo menos 2"):
        svc.compare_scenarios(
            model_run_id=run_id,
            scenario_ids=[s1["id"]],
            include_baseline=False,
            include_top_path=False,
            session=session,
        )


def test_compare_wrong_model_run_raises(db_session):
    session, run_id = db_session
    # Create a second model run
    from gograph.backend.app.db.models import ModelRun
    run2 = ModelRun(
        start_date="2026-04-01", end_date="2026-04-30", status="completed",
        parameters_json="{}", observed_conversion_rate=0.01,
        model_conversion_rate=0.01, total_revenue=50000.0,
        total_spend=5000.0, runtime_seconds=3.0,
    )
    session.add(run2)
    session.commit()
    session.refresh(run2)

    s1 = svc.create_scenario(run_id,  "RunA", None, [], [], ["Google Ads"], session)
    s2 = svc.create_scenario(run2.id, "RunB", None, [], [], ["Email"], session)
    session.commit()

    with pytest.raises(ValueError, match="pertence ao model run"):
        svc.compare_scenarios(
            model_run_id=run_id,
            scenario_ids=[s1["id"], s2["id"]],
            include_baseline=False,
            include_top_path=False,
            session=session,
        )


def test_compare_winners_set(db_session):
    session, run_id = db_session
    s1 = svc.create_scenario(run_id, "A", None, [], [], ["Google Ads", "Email"], session)
    s2 = svc.create_scenario(run_id, "B", None, [], [], ["Email"], session)
    session.commit()

    result = svc.compare_scenarios(
        model_run_id=run_id,
        scenario_ids=[s1["id"], s2["id"]],
        include_baseline=False,
        include_top_path=False,
        session=session,
    )
    # At least one winner key should be set (may be None if all values are None, which is fine)
    assert "winner_conversion" in result
    assert "winner_revenue" in result
    assert "winner_confidence" in result


def test_compare_delta_direction(db_session):
    """Delta is B − A (second item minus first)."""
    session, run_id = db_session
    s1 = svc.create_scenario(run_id, "A", None, [], [], ["Google Ads", "Email"], session)
    s2 = svc.create_scenario(run_id, "B", None, [], [], ["Email"], session)
    session.commit()

    result = svc.compare_scenarios(
        model_run_id=run_id,
        scenario_ids=[s1["id"], s2["id"]],
        include_baseline=False,
        include_top_path=False,
        session=session,
    )
    delta = result["delta"]
    a_conf = result["items"][0]["confidence_score"]
    b_conf = result["items"][1]["confidence_score"]
    if delta["confidence_delta"] is not None and a_conf is not None and b_conf is not None:
        assert abs(delta["confidence_delta"] - (b_conf - a_conf)) < 1e-9


def test_get_baseline_item():
    matrix_df = pd.DataFrame([
        {"from_state": "(start)", "to_state": "Google Ads", "probability": 0.4},
        {"from_state": "Google Ads", "to_state": "Conversion", "probability": 0.3},
        {"from_state": "Google Ads", "to_state": "Non-Conversion", "probability": 0.7},
    ])
    paths_df = pd.DataFrame([
        {"path_text": "(start) -> Google Ads -> Conversion", "count": 100, "conversion_rate": 0.3, "revenue": 15000.0},
    ])
    transitions_df = pd.DataFrame()
    item = svc._get_baseline_item(matrix_df, paths_df, transitions_df, 0.02, 50000.0)
    assert item["source"] == "baseline"
    assert item["name"] == "Baseline (modelo atual)"
    assert item["composite_conversion_probability"] == pytest.approx(0.02)
    assert item["historical_support"] == 100
    assert item["confidence_score"] == 1.0


def test_find_winner():
    items = [
        {"name": "A", "confidence_score": 0.5},
        {"name": "B", "confidence_score": 0.8},
        {"name": "C", "confidence_score": 0.3},
    ]
    assert svc._find_winner(items, "confidence_score") == "B"


def test_find_winner_all_none():
    items = [
        {"name": "A", "confidence_score": None},
        {"name": "B", "confidence_score": None},
    ]
    assert svc._find_winner(items, "confidence_score") is None


def test_compute_delta_basic():
    a = {"composite_conversion_probability": 0.10, "expected_revenue": 1000.0, "confidence_score": 0.5, "historical_support": 200}
    b = {"composite_conversion_probability": 0.15, "expected_revenue": 1500.0, "confidence_score": 0.7, "historical_support": 300}
    delta = svc._compute_delta(a, b)
    assert delta["composite_conversion_delta"] == pytest.approx(0.05)
    assert delta["composite_conversion_pct"] == pytest.approx(50.0)
    assert delta["expected_revenue_delta"] == pytest.approx(500.0)
    assert delta["confidence_delta"] == pytest.approx(0.2)
    assert delta["historical_support_delta"] == pytest.approx(100)
