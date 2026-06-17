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
    if engine.dialect.name != "sqlite":
        return
    _add_column_if_missing(engine, "attribution_results", "pfc_weight", "FLOAT")
    _add_column_if_missing(engine, "attribution_results", "pfc_delta_pp", "FLOAT")
    _add_column_if_missing(engine, "data_quality_checks", "score", "FLOAT")
    _add_column_if_missing(engine, "data_quality_checks", "affected_rows", "INTEGER")
    _add_column_if_missing(engine, "data_quality_checks", "recommendation", "TEXT")
    _add_column_if_missing(engine, "scenarios", "action_type", "TEXT DEFAULT 'path'")
    _add_column_if_missing(engine, "scenarios", "channel", "TEXT")
    _add_column_if_missing(engine, "scenarios", "intensity_pct", "FLOAT")
    _add_column_if_missing(engine, "scenarios", "period_start", "DATE")
    _add_column_if_missing(engine, "scenarios", "period_end", "DATE")
    _backfill_scenario_graph(engine)
    _drop_column_if_present(engine, "scenarios", "nodes_json")
    _drop_column_if_present(engine, "scenarios", "edges_json")
    _drop_column_if_present(engine, "scenarios", "path_channels_json")


def _add_column_if_missing(engine, table: str, column: str, col_type: str) -> None:
    with engine.connect() as conn:
        result = conn.execute(
            __import__("sqlalchemy").text(f"PRAGMA table_info({table})")
        )
        existing = {row[1] for row in result}
        if not existing:
            return
        if column not in existing:
            conn.execute(
                __import__("sqlalchemy").text(
                    f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
                )
            )
            conn.commit()


def _drop_column_if_present(engine, table: str, column: str) -> None:
    from sqlalchemy import text

    with engine.connect() as conn:
        existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
        if column not in existing:
            return
        conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))
        conn.commit()


def _backfill_scenario_graph(engine) -> None:
    """Move old inline graph JSON columns into scenario_graph when present."""
    from sqlalchemy import text

    with engine.connect() as conn:
        scenario_cols = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(scenarios)"))
        }
        graph_cols = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(scenario_graph)"))
        }
        required_old = {"id", "nodes_json", "edges_json", "path_channels_json"}
        required_graph = {"scenario_id", "nodes_json", "edges_json", "path_channels_json"}
        if not required_old.issubset(scenario_cols) or not required_graph.issubset(graph_cols):
            return

        conn.execute(
            text(
                """
                INSERT INTO scenario_graph (
                    scenario_id, nodes_json, edges_json, path_channels_json
                )
                SELECT s.id, s.nodes_json, s.edges_json, s.path_channels_json
                FROM scenarios s
                LEFT JOIN scenario_graph g ON g.scenario_id = s.id
                WHERE g.scenario_id IS NULL
                """
            )
        )
        conn.commit()
