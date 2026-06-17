"""HTTP contract tests for typed scenario endpoints."""

from fastapi.testclient import TestClient

from gograph.backend.app.db.models import ModelRun
from gograph.backend.app.db.session import get_session_factory
from gograph.backend.app.main import create_app
from gograph.backend.app.services.code_version_service import get_code_version


def _client_and_run(tmp_path):
    database_url = f"sqlite:///{tmp_path}/scenario_api.db"
    app = create_app(database_url=database_url)
    factory = get_session_factory(database_url)
    with factory() as session:
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
        run_id = run.id
    return TestClient(app), run_id


def test_create_scenario_validates_action_payload(tmp_path):
    client, run_id = _client_and_run(tmp_path)

    response = client.post(
        f"/model-runs/{run_id}/scenarios",
        json={
            "name": "Remove without channel",
            "action_type": "removeChannel",
            "nodes": [],
            "edges": [],
            "path_channels": [],
        },
    )

    assert response.status_code == 422


def test_analyze_persists_latest_analysis_and_list_exposes_version(tmp_path, monkeypatch):
    monkeypatch.setenv("CODE_VERSION", "test-sha")
    get_code_version.cache_clear()
    client, run_id = _client_and_run(tmp_path)

    created = client.post(
        f"/model-runs/{run_id}/scenarios",
        json={
            "name": "Reduzir Google",
            "description": "Teste endpoint",
            "action_type": "reducePresence",
            "channel": "Google Ads",
            "intensity_pct": 30,
            "nodes": [],
            "edges": [],
            "path_channels": ["Google Ads"],
        },
    )
    assert created.status_code == 201, created.text
    scenario_id = created.json()["id"]

    analysis = client.post(f"/scenarios/{scenario_id}/analyze")
    assert analysis.status_code == 200, analysis.text
    assert analysis.json()["code_version"] == "test-sha"
    assert analysis.json()["model_run_id"] == run_id

    listed = client.get(f"/model-runs/{run_id}/scenarios")
    assert listed.status_code == 200
    body = listed.json()
    assert body[0]["analysis"]["code_version"] == "test-sha"
    assert body[0]["analysis"]["analyzed_at"]


def test_compare_uses_persisted_analysis(tmp_path):
    client, run_id = _client_and_run(tmp_path)
    scenario_ids = []
    for channel in ("Google Ads", "Email"):
        response = client.post(
            f"/model-runs/{run_id}/scenarios",
            json={
                "name": channel,
                "action_type": "reducePresence",
                "channel": channel,
                "intensity_pct": 25,
                "nodes": [],
                "edges": [],
                "path_channels": [channel],
            },
        )
        assert response.status_code == 201, response.text
        scenario_id = response.json()["id"]
        scenario_ids.append(scenario_id)
        assert client.post(f"/scenarios/{scenario_id}/analyze").status_code == 200

    compared = client.post(
        f"/model-runs/{run_id}/scenarios/compare",
        json={"scenario_ids": scenario_ids},
    )

    assert compared.status_code == 200, compared.text
    assert [item["source"] for item in compared.json()["items"]] == [
        "scenario",
        "scenario",
    ]
