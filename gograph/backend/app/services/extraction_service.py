"""Extraction service wrappers around the current Metabase extraction module."""

import calendar
from datetime import date, timedelta

import pandas as pd
from sqlalchemy.orm import Session

from extract import (
    get_censored_count,
    get_channel_spend,
    get_conversion_rate,
    get_converting_transitions,
    get_nonconverting_transitions,
    get_total_revenue,
    get_raw_paths,
)
from gograph.backend.app.schemas import ModelRunParams
from gograph.backend.app.services.lineage_service import record_input_if_possible


def extract_transition_counts(
    params: ModelRunParams,
    *,
    model_run_id: int | None = None,
    session: Session | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if should_batch_transition_extraction(params):
        return extract_transition_counts_batched(
            params,
            model_run_id=model_run_id,
            session=session,
        )

    converting = get_converting_transitions(
        database_id=params.db_plausible,
        start_date=params.start_date,
        end_date=params.end_date,
        lookback=params.lookback_days,
        decay_lambda=params.decay_lambda,
    )
    record_input_if_possible(
        session,
        model_run_id=model_run_id,
        source="plausible",
        database_id=params.db_plausible,
        query_name="converting_transitions",
        df=converting,
        date_range=(params.start_date, params.end_date),
        sort_by=["from_ch", "to_ch"],
    )
    nonconverting = get_nonconverting_transitions(
        database_id=params.db_plausible,
        start_date=params.start_date,
        end_date=params.end_date,
        sample_pct=params.non_conv_sample_pct,
        censorship_days=params.censorship_days,
    )
    record_input_if_possible(
        session,
        model_run_id=model_run_id,
        source="plausible",
        database_id=params.db_plausible,
        query_name="nonconverting_transitions",
        df=nonconverting,
        date_range=(params.start_date, params.end_date),
        sort_by=["from_ch", "to_ch"],
    )
    return converting, nonconverting

def extract_raw_paths(
    params: ModelRunParams,
    *,
    model_run_id: int | None = None,
    session: Session | None = None,
) -> pd.DataFrame:
    """Extracts full path sequences for Sprint 7 analysis."""
    df = get_raw_paths(
        database_id=params.db_plausible,
        start_date=params.start_date,
        end_date=params.end_date,
        lookback=params.lookback_days
    )
    record_input_if_possible(
        session,
        model_run_id=model_run_id,
        source="plausible",
        database_id=params.db_plausible,
        query_name="raw_paths",
        df=df,
        date_range=(params.start_date, params.end_date),
        sort_by=["path_sequence"],
    )
    return df

def should_batch_transition_extraction(params: ModelRunParams) -> bool:
    if params.batch_mode == "never":
        return False
    if params.batch_mode == "always":
        return True
    if params.batch_mode != "auto":
        raise ValueError("batch_mode must be one of: auto, always, never.")
    start = date.fromisoformat(params.start_date)
    end = date.fromisoformat(params.end_date)
    return (end - start).days + 1 > params.batch_days


def extract_transition_counts_batched(
    params: ModelRunParams,
    *,
    model_run_id: int | None = None,
    session: Session | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    converting_batches = []
    nonconverting_batches = []

    for month_start, month_end in months_in_range(params.start_date, params.end_date):
        month_params = ModelRunParams(
            **{
                **params.to_dict(),
                "start_date": month_start,
                "end_date": month_end,
                "batch_mode": "never",
            }
        )
        converting, nonconverting = extract_transition_counts(
            month_params,
            model_run_id=model_run_id,
            session=session,
        )
        converting_batches.append(converting)
        nonconverting_batches.append(nonconverting)

    converting_all = _aggregate_converting(converting_batches)
    nonconverting_all = _aggregate_nonconverting(nonconverting_batches)
    return converting_all, nonconverting_all


def months_in_range(start_date: str, end_date: str) -> list[tuple[str, str]]:
    cursor = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    months = []
    while cursor <= end:
        last_day = calendar.monthrange(cursor.year, cursor.month)[1]
        month_end = min(date(cursor.year, cursor.month, last_day), end)
        months.append((str(cursor), str(month_end)))
        cursor = month_end + timedelta(days=1)
    return months


def _aggregate_converting(frames: list[pd.DataFrame]) -> pd.DataFrame:
    if not frames:
        return pd.DataFrame(columns=["from_ch", "to_ch", "n", "total_revenue"])
    return (
        pd.concat(frames, ignore_index=True)
        .groupby(["from_ch", "to_ch"], as_index=False)
        .agg(n=("n", "sum"), total_revenue=("total_revenue", "sum"))
    )


def _aggregate_nonconverting(frames: list[pd.DataFrame]) -> pd.DataFrame:
    if not frames:
        return pd.DataFrame(columns=["from_ch", "to_ch", "n"])
    return (
        pd.concat(frames, ignore_index=True)
        .groupby(["from_ch", "to_ch"], as_index=False)
        .agg(n=("n", "sum"))
    )


def extract_observed_conversion_rate(
    params: ModelRunParams,
    *,
    model_run_id: int | None = None,
    session: Session | None = None,
) -> float:
    value = get_conversion_rate(
        database_id=params.db_plausible,
        start_date=params.start_date,
        end_date=params.end_date,
        sample_pct=params.non_conv_sample_pct,
        censorship_days=params.censorship_days,
    )
    record_input_if_possible(
        session,
        model_run_id=model_run_id,
        source="plausible",
        database_id=params.db_plausible,
        query_name="observed_conversion_rate",
        df=pd.DataFrame([{"observed_conversion_rate": value}]),
        date_range=(params.start_date, params.end_date),
    )
    return value


def extract_censored_count(params: ModelRunParams) -> tuple[int, int]:
    """
    Returns (censored_sample_count, total_sample_count) for the non-converting
    sampled journeys. Both values are 0 when censorship_days == 0.
    """
    return get_censored_count(
        database_id=params.db_plausible,
        start_date=params.start_date,
        end_date=params.end_date,
        sample_pct=params.non_conv_sample_pct,
        censorship_days=params.censorship_days,
    )


def extract_total_revenue(
    params: ModelRunParams,
    *,
    model_run_id: int | None = None,
    session: Session | None = None,
) -> float:
    value = get_total_revenue(
        database_id=params.db_plausible,
        start_date=params.start_date,
        end_date=params.end_date,
    )
    record_input_if_possible(
        session,
        model_run_id=model_run_id,
        source="plausible",
        database_id=params.db_plausible,
        query_name="total_revenue",
        df=pd.DataFrame([{"total_revenue": value}]),
        date_range=(params.start_date, params.end_date),
    )
    return value


def extract_spend(
    params: ModelRunParams,
    *,
    model_run_id: int | None = None,
    session: Session | None = None,
) -> pd.DataFrame:
    if params.db_datamart is None:
        return pd.DataFrame(columns=["channel", "spend"])
    df = get_channel_spend(
        db_datamart=params.db_datamart,
        start_date=params.start_date,
        end_date=params.end_date,
    )
    record_input_if_possible(
        session,
        model_run_id=model_run_id,
        source="datamart",
        database_id=params.db_datamart,
        query_name="channel_spend",
        df=df,
        date_range=(params.start_date, params.end_date),
        sort_by=["channel"],
    )
    return df
