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
