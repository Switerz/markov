"""SQLAlchemy models for persisted GoGraph model runs."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from gograph.backend.app.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ModelRun(Base):
    __tablename__ = "model_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_date: Mapped[str] = mapped_column(String(10), index=True)
    end_date: Mapped[str] = mapped_column(String(10), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(32), default="completed", index=True)
    parameters_json: Mapped[str] = mapped_column(Text)
    observed_conversion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_conversion_rate: Mapped[float] = mapped_column(Float)
    total_revenue: Mapped[float] = mapped_column(Float)
    total_spend: Mapped[float] = mapped_column(Float, default=0.0)
    runtime_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    funnel_model_active: Mapped[bool] = mapped_column(Integer, default=0)

    transition_counts: Mapped[list["TransitionCount"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    transition_matrix: Mapped[list["TransitionMatrixEntry"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    attribution_results: Mapped[list["AttributionResult"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    channel_diagnostics: Mapped[list["ChannelDiagnostic"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    path_summary: Mapped[list["PathSummary"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    data_quality_checks: Mapped[list["DataQualityCheck"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    exports: Mapped[list["ExportRecord"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    loop_diagnostics: Mapped[list["LoopDiagnostic"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    funnel_state_attribution: Mapped[list["FunnelStateAttribution"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    sequential_effects: Mapped[list["SequentialEffect"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    summary: Mapped["ModelRunSummary | None"] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
        uselist=False,
    )
    channel_recommendations: Mapped[list["ChannelRecommendation"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    inputs: Mapped[list["ModelRunInput"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )
    logs: Mapped[list["ModelRunLog"]] = relationship(
        back_populates="model_run",
        cascade="all, delete-orphan",
    )


class ModelRunSummary(Base):
    __tablename__ = "model_run_summary"

    model_run_id: Mapped[int] = mapped_column(
        ForeignKey("model_runs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    observed_conversion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_conversion_rate: Mapped[float] = mapped_column(Float)
    total_revenue: Mapped[float] = mapped_column(Float)
    total_spend: Mapped[float] = mapped_column(Float)
    total_conversions: Mapped[int] = mapped_column(Integer)
    total_nonconversions_sampled: Mapped[int] = mapped_column(Integer)
    non_conv_scale: Mapped[float | None] = mapped_column(Float, nullable=True)
    state_count: Mapped[int] = mapped_column(Integer)
    channel_count: Mapped[int] = mapped_column(Integer)
    path_count: Mapped[int] = mapped_column(Integer)
    transition_count: Mapped[int] = mapped_column(Integer)
    confidence_score: Mapped[float] = mapped_column(Float)
    confidence_label: Mapped[str] = mapped_column(String(32))

    model_run: Mapped["ModelRun"] = relationship(back_populates="summary")


class ChannelRecommendation(Base):
    __tablename__ = "channel_recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(
        ForeignKey("model_runs.id", ondelete="CASCADE"),
        index=True,
    )
    channel: Mapped[str] = mapped_column(String(255), index=True)
    recommendation: Mapped[str] = mapped_column(String(32))
    recommendation_tone: Mapped[str] = mapped_column(String(32))
    priority_rank: Mapped[int] = mapped_column(Integer)
    rationale_json: Mapped[str] = mapped_column(Text)
    risks_json: Mapped[str] = mapped_column(Text)
    best_practices_json: Mapped[str] = mapped_column(Text)
    suggested_budget_delta_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    suggested_budget_delta_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_revenue_delta: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_roas_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_roas_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    saturation_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float)

    model_run: Mapped["ModelRun"] = relationship(back_populates="channel_recommendations")

    __table_args__ = (UniqueConstraint("model_run_id", "channel"),)


class ModelRunInput(Base):
    __tablename__ = "model_run_inputs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(
        ForeignKey("model_runs.id", ondelete="CASCADE"),
        index=True,
    )
    source: Mapped[str] = mapped_column(String(64), index=True)
    database_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    query_name: Mapped[str] = mapped_column(String(255), index=True)
    row_count: Mapped[int] = mapped_column(Integer)
    date_min: Mapped[str | None] = mapped_column(String(10), nullable=True)
    date_max: Mapped[str | None] = mapped_column(String(10), nullable=True)
    data_hash: Mapped[str] = mapped_column(String(64))
    extracted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    model_run: Mapped["ModelRun"] = relationship(back_populates="inputs")


class ModelRunLog(Base):
    __tablename__ = "model_run_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(
        ForeignKey("model_runs.id", ondelete="CASCADE"),
        index=True,
    )
    step: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    model_run: Mapped["ModelRun"] = relationship(back_populates="logs")


class TransitionCount(Base):
    __tablename__ = "transition_counts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    from_state: Mapped[str] = mapped_column(String(255), index=True)
    to_state: Mapped[str] = mapped_column(String(255), index=True)
    n: Mapped[float] = mapped_column(Float)
    total_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    transition_type: Mapped[str] = mapped_column(String(32), index=True)

    model_run: Mapped[ModelRun] = relationship(back_populates="transition_counts")


class TransitionMatrixEntry(Base):
    __tablename__ = "transition_matrix"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    from_state: Mapped[str] = mapped_column(String(255), index=True)
    to_state: Mapped[str] = mapped_column(String(255), index=True)
    probability: Mapped[float] = mapped_column(Float)

    model_run: Mapped[ModelRun] = relationship(back_populates="transition_matrix")


class AttributionResult(Base):
    __tablename__ = "attribution_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    # 'raw' = Raw Channel Markov  |  'funnel' = Funnel Stage Markov (aggregated by channel)
    model_type: Mapped[str] = mapped_column(String(16), default="raw", index=True)
    channel: Mapped[str] = mapped_column(String(255), index=True)
    markov_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    markov_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    removal_effect: Mapped[float | None] = mapped_column(Float, nullable=True)
    shapley_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    shapley_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    shapley_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    spend: Mapped[float | None] = mapped_column(Float, nullable=True)
    roas_markov: Mapped[float | None] = mapped_column(Float, nullable=True)
    roas_shapley: Mapped[float | None] = mapped_column(Float, nullable=True)
    pfc_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    pfc_delta_pp: Mapped[float | None] = mapped_column(Float, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    model_run: Mapped[ModelRun] = relationship(back_populates="attribution_results")


class ChannelDiagnostic(Base):
    __tablename__ = "channel_diagnostics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    channel: Mapped[str] = mapped_column(String(255), index=True)
    channel_role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    touchpoint_role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    presence_converting: Mapped[float | None] = mapped_column(Float, nullable=True)
    presence_nonconverting: Mapped[float | None] = mapped_column(Float, nullable=True)
    first_touch_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    middle_touch_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_touch_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    assist_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    closer_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    starter_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    markov_shapley_delta_pp: Mapped[float | None] = mapped_column(Float, nullable=True)
    diagnostic_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    diagnostic_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    model_run: Mapped[ModelRun] = relationship(back_populates="channel_diagnostics")


class PathSummary(Base):
    __tablename__ = "path_summary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    path_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    path_text: Mapped[str] = mapped_column(Text)
    path_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    count: Mapped[float | None] = mapped_column(Float, nullable=True)
    conversion_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    nonconversion_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    conversion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_ticket: Mapped[float | None] = mapped_column(Float, nullable=True)
    path_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    contains_loop: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    model_run: Mapped[ModelRun] = relationship(back_populates="path_summary")


class DataQualityCheck(Base):
    __tablename__ = "data_quality_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    check_name: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(32), index=True)
    severity: Mapped[str] = mapped_column(String(32), index=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    affected_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)

    model_run: Mapped[ModelRun] = relationship(back_populates="data_quality_checks")


class ExportRecord(Base):
    __tablename__ = "exports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    export_type: Mapped[str] = mapped_column(String(32), index=True)
    file_path: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    model_run: Mapped[ModelRun] = relationship(back_populates="exports")


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    nodes_json: Mapped[str] = mapped_column(Text, default="[]")
    edges_json: Mapped[str] = mapped_column(Text, default="[]")
    path_channels_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    model_run: Mapped[ModelRun] = relationship(back_populates="scenarios")


ModelRun.scenarios = relationship(
    "Scenario",
    back_populates="model_run",
    cascade="all, delete-orphan",
)

Index("ix_transition_counts_run_type", TransitionCount.model_run_id, TransitionCount.transition_type)
Index("ix_attribution_results_run_channel", AttributionResult.model_run_id, AttributionResult.channel)
Index("ix_channel_diagnostics_run_channel", ChannelDiagnostic.model_run_id, ChannelDiagnostic.channel)
Index("ix_model_run_inputs_run_query", ModelRunInput.model_run_id, ModelRunInput.query_name)
Index("ix_model_run_logs_run_created", ModelRunLog.model_run_id, ModelRunLog.created_at)


# ---------------------------------------------------------------------------
# Sprint 11 — Loop Diagnostics
# ---------------------------------------------------------------------------

class LoopDiagnostic(Base):
    """Per-channel auto-loop statistics derived from path sequences."""
    __tablename__ = "loop_diagnostics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    channel: Mapped[str] = mapped_column(String(255), index=True)
    self_loop_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    self_loop_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_consecutive_repeats: Mapped[float | None] = mapped_column(Float, nullable=True)
    median_consecutive_repeats: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_consecutive_repeats: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Conversion rates inside vs after loops
    loop_conversion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    nonloop_conversion_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    loop_conversion_lift: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Exit channel distribution (top 3 stored as JSON text)
    exit_distribution_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    support: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(32), nullable=True)

    model_run: Mapped["ModelRun"] = relationship(back_populates="loop_diagnostics")


# ---------------------------------------------------------------------------
# Sprint 13 — Funnel State Attribution
# ---------------------------------------------------------------------------

class FunnelStateAttribution(Base):
    """Markov/Shapley attribution per channel + funnel stage composite state."""
    __tablename__ = "funnel_state_attribution"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    # Composite state: "Paid Meta Ads / Product Interest"
    state: Mapped[str] = mapped_column(String(512), index=True)
    channel: Mapped[str] = mapped_column(String(255), index=True)
    funnel_stage: Mapped[str] = mapped_column(String(64), index=True)
    markov_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    markov_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    removal_effect: Mapped[float | None] = mapped_column(Float, nullable=True)
    shapley_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    shapley_revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    presence_converting: Mapped[float | None] = mapped_column(Float, nullable=True)
    presence_nonconverting: Mapped[float | None] = mapped_column(Float, nullable=True)
    support: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(32), nullable=True)

    model_run: Mapped["ModelRun"] = relationship(back_populates="funnel_state_attribution")


# ---------------------------------------------------------------------------
# Sprint 14 — Sequential Effects (Order-2 Diagnostics)
# ---------------------------------------------------------------------------

class SequentialEffect(Base):
    """Order-2 conditional conversion probabilities: P(Conv | prev, current)."""
    __tablename__ = "sequential_effects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    previous_channel: Mapped[str] = mapped_column(String(255), index=True)
    current_channel: Mapped[str] = mapped_column(String(255), index=True)
    pair_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    conversion_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    nonconversion_count: Mapped[float | None] = mapped_column(Float, nullable=True)
    conversion_probability_pair: Mapped[float | None] = mapped_column(Float, nullable=True)
    conversion_probability_baseline: Mapped[float | None] = mapped_column(Float, nullable=True)
    lift_vs_baseline: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_ticket: Mapped[float | None] = mapped_column(Float, nullable=True)
    revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    support: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(32), nullable=True)
    diagnostic_label: Mapped[str | None] = mapped_column(String(64), nullable=True)

    model_run: Mapped["ModelRun"] = relationship(back_populates="sequential_effects")


Index("ix_loop_diagnostics_run_channel", LoopDiagnostic.model_run_id, LoopDiagnostic.channel)
Index("ix_funnel_state_run_channel", FunnelStateAttribution.model_run_id, FunnelStateAttribution.channel)
Index("ix_sequential_effects_run_pair", SequentialEffect.model_run_id, SequentialEffect.previous_channel, SequentialEffect.current_channel)


# ---------------------------------------------------------------------------
# Sprint 18 — Session Quality
# ---------------------------------------------------------------------------

class SessionQuality(Base):
    """Per-channel session engagement metrics (duration, pageviews, bounce, events)."""
    __tablename__ = "session_quality"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model_run_id: Mapped[int] = mapped_column(ForeignKey("model_runs.id"), index=True)
    channel: Mapped[str] = mapped_column(String(255), index=True)
    sessions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_pageviews: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_bounce_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_events: Mapped[float | None] = mapped_column(Float, nullable=True)
    conv_sessions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    conv_avg_duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    conv_avg_bounce_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    nonconv_avg_duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    nonconv_avg_bounce_rate: Mapped[float | None] = mapped_column(Float, nullable=True)

    model_run: Mapped["ModelRun"] = relationship(back_populates="session_quality")


ModelRun.session_quality = relationship(
    "SessionQuality",
    back_populates="model_run",
    cascade="all, delete-orphan",
)

Index("ix_session_quality_run_channel", SessionQuality.model_run_id, SessionQuality.channel)
