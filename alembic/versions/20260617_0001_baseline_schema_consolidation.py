"""baseline schema consolidation

Revision ID: 20260617_0001
Revises:
Create Date: 2026-06-17
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

# Converts absolute Markov/Shapley weight delta into a 0-1 agreement score.
CONSENSUS_DELTA_MULTIPLIER = 5.0

revision: str = "20260617_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    _create_current_schema()
    bind = op.get_bind()
    _backfill_transition_edges(bind)
    _backfill_channel_metrics(bind)
    _drop_legacy_tables(bind)


def downgrade() -> None:
    bind = op.get_bind()
    _create_legacy_tables()
    _backfill_legacy_channel_tables(bind)
    _backfill_legacy_transition_tables(bind)
    _drop_consolidated_tables(bind)


def _create_current_schema() -> None:
    _create_model_runs()
    _create_model_run_summary()
    _create_channel_recommendations()
    _create_model_run_inputs()
    _create_model_run_logs()
    _create_transition_edges()
    _create_channel_metrics()
    _create_path_summary()
    _create_data_quality_checks()
    _create_exports()
    _create_scenarios()
    _create_scenario_graph()
    _create_scenario_analysis()
    _create_loop_diagnostics()
    _create_funnel_state_attribution()
    _create_sequential_effects()
    _create_session_quality()


def _create_model_runs() -> None:
    _create_table(
        "model_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("start_date", sa.String(length=10), nullable=False),
        sa.Column("end_date", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("parameters_json", sa.Text(), nullable=False),
        sa.Column("observed_conversion_rate", sa.Float(), nullable=True),
        sa.Column("model_conversion_rate", sa.Float(), nullable=False),
        sa.Column("total_revenue", sa.Float(), nullable=False),
        sa.Column("total_spend", sa.Float(), nullable=False),
        sa.Column("runtime_seconds", sa.Float(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("funnel_model_active", sa.Integer(), nullable=False),
    )
    _create_index("ix_model_runs_start_date", "model_runs", ["start_date"])
    _create_index("ix_model_runs_end_date", "model_runs", ["end_date"])
    _create_index("ix_model_runs_status", "model_runs", ["status"])


def _create_model_run_summary() -> None:
    _create_table(
        "model_run_summary",
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("observed_conversion_rate", sa.Float(), nullable=True),
        sa.Column("model_conversion_rate", sa.Float(), nullable=False),
        sa.Column("total_revenue", sa.Float(), nullable=False),
        sa.Column("total_spend", sa.Float(), nullable=False),
        sa.Column("total_conversions", sa.Integer(), nullable=False),
        sa.Column("total_nonconversions_sampled", sa.Integer(), nullable=False),
        sa.Column("non_conv_scale", sa.Float(), nullable=True),
        sa.Column("state_count", sa.Integer(), nullable=False),
        sa.Column("channel_count", sa.Integer(), nullable=False),
        sa.Column("path_count", sa.Integer(), nullable=False),
        sa.Column("transition_count", sa.Integer(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("confidence_label", sa.String(length=32), nullable=False),
    )


def _create_channel_recommendations() -> None:
    _create_table(
        "channel_recommendations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(length=255), nullable=False),
        sa.Column("recommendation", sa.String(length=32), nullable=False),
        sa.Column("recommendation_tone", sa.String(length=32), nullable=False),
        sa.Column("priority_rank", sa.Integer(), nullable=False),
        sa.Column("rationale_json", sa.Text(), nullable=False),
        sa.Column("risks_json", sa.Text(), nullable=False),
        sa.Column("best_practices_json", sa.Text(), nullable=False),
        sa.Column("suggested_budget_delta_pct", sa.Float(), nullable=True),
        sa.Column("suggested_budget_delta_value", sa.Float(), nullable=True),
        sa.Column("estimated_revenue_delta", sa.Float(), nullable=True),
        sa.Column("estimated_roas_min", sa.Float(), nullable=True),
        sa.Column("estimated_roas_max", sa.Float(), nullable=True),
        sa.Column("saturation_score", sa.Float(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.UniqueConstraint("model_run_id", "channel"),
    )
    _create_index("ix_channel_recommendations_model_run_id", "channel_recommendations", ["model_run_id"])
    _create_index("ix_channel_recommendations_channel", "channel_recommendations", ["channel"])


def _create_model_run_inputs() -> None:
    _create_table(
        "model_run_inputs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("database_id", sa.Integer(), nullable=True),
        sa.Column("query_name", sa.String(length=255), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("date_min", sa.String(length=10), nullable=True),
        sa.Column("date_max", sa.String(length=10), nullable=True),
        sa.Column("data_hash", sa.String(length=64), nullable=False),
        sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=False),
    )
    _create_index("ix_model_run_inputs_model_run_id", "model_run_inputs", ["model_run_id"])
    _create_index("ix_model_run_inputs_source", "model_run_inputs", ["source"])
    _create_index("ix_model_run_inputs_query_name", "model_run_inputs", ["query_name"])
    _create_index("ix_model_run_inputs_run_query", "model_run_inputs", ["model_run_id", "query_name"])


def _create_model_run_logs() -> None:
    _create_table(
        "model_run_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    _create_index("ix_model_run_logs_model_run_id", "model_run_logs", ["model_run_id"])
    _create_index("ix_model_run_logs_step", "model_run_logs", ["step"])
    _create_index("ix_model_run_logs_status", "model_run_logs", ["status"])
    _create_index("ix_model_run_logs_run_created", "model_run_logs", ["model_run_id", "created_at"])


def _create_transition_edges() -> None:
    _create_table(
        "transition_edges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_state", sa.String(length=255), nullable=False),
        sa.Column("to_state", sa.String(length=255), nullable=False),
        sa.Column("transition_type", sa.String(length=32), nullable=False),
        sa.Column("count", sa.Float(), nullable=True),
        sa.Column("probability", sa.Float(), nullable=True),
        sa.Column("revenue", sa.Float(), nullable=True),
        sa.Column("avg_ticket", sa.Float(), nullable=True),
        sa.Column("is_self_loop", sa.Integer(), nullable=False, server_default="0"),
    )
    _create_index("ix_transition_edges_model_run_id", "transition_edges", ["model_run_id"])
    _create_index("ix_transition_edges_from_state", "transition_edges", ["from_state"])
    _create_index("ix_transition_edges_to_state", "transition_edges", ["to_state"])
    _create_index("ix_transition_edges_transition_type", "transition_edges", ["transition_type"])
    _create_index("ix_transition_edges_is_self_loop", "transition_edges", ["is_self_loop"])
    _create_index("ix_transition_edges_run_from", "transition_edges", ["model_run_id", "from_state"])
    _create_index("ix_transition_edges_run_to", "transition_edges", ["model_run_id", "to_state"])
    _create_index("ix_transition_edges_run_type", "transition_edges", ["model_run_id", "transition_type"])


def _create_channel_metrics() -> None:
    _create_table(
        "channel_metrics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_type", sa.String(length=16), nullable=False, server_default="raw"),
        sa.Column("channel", sa.String(length=255), nullable=False),
        sa.Column("spend", sa.Float(), nullable=True),
        sa.Column("spend_share", sa.Float(), nullable=True),
        sa.Column("markov_weight", sa.Float(), nullable=True),
        sa.Column("markov_revenue", sa.Float(), nullable=True),
        sa.Column("markov_revenue_share", sa.Float(), nullable=True),
        sa.Column("removal_effect", sa.Float(), nullable=True),
        sa.Column("shapley_weight", sa.Float(), nullable=True),
        sa.Column("shapley_revenue", sa.Float(), nullable=True),
        sa.Column("shapley_revenue_share", sa.Float(), nullable=True),
        sa.Column("shapley_value", sa.Float(), nullable=True),
        sa.Column("roas_markov", sa.Float(), nullable=True),
        sa.Column("roas_shapley", sa.Float(), nullable=True),
        sa.Column("first_click_revenue", sa.Float(), nullable=True),
        sa.Column("last_click_revenue", sa.Float(), nullable=True),
        sa.Column("first_click_roas", sa.Float(), nullable=True),
        sa.Column("last_click_roas", sa.Float(), nullable=True),
        sa.Column("pfc_weight", sa.Float(), nullable=True),
        sa.Column("pfc_delta_pp", sa.Float(), nullable=True),
        sa.Column("consensus_score", sa.Float(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("recommendation", sa.String(length=255), nullable=True),
        sa.Column("recommendation_tone", sa.String(length=32), nullable=True),
        sa.Column("channel_role", sa.String(length=255), nullable=True),
        sa.Column("touchpoint_role", sa.String(length=255), nullable=True),
        sa.Column("presence_converting", sa.Float(), nullable=True),
        sa.Column("presence_nonconverting", sa.Float(), nullable=True),
        sa.Column("first_touch_share", sa.Float(), nullable=True),
        sa.Column("middle_touch_share", sa.Float(), nullable=True),
        sa.Column("last_touch_share", sa.Float(), nullable=True),
        sa.Column("starter_count", sa.Float(), nullable=True),
        sa.Column("assist_count", sa.Float(), nullable=True),
        sa.Column("closer_count", sa.Float(), nullable=True),
        sa.Column("dropoff_after_touch", sa.Float(), nullable=True),
        sa.Column("markov_shapley_delta_pp", sa.Float(), nullable=True),
        sa.Column("diagnostic_label", sa.String(length=255), nullable=True),
        sa.Column("diagnostic_text", sa.Text(), nullable=True),
        sa.UniqueConstraint("model_run_id", "model_type", "channel"),
    )
    _create_index("ix_channel_metrics_model_run_id", "channel_metrics", ["model_run_id"])
    _create_index("ix_channel_metrics_model_type", "channel_metrics", ["model_type"])
    _create_index("ix_channel_metrics_channel", "channel_metrics", ["channel"])
    _create_index("ix_channel_metrics_run_channel", "channel_metrics", ["model_run_id", "channel"])


def _create_path_summary() -> None:
    _create_table(
        "path_summary",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("path_hash", sa.String(length=64), nullable=True),
        sa.Column("path_text", sa.Text(), nullable=False),
        sa.Column("path_length", sa.Integer(), nullable=True),
        sa.Column("count", sa.Float(), nullable=True),
        sa.Column("conversion_count", sa.Float(), nullable=True),
        sa.Column("nonconversion_count", sa.Float(), nullable=True),
        sa.Column("conversion_rate", sa.Float(), nullable=True),
        sa.Column("revenue", sa.Float(), nullable=True),
        sa.Column("avg_ticket", sa.Float(), nullable=True),
        sa.Column("path_probability", sa.Float(), nullable=True),
        sa.Column("contains_loop", sa.Integer(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
    )
    _create_index("ix_path_summary_model_run_id", "path_summary", ["model_run_id"])
    _create_index("ix_path_summary_path_hash", "path_summary", ["path_hash"])


def _create_data_quality_checks() -> None:
    _create_table(
        "data_quality_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("check_name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("affected_rows", sa.Integer(), nullable=True),
        sa.Column("recommendation", sa.Text(), nullable=True),
    )
    _create_index("ix_data_quality_checks_model_run_id", "data_quality_checks", ["model_run_id"])
    _create_index("ix_data_quality_checks_check_name", "data_quality_checks", ["check_name"])
    _create_index("ix_data_quality_checks_status", "data_quality_checks", ["status"])
    _create_index("ix_data_quality_checks_severity", "data_quality_checks", ["severity"])


def _create_exports() -> None:
    _create_table(
        "exports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("export_type", sa.String(length=32), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    _create_index("ix_exports_model_run_id", "exports", ["model_run_id"])
    _create_index("ix_exports_export_type", "exports", ["export_type"])


def _create_scenarios() -> None:
    _create_table(
        "scenarios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("action_type", sa.String(length=32), nullable=False, server_default="path"),
        sa.Column("channel", sa.String(length=255), nullable=True),
        sa.Column("intensity_pct", sa.Float(), nullable=True),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    _create_index("ix_scenarios_model_run_id", "scenarios", ["model_run_id"])
    _create_index("ix_scenarios_action_type", "scenarios", ["action_type"])


def _create_scenario_graph() -> None:
    _create_table(
        "scenario_graph",
        sa.Column("scenario_id", sa.Integer(), sa.ForeignKey("scenarios.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("nodes_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("edges_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("path_channels_json", sa.Text(), nullable=False, server_default="[]"),
    )


def _create_scenario_analysis() -> None:
    _create_table(
        "scenario_analysis",
        sa.Column("scenario_id", sa.Integer(), sa.ForeignKey("scenarios.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), nullable=False),
        sa.Column("code_version", sa.String(length=64), nullable=False),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("path_probability", sa.Float(), nullable=True),
        sa.Column("conversion_probability_given_last_node", sa.Float(), nullable=True),
        sa.Column("composite_conversion_probability", sa.Float(), nullable=True),
        sa.Column("historical_conversion_rate", sa.Float(), nullable=True),
        sa.Column("lift", sa.Float(), nullable=True),
        sa.Column("expected_revenue", sa.Float(), nullable=True),
        sa.Column("expected_ticket", sa.Float(), nullable=True),
        sa.Column("historical_support", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("warnings_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("similar_paths_json", sa.Text(), nullable=False, server_default="[]"),
    )
    _create_index("ix_scenario_analysis_model_run_id", "scenario_analysis", ["model_run_id"])


def _create_loop_diagnostics() -> None:
    _create_table(
        "loop_diagnostics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("channel", sa.String(length=255), nullable=False),
        sa.Column("self_loop_count", sa.Float(), nullable=True),
        sa.Column("self_loop_rate", sa.Float(), nullable=True),
        sa.Column("avg_consecutive_repeats", sa.Float(), nullable=True),
        sa.Column("median_consecutive_repeats", sa.Float(), nullable=True),
        sa.Column("max_consecutive_repeats", sa.Float(), nullable=True),
        sa.Column("loop_conversion_rate", sa.Float(), nullable=True),
        sa.Column("nonloop_conversion_rate", sa.Float(), nullable=True),
        sa.Column("loop_conversion_lift", sa.Float(), nullable=True),
        sa.Column("exit_distribution_json", sa.Text(), nullable=True),
        sa.Column("support", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.String(length=32), nullable=True),
    )
    _create_index("ix_loop_diagnostics_model_run_id", "loop_diagnostics", ["model_run_id"])
    _create_index("ix_loop_diagnostics_channel", "loop_diagnostics", ["channel"])
    _create_index("ix_loop_diagnostics_run_channel", "loop_diagnostics", ["model_run_id", "channel"])


def _create_funnel_state_attribution() -> None:
    _create_table(
        "funnel_state_attribution",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("state", sa.String(length=512), nullable=False),
        sa.Column("channel", sa.String(length=255), nullable=False),
        sa.Column("funnel_stage", sa.String(length=64), nullable=False),
        sa.Column("markov_weight", sa.Float(), nullable=True),
        sa.Column("markov_revenue", sa.Float(), nullable=True),
        sa.Column("removal_effect", sa.Float(), nullable=True),
        sa.Column("shapley_weight", sa.Float(), nullable=True),
        sa.Column("shapley_revenue", sa.Float(), nullable=True),
        sa.Column("presence_converting", sa.Float(), nullable=True),
        sa.Column("presence_nonconverting", sa.Float(), nullable=True),
        sa.Column("support", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.String(length=32), nullable=True),
    )
    _create_index("ix_funnel_state_attribution_model_run_id", "funnel_state_attribution", ["model_run_id"])
    _create_index("ix_funnel_state_attribution_state", "funnel_state_attribution", ["state"])
    _create_index("ix_funnel_state_attribution_channel", "funnel_state_attribution", ["channel"])
    _create_index("ix_funnel_state_attribution_funnel_stage", "funnel_state_attribution", ["funnel_stage"])
    _create_index("ix_funnel_state_run_channel", "funnel_state_attribution", ["model_run_id", "channel"])


def _create_sequential_effects() -> None:
    _create_table(
        "sequential_effects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("previous_channel", sa.String(length=255), nullable=False),
        sa.Column("current_channel", sa.String(length=255), nullable=False),
        sa.Column("pair_count", sa.Float(), nullable=True),
        sa.Column("conversion_count", sa.Float(), nullable=True),
        sa.Column("nonconversion_count", sa.Float(), nullable=True),
        sa.Column("conversion_probability_pair", sa.Float(), nullable=True),
        sa.Column("conversion_probability_baseline", sa.Float(), nullable=True),
        sa.Column("lift_vs_baseline", sa.Float(), nullable=True),
        sa.Column("avg_ticket", sa.Float(), nullable=True),
        sa.Column("revenue", sa.Float(), nullable=True),
        sa.Column("support", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.String(length=32), nullable=True),
        sa.Column("diagnostic_label", sa.String(length=64), nullable=True),
    )
    _create_index("ix_sequential_effects_model_run_id", "sequential_effects", ["model_run_id"])
    _create_index("ix_sequential_effects_previous_channel", "sequential_effects", ["previous_channel"])
    _create_index("ix_sequential_effects_current_channel", "sequential_effects", ["current_channel"])
    _create_index("ix_sequential_effects_run_pair", "sequential_effects", ["model_run_id", "previous_channel", "current_channel"])


def _create_session_quality() -> None:
    _create_table(
        "session_quality",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("channel", sa.String(length=255), nullable=False),
        sa.Column("sessions", sa.Integer(), nullable=True),
        sa.Column("avg_duration_s", sa.Float(), nullable=True),
        sa.Column("avg_pageviews", sa.Float(), nullable=True),
        sa.Column("avg_bounce_rate", sa.Float(), nullable=True),
        sa.Column("avg_events", sa.Float(), nullable=True),
        sa.Column("conv_sessions", sa.Integer(), nullable=True),
        sa.Column("conv_avg_duration_s", sa.Float(), nullable=True),
        sa.Column("conv_avg_bounce_rate", sa.Float(), nullable=True),
        sa.Column("nonconv_avg_duration_s", sa.Float(), nullable=True),
        sa.Column("nonconv_avg_bounce_rate", sa.Float(), nullable=True),
    )
    _create_index("ix_session_quality_model_run_id", "session_quality", ["model_run_id"])
    _create_index("ix_session_quality_channel", "session_quality", ["channel"])
    _create_index("ix_session_quality_run_channel", "session_quality", ["model_run_id", "channel"])


def _create_legacy_tables() -> None:
    _create_table(
        "transition_counts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("from_state", sa.String(length=255), nullable=False),
        sa.Column("to_state", sa.String(length=255), nullable=False),
        sa.Column("n", sa.Float(), nullable=False),
        sa.Column("total_revenue", sa.Float(), nullable=True),
        sa.Column("transition_type", sa.String(length=32), nullable=False),
    )
    _create_index("ix_transition_counts_model_run_id", "transition_counts", ["model_run_id"])
    _create_index("ix_transition_counts_from_state", "transition_counts", ["from_state"])
    _create_index("ix_transition_counts_to_state", "transition_counts", ["to_state"])
    _create_index("ix_transition_counts_transition_type", "transition_counts", ["transition_type"])
    _create_index("ix_transition_counts_run_type", "transition_counts", ["model_run_id", "transition_type"])

    _create_table(
        "transition_matrix",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("from_state", sa.String(length=255), nullable=False),
        sa.Column("to_state", sa.String(length=255), nullable=False),
        sa.Column("probability", sa.Float(), nullable=False),
    )
    _create_index("ix_transition_matrix_model_run_id", "transition_matrix", ["model_run_id"])
    _create_index("ix_transition_matrix_from_state", "transition_matrix", ["from_state"])
    _create_index("ix_transition_matrix_to_state", "transition_matrix", ["to_state"])

    _create_table(
        "attribution_results",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("model_type", sa.String(length=16), nullable=False, server_default="raw"),
        sa.Column("channel", sa.String(length=255), nullable=False),
        sa.Column("markov_weight", sa.Float(), nullable=True),
        sa.Column("markov_revenue", sa.Float(), nullable=True),
        sa.Column("removal_effect", sa.Float(), nullable=True),
        sa.Column("shapley_weight", sa.Float(), nullable=True),
        sa.Column("shapley_revenue", sa.Float(), nullable=True),
        sa.Column("shapley_value", sa.Float(), nullable=True),
        sa.Column("spend", sa.Float(), nullable=True),
        sa.Column("roas_markov", sa.Float(), nullable=True),
        sa.Column("roas_shapley", sa.Float(), nullable=True),
        sa.Column("pfc_weight", sa.Float(), nullable=True),
        sa.Column("pfc_delta_pp", sa.Float(), nullable=True),
        sa.Column("recommendation", sa.String(length=255), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
    )
    _create_index("ix_attribution_results_model_run_id", "attribution_results", ["model_run_id"])
    _create_index("ix_attribution_results_model_type", "attribution_results", ["model_type"])
    _create_index("ix_attribution_results_channel", "attribution_results", ["channel"])
    _create_index("ix_attribution_results_run_channel", "attribution_results", ["model_run_id", "channel"])

    _create_table(
        "channel_diagnostics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("model_run_id", sa.Integer(), sa.ForeignKey("model_runs.id"), nullable=False),
        sa.Column("channel", sa.String(length=255), nullable=False),
        sa.Column("channel_role", sa.String(length=255), nullable=True),
        sa.Column("touchpoint_role", sa.String(length=255), nullable=True),
        sa.Column("presence_converting", sa.Float(), nullable=True),
        sa.Column("presence_nonconverting", sa.Float(), nullable=True),
        sa.Column("first_touch_share", sa.Float(), nullable=True),
        sa.Column("middle_touch_share", sa.Float(), nullable=True),
        sa.Column("last_touch_share", sa.Float(), nullable=True),
        sa.Column("assist_count", sa.Float(), nullable=True),
        sa.Column("closer_count", sa.Float(), nullable=True),
        sa.Column("starter_count", sa.Float(), nullable=True),
        sa.Column("markov_shapley_delta_pp", sa.Float(), nullable=True),
        sa.Column("diagnostic_label", sa.String(length=255), nullable=True),
        sa.Column("diagnostic_text", sa.Text(), nullable=True),
    )
    _create_index("ix_channel_diagnostics_model_run_id", "channel_diagnostics", ["model_run_id"])
    _create_index("ix_channel_diagnostics_channel", "channel_diagnostics", ["channel"])
    _create_index("ix_channel_diagnostics_run_channel", "channel_diagnostics", ["model_run_id", "channel"])


def _create_table(table_name: str, *columns_and_constraints) -> None:
    if not _has_table(op.get_bind(), table_name):
        op.create_table(table_name, *columns_and_constraints)


def _create_index(index_name: str, table_name: str, columns: list[str]) -> None:
    if _has_table(op.get_bind(), table_name) and not _has_index(op.get_bind(), table_name, index_name):
        op.create_index(index_name, table_name, columns)


def _has_table(bind, table_name: str) -> bool:
    return inspect(bind).has_table(table_name)


def _has_index(bind, table_name: str, index_name: str) -> bool:
    if not _has_table(bind, table_name):
        return False
    return any(index["name"] == index_name for index in inspect(bind).get_indexes(table_name))


def _table_columns(bind, table_name: str) -> set[str]:
    if not _has_table(bind, table_name):
        return set()
    return {column["name"] for column in inspect(bind).get_columns(table_name)}


def _select_expr(source_alias: str, source_cols: set[str], column: str, default: str = "NULL") -> str:
    return f"{source_alias}.{column}" if column in source_cols else default


def _backfill_transition_edges(bind) -> None:
    if not _has_table(bind, "transition_edges"):
        return
    if _has_table(bind, "transition_counts"):
        bind.execute(
            text(
                """
                INSERT INTO transition_edges (
                    model_run_id, from_state, to_state, transition_type,
                    count, revenue, avg_ticket, is_self_loop
                )
                SELECT
                    tc.model_run_id,
                    tc.from_state,
                    tc.to_state,
                    tc.transition_type,
                    tc.n,
                    tc.total_revenue,
                    CASE
                        WHEN tc.total_revenue IS NOT NULL AND tc.n IS NOT NULL AND tc.n != 0
                        THEN tc.total_revenue / tc.n
                        ELSE NULL
                    END,
                    CASE WHEN tc.from_state = tc.to_state THEN 1 ELSE 0 END
                FROM transition_counts tc
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM transition_edges te
                    WHERE te.model_run_id = tc.model_run_id
                      AND te.from_state = tc.from_state
                      AND te.to_state = tc.to_state
                      AND te.transition_type = tc.transition_type
                )
                """
            )
        )
    if _has_table(bind, "transition_matrix"):
        bind.execute(
            text(
                """
                INSERT INTO transition_edges (
                    model_run_id, from_state, to_state, transition_type,
                    probability, is_self_loop
                )
                SELECT
                    tm.model_run_id,
                    tm.from_state,
                    tm.to_state,
                    'matrix',
                    tm.probability,
                    CASE WHEN tm.from_state = tm.to_state THEN 1 ELSE 0 END
                FROM transition_matrix tm
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM transition_edges te
                    WHERE te.model_run_id = tm.model_run_id
                      AND te.from_state = tm.from_state
                      AND te.to_state = tm.to_state
                      AND te.transition_type = 'matrix'
                )
                """
            )
        )


def _backfill_channel_metrics(bind) -> None:
    if not (_has_table(bind, "attribution_results") and _has_table(bind, "channel_metrics")):
        return
    attribution_cols = _table_columns(bind, "attribution_results")
    if not {"model_run_id", "channel"}.issubset(attribution_cols):
        return
    diagnostic_cols = _table_columns(bind, "channel_diagnostics")
    has_diagnostics = _has_table(bind, "channel_diagnostics")

    model_type_expr = _select_expr("a", attribution_cols, "model_type", "'raw'")
    diagnostic_select = {
        col: _select_expr("d", diagnostic_cols, col)
        for col in [
            "channel_role",
            "touchpoint_role",
            "presence_converting",
            "presence_nonconverting",
            "first_touch_share",
            "middle_touch_share",
            "last_touch_share",
            "assist_count",
            "closer_count",
            "starter_count",
            "markov_shapley_delta_pp",
            "diagnostic_label",
            "diagnostic_text",
        ]
    }
    join = (
        "LEFT JOIN channel_diagnostics d "
        "ON d.model_run_id = a.model_run_id AND d.channel = a.channel"
        if has_diagnostics
        else ""
    )
    bind.execute(
        text(
            f"""
            INSERT INTO channel_metrics (
                model_run_id, model_type, channel, spend, spend_share,
                markov_weight, markov_revenue, markov_revenue_share, removal_effect,
                shapley_weight, shapley_revenue, shapley_revenue_share, shapley_value,
                roas_markov, roas_shapley, first_click_revenue, last_click_revenue,
                first_click_roas, last_click_roas, pfc_weight, pfc_delta_pp,
                consensus_score, confidence_score, recommendation,
                channel_role, touchpoint_role, presence_converting, presence_nonconverting,
                first_touch_share, middle_touch_share, last_touch_share, starter_count,
                assist_count, closer_count, markov_shapley_delta_pp, diagnostic_label,
                diagnostic_text
            )
            SELECT
                src.model_run_id,
                src.model_type,
                src.channel,
                src.spend,
                CASE WHEN src.total_spend > 0 AND src.spend IS NOT NULL
                    THEN src.spend / src.total_spend ELSE NULL END,
                src.markov_weight,
                src.markov_revenue,
                CASE WHEN src.total_markov_revenue > 0 AND src.markov_revenue IS NOT NULL
                    THEN src.markov_revenue / src.total_markov_revenue ELSE NULL END,
                src.removal_effect,
                src.shapley_weight,
                src.shapley_revenue,
                CASE WHEN src.total_shapley_revenue > 0 AND src.shapley_revenue IS NOT NULL
                    THEN src.shapley_revenue / src.total_shapley_revenue ELSE NULL END,
                src.shapley_value,
                src.roas_markov,
                src.roas_shapley,
                src.first_click_revenue,
                src.last_click_revenue,
                CASE WHEN src.spend > 0 AND src.first_click_revenue IS NOT NULL
                    THEN src.first_click_revenue / src.spend ELSE NULL END,
                CASE WHEN src.spend > 0 AND src.last_click_revenue IS NOT NULL
                    THEN src.last_click_revenue / src.spend ELSE NULL END,
                src.pfc_weight,
                src.pfc_delta_pp,
                CASE
                    WHEN src.markov_weight IS NULL OR src.shapley_weight IS NULL THEN NULL
                    WHEN 1.0 - ABS(src.markov_weight - src.shapley_weight) * :consensus_multiplier < 0.0 THEN 0.0
                    WHEN 1.0 - ABS(src.markov_weight - src.shapley_weight) * :consensus_multiplier > 1.0 THEN 1.0
                    ELSE 1.0 - ABS(src.markov_weight - src.shapley_weight) * :consensus_multiplier
                END,
                src.confidence_score,
                src.recommendation,
                src.channel_role,
                src.touchpoint_role,
                src.presence_converting,
                src.presence_nonconverting,
                src.first_touch_share,
                src.middle_touch_share,
                src.last_touch_share,
                src.starter_count,
                src.assist_count,
                src.closer_count,
                src.markov_shapley_delta_pp,
                src.diagnostic_label,
                src.diagnostic_text
            FROM (
                SELECT
                    a.model_run_id,
                    {model_type_expr} AS model_type,
                    a.channel,
                    {_select_expr("a", attribution_cols, "spend")} AS spend,
                    SUM(COALESCE({_select_expr("a", attribution_cols, "spend", "0.0")}, 0.0))
                        OVER (PARTITION BY a.model_run_id, {model_type_expr}) AS total_spend,
                    {_select_expr("a", attribution_cols, "markov_weight")} AS markov_weight,
                    {_select_expr("a", attribution_cols, "markov_revenue")} AS markov_revenue,
                    SUM(COALESCE({_select_expr("a", attribution_cols, "markov_revenue", "0.0")}, 0.0))
                        OVER (PARTITION BY a.model_run_id, {model_type_expr}) AS total_markov_revenue,
                    {_select_expr("a", attribution_cols, "removal_effect")} AS removal_effect,
                    {_select_expr("a", attribution_cols, "shapley_weight")} AS shapley_weight,
                    {_select_expr("a", attribution_cols, "shapley_revenue")} AS shapley_revenue,
                    SUM(COALESCE({_select_expr("a", attribution_cols, "shapley_revenue", "0.0")}, 0.0))
                        OVER (PARTITION BY a.model_run_id, {model_type_expr}) AS total_shapley_revenue,
                    {_select_expr("a", attribution_cols, "shapley_value")} AS shapley_value,
                    {_select_expr("a", attribution_cols, "roas_markov")} AS roas_markov,
                    {_select_expr("a", attribution_cols, "roas_shapley")} AS roas_shapley,
                    first_click.revenue AS first_click_revenue,
                    last_click.revenue AS last_click_revenue,
                    {_select_expr("a", attribution_cols, "pfc_weight")} AS pfc_weight,
                    {_select_expr("a", attribution_cols, "pfc_delta_pp")} AS pfc_delta_pp,
                    {_select_expr("a", attribution_cols, "confidence_score")} AS confidence_score,
                    {_select_expr("a", attribution_cols, "recommendation")} AS recommendation,
                    {diagnostic_select["channel_role"]} AS channel_role,
                    {diagnostic_select["touchpoint_role"]} AS touchpoint_role,
                    {diagnostic_select["presence_converting"]} AS presence_converting,
                    {diagnostic_select["presence_nonconverting"]} AS presence_nonconverting,
                    {diagnostic_select["first_touch_share"]} AS first_touch_share,
                    {diagnostic_select["middle_touch_share"]} AS middle_touch_share,
                    {diagnostic_select["last_touch_share"]} AS last_touch_share,
                    {diagnostic_select["starter_count"]} AS starter_count,
                    {diagnostic_select["assist_count"]} AS assist_count,
                    {diagnostic_select["closer_count"]} AS closer_count,
                    {diagnostic_select["markov_shapley_delta_pp"]} AS markov_shapley_delta_pp,
                    {diagnostic_select["diagnostic_label"]} AS diagnostic_label,
                    {diagnostic_select["diagnostic_text"]} AS diagnostic_text
                FROM attribution_results a
                {join}
                LEFT JOIN (
                    SELECT model_run_id, to_state AS channel, SUM(COALESCE(revenue, 0.0)) AS revenue
                    FROM transition_edges
                    WHERE transition_type = 'converting' AND from_state = '(start)'
                    GROUP BY model_run_id, to_state
                ) first_click ON first_click.model_run_id = a.model_run_id AND first_click.channel = a.channel
                LEFT JOIN (
                    SELECT model_run_id, from_state AS channel, SUM(COALESCE(revenue, 0.0)) AS revenue
                    FROM transition_edges
                    WHERE transition_type = 'converting' AND to_state = 'Conversion'
                    GROUP BY model_run_id, from_state
                ) last_click ON last_click.model_run_id = a.model_run_id AND last_click.channel = a.channel
            ) src
            WHERE NOT EXISTS (
                SELECT 1
                FROM channel_metrics cm
                WHERE cm.model_run_id = src.model_run_id
                  AND cm.model_type = src.model_type
                  AND cm.channel = src.channel
            )
            """
        ),
        {"consensus_multiplier": CONSENSUS_DELTA_MULTIPLIER},
    )


def _backfill_legacy_channel_tables(bind) -> None:
    if not _has_table(bind, "channel_metrics"):
        return
    bind.execute(
        text(
            """
            INSERT INTO attribution_results (
                model_run_id, model_type, channel, markov_weight, markov_revenue,
                removal_effect, shapley_weight, shapley_revenue, shapley_value,
                spend, roas_markov, roas_shapley, pfc_weight, pfc_delta_pp,
                recommendation, confidence_score
            )
            SELECT
                cm.model_run_id, cm.model_type, cm.channel, cm.markov_weight, cm.markov_revenue,
                cm.removal_effect, cm.shapley_weight, cm.shapley_revenue, cm.shapley_value,
                cm.spend, cm.roas_markov, cm.roas_shapley, cm.pfc_weight, cm.pfc_delta_pp,
                cm.recommendation, cm.confidence_score
            FROM channel_metrics cm
            WHERE NOT EXISTS (
                SELECT 1
                FROM attribution_results ar
                WHERE ar.model_run_id = cm.model_run_id
                  AND ar.model_type = cm.model_type
                  AND ar.channel = cm.channel
            )
            """
        )
    )
    bind.execute(
        text(
            """
            INSERT INTO channel_diagnostics (
                model_run_id, channel, channel_role, touchpoint_role,
                presence_converting, presence_nonconverting, first_touch_share,
                middle_touch_share, last_touch_share, assist_count, closer_count,
                starter_count, markov_shapley_delta_pp, diagnostic_label,
                diagnostic_text
            )
            SELECT
                cm.model_run_id, cm.channel, cm.channel_role, cm.touchpoint_role,
                cm.presence_converting, cm.presence_nonconverting, cm.first_touch_share,
                cm.middle_touch_share, cm.last_touch_share, cm.assist_count, cm.closer_count,
                cm.starter_count, cm.markov_shapley_delta_pp, cm.diagnostic_label,
                cm.diagnostic_text
            FROM channel_metrics cm
            WHERE cm.model_type = 'raw'
              AND (
                  cm.channel_role IS NOT NULL
                  OR cm.touchpoint_role IS NOT NULL
                  OR cm.presence_converting IS NOT NULL
                  OR cm.presence_nonconverting IS NOT NULL
                  OR cm.first_touch_share IS NOT NULL
                  OR cm.middle_touch_share IS NOT NULL
                  OR cm.last_touch_share IS NOT NULL
                  OR cm.assist_count IS NOT NULL
                  OR cm.closer_count IS NOT NULL
                  OR cm.starter_count IS NOT NULL
                  OR cm.markov_shapley_delta_pp IS NOT NULL
                  OR cm.diagnostic_label IS NOT NULL
                  OR cm.diagnostic_text IS NOT NULL
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM channel_diagnostics cd
                  WHERE cd.model_run_id = cm.model_run_id
                    AND cd.channel = cm.channel
              )
            """
        )
    )


def _backfill_legacy_transition_tables(bind) -> None:
    if not _has_table(bind, "transition_edges"):
        return
    bind.execute(
        text(
            """
            INSERT INTO transition_counts (
                model_run_id, from_state, to_state, n, total_revenue, transition_type
            )
            SELECT model_run_id, from_state, to_state, count, revenue, transition_type
            FROM transition_edges te
            WHERE te.transition_type != 'matrix'
              AND NOT EXISTS (
                  SELECT 1
                  FROM transition_counts tc
                  WHERE tc.model_run_id = te.model_run_id
                    AND tc.from_state = te.from_state
                    AND tc.to_state = te.to_state
                    AND tc.transition_type = te.transition_type
              )
            """
        )
    )
    bind.execute(
        text(
            """
            INSERT INTO transition_matrix (
                model_run_id, from_state, to_state, probability
            )
            SELECT model_run_id, from_state, to_state, probability
            FROM transition_edges te
            WHERE te.transition_type = 'matrix'
              AND te.probability IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM transition_matrix tm
                  WHERE tm.model_run_id = te.model_run_id
                    AND tm.from_state = te.from_state
                    AND tm.to_state = te.to_state
              )
            """
        )
    )


def _drop_legacy_tables(bind) -> None:
    for table_name in [
        "transition_matrix",
        "transition_counts",
        "channel_diagnostics",
        "attribution_results",
    ]:
        if _has_table(bind, table_name):
            op.drop_table(table_name)


def _drop_consolidated_tables(bind) -> None:
    for table_name in ["transition_edges", "channel_metrics"]:
        if _has_table(bind, table_name):
            op.drop_table(table_name)
