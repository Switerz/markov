import pytest
import pandas as pd

from gograph.backend.app.db.models import ModelRunInput, ModelRunLog
from gograph.backend.app.schemas import ModelRunParams
from gograph.backend.app.services import extraction_service
from gograph.backend.app.services.lineage_service import canonical_hash
from gograph.backend.app.services.log_service import run_logged_step
from gograph.backend.app.services.persistence_service import (
    create_pending_model_run,
    init_database,
    session_scope,
)


def test_canonical_hash_stable_across_order():
    df1 = pd.DataFrame({"a": [3, 1, 2], "b": ["x", "y", "z"]})
    df2 = df1.iloc[[2, 0, 1]].reset_index(drop=True)

    assert canonical_hash(df1, sort_by=["a"]) == canonical_hash(df2, sort_by=["a"])


def test_canonical_hash_changes_with_data():
    df1 = pd.DataFrame({"a": [1], "b": ["x"]})
    df2 = pd.DataFrame({"a": [1], "b": ["y"]})

    assert canonical_hash(df1) != canonical_hash(df2)


def test_extract_transition_counts_records_lineage(monkeypatch, tmp_path):
    database_url = f"sqlite:///{tmp_path / 'lineage.db'}"
    init_database(database_url)
    model_run_id = create_pending_model_run(
        {
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "db_plausible": 70,
        },
        database_url=database_url,
    )
    conv = pd.DataFrame([{"from_ch": "(start)", "to_ch": "Google", "n": 1, "total_revenue": 10.0}])
    nconv = pd.DataFrame([{"from_ch": "(start)", "to_ch": "Direct", "n": 2}])

    monkeypatch.setattr(extraction_service, "get_converting_transitions", lambda **_kwargs: conv)
    monkeypatch.setattr(extraction_service, "get_nonconverting_transitions", lambda **_kwargs: nconv)

    params = ModelRunParams(
        start_date="2026-03-01",
        end_date="2026-03-31",
        db_plausible=70,
        non_conv_scale=1.0,
        batch_mode="never",
    )
    with session_scope(database_url=database_url) as session:
        extraction_service.extract_transition_counts(
            params,
            model_run_id=model_run_id,
            session=session,
        )

    with session_scope(database_url=database_url) as session:
        rows = session.query(ModelRunInput).order_by(ModelRunInput.query_name).all()
        query_names = [row.query_name for row in rows]
        first_hash = rows[0].data_hash

    assert query_names == [
        "converting_transitions",
        "nonconverting_transitions",
    ]
    assert first_hash == canonical_hash(conv, sort_by=["from_ch", "to_ch"])


def test_run_logged_step_records_failed_before_exception(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'logs.db'}"
    init_database(database_url)
    model_run_id = create_pending_model_run(
        {
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "db_plausible": 70,
        },
        database_url=database_url,
    )

    with pytest.raises(RuntimeError):
        run_logged_step(
            database_url=database_url,
            model_run_id=model_run_id,
            step="markov",
            fn=lambda: (_ for _ in ()).throw(RuntimeError("boom")),
        )

    with session_scope(database_url=database_url) as session:
        logs = session.query(ModelRunLog).order_by(ModelRunLog.created_at).all()
        statuses = [log.status for log in logs]
        failed_message = logs[-1].message

    assert statuses == ["started", "failed"]
    assert failed_message == "boom"
