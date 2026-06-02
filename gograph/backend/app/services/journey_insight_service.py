"""Sprint 5 journey touchpoint and insight analytics."""

from __future__ import annotations

from typing import Any

import pandas as pd


SPECIAL_STATES = {"(start)", "Conversion", "Non-Conversion"}


def compute_touchpoint_metrics(transition_counts: pd.DataFrame) -> pd.DataFrame:
    """
    Compute channel touchpoint metrics from persisted transition counts.

    These are transition-based shares, not user-level path-presence shares. A
    later path table can replace/augment them with exact journey containment.
    """
    if transition_counts.empty:
        return pd.DataFrame(columns=_touchpoint_columns())

    df = transition_counts.copy()
    df["n"] = pd.to_numeric(df["n"], errors="coerce").fillna(0.0)
    df = df.rename(columns={"from_state": "from_ch", "to_state": "to_ch"})
    channels = sorted(
        (
            set(df["from_ch"].dropna().astype(str))
            | set(df["to_ch"].dropna().astype(str))
        )
        - SPECIAL_STATES
    )
    rows = pd.DataFrame({"channel": channels})

    metrics = [
        _share(df, "converting", df["from_ch"] == "(start)", "to_ch", "conv_first_touch_share"),
        _share(df, "converting", _middle_mask(df, "converting"), "to_ch", "conv_middle_touch_share"),
        _share(df, "converting", df["to_ch"] == "Conversion", "from_ch", "conv_last_touch_share"),
        _share(df, "nonconverting", df["from_ch"] == "(start)", "to_ch", "nonconv_first_touch_share"),
        _share(df, "nonconverting", _middle_mask(df, "nonconverting"), "to_ch", "nonconv_middle_touch_share"),
        _share(df, "nonconverting", df["to_ch"] == "Non-Conversion", "from_ch", "nonconv_last_touch_share"),
        _count(df, "converting", df["from_ch"] == "(start)", "to_ch", "starter_count"),
        _count(df, "converting", _middle_mask(df, "converting"), "to_ch", "assist_count"),
        _count(df, "converting", df["to_ch"] == "Conversion", "from_ch", "closer_count"),
        _dropoff_after_touch(df),
    ]

    result = rows
    for metric in metrics:
        result = result.merge(metric, on="channel", how="left")

    for column in _touchpoint_columns():
        if column not in result.columns:
            result[column] = 0.0 if column != "channel" else ""
    numeric_cols = [column for column in result.columns if column != "channel"]
    result[numeric_cols] = result[numeric_cols].fillna(0.0)
    result["touchpoint_role"] = result.apply(_classify_touchpoint_role, axis=1)
    return result[_touchpoint_columns() + ["touchpoint_role"]]


def generate_channel_insights(
    attribution_results: pd.DataFrame,
    touchpoints: pd.DataFrame,
) -> pd.DataFrame:
    if attribution_results.empty and touchpoints.empty:
        return pd.DataFrame(columns=_insight_columns())

    attribution = attribution_results.copy()
    if "channel" not in attribution.columns:
        attribution["channel"] = ""
    combined = touchpoints.merge(attribution, on="channel", how="outer").fillna(0.0)

    rows: list[dict[str, Any]] = []
    for _, row in combined.iterrows():
        channel = str(row["channel"])
        markov = float(row.get("markov_weight", 0.0) or 0.0)
        shapley = float(row.get("shapley_weight", 0.0) or 0.0)
        spend = float(row.get("spend", 0.0) or 0.0)
        roas_markov = row.get("roas_markov")
        conv_first = float(row.get("conv_first_touch_share", 0.0) or 0.0)
        conv_middle = float(row.get("conv_middle_touch_share", 0.0) or 0.0)
        conv_last = float(row.get("conv_last_touch_share", 0.0) or 0.0)
        nonconv_first = float(row.get("nonconv_first_touch_share", 0.0) or 0.0)
        nonconv_last = float(row.get("nonconv_last_touch_share", 0.0) or 0.0)
        total_signal = markov + shapley

        if conv_last >= 0.20 and total_signal >= 0.05:
            rows.append(
                _insight(
                    channel,
                    "Conversion Closer",
                    "Canal aparece com força como último toque antes de conversão.",
                    f"last_touch_convertido={conv_last:.2%}; markov={markov:.2%}; shapley={shapley:.2%}",
                    "conv_last_touch_share",
                    "medium",
                    _confidence(markov, shapley, conv_last),
                    "Proteger leitura de fechamento, mas validar incrementalidade antes de aumentar verba.",
                )
            )

        if conv_middle >= 0.20 and shapley > markov:
            rows.append(
                _insight(
                    channel,
                    "Assist Channel",
                    "Canal tem papel intermediário e Shapley acima de Markov.",
                    f"middle_convertido={conv_middle:.2%}; delta_shapley_markov={(shapley - markov):.2%}",
                    "conv_middle_touch_share",
                    "medium",
                    _confidence(markov, shapley, conv_middle),
                    "Avaliar como canal de assistência, nao apenas por ROAS direto.",
                )
            )

        if conv_first >= 0.20:
            rows.append(
                _insight(
                    channel,
                    "Initial Touchpoint",
                    "Canal inicia parcela relevante das jornadas convertidas.",
                    f"first_touch_convertido={conv_first:.2%}",
                    "conv_first_touch_share",
                    "info",
                    _confidence(markov, shapley, conv_first),
                    "Usar para leitura de aquisição; comparar com first touch não-convertido.",
                )
            )

        if nonconv_first >= 0.25 or nonconv_last >= 0.25:
            rows.append(
                _insight(
                    channel,
                    "Investigate Dropoff",
                    "Canal aparece com força em jornadas não-convertidas.",
                    f"first_nonconv={nonconv_first:.2%}; last_nonconv={nonconv_last:.2%}",
                    "nonconv_touch_share",
                    "high" if total_signal < 0.03 else "medium",
                    _confidence(markov, shapley, max(nonconv_first, nonconv_last)),
                    "Investigar qualidade de tráfego, tracking ou etapa de abandono antes de cortar verba.",
                )
            )

        if spend > 0 and total_signal < 0.01:
            rows.append(
                _insight(
                    channel,
                    "Low Support / Zero Attribution",
                    "Canal tem spend, mas baixo valor atribuído pelos modelos.",
                    f"spend={spend:.2f}; markov={markov:.2%}; shapley={shapley:.2%}",
                    "markov_weight + shapley_weight",
                    "medium",
                    "Low",
                    "Tratar como hipótese de baixa contribuição observada; validar com volume, tracking e lift test.",
                )
            )

        if spend > 0 and _is_number(roas_markov) and float(roas_markov) >= 3 and total_signal >= 0.05:
            rows.append(
                _insight(
                    channel,
                    "Scale Up",
                    "Canal pago tem ROAS Markov alto e sinal atribuído material.",
                    f"roas_markov={float(roas_markov):.2f}; markov={markov:.2%}; shapley={shapley:.2%}",
                    "roas_markov",
                    "medium",
                    _confidence(markov, shapley, max(conv_first, conv_middle, conv_last)),
                    "Escalar com cautela e monitorar incrementalidade.",
                )
            )

    if not rows:
        return pd.DataFrame(columns=_insight_columns())
    return pd.DataFrame(rows).sort_values(["severity", "confidence"], ascending=[True, True])


