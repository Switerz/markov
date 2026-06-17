from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def _alembic_config(database_url: str) -> Config:
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def _seed_legacy_db(database_url: str) -> None:
    engine = create_engine(database_url)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE model_runs (
                    id INTEGER PRIMARY KEY,
                    start_date VARCHAR(10) NOT NULL,
                    end_date VARCHAR(10) NOT NULL,
                    created_at DATETIME NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    parameters_json TEXT NOT NULL,
                    observed_conversion_rate FLOAT,
                    model_conversion_rate FLOAT NOT NULL,
                    total_revenue FLOAT NOT NULL,
                    total_spend FLOAT NOT NULL,
                    runtime_seconds FLOAT NOT NULL,
                    error_message TEXT,
                    funnel_model_active INTEGER NOT NULL
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO model_runs (
                    id, start_date, end_date, created_at, status, parameters_json,
                    observed_conversion_rate, model_conversion_rate, total_revenue,
                    total_spend, runtime_seconds, error_message, funnel_model_active
                )
                VALUES (
                    1, '2026-03-01', '2026-03-31', '2026-06-17 00:00:00',
                    'completed', '{}', 0.1, 0.1, 300.0, 150.0, 1.0, NULL, 0
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE attribution_results (
                    id INTEGER PRIMARY KEY,
                    model_run_id INTEGER NOT NULL,
                    model_type VARCHAR(16) NOT NULL,
                    channel VARCHAR(255) NOT NULL,
                    markov_weight FLOAT,
                    markov_revenue FLOAT,
                    removal_effect FLOAT,
                    shapley_weight FLOAT,
                    shapley_revenue FLOAT,
                    shapley_value FLOAT,
                    spend FLOAT,
                    roas_markov FLOAT,
                    roas_shapley FLOAT,
                    pfc_weight FLOAT,
                    pfc_delta_pp FLOAT,
                    recommendation VARCHAR(255),
                    confidence_score FLOAT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO attribution_results (
                    model_run_id, model_type, channel, markov_weight, markov_revenue,
                    removal_effect, shapley_weight, shapley_revenue, shapley_value,
                    spend, roas_markov, roas_shapley, pfc_weight, pfc_delta_pp,
                    recommendation, confidence_score
                )
                VALUES
                    (1, 'raw', 'Google Ads', 0.2, 200.0, 0.4, 0.1, 100.0, 0.1, 100.0, 2.0, 1.0, 0.15, 2.0, 'Escalar', 0.9),
                    (1, 'raw', 'Email', 0.1, 100.0, 0.2, 0.1, 50.0, 0.1, 50.0, 2.0, 1.0, 0.05, 1.0, 'Defender', 0.8)
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE channel_diagnostics (
                    id INTEGER PRIMARY KEY,
                    model_run_id INTEGER NOT NULL,
                    channel VARCHAR(255) NOT NULL,
                    channel_role VARCHAR(255),
                    touchpoint_role VARCHAR(255),
                    presence_converting FLOAT,
                    presence_nonconverting FLOAT,
                    first_touch_share FLOAT,
                    middle_touch_share FLOAT,
                    last_touch_share FLOAT,
                    assist_count FLOAT,
                    closer_count FLOAT,
                    starter_count FLOAT,
                    markov_shapley_delta_pp FLOAT,
                    diagnostic_label VARCHAR(255),
                    diagnostic_text TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO channel_diagnostics (
                    model_run_id, channel, channel_role, touchpoint_role,
                    presence_converting, presence_nonconverting, first_touch_share,
                    middle_touch_share, last_touch_share, assist_count, closer_count,
                    starter_count, markov_shapley_delta_pp, diagnostic_label,
                    diagnostic_text
                )
                VALUES (
                    1, 'Google Ads', 'Closer', 'Starter', 0.7, 0.2, 0.5,
                    0.2, 0.3, 4.0, 3.0, 5.0, 10.0, 'ok', 'diagnostic copy'
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE transition_counts (
                    id INTEGER PRIMARY KEY,
                    model_run_id INTEGER NOT NULL,
                    from_state VARCHAR(255) NOT NULL,
                    to_state VARCHAR(255) NOT NULL,
                    n FLOAT NOT NULL,
                    total_revenue FLOAT,
                    transition_type VARCHAR(32) NOT NULL
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO transition_counts (
                    model_run_id, from_state, to_state, n, total_revenue, transition_type
                )
                VALUES
                    (1, '(start)', 'Google Ads', 10.0, 100.0, 'converting'),
                    (1, 'Google Ads', 'Conversion', 8.0, 80.0, 'converting'),
                    (1, '(start)', 'Email', 5.0, 50.0, 'nonconverting')
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE transition_matrix (
                    id INTEGER PRIMARY KEY,
                    model_run_id INTEGER NOT NULL,
                    from_state VARCHAR(255) NOT NULL,
                    to_state VARCHAR(255) NOT NULL,
                    probability FLOAT NOT NULL
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO transition_matrix (
                    model_run_id, from_state, to_state, probability
                )
                VALUES (1, 'Google Ads', 'Conversion', 0.8)
                """
            )
        )


def test_baseline_upgrade_backfills_and_drops_legacy_tables(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'legacy.db'}"
    _seed_legacy_db(database_url)

    command.upgrade(_alembic_config(database_url), "head")

    engine = create_engine(database_url)
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        assert {"channel_metrics", "transition_edges"}.issubset(tables)
        assert not {"attribution_results", "channel_diagnostics", "transition_counts", "transition_matrix"} & tables

        google = conn.execute(
            text(
                """
                SELECT spend_share, markov_revenue_share, shapley_revenue_share,
                       first_click_revenue, first_click_roas, last_click_revenue,
                       last_click_roas, consensus_score, diagnostic_text
                FROM channel_metrics
                WHERE model_run_id = 1 AND model_type = 'raw' AND channel = 'Google Ads'
                """
            )
        ).mappings().one()
        assert round(google["spend_share"], 4) == 0.6667
        assert round(google["markov_revenue_share"], 4) == 0.6667
        assert round(google["shapley_revenue_share"], 4) == 0.6667
        assert google["first_click_revenue"] == 100.0
        assert google["first_click_roas"] == 1.0
        assert google["last_click_revenue"] == 80.0
        assert google["last_click_roas"] == 0.8
        assert round(google["consensus_score"], 4) == 0.5
        assert google["diagnostic_text"] == "diagnostic copy"
        email_diagnostic = conn.execute(
            text(
                """
                SELECT diagnostic_text
                FROM channel_metrics
                WHERE model_run_id = 1 AND model_type = 'raw' AND channel = 'Email'
                """
            )
        ).scalar_one()
        assert email_diagnostic is None

        edge_count = conn.execute(text("SELECT count(*) FROM transition_edges")).scalar_one()
        assert edge_count == 4


def test_baseline_downgrade_recreates_legacy_tables_from_consolidated(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'legacy_downgrade.db'}"
    _seed_legacy_db(database_url)
    config = _alembic_config(database_url)

    command.upgrade(config, "head")
    command.downgrade(config, "base")

    engine = create_engine(database_url)
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        assert {"attribution_results", "channel_diagnostics", "transition_counts", "transition_matrix"}.issubset(tables)
        assert not {"channel_metrics", "transition_edges"} & tables
        assert conn.execute(text("SELECT count(*) FROM attribution_results")).scalar_one() == 2
        assert conn.execute(text("SELECT count(*) FROM channel_diagnostics")).scalar_one() == 1
        assert conn.execute(text("SELECT count(*) FROM transition_counts")).scalar_one() == 3
        assert conn.execute(text("SELECT count(*) FROM transition_matrix")).scalar_one() == 1
