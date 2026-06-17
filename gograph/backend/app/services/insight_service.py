"""Initial insight and data-quality helpers for GoGraph."""

from typing import Optional

import pandas as pd


def compute_data_quality(
    converting: pd.DataFrame,
    nonconverting: pd.DataFrame,
    spend: pd.DataFrame,
    observed_conversion_rate: Optional[float],
    model_conversion_rate: float,
) -> pd.DataFrame:
    checks = []

    def add_check(
        name: str,
        status: str,
        severity: str,
        detail: str,
        *,
        score: float | None = None,
        affected_rows: int | None = None,
        recommendation: str | None = None,
    ) -> None:
        checks.append(
            {
                "check_name": name,
                "status": status,
                "severity": severity,
                "detail": detail,
                "score": score,
                "affected_rows": affected_rows,
                "recommendation": recommendation,
            }
        )

    required_conv = {"from_ch", "to_ch", "n", "total_revenue"}
    required_nconv = {"from_ch", "to_ch", "n"}
    missing_conv = sorted(required_conv - set(converting.columns))
    missing_nconv = sorted(required_nconv - set(nonconverting.columns))

    add_check(
        "converting_schema",
        "fail" if missing_conv else "pass",
        "high" if missing_conv else "info",
        f"Missing columns: {missing_conv}" if missing_conv else "Required columns present.",
        score=0.0 if missing_conv else 1.0,
        affected_rows=len(converting),
        recommendation="Corrigir schema da query de conversoes." if missing_conv else None,
    )
    add_check(
        "nonconverting_schema",
        "fail" if missing_nconv else "pass",
        "high" if missing_nconv else "info",
        f"Missing columns: {missing_nconv}" if missing_nconv else "Required columns present.",
        score=0.0 if missing_nconv else 1.0,
        affected_rows=len(nonconverting),
        recommendation="Corrigir schema da query de nao-conversoes." if missing_nconv else None,
    )
    add_check(
        "nonconverting_sample",
        "warn" if nonconverting.empty else "pass",
        "medium" if nonconverting.empty else "info",
        "No non-converting transitions available."
        if nonconverting.empty
        else f"{len(nonconverting)} non-converting transition rows.",
        score=0.25 if nonconverting.empty else 1.0,
        affected_rows=len(nonconverting),
        recommendation="Validar amostragem de nao-conversores." if nonconverting.empty else None,
    )

    if observed_conversion_rate is not None:
        delta_pp = abs(model_conversion_rate - observed_conversion_rate) * 100
        add_check(
            "model_calibration",
            "warn" if delta_pp > 1 else "pass",
            "medium" if delta_pp > 1 else "info",
            f"Observed/model conversion-rate delta: {delta_pp:.2f} p.p.",
            score=max(0.0, min(1.0, 1.0 - delta_pp / 10.0)),
            recommendation="Revisar escala de nao-conversores ou janela de lookback." if delta_pp > 1 else None,
        )
    else:
        add_check(
            "model_calibration",
            "warn",
            "medium",
            "Observed conversion rate was not provided.",
            score=0.5,
            recommendation="Disponibilizar taxa observada para calibracao do modelo.",
        )

    spend_channels = set(spend.get("channel", pd.Series(dtype=str)).dropna())
    journey_channels = (
        set(converting.get("from_ch", pd.Series(dtype=str)))
        | set(converting.get("to_ch", pd.Series(dtype=str)))
        | set(nonconverting.get("from_ch", pd.Series(dtype=str)))
        | set(nonconverting.get("to_ch", pd.Series(dtype=str)))
    ) - {"(start)", "Conversion", "Non-Conversion"}
    unmatched_spend = sorted(spend_channels - journey_channels)
    add_check(
        "spend_mapping",
        "warn" if unmatched_spend else "pass",
        "medium" if unmatched_spend else "info",
        f"Spend channels without journey transitions: {unmatched_spend}"
        if unmatched_spend
        else "Spend channels map to observed journeys.",
        score=max(0.0, 1.0 - len(unmatched_spend) / max(len(spend_channels), 1)),
        affected_rows=len(unmatched_spend),
        recommendation="Revisar mapeamento de canais de investimento." if unmatched_spend else None,
    )

    return pd.DataFrame(checks)


def generate_insights(roas_results: pd.DataFrame) -> pd.DataFrame:
    if roas_results.empty:
        return pd.DataFrame(
            columns=["channel", "title", "severity", "recommendation", "limitation"]
        )

    rows = []
    for _, row in roas_results.iterrows():
        recommendation = row.get("recommendation", "Hold / Monitor")
        warning = row.get("presence_warning", "")
        if recommendation == "Hold / Monitor" and not warning:
            continue
        rows.append(
            {
                "channel": row.get("channel"),
                "title": recommendation,
                "severity": "medium" if "Investigate" in recommendation else "info",
                "recommendation": recommendation,
                "limitation": (
                    "Markov/Shapley measure observed behavioral attribution, "
                    "not causal incrementality."
                ),
            }
        )
    return pd.DataFrame(rows)
