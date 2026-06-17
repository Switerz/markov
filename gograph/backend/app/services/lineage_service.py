"""Lineage helpers for model-run input reproducibility."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from gograph.backend.app.db.models import ModelRunInput


def canonical_hash(df: pd.DataFrame, sort_by: list[str] | None = None) -> str:
    """
    SHA-256 of a canonical DataFrame representation.

    Canonical order: sort by `sort_by` when present, otherwise all columns.
    Missing sort columns are ignored. Values are normalized through pandas CSV
    serialization after index reset, so row order and input index do not affect
    the hash.
    """
    if df.empty:
        payload = df.head(0).to_csv(index=False).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()
    sort_cols = sort_by or list(df.columns)
    sort_cols = [col for col in sort_cols if col in df.columns]
    canon = df.copy()
    if sort_cols:
        canon = canon.sort_values(sort_cols)
    canon = canon.reset_index(drop=True)
    payload = canon.to_csv(index=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def record_input(
    session: Session,
    *,
    model_run_id: int,
    source: str,
    database_id: int | None,
    query_name: str,
    df: pd.DataFrame,
    date_range: tuple[str | None, str | None] = (None, None),
    sort_by: list[str] | None = None,
) -> ModelRunInput:
    row = ModelRunInput(
        model_run_id=model_run_id,
        source=source,
        database_id=database_id,
        query_name=query_name,
        row_count=int(len(df)),
        date_min=date_range[0],
        date_max=date_range[1],
        data_hash=canonical_hash(df, sort_by=sort_by),
        extracted_at=datetime.now(timezone.utc),
    )
    session.add(row)
    session.flush()
    return row


def record_input_if_possible(
    session: Session | None,
    *,
    model_run_id: int | None,
    source: str,
    database_id: int | None,
    query_name: str,
    df: pd.DataFrame,
    date_range: tuple[str | None, str | None],
    sort_by: list[str] | None = None,
) -> None:
    if session is None or model_run_id is None:
        return
    record_input(
        session,
        model_run_id=model_run_id,
        source=source,
        database_id=database_id,
        query_name=query_name,
        df=df,
        date_range=date_range,
        sort_by=sort_by,
    )
