"""Structured model-run logging helpers."""

from __future__ import annotations

import functools
import time
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

from sqlalchemy.orm import Session

from gograph.backend.app.db.models import ModelRunLog
from gograph.backend.app.db.session import get_session_factory

F = TypeVar("F", bound=Callable[..., Any])


def insert_log(
    session: Session,
    model_run_id: int,
    step: str,
    status: str,
    message: str | None = None,
    duration_seconds: float | None = None,
    *,
    commit: bool = False,
) -> None:
    session.add(
        ModelRunLog(
            model_run_id=model_run_id,
            step=step,
            status=status,
            message=message,
            duration_seconds=duration_seconds,
            created_at=datetime.now(timezone.utc),
        )
    )
    if commit:
        session.commit()
    else:
        session.flush()


def insert_log_with_database_url(
    database_url: str,
    model_run_id: int,
    step: str,
    status: str,
    message: str | None = None,
    duration_seconds: float | None = None,
) -> None:
    factory = get_session_factory(database_url)
    session = factory()
    try:
        insert_log(
            session,
            model_run_id,
            step,
            status,
            message=message,
            duration_seconds=duration_seconds,
            commit=True,
        )
    finally:
        session.close()


def logged_step(step_name: str) -> Callable[[F], F]:
    def deco(fn: F) -> F:
        @functools.wraps(fn)
        def wrapper(session: Session, model_run_id: int, *args: Any, **kwargs: Any) -> Any:
            start = time.time()
            insert_log(session, model_run_id, step_name, "started", commit=True)
            try:
                result = fn(session, model_run_id, *args, **kwargs)
                insert_log(
                    session,
                    model_run_id,
                    step_name,
                    "success",
                    duration_seconds=time.time() - start,
                    commit=True,
                )
                return result
            except Exception as exc:
                insert_log(
                    session,
                    model_run_id,
                    step_name,
                    "failed",
                    message=str(exc),
                    duration_seconds=time.time() - start,
                    commit=True,
                )
                raise

        return wrapper  # type: ignore[return-value]

    return deco


def run_logged_step(
    *,
    database_url: str | None,
    model_run_id: int | None,
    step: str,
    fn: Callable[[], Any],
) -> Any:
    if database_url is None or model_run_id is None:
        return fn()

    start = time.time()
    insert_log_with_database_url(database_url, model_run_id, step, "started")
    try:
        result = fn()
        insert_log_with_database_url(
            database_url,
            model_run_id,
            step,
            "success",
            duration_seconds=time.time() - start,
        )
        return result
    except Exception as exc:
        insert_log_with_database_url(
            database_url,
            model_run_id,
            step,
            "failed",
            message=str(exc),
            duration_seconds=time.time() - start,
        )
        raise
