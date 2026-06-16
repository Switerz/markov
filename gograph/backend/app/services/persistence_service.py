"""Persistence service for GoGraph model run history."""

from __future__ import annotations

import hashlib
import json
import math
from contextlib import contextmanager
from typing import Any, Iterable, Iterator, Optional

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from gograph.backend.app.db.models import (
    AttributionResult,
    ChannelDiagnostic,
    ChannelRecommendation,
    DataQualityCheck,
    ExportRecord,
    FunnelStateAttribution,
    LoopDiagnostic,
    ModelRunInput,
    ModelRunLog,
    ModelRun,
    ModelRunSummary,
    PathSummary,
    SequentialEffect,
    SessionQuality,
    TransitionCount,
    TransitionMatrixEntry,
)
from gograph.backend.app.db.session import (
    create_db_and_tables,
    get_session_factory,
)
from gograph.backend.app.schemas import ModelRunResult
from gograph.backend.app.services.recommendation_service import derive_recommendations
from gograph.backend.app.services.summary_service import compute_summary
from gograph.backend.app.services.log_service import insert_log


def _clean_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, float) and math.isinf(value):
        return None
    return value


def _row_value(row: pd.Series, name: str, default: Any = None) -> Any:
    if name not in row:
        return default
    return _clean_value(row[name])


def _df_records(df: pd.DataFrame) -> Iterable[pd.Series]:
    for _, row in df.iterrows():
        yield row


@contextmanager
def session_scope(
    session_factory: Optional[sessionmaker[Session]] = None,
    database_url: str | None = None,
) -> Iterator[Session]:
    factory = session_factory or get_session_factory(database_url)
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_database(database_url: str | None = None) -> None:
    create_db_and_tables(database_url)


def save_model_run(
    result: ModelRunResult,
    model_run_id: int | None = None,
    session: Optional[Session] = None,
    database_url: str | None = None,
) -> int:
    """
    Persist a completed model run and return its model_run_id.

    Passing a SQLAlchemy Session lets tests/API callers control transactions.
    """
    if session is None:
        init_database(database_url)
        with session_scope(database_url=database_url) as scoped_session:
            return save_model_run(
                result,
                model_run_id=model_run_id,
                session=scoped_session,
                database_url=database_url,
            )

    if model_run_id is None:
        model_run = ModelRun(
            start_date=result.parameters.start_date,
            end_date=result.parameters.end_date,
            status="completed",
            parameters_json=json.dumps(result.parameters.to_dict(), sort_keys=True),
            observed_conversion_rate=result.observed_conversion_rate,
            model_conversion_rate=result.model_conversion_rate,
            total_revenue=result.total_revenue,
            total_spend=result.total_spend,
            runtime_seconds=result.runtime_seconds,
            error_message=None,
            funnel_model_active=int(result.funnel_model_active),
        )
        session.add(model_run)
    else:
        model_run = session.get(ModelRun, model_run_id)
        if model_run is None:
            raise ValueError(f"Model run not found: {model_run_id}")
        _clear_model_run_children(session, model_run_id)
        model_run.status = "completed"
        model_run.parameters_json = json.dumps(result.parameters.to_dict(), sort_keys=True)
        model_run.observed_conversion_rate = result.observed_conversion_rate
        model_run.model_conversion_rate = result.model_conversion_rate
        model_run.total_revenue = result.total_revenue
        model_run.total_spend = result.total_spend
        model_run.runtime_seconds = result.runtime_seconds
        model_run.error_message = None
        model_run.funnel_model_active = int(result.funnel_model_active)
    session.flush()

    _save_transition_counts(session, model_run.id, result)
    _save_transition_matrix(session, model_run.id, result.transition_matrix)
    # Primary attribution (funnel when active, raw otherwise)
    model_type = "funnel" if result.funnel_model_active else "raw"
    _save_attribution_results(session, model_run.id, result.roas_results, model_type=model_type)
    # Always persist raw baseline for comparison
    if result.funnel_model_active and result.raw_markov_results is not None:
        raw_roas = _build_raw_roas_for_persistence(result)
        if raw_roas is not None:
            _save_attribution_results(session, model_run.id, raw_roas, model_type="raw")
    _save_channel_diagnostics(session, model_run.id, result.roas_results, result.diagnostics)
    _save_path_summary(session, model_run.id, result.top_paths)
    _save_data_quality(session, model_run.id, result.data_quality)
    if result.loop_diagnostics is not None and not result.loop_diagnostics.empty:
        _save_loop_diagnostics(session, model_run.id, result.loop_diagnostics)
    if result.funnel_state_attribution is not None and not result.funnel_state_attribution.empty:
        _save_funnel_state_attribution(session, model_run.id, result.funnel_state_attribution)
    if result.sequential_effects is not None and not result.sequential_effects.empty:
        _save_sequential_effects(session, model_run.id, result.sequential_effects)
    if result.session_quality is not None and not result.session_quality.empty:
        _save_session_quality(session, model_run.id, result.session_quality)
    summary = compute_summary(
        channel_rows=result.roas_results,
        path_rows=result.top_paths,
        transition_rows=result.transition_counts,
        states=result.states,
        observed_rate=result.observed_conversion_rate,
        model_rate=result.model_conversion_rate,
        total_revenue=result.total_revenue,
        total_spend=result.total_spend,
        non_conv_scale=result.non_conv_scale,
        data_quality_rows=result.data_quality,
    )
    save_model_run_summary(session, model_run.id, summary)
    if model_run_id is not None:
        insert_log(session, model_run.id, "recommendation", "started")
    try:
        recs = derive_recommendations(
            result.roas_results,
            result.session_quality if result.session_quality is not None else None,
        )
        save_channel_recommendations(session, model_run.id, recs)
        if model_run_id is not None:
            insert_log(session, model_run.id, "recommendation", "success")
    except Exception as exc:
        if model_run_id is not None:
            insert_log(session, model_run.id, "recommendation", "failed", message=str(exc))
        raise

    return model_run.id


