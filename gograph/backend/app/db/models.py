"""SQLAlchemy models for persisted GoGraph model runs."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
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
