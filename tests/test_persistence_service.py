from pathlib import Path

from gograph.backend.app.db.session import get_session_factory
from gograph.backend.app.schemas import ModelRunParams
from gograph.backend.app.services.model_service import run_model
from gograph.backend.app.services.persistence_service import (
    get_model_run,
    get_model_run_table,
    init_database,
    list_model_runs,
    register_export,
    save_model_run,
    session_scope,
)
from tests.test_model_service import _sample_inputs


def _build_result():
    converting, nonconverting, spend = _sample_inputs()
    params = ModelRunParams(
        start_date="2026-03-01",
        end_date="2026-03-31",
        db_plausible=70,
        db_datamart=63,
        non_conv_scale=1.0,
        shapley_samples=10,
    )
    return run_model(
        params=params,
        converting_transitions=converting,
        nonconverting_transitions=nonconverting,
        spend=spend,
        total_revenue=1000.0,
        observed_conversion_rate=0.5,
        paid_channels={"Google Ads"},
    )


def test_save_and_read_model_run_with_sqlite(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'gograph_test.db'}"
    init_database(database_url)
    result = _build_result()

    model_run_id = save_model_run(result, database_url=database_url)

    saved = get_model_run(model_run_id, database_url=database_url)
    runs = list_model_runs(database_url=database_url)
    attribution = get_model_run_table(
        model_run_id,
        "attribution_results",
        database_url=database_url,
    )
    transitions = get_model_run_table(
        model_run_id,
        "transition_counts",
        database_url=database_url,
    )

    assert saved is not None
    assert saved["id"] == model_run_id
    assert saved["total_revenue"] == 1000.0
    assert len(runs) == 1
    assert {"Google Ads", "Email"}.issubset(set(attribution["channel"]))
    assert {"converting", "nonconverting"}.issubset(set(transitions["transition_type"]))


def test_register_export_uses_existing_session(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'gograph_test.db'}"
    init_database(database_url)
    session_factory = get_session_factory(database_url)
    result = _build_result()
    export_path = Path(tmp_path / "model_run.xlsx")

    with session_scope(session_factory=session_factory) as session:
        model_run_id = save_model_run(result, session=session)
        export_id = register_export(
            model_run_id,
            "excel",
            str(export_path),
            session=session,
        )

    exports = get_model_run_table(
        model_run_id,
        "exports",
        database_url=database_url,
    )

    assert export_id == 1
    assert exports["export_type"].iloc[0] == "excel"
    assert exports["file_path"].iloc[0] == str(export_path)
