"""Derive budget recommendations from persisted channel metrics."""

from __future__ import annotations

import math
from typing import Any

import pandas as pd


TONE_BY_RECOMMENDATION = {
    "Escalar": "green",
    "Defender": "orange",
    "Investigar": "blue",
    "Reduzir": "red",
}


def derive_recommendations(
    channel_rows: list[dict[str, Any]] | pd.DataFrame,
    session_quality_rows: list[dict[str, Any]] | pd.DataFrame | None = None,
    pfc_threshold: float = 0.05,
) -> list[dict[str, Any]]:
    """
    Produce one budget recommendation per channel.

    Rules are intentionally simple for Block 2:
    - Escalar: model consensus, high ROAS, and budget-actionable channel.
    - Defender: meaningful presence or revenue with acceptable ROAS.
    - Investigar: Markov/Shapley conflict or quality/PFC ambiguity.
    - Reduzir: low ROAS, low attribution presence, and weak PFC.
    """

    df = _as_dataframe(channel_rows)
    if df.empty:
        return []

    quality = _quality_by_channel(session_quality_rows)
    total_spend = _num(df, "spend").sum()
    total_revenue = _num(df, "markov_revenue", "attributed_revenue").sum()

    recommendations: list[dict[str, Any]] = []
    for row in df.to_dict("records"):
        channel = str(row.get("channel", ""))
        spend = _float(row.get("spend"))
        markov_weight = _float(row.get("markov_weight", row.get("attribution_weight")))
        shapley_weight = _float(row.get("shapley_weight"))
        roas_markov = _float(row.get("roas_markov"))
        roas_shapley = _float(row.get("roas_shapley"))
        revenue = _float(row.get("markov_revenue", row.get("attributed_revenue")))
        pfc_weight = _float(row.get("pfc_weight"))
        pfc_delta = _float(row.get("pfc_delta_pp"))
        presence = max(
            _float(row.get("conv_presence_share")),
            _float(row.get("nonconv_presence_share")),
        )
        role = str(row.get("channel_role") or "")

        consensus_gap = abs(markov_weight - shapley_weight)
        roas = roas_markov if roas_markov > 0 else roas_shapley
        spend_share = spend / total_spend if total_spend > 0 else 0.0
        revenue_share = revenue / total_revenue if total_revenue > 0 else markov_weight
        saturation_score = _saturation_score(spend_share, revenue_share, roas)
        confidence = _confidence(consensus_gap, presence, roas, quality.get(channel))
        budget_delta_pct = _budget_delta_pct(
            recommendation=_classify(
                spend=spend,
                role=role,
                markov_weight=markov_weight,
                shapley_weight=shapley_weight,
                roas=roas,
                presence=presence,
                pfc_weight=pfc_weight,
                pfc_threshold=pfc_threshold,
            ),
            saturation_score=saturation_score,
            roas=roas,
            pfc_delta=pfc_delta,
        )
        recommendation = _classify(
            spend=spend,
            role=role,
            markov_weight=markov_weight,
            shapley_weight=shapley_weight,
            roas=roas,
            presence=presence,
            pfc_weight=pfc_weight,
            pfc_threshold=pfc_threshold,
        )
        budget_delta_value = spend * budget_delta_pct if spend > 0 else None
        revenue_delta = budget_delta_value * max(roas, 0.0) if budget_delta_value is not None else None

        recommendations.append(
            {
                "channel": channel,
                "recommendation": recommendation,
                "recommendation_tone": TONE_BY_RECOMMENDATION[recommendation],
                "rationale": _rationale(recommendation, roas, markov_weight, shapley_weight, presence),
                "risks": _risks(recommendation, roas, consensus_gap, saturation_score),
                "best_practices": _best_practices(recommendation),
                "suggested_budget_delta_pct": round(budget_delta_pct, 4),
                "suggested_budget_delta_value": _round_optional(budget_delta_value),
                "estimated_revenue_delta": _round_optional(revenue_delta),
                "estimated_roas_min": round(max(roas * 0.85, 0.0), 4) if roas > 0 else None,
                "estimated_roas_max": round(max(roas * 1.10, 0.0), 4) if roas > 0 else None,
                "saturation_score": round(saturation_score, 4),
                "confidence_score": round(confidence, 4),
            }
        )

    recommendations.sort(
        key=lambda item: (
            item["estimated_revenue_delta"] if item["estimated_revenue_delta"] is not None else -math.inf,
            -abs(item["suggested_budget_delta_pct"] or 0.0),
            item["confidence_score"],
        ),
        reverse=True,
    )
    for idx, item in enumerate(recommendations, start=1):
        item["priority_rank"] = idx
    return recommendations


def _classify(
    *,
    spend: float,
    role: str,
    markov_weight: float,
    shapley_weight: float,
    roas: float,
    presence: float,
    pfc_weight: float,
    pfc_threshold: float,
) -> str:
    consensus = markov_weight >= 0.05 and shapley_weight >= 0.05 and abs(markov_weight - shapley_weight) <= 0.06
    conflict = abs(markov_weight - shapley_weight) >= 0.08
    paid = spend > 0 or "Paid" in role or "media" in role.lower()
    low_signal = markov_weight < 0.03 and shapley_weight < 0.03 and presence < 0.12

    if paid and consensus and roas >= 3.0 and "Context" not in role:
        return "Escalar"
    if low_signal and roas < 1.5 and pfc_weight < pfc_threshold:
        return "Reduzir"
    if conflict or pfc_weight >= pfc_threshold * 1.8:
        return "Investigar"
    if presence >= 0.15 or shapley_weight >= 0.05 or roas >= 2.0:
        return "Defender"
    return "Investigar"


