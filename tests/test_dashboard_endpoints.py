from fastapi.testclient import TestClient

from gograph.backend.app.api.dashboard_schemas import (
    BudgetDashboardResponse,
    OverviewDashboardResponse,
)
from gograph.backend.app.main import create_app
from gograph.backend.app.services.persistence_service import save_model_run
from tests.test_persistence_service import _build_result


def test_summary_and_recommendations_endpoints(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'dashboard_summary.db'}"
    app = create_app(database_url=database_url)
    result = _build_result()
    model_run_id = save_model_run(result, database_url=database_url)
    client = TestClient(app)

    summary = client.get(f"/model-runs/{model_run_id}/summary")
    recommendations = client.get(f"/model-runs/{model_run_id}/recommendations")

    assert summary.status_code == 200
    assert summary.json()["total_revenue"] == 1000.0
    assert recommendations.status_code == 200
    assert recommendations.json()
    assert "rationale" in recommendations.json()[0]


def test_overview_dashboard_returns_full_payload_with_compare(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'dashboard_overview.db'}"
    app = create_app(database_url=database_url)
    result = _build_result()
    run_a = save_model_run(result, database_url=database_url)
    run_b = save_model_run(result, database_url=database_url)
    client = TestClient(app)

    response = client.get(f"/model-runs/{run_a}/dashboard/overview?compare_run_id={run_b}")

    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["run_id"] == run_a
    assert body["meta"]["compare_run_id"] == run_b
    assert len(body["metric_strip"]) == 6
    assert body["metric_strip"][0]["delta"] is not None
    assert len(body["priority_decisions"]) <= 5
    OverviewDashboardResponse.model_validate(body)


def test_budget_dashboard_returns_full_payload(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'dashboard_budget.db'}"
    app = create_app(database_url=database_url)
    result = _build_result()
    model_run_id = save_model_run(result, database_url=database_url)
    client = TestClient(app)

    response = client.get(f"/model-runs/{model_run_id}/dashboard/budget")

    assert response.status_code == 200
    body = response.json()
    assert len(body["summary_cards"]) == 4
    assert body["channels_table"]
    assert body["selected_channel_drawer"] is not None
    BudgetDashboardResponse.model_validate(body)


def test_overview_dashboard_invalid_compare_422(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'dashboard_invalid_compare.db'}"
    app = create_app(database_url=database_url)
    result = _build_result()
    model_run_id = save_model_run(result, database_url=database_url)
    client = TestClient(app)

    response = client.get(f"/model-runs/{model_run_id}/dashboard/overview?compare_run_id=999999")

    assert response.status_code == 422