def _middle_mask(df: pd.DataFrame, transition_type: str) -> pd.Series:
    return (
        (df["transition_type"] == transition_type)
        & (df["from_ch"] != "(start)")
        & (~df["to_ch"].isin(["Conversion", "Non-Conversion"]))
    )


def _share(
    df: pd.DataFrame,
    transition_type: str,
    mask: pd.Series,
    group_col: str,
    name: str,
) -> pd.DataFrame:
    subset = df[(df["transition_type"] == transition_type) & mask].copy()
    total = subset["n"].sum()
    if total <= 0:
        return pd.DataFrame({"channel": [], name: []})
    grouped = subset.groupby(group_col, as_index=False)["n"].sum()
    grouped = grouped.rename(columns={group_col: "channel", "n": name})
    grouped[name] = grouped[name] / total
    return grouped


def _count(
    df: pd.DataFrame,
    transition_type: str,
    mask: pd.Series,
    group_col: str,
    name: str,
) -> pd.DataFrame:
    subset = df[(df["transition_type"] == transition_type) & mask].copy()
    grouped = subset.groupby(group_col, as_index=False)["n"].sum()
    return grouped.rename(columns={group_col: "channel", "n": name})


def _dropoff_after_touch(df: pd.DataFrame) -> pd.DataFrame:
    outgoing = df[~df["from_ch"].isin(SPECIAL_STATES)].copy()
    total = outgoing.groupby("from_ch", as_index=False)["n"].sum()
    total = total.rename(columns={"from_ch": "channel", "n": "_outgoing"})
    dropoff = outgoing[outgoing["to_ch"] == "Non-Conversion"].groupby("from_ch", as_index=False)["n"].sum()
    dropoff = dropoff.rename(columns={"from_ch": "channel", "n": "_dropoff"})
    merged = total.merge(dropoff, on="channel", how="left").fillna(0.0)
    merged["dropoff_after_touch"] = merged["_dropoff"] / merged["_outgoing"].replace(0, pd.NA)
    return merged[["channel", "dropoff_after_touch"]].fillna(0.0)


def _classify_touchpoint_role(row: pd.Series) -> str:
    scores = {
        "Aquisicao": row["conv_first_touch_share"],
        "Assistencia": row["conv_middle_touch_share"],
        "Fechamento": row["conv_last_touch_share"],
    }
    role = max(scores, key=scores.get)
    if scores[role] == 0:
        return "Sem papel dominante"
    return role


def _confidence(markov: float, shapley: float, support: float) -> str:
    if support >= 0.20 and max(markov, shapley) >= 0.05:
        return "High"
    if support >= 0.05 or max(markov, shapley) >= 0.02:
        return "Medium"
    return "Low"


def _insight(
    channel: str,
    title: str,
    description: str,
    evidence: str,
    metric: str,
    severity: str,
    confidence: str,
    recommendation: str,
) -> dict[str, str]:
    return {
        "channel": channel,
        "title": title,
        "description": description,
        "evidence": evidence,
        "metric": metric,
        "severity": severity,
        "confidence": confidence,
        "recommendation": recommendation,
        "limitation": "Markov/Shapley medem atribuicao comportamental observada, nao incrementalidade causal.",
    }


def _is_number(value: Any) -> bool:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return False
    return pd.notna(numeric)


def _touchpoint_columns() -> list[str]:
    return [
        "channel",
        "conv_first_touch_share",
        "conv_middle_touch_share",
        "conv_last_touch_share",
        "nonconv_first_touch_share",
        "nonconv_middle_touch_share",
        "nonconv_last_touch_share",
        "starter_count",
        "assist_count",
        "closer_count",
        "dropoff_after_touch",
    ]


def _insight_columns() -> list[str]:
    return [
        "channel",
        "title",
        "description",
        "evidence",
        "metric",
        "severity",
        "confidence",
        "recommendation",
        "limitation",
    ]