def _budget_delta_pct(
    *,
    recommendation: str,
    saturation_score: float,
    roas: float,
    pfc_delta: float,
) -> float:
    if recommendation == "Escalar":
        upside = 0.30 - min(max(saturation_score, 0.0), 1.0) * 0.15
        if pfc_delta > 0:
            upside += 0.03
        return min(0.30, max(0.15, upside))
    if recommendation == "Reduzir":
        severity = 0.20 + max(0.0, 1.5 - roas) / 1.5 * 0.30
        return -min(0.50, max(0.20, severity))
    return 0.0


def _saturation_score(spend_share: float, revenue_share: float, roas: float) -> float:
    if spend_share <= 0:
        return 0.15
    pressure = spend_share / max(revenue_share, 0.01)
    roas_drag = 1.0 / max(roas, 1.0)
    return max(0.0, min(1.0, 0.65 * min(pressure, 1.0) + 0.35 * roas_drag))


def _confidence(consensus_gap: float, presence: float, roas: float, quality: float | None) -> float:
    agreement = max(0.0, 1.0 - consensus_gap * 5.0)
    support = min(1.0, presence / 0.25) if presence > 0 else 0.45
    efficiency = min(1.0, roas / 4.0) if roas > 0 else 0.35
    quality_score = quality if quality is not None else 0.70
    return 0.40 * agreement + 0.25 * support + 0.20 * efficiency + 0.15 * quality_score


def _rationale(recommendation: str, roas: float, markov_weight: float, shapley_weight: float, presence: float) -> list[str]:
    return [
        f"ROAS Markov estimado em {roas:.2f}x." if roas > 0 else "Sem ROAS material calculado para o canal.",
        f"Peso Markov de {markov_weight:.1%} e Shapley de {shapley_weight:.1%}.",
        f"Presenca maxima na jornada de {presence:.1%}.",
        _recommendation_reason(recommendation),
    ]


def _recommendation_reason(recommendation: str) -> str:
    return {
        "Escalar": "Consenso e eficiencia sustentam aumento gradual de verba.",
        "Defender": "Canal relevante para a jornada; preservar antes de realocar.",
        "Investigar": "Sinais entre modelos ou qualidade pedem validacao adicional.",
        "Reduzir": "Baixa eficiencia e baixo sinal justificam reducao controlada.",
    }[recommendation]


def _risks(recommendation: str, roas: float, consensus_gap: float, saturation_score: float) -> list[str]:
    base = [
        f"Divergencia Markov/Shapley de {consensus_gap:.1%}.",
        f"Saturacao estimada em {saturation_score:.0%}.",
    ]
    if recommendation == "Escalar":
        return base + ["Escala rapida pode reduzir ROAS marginal.", "Monitorar frequencia e incrementalidade."]
    if recommendation == "Reduzir":
        return base + ["Corte brusco pode afetar funil assistido.", "Validar sazonalidade antes de realocar tudo."]
    if recommendation == "Investigar":
        return base + ["Tracking ou composicao de audiencia pode distorcer o sinal.", "Evitar mudanca grande ate fechar diagnostico."]
    return base + [f"ROAS atual de {roas:.2f}x ainda precisa ser monitorado.", "Reduzir pode remover suporte indireto a conversao."]


def _best_practices(recommendation: str) -> list[str]:
    return {
        "Escalar": [
            "Aumentar verba em etapas semanais.",
            "Separar testes de incrementalidade.",
            "Monitorar ROAS marginal por campanha.",
        ],
        "Defender": [
            "Manter cobertura atual.",
            "Acompanhar quedas de presenca em jornadas convertidas.",
            "Testar melhorias de criativo sem reduzir verba base.",
        ],
        "Investigar": [
            "Auditar UTMs, eventos e janelas de atribuicao.",
            "Comparar cortes por audiencia e campanha.",
            "Rodar cenario antes de alterar budget.",
        ],
        "Reduzir": [
            "Reduzir gradualmente e medir impacto.",
            "Realocar para canais com consenso maior.",
            "Preservar campanhas com papel claro no funil.",
        ],
    }[recommendation]


def _quality_by_channel(rows: list[dict[str, Any]] | pd.DataFrame | None) -> dict[str, float]:
    df = _as_dataframe(rows)
    if df.empty or "channel" not in df.columns:
        return {}
    quality: dict[str, float] = {}
    for row in df.to_dict("records"):
        bounce = _float(row.get("avg_bounce_rate"))
        duration = _float(row.get("avg_duration_s"))
        pageviews = _float(row.get("avg_pageviews"))
        score = 0.55
        if duration > 0:
            score += min(duration / 180.0, 1.0) * 0.20
        if pageviews > 0:
            score += min(pageviews / 4.0, 1.0) * 0.15
        if bounce > 0:
            score += (1.0 - min(bounce, 1.0)) * 0.10
        quality[str(row["channel"])] = max(0.0, min(1.0, score))
    return quality


def _as_dataframe(rows: list[dict[str, Any]] | pd.DataFrame | None) -> pd.DataFrame:
    if rows is None:
        return pd.DataFrame()
    if isinstance(rows, pd.DataFrame):
        return rows.copy()
    return pd.DataFrame(rows)


def _num(df: pd.DataFrame, column: str, fallback: str | None = None) -> pd.Series:
    source = column if column in df.columns else fallback
    if not source or source not in df.columns:
        return pd.Series([0.0] * len(df))
    return pd.to_numeric(df[source], errors="coerce").fillna(0.0)


def _float(value: Any) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return 0.0
    return parsed if math.isfinite(parsed) else 0.0


def _round_optional(value: float | None) -> float | None:
    return round(value, 2) if value is not None and math.isfinite(value) else None
