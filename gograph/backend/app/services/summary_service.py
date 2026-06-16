"""Aggregate model-run summary metrics for persisted dashboards."""

from __future__ import annotations

import math
from typing import Any

import pandas as pd


def compute_summary(
    *,
    channel_rows: pd.DataFrame,
    path_rows: pd.DataFrame,
    transition_rows: dict[str, pd.DataFrame],
    states: list[str],
    observed_rate: float | None,
    model_rate: float,
    total_revenue: float,
    total_spend: float,
    non_conv_scale: float | None,
    data_quality_rows: pd.DataFrame | None = None,
) -> dict[str, Any]:
    """Return the single-row aggregate persisted in model_run_summary."""

    converting = transition_rows.get("converting", pd.DataFrame())
    nonconverting = transition_rows.get("nonconverting", pd.DataFrame())
    total_conversions = _sum_n_to_int(converting)
    total_nonconversions = _sum_n_to_int(nonconverting)
    transition_count = int(sum(len(df) for df in transition_rows.values()))
    channel_count = int(channel_rows["channel"].nunique()) if "channel" in channel_rows.columns else 0

    data_quality_score = _data_quality_score(data_quality_rows)
    calibration_score = _calibration_score(observed_rate, model_rate)
    coverage_score = _coverage_score(total_conversions, total_nonconversions, channel_count)
    agreement_score = _markov_shapley_agreement(channel_rows)

    # Heuristic Block 2 blend: data quality, calibration, coverage, and model agreement.
    confidence = max(
        0.0,
        min(
            1.0,
            0.30 * data_quality_score
            + 0.25 * calibration_score
            + 0.25 * coverage_score
            + 0.20 * agreement_score,
        ),
    )

    return {
        "observed_conversion_rate": observed_rate,
        "model_conversion_rate": float(model_rate),
        "total_revenue": float(total_revenue),
        "total_spend": float(total_spend),
        "total_conversions": total_conversions,
        "total_nonconversions_sampled": total_nonconversions,
        "non_conv_scale": non_conv_scale,
        "state_count": len(states),
        "channel_count": channel_count,
        "path_count": int(len(path_rows)),
        "transition_count": transition_count,
        "confidence_score": round(confidence, 4),
        "confidence_label": _confidence_label(confidence),
    }


def _sum_n_to_int(df: pd.DataFrame) -> int:
    if df.empty or "n" not in df.columns:
        return 0
    return int(pd.to_numeric(df["n"], errors="coerce").fillna(0).sum())


def _data_quality_score(rows: pd.DataFrame | None) -> float:
    if rows is None or rows.empty or "status" not in rows.columns:
        return 0.75
    statuses = rows["status"].astype(str).str.lower()
    if statuses.empty:
        return 0.75
    passed = statuses.isin(["pass", "passed", "ok", "green", "success"]).sum()
    warning = statuses.isin(["warn", "warning", "yellow"]).sum()
    return float((passed + 0.5 * warning) / max(len(statuses), 1))


def _calibration_score(observed_rate: float | None, model_rate: float) -> float:
    if observed_rate is None or observed_rate <= 0:
        return 0.75
    ratio_error = abs(float(observed_rate) - float(model_rate)) / max(float(observed_rate), 1e-6)
    return max(0.0, min(1.0, 1.0 - ratio_error))


def _coverage_score(total_conversions: int, total_nonconversions: int, channel_count: int) -> float:
    support_score = min(1.0, math.log10(max(total_conversions + total_nonconversions, 1)) / 4.0)
    channel_score = min(1.0, channel_count / 8.0)
    return 0.65 * support_score + 0.35 * channel_score


def _markov_shapley_agreement(rows: pd.DataFrame) -> float:
    if rows.empty:
        return 0.75
    markov = _numeric_series(rows, "markov_weight", fallback="attribution_weight")
    shapley = _numeric_series(rows, "shapley_weight")
    if markov.empty or shapley.empty:
        return 0.75
    diff = (markov - shapley).abs().mean()
    return max(0.0, min(1.0, 1.0 - float(diff) * 4.0))


def _numeric_series(rows: pd.DataFrame, column: str, fallback: str | None = None) -> pd.Series:
    source = column if column in rows.columns else fallback
    if not source or source not in rows.columns:
        return pd.Series(dtype=float)
    return pd.to_numeric(rows[source], errors="coerce").fillna(0.0)


def _confidence_label(score: float) -> str:
    if score >= 0.75:
        return "Alta"
    if score >= 0.50:
        return "Média"
    return "Baixa"
