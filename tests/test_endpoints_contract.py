"""Contract tests: every typed table endpoint validates against its row schema.

Each test calls the live FastAPI endpoint with a persisted sample run and
re-validates the JSON body against `TableResponse[XRow]`. A shape mismatch
(missing or wrongly-typed field) makes Pydantic raise, failing the test.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from gograph.backend.app.api.row_schemas import (
    ChannelMetricRow,
    DataQualityRow,
    DiagnosticRow,
    FunnelAttributionRow,
    FunnelValidationRow,
    InsightRow,
    LoopDiagnosticRow,
    PathRow,
    SequentialEffectRow,
    SessionQualityRow,
    TouchpointRow,
    TransitionRow,
)
from gograph.backend.app.api.schemas import TableResponse
from gograph.backend.app.main import create_app
from gograph.backend.app.services.persistence_service import save_model_run
from tests.test_persistence_service import _build_result


@pytest.fixture
def client_and_run(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'contract_test.db'}"
    app = create_app(database_url=database_url)
    result = _build_result()
    model_run_id = save_model_run(result, database_url=database_url)
    return TestClient(app), model_run_id


# (endpoint_path_suffix, row_model) — 12 endpoints + session-quality (13 routes total)
ENDPOINTS = [
    ("channels", ChannelMetricRow),
    ("raw-channels", ChannelMetricRow),
    ("diagnostics", DiagnosticRow),
    ("insights", InsightRow),
    ("touchpoints", TouchpointRow),
    ("transitions", TransitionRow),
    ("paths", PathRow),
    ("loops", PathRow),
    ("data-quality", DataQualityRow),
    ("loop-diagnostics", LoopDiagnosticRow),
    ("funnel-attribution", FunnelAttributionRow),
    ("funnel-validation", FunnelValidationRow),
    ("sequential-effects", SequentialEffectRow),
    ("session-quality", SessionQualityRow),
]


@pytest.mark.parametrize("suffix,row_model", ENDPOINTS)
def test_endpoint_contract_matches_row_schema(client_and_run, suffix, row_model):
    client, run_id = client_and_run

    response = client.get(f"/model-runs/{run_id}/{suffix}")
    assert response.status_code == 200, response.text

    body = response.json()
    # Validates wrapper + every row against the typed schema. Raises on mismatch.
    parsed = TableResponse[row_model].model_validate(body)
    assert parsed.model_run_id == run_id
    # rows may legitimately be empty for the sample fixture (e.g. session_quality);
    # the value of this test is the shape validation above.


def test_channels_endpoint_exposes_pfc_fields(client_and_run):
    """Block 1 acceptance: PFC keys present (even when None)."""
    client, run_id = client_and_run
    response = client.get(f"/model-runs/{run_id}/channels")
    assert response.status_code == 200
    body = response.json()
    assert body["rows"], "sample run should yield at least one channel row"
    row = body["rows"][0]
    assert "pfc_weight" in row
    assert "pfc_delta_pp" in row


def test_session_quality_endpoint_has_full_shape(client_and_run):
    """Block 1 acceptance: /session-quality must declare the full SessionQuality row shape."""
    client, run_id = client_and_run
    response = client.get(f"/model-runs/{run_id}/session-quality")
    assert response.status_code == 200
    # Even with no rows persisted, the wrapper must validate against the typed schema.
    TableResponse[SessionQualityRow].model_validate(response.json())


def test_openapi_schema_declares_typed_responses(client_and_run):
    """OpenAPI: every typed endpoint must reference a TableResponse_<XRow>_ schema."""
    client, _ = client_and_run
    spec = client.get("/openapi.json").json()
    schemas = spec.get("components", {}).get("schemas", {})

    expected_wrappers = {
        f"TableResponse_{row_model.__name__}_" for _, row_model in ENDPOINTS
    }
    missing = expected_wrappers - set(schemas.keys())
    assert not missing, f"OpenAPI is missing typed wrappers: {missing}"
