from fastapi.testclient import TestClient

from gograph.backend.app.main import create_app
from gograph.backend.app.services.persistence_service import save_model_run
from tests.test_persistence_service import _build_result


def test_model_run_read_endpoints_return_persisted_data(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'api_test.db'}"
    app = create_app(database_url=database_url)
    result = _build_result()
    model_run_id = save_model_run(result, database_url=database_url)
    client = TestClient(app)

    health = client.get("/health").json()
    assert health["status"] == "ok"

    runs = client.get("/model-runs")
    overview = client.get(f"/model-runs/{model_run_id}/overview")
    channels = client.get(f"/model-runs/{model_run_id}/channels")
    diagnostics = client.get(f"/model-runs/{model_run_id}/diagnostics")
    insights = client.get(f"/model-runs/{model_run_id}/insights")
    touchpoints = client.get(f"/model-runs/{model_run_id}/touchpoints")
    transitions = client.get(f"/model-runs/{model_run_id}/transitions")
    paths = client.get(f"/model-runs/{model_run_id}/paths")
    graph = client.get(f"/model-runs/{model_run_id}/graph")
    data_quality = client.get(f"/model-runs/{model_run_id}/data-quality")
    exports = client.get(f"/model-runs/{model_run_id}/export")

    assert runs.status_code == 200
    assert len(runs.json()) == 1
    assert overview.status_code == 200
    assert overview.json()["id"] == model_run_id
    assert channels.status_code == 200
    assert len(channels.json()["rows"]) >= 2
    assert diagnostics.status_code == 200
    assert insights.status_code == 200
    assert touchpoints.status_code == 200
    assert touchpoints.json()["rows"]
    assert transitions.status_code == 200
    assert paths.status_code == 200
    assert graph.status_code == 200
    assert graph.json()["nodes"]
    assert graph.json()["edges"]
    assert graph.json()["summary"]["node_count"] >= 1
    assert "pagerank" in graph.json()["nodes"][0]
    assert "cycles" in graph.json()
    assert "self_loops" in graph.json()
    assert data_quality.status_code == 200
    assert exports.status_code == 200


def test_create_model_run_endpoint_persists_result(monkeypatch, tmp_path):
    database_url = f"sqlite:///{tmp_path / 'api_post_test.db'}"
    app = create_app(database_url=database_url)
    result = _build_result()

    def fake_run_model(params, **_kwargs):
        assert params.start_date == "2026-03-01"
        assert params.end_date == "2026-03-31"
        return result

    monkeypatch.setattr(
        "gograph.backend.app.api.model_runs.run_model",
        fake_run_model,
    )
    client = TestClient(app)

    response = client.post(
        "/model-runs",
        json={
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "lookback_days": 30,
            "decay_lambda": 0.05,
            "non_conv_sample_pct": 1,
            "non_conv_scale": 1.0,
            "shapley_samples": 10,
            "db_plausible": 70,
            "db_datamart": 63,
            "batch_mode": "auto",
            "batch_days": 35,
        },
    )

    assert response.status_code == 200
    assert response.json()["id"] == 1
    assert client.get("/model-runs").json()[0]["id"] == 1


def test_unknown_model_run_returns_404(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'api_404_test.db'}"
    app = create_app(database_url=database_url)
    client = TestClient(app)

    response = client.get("/model-runs/999")

    assert response.status_code == 404
