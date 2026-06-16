from datetime import datetime, timezone

from fastapi.testclient import TestClient

from gograph.backend.app.db.models import ModelRunInput, ModelRunLog
from gograph.backend.app.main import create_app
from gograph.backend.app.services.persistence_service import (
    create_pending_model_run,
    session_scope,
)


def test_inputs_and_logs_endpoints_return_typed_rows(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'lineage_api.db'}"
    app = create_app(database_url=database_url)
    model_run_id = create_pending_model_run(
        {
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "db_plausible": 70,
        },
        database_url=database_url,
    )
    now = datetime.now(timezone.utc)
    with session_scope(database_url=database_url) as session:
        session.add(
            ModelRunInput(
                model_run_id=model_run_id,
                source="plausible",
                database_id=70,
                query_name="converting_transitions",
                row_count=10,
                date_min="2026-03-01",
                date_max="2026-03-31",
                data_hash="a" * 64,
                extracted_at=now,
            )
        )
        session.add(
            ModelRunLog(
                model_run_id=model_run_id,
                step="extraction",
                status="success",
                message=None,
                duration_seconds=0.1,
                created_at=now,
            )
        )

    client = TestClient(app)
    inputs = client.get(f"/model-runs/{model_run_id}/inputs")
    logs = client.get(f"/model-runs/{model_run_id}/logs")

    assert inputs.status_code == 200
    assert inputs.json()[0]["query_name"] == "converting_transitions"
    assert inputs.json()[0]["data_hash"] == "a" * 64
    assert logs.status_code == 200
    assert logs.json()[0]["step"] == "extraction"
    assert logs.json()[0]["status"] == "success"