def create_pending_model_run(
    parameters: dict[str, Any],
    session: Optional[Session] = None,
    database_url: str | None = None,
) -> int:
    if session is None:
        init_database(database_url)
        with session_scope(database_url=database_url) as scoped_session:
            return create_pending_model_run(parameters, session=scoped_session)

    run = ModelRun(
        start_date=str(parameters["start_date"]),
        end_date=str(parameters["end_date"]),
        status="pending",
        parameters_json=json.dumps(parameters, sort_keys=True),
        observed_conversion_rate=None,
        model_conversion_rate=0.0,
        total_revenue=0.0,
        total_spend=0.0,
        runtime_seconds=0.0,
        error_message=None,
    )
    session.add(run)
    session.flush()
    return run.id


def mark_model_run_running(
    model_run_id: int,
    session: Optional[Session] = None,
    database_url: str | None = None,
) -> None:
    _update_model_run_status(model_run_id, "running", None, session, database_url)


def mark_model_run_failed(
    model_run_id: int,
    error_message: str,
    session: Optional[Session] = None,
    database_url: str | None = None,
) -> None:
    _update_model_run_status(
        model_run_id,
        "failed",
        error_message[:4000],
        session,
        database_url,
    )


def list_model_runs(
    session: Optional[Session] = None,
    database_url: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    if session is None:
        with session_scope(database_url=database_url) as scoped_session:
            return list_model_runs(scoped_session, limit=limit)

    stmt = select(ModelRun).order_by(ModelRun.created_at.desc()).limit(limit)
    runs = session.execute(stmt).scalars().all()
    return [_model_run_to_dict(run) for run in runs]


def get_model_run(
    model_run_id: int,
    session: Optional[Session] = None,
    database_url: str | None = None,
) -> Optional[dict[str, Any]]:
    if session is None:
        with session_scope(database_url=database_url) as scoped_session:
            return get_model_run(model_run_id, scoped_session)

    run = session.get(ModelRun, model_run_id)
    return _model_run_to_dict(run) if run else None


def get_model_run_table(
    model_run_id: int,
    table_name: str,
    session: Optional[Session] = None,
    database_url: str | None = None,
) -> pd.DataFrame:
    if session is None:
        with session_scope(database_url=database_url) as scoped_session:
            return get_model_run_table(model_run_id, table_name, scoped_session)

    model_by_table = {
        "transition_counts": TransitionCount,
        "transition_matrix": TransitionMatrixEntry,
        "attribution_results": AttributionResult,
        "channel_diagnostics": ChannelDiagnostic,
        "path_summary": PathSummary,
        "data_quality_checks": DataQualityCheck,
        "model_run_inputs": ModelRunInput,
        "model_run_logs": ModelRunLog,
        "model_run_summary": ModelRunSummary,
        "channel_recommendations": ChannelRecommendation,
        "exports": ExportRecord,
        "loop_diagnostics": LoopDiagnostic,
        "funnel_state_attribution": FunnelStateAttribution,
        "sequential_effects": SequentialEffect,
        "session_quality": SessionQuality,
    }
    model = model_by_table.get(table_name)
    if model is None:
        raise ValueError(f"Unsupported model run table: {table_name}")

    rows = (
        session.execute(select(model).where(model.model_run_id == model_run_id))
        .scalars()
        .all()
    )
    return pd.DataFrame([_model_to_public_dict(row) for row in rows])


def clear_database(database_url: str | None = None) -> None:
    """Wipes all rows from all tables in the database."""
    with session_scope(database_url=database_url) as session:
        # Deletar filhos primeiro para respeitar chaves estrangeiras
        models = [
            TransitionCount,
            TransitionMatrixEntry,
            AttributionResult,
            ChannelDiagnostic,
            PathSummary,
            DataQualityCheck,
            ModelRunSummary,
            ChannelRecommendation,
            ModelRunInput,
            ModelRunLog,
            ExportRecord,
            LoopDiagnostic,
            FunnelStateAttribution,
            SequentialEffect,
            SessionQuality,
            ModelRun,
        ]
        for model in models:
            session.query(model).delete()


def _save_transition_counts(
    session: Session,
    model_run_id: int,
    result: ModelRunResult,
) -> None:
    for transition_type, df in result.transition_counts.items():
        for row in _df_records(df):
            f_state = _row_value(row, "from_ch") or _row_value(row, "from_state")
            t_state = _row_value(row, "to_ch") or _row_value(row, "to_state")
            session.add(
                TransitionCount(
                    model_run_id=model_run_id,
                    from_state=str(f_state) if f_state else "(start)",
                    to_state=str(t_state) if t_state else "Non-Conversion",
                    n=float(_row_value(row, "n", 0.0) or 0.0),
                    total_revenue=_row_value(row, "total_revenue"),
                    transition_type=transition_type,
                )
            )


def _save_transition_matrix(
    session: Session,
    model_run_id: int,
    matrix: pd.DataFrame,
) -> None:
    for from_state, row in matrix.iterrows():
        for to_state, probability in row.items():
            prob = _clean_value(probability)
            if prob is None or float(prob) == 0.0:
                continue
            session.add(
                TransitionMatrixEntry(
                    model_run_id=model_run_id,
                    from_state=str(from_state),
                    to_state=str(to_state),
                    probability=float(prob),
                )
            )


def _save_attribution_results(
    session: Session,
    model_run_id: int,
    roas_results: pd.DataFrame,
    model_type: str = "raw",
) -> None:
    for row in _df_records(roas_results):
        markov_weight = _row_value(row, "markov_weight", _row_value(row, "attribution_weight"))
        markov_revenue = _row_value(row, "markov_revenue", _row_value(row, "attributed_revenue"))
        session.add(
            AttributionResult(
                model_run_id=model_run_id,
                model_type=model_type,
                channel=str(_row_value(row, "channel")),
                markov_weight=markov_weight,
                markov_revenue=markov_revenue,
                removal_effect=_row_value(row, "removal_effect"),
                shapley_weight=_row_value(row, "shapley_weight"),
                shapley_revenue=_row_value(row, "shapley_revenue"),
                shapley_value=_row_value(row, "shapley_value"),
                spend=_row_value(row, "spend"),
                roas_markov=_row_value(row, "roas_markov"),
                roas_shapley=_row_value(row, "roas_shapley"),
                pfc_weight=_row_value(row, "pfc_weight"),
                pfc_delta_pp=_row_value(row, "pfc_delta_pp"),
                recommendation=_row_value(row, "recommendation"),
                confidence_score=_row_value(row, "confidence_score"),
            )
        )


def _build_raw_roas_for_persistence(result: "ModelRunResult") -> "pd.DataFrame | None":
    """Build a minimal roas-shaped DataFrame from raw results for persistence."""
    import config as _config
    from gograph.backend.app.services.roas_service import compute_roas
    if result.raw_markov_results is None or result.raw_shapley_results is None:
        return None
    try:
        # diagnostics already computed from raw transitions — reuse it
        return compute_roas(
            result.raw_markov_results,
            result.raw_shapley_results,
            result.roas_results[["channel", "spend"]].drop_duplicates() if "spend" in result.roas_results.columns else pd.DataFrame(columns=["channel", "spend"]),
            result.diagnostics,
            paid_channels=_config.PAID_CHANNELS,
        )
    except Exception:
        return None


def _save_channel_diagnostics(
    session: Session,
    model_run_id: int,
    roas_results: pd.DataFrame,
    diagnostics: pd.DataFrame,
) -> None:
    source = roas_results if "channel_role" in roas_results.columns else diagnostics
    for row in _df_records(source):
        markov_weight = _row_value(row, "markov_weight", _row_value(row, "attribution_weight", 0.0))
        shapley_weight = _row_value(row, "shapley_weight", 0.0)
        delta_pp = None
        if markov_weight is not None and shapley_weight is not None:
            delta_pp = (float(markov_weight) - float(shapley_weight)) * 100
        session.add(
            ChannelDiagnostic(
                model_run_id=model_run_id,
                channel=str(_row_value(row, "channel")),
                channel_role=_row_value(row, "channel_role"),
                touchpoint_role=None,
                presence_converting=_row_value(row, "conv_presence_share"),
                presence_nonconverting=_row_value(row, "nonconv_presence_share"),
                first_touch_share=_row_value(row, "conv_start_share"),
                middle_touch_share=_row_value(row, "conv_middle_in_share"),
                last_touch_share=_row_value(row, "conv_last_share"),
                assist_count=None,
                closer_count=None,
                starter_count=None,
                markov_shapley_delta_pp=delta_pp,
                diagnostic_label=_row_value(row, "presence_warning"),
                diagnostic_text=_row_value(row, "recommendation"),
            )
        )


def _save_path_summary(
    session: Session,
    model_run_id: int,
    paths: pd.DataFrame,
) -> None:
    for row in _df_records(paths):
        path_text = str(_row_value(row, "path_sequence", ""))
        path_hash = hashlib.sha256(path_text.encode("utf-8")).hexdigest()[:32]
        count = _row_value(row, "occurrences", 0)
        revenue = _row_value(row, "total_revenue", 0.0)
        path_prob = _row_value(row, "path_probability")
        session.add(
            PathSummary(
                model_run_id=model_run_id,
                path_hash=path_hash,
                path_text=path_text,
                path_length=int(_row_value(row, "path_length", 0)),
                count=int(count),
                conversion_count=int(_row_value(row, "conversions", 0)),
                nonconversion_count=_row_value(row, "nonconversion_count"),
                conversion_rate=float(_row_value(row, "conversion_rate", 0.0)),
                revenue=revenue,
                avg_ticket=float(_row_value(row, "avg_revenue", 0.0)),
                path_probability=float(path_prob) if path_prob is not None else None,
                contains_loop=bool(_row_value(row, "contains_loop", False)),
                confidence_score=_row_value(row, "confidence_score"),
            )
        )


def _save_data_quality(
    session: Session,
    model_run_id: int,
    checks: pd.DataFrame,
) -> None:
    for row in _df_records(checks):
        session.add(
            DataQualityCheck(
                model_run_id=model_run_id,
                check_name=str(_row_value(row, "check_name")),
                status=str(_row_value(row, "status")),
                severity=str(_row_value(row, "severity")),
                detail=_row_value(row, "detail"),
                score=_row_value(row, "score"),
                affected_rows=_row_value(row, "affected_rows"),
                recommendation=_row_value(row, "recommendation"),
            )
        )


def _save_loop_diagnostics(
    session: Session,
    model_run_id: int,
    df: pd.DataFrame,
) -> None:
    for row in _df_records(df):
        session.add(
            LoopDiagnostic(
                model_run_id=model_run_id,
                channel=str(_row_value(row, "channel")),
                self_loop_count=_row_value(row, "self_loop_count"),
                self_loop_rate=_row_value(row, "self_loop_rate"),
                avg_consecutive_repeats=_row_value(row, "avg_consecutive_repeats"),
                median_consecutive_repeats=_row_value(row, "median_consecutive_repeats"),
                max_consecutive_repeats=_row_value(row, "max_consecutive_repeats"),
                loop_conversion_rate=_row_value(row, "loop_conversion_rate"),
                nonloop_conversion_rate=_row_value(row, "nonloop_conversion_rate"),
                loop_conversion_lift=_row_value(row, "loop_conversion_lift"),
                exit_distribution_json=_row_value(row, "exit_distribution_json"),
                support=_row_value(row, "support"),
                confidence=_row_value(row, "confidence"),
            )
        )


def _save_funnel_state_attribution(
    session: Session,
    model_run_id: int,
    df: pd.DataFrame,
) -> None:
    for row in _df_records(df):
        session.add(
            FunnelStateAttribution(
                model_run_id=model_run_id,
                state=str(_row_value(row, "state")),
                channel=str(_row_value(row, "channel")),
                funnel_stage=str(_row_value(row, "funnel_stage")),
                markov_weight=_row_value(row, "markov_weight"),
                markov_revenue=_row_value(row, "markov_revenue"),
                removal_effect=_row_value(row, "removal_effect"),
                shapley_weight=_row_value(row, "shapley_weight"),
                shapley_revenue=_row_value(row, "shapley_revenue"),
                presence_converting=_row_value(row, "presence_converting"),
                presence_nonconverting=_row_value(row, "presence_nonconverting"),
                support=_row_value(row, "support"),
                confidence=_row_value(row, "confidence"),
            )
        )


def _save_sequential_effects(
    session: Session,
    model_run_id: int,
    df: pd.DataFrame,
) -> None:
    for row in _df_records(df):
        session.add(
            SequentialEffect(
                model_run_id=model_run_id,
                previous_channel=str(_row_value(row, "previous_channel")),
                current_channel=str(_row_value(row, "current_channel")),
                pair_count=_row_value(row, "pair_count"),
                conversion_count=_row_value(row, "conversion_count"),
                nonconversion_count=_row_value(row, "nonconversion_count"),
                conversion_probability_pair=_row_value(row, "conversion_probability_pair"),
                conversion_probability_baseline=_row_value(row, "conversion_probability_baseline"),
                lift_vs_baseline=_row_value(row, "lift_vs_baseline"),
                avg_ticket=_row_value(row, "avg_ticket"),
                revenue=_row_value(row, "revenue"),
                support=_row_value(row, "support"),
                confidence=_row_value(row, "confidence"),
                diagnostic_label=_row_value(row, "diagnostic_label"),
            )
        )


def _save_session_quality(
    session: Session,
    model_run_id: int,
    df: pd.DataFrame,
) -> None:
    for row in _df_records(df):
        session.add(
            SessionQuality(
                model_run_id=model_run_id,
                channel=str(_row_value(row, "channel")),
                sessions=_row_value(row, "sessions"),
                avg_duration_s=_row_value(row, "avg_duration_s"),
                avg_pageviews=_row_value(row, "avg_pageviews"),
                avg_bounce_rate=_row_value(row, "avg_bounce_rate"),
                avg_events=_row_value(row, "avg_events"),
                conv_sessions=_row_value(row, "conv_sessions"),
                conv_avg_duration_s=_row_value(row, "conv_avg_duration_s"),
                conv_avg_bounce_rate=_row_value(row, "conv_avg_bounce_rate"),
                nonconv_avg_duration_s=_row_value(row, "nonconv_avg_duration_s"),
                nonconv_avg_bounce_rate=_row_value(row, "nonconv_avg_bounce_rate"),
            )
        )


def save_model_run_summary(session: Session, model_run_id: int, summary: dict[str, Any]) -> None:
    existing = session.get(ModelRunSummary, model_run_id)
    if existing is not None:
        session.delete(existing)
        session.flush()
    session.add(
        ModelRunSummary(
            model_run_id=model_run_id,
            observed_conversion_rate=_clean_value(summary.get("observed_conversion_rate")),
            model_conversion_rate=float(summary.get("model_conversion_rate", 0.0) or 0.0),
            total_revenue=float(summary.get("total_revenue", 0.0) or 0.0),
            total_spend=float(summary.get("total_spend", 0.0) or 0.0),
            total_conversions=int(summary.get("total_conversions", 0) or 0),
            total_nonconversions_sampled=int(summary.get("total_nonconversions_sampled", 0) or 0),
            non_conv_scale=_clean_value(summary.get("non_conv_scale")),
            state_count=int(summary.get("state_count", 0) or 0),
            channel_count=int(summary.get("channel_count", 0) or 0),
            path_count=int(summary.get("path_count", 0) or 0),
            transition_count=int(summary.get("transition_count", 0) or 0),
            confidence_score=float(summary.get("confidence_score", 0.0) or 0.0),
            confidence_label=str(summary.get("confidence_label", "Baixa")),
        )
    )


def save_channel_recommendations(
    session: Session,
    model_run_id: int,
    recs: list[dict[str, Any]],
) -> None:
    rows = session.execute(
        select(ChannelRecommendation).where(ChannelRecommendation.model_run_id == model_run_id)
    ).scalars()
    for row in rows:
        session.delete(row)
    session.flush()

    for rec in recs:
        session.add(
            ChannelRecommendation(
                model_run_id=model_run_id,
                channel=str(rec.get("channel")),
                recommendation=str(rec.get("recommendation")),
                recommendation_tone=str(rec.get("recommendation_tone")),
                priority_rank=int(rec.get("priority_rank", 0) or 0),
                rationale_json=json.dumps(rec.get("rationale", []), ensure_ascii=False),
                risks_json=json.dumps(rec.get("risks", []), ensure_ascii=False),
                best_practices_json=json.dumps(rec.get("best_practices", []), ensure_ascii=False),
                suggested_budget_delta_pct=_clean_value(rec.get("suggested_budget_delta_pct")),
                suggested_budget_delta_value=_clean_value(rec.get("suggested_budget_delta_value")),
                estimated_revenue_delta=_clean_value(rec.get("estimated_revenue_delta")),
                estimated_roas_min=_clean_value(rec.get("estimated_roas_min")),
                estimated_roas_max=_clean_value(rec.get("estimated_roas_max")),
                saturation_score=_clean_value(rec.get("saturation_score")),
                confidence_score=float(rec.get("confidence_score", 0.0) or 0.0),
            )
        )


def register_export(
    model_run_id: int,
    export_type: str,
    file_path: str,
    session: Optional[Session] = None,
    database_url: str | None = None,
) -> int:
    if session is None:
        with session_scope(database_url=database_url) as scoped_session:
            return register_export(model_run_id, export_type, file_path, scoped_session)

    record = ExportRecord(
        model_run_id=model_run_id,
        export_type=export_type,
        file_path=file_path,
    )
    session.add(record)
    session.flush()
    return record.id


def _update_model_run_status(
    model_run_id: int,
    status: str,
    error_message: str | None,
    session: Optional[Session] = None,
    database_url: str | None = None,
) -> None:
    if session is None:
        with session_scope(database_url=database_url) as scoped_session:
            _update_model_run_status(
                model_run_id,
                status,
                error_message,
                session=scoped_session,
            )
            return

    run = session.get(ModelRun, model_run_id)
    if run is None:
        raise ValueError(f"Model run not found: {model_run_id}")
    run.status = status
    run.error_message = error_message


def _clear_model_run_children(session: Session, model_run_id: int) -> None:
    for model in [
        TransitionCount,
        TransitionMatrixEntry,
        AttributionResult,
        ChannelDiagnostic,
        PathSummary,
        DataQualityCheck,
        ModelRunSummary,
        ChannelRecommendation,
        ModelRunInput,
        ModelRunLog,
        ExportRecord,
        LoopDiagnostic,
        FunnelStateAttribution,
        SequentialEffect,
        SessionQuality,
    ]:
        rows = session.execute(
            select(model).where(model.model_run_id == model_run_id)
        ).scalars()
        for row in rows:
            session.delete(row)
    session.flush()


def _model_run_to_dict(run: ModelRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "start_date": run.start_date,
        "end_date": run.end_date,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "status": run.status,
        "parameters": json.loads(run.parameters_json),
        "observed_conversion_rate": run.observed_conversion_rate,
        "model_conversion_rate": run.model_conversion_rate,
        "total_revenue": run.total_revenue,
        "total_spend": run.total_spend,
        "runtime_seconds": run.runtime_seconds,
        "error_message": run.error_message,
        "funnel_model_active": bool(run.funnel_model_active) if run.funnel_model_active is not None else False,
    }


def _model_to_public_dict(row: Any) -> dict[str, Any]:
    data = {}
    for column in row.__table__.columns:
        value = getattr(row, column.name)
        if hasattr(value, "isoformat"):
            value = value.isoformat()
        data[column.name] = value
    return data
