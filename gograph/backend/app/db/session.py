"""Database engine/session helpers for GoGraph."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

import config
from gograph.backend.app.db.base import Base


def get_engine(database_url: str | None = None):
    url = database_url or config.DATABASE_URL
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    poolclass = NullPool if url.startswith("sqlite") else None
    return create_engine(
        url,
        connect_args=connect_args,
        future=True,
        poolclass=poolclass,
    )


def get_session_factory(database_url: str | None = None):
    engine = get_engine(database_url)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def create_db_and_tables(database_url: str | None = None) -> None:
    from gograph.backend.app.db import models  # noqa: F401

    engine = get_engine(database_url)
    Base.metadata.create_all(engine)
    _apply_migrations(engine)


def _apply_migrations(engine) -> None:
    """Idempotent column additions for schema evolution without Alembic."""
    _add_column_if_missing(engine, "attribution_results", "pfc_weight", "FLOAT")
    _add_column_if_missing(engine, "attribution_results", "pfc_delta_pp", "FLOAT")


def _add_column_if_missing(engine, table: str, column: str, col_type: str) -> None:
    with engine.connect() as conn:
        result = conn.execute(
            __import__("sqlalchemy").text(f"PRAGMA table_info({table})")
        )
        existing = {row[1] for row in result}
        if column not in existing:
            conn.execute(
                __import__("sqlalchemy").text(
                    f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
                )
            )
            conn.commit()
