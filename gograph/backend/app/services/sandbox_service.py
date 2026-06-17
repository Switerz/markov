"""Sandbox service: CRUD for scenarios and path-metric analysis."""

from __future__ import annotations

import json
import math
from typing import Any, Optional

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from gograph.backend.app.db.models import (
    ModelRun,
    Scenario,
    ScenarioAnalysis,
    ScenarioGraph,
    utcnow,
)
from gograph.backend.app.services.code_version_service import get_code_version
from gograph.backend.app.services.persistence_service import (
    get_model_run_table,
)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def create_scenario(
    model_run_id: int,
    name: str,
    description: Optional[str],
    nodes: list[dict],
    edges: list[dict],
    path_channels: list[str],
    session: Session,
    action_type: str = "path",
    channel: Optional[str] = None,
    intensity_pct: Optional[float] = None,
    period_start: Any = None,
    period_end: Any = None,
) -> dict[str, Any]:
    _validate_action_payload(action_type, channel, intensity_pct)
    scenario = Scenario(
        model_run_id=model_run_id,
        name=name,
        description=description,
        action_type=action_type,
        channel=channel,
        intensity_pct=intensity_pct,
        period_start=period_start,
        period_end=period_end,
    )
    session.add(scenario)
    session.flush()
    graph = ScenarioGraph(
        scenario_id=scenario.id,
        nodes_json=json.dumps(nodes),
        edges_json=json.dumps(edges),
        path_channels_json=json.dumps(path_channels),
    )
    session.add(graph)
    session.flush()
    scenario.graph = graph
    return _scenario_to_dict(scenario)


def list_scenarios(
    model_run_id: int,
    session: Session,
) -> list[dict[str, Any]]:
    stmt = (
        select(Scenario)
        .where(Scenario.model_run_id == model_run_id)
        .order_by(Scenario.created_at.desc())
    )
    rows = session.execute(stmt).scalars().all()
    return [_scenario_to_dict(r) for r in rows]


def get_scenario(scenario_id: int, session: Session) -> Optional[dict[str, Any]]:
    row = session.get(Scenario, scenario_id)
    return _scenario_to_dict(row) if row else None


def update_scenario(
    scenario_id: int,
    name: Optional[str],
    description: Optional[str],
    nodes: Optional[list[dict]],
    edges: Optional[list[dict]],
    path_channels: Optional[list[str]],
    session: Session,
    action_type: Optional[str] = None,
    channel: Optional[str] = None,
    intensity_pct: Optional[float] = None,
    period_start: Any = None,
    period_end: Any = None,
) -> Optional[dict[str, Any]]:
    row = session.get(Scenario, scenario_id)
    if row is None:
        return None
    graph = _ensure_graph(row, session)
    next_action_type = action_type or row.action_type
    next_channel = channel if channel is not None else row.channel
    next_intensity_pct = intensity_pct if intensity_pct is not None else row.intensity_pct
    _validate_action_payload(next_action_type, next_channel, next_intensity_pct)
    if name is not None:
        row.name = name
    if description is not None:
        row.description = description
    if action_type is not None:
        row.action_type = action_type
    if channel is not None:
        row.channel = channel
    if intensity_pct is not None:
        row.intensity_pct = intensity_pct
    if period_start is not None:
        row.period_start = period_start
    if period_end is not None:
        row.period_end = period_end
    if nodes is not None:
        graph.nodes_json = json.dumps(nodes)
    if edges is not None:
        graph.edges_json = json.dumps(edges)
    if path_channels is not None:
        graph.path_channels_json = json.dumps(path_channels)
    session.flush()
    return _scenario_to_dict(row)


def delete_scenario(scenario_id: int, session: Session) -> bool:
    row = session.get(Scenario, scenario_id)
    if row is None:
        return False
    session.delete(row)
    session.flush()
    return True


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def analyze_scenario(scenario_id: int, session: Session) -> dict[str, Any]:
    """
    Compute path metrics for a saved scenario using the attached model run's
    transition matrix, attribution results and path summary.
    """
    row = session.get(Scenario, scenario_id)
    if row is None:
        raise ValueError(f"Scenario {scenario_id} not found.")

    graph = _ensure_graph(row, session)
    path_channels: list[str] = _json_str_list(graph.path_channels_json)
    model_run_id: int = row.model_run_id

    matrix_df      = get_model_run_table(model_run_id, "transition_matrix", session=session)
    paths_df       = get_model_run_table(model_run_id, "path_summary",      session=session)
    transitions_df = get_model_run_table(model_run_id, "transition_counts", session=session)

    model_run = session.get(ModelRun, model_run_id)
    baseline_conv_rate = float(model_run.observed_conversion_rate or 0.0) if model_run else 0.0
    model_total_rev    = float(model_run.total_revenue) if model_run else 0.0

    result = _analyze_path_channels(
        path_channels, matrix_df, paths_df, transitions_df,
        baseline_conv_rate, model_total_rev,
    )
    result["scenario_id"] = scenario_id
    result["model_run_id"] = model_run_id
    result["code_version"] = get_code_version()
    result["analyzed_at"] = utcnow()
    _upsert_analysis(row, result, session)
    session.flush()
    result["analyzed_at"] = result["analyzed_at"].isoformat()
    return result


# ---------------------------------------------------------------------------
# Compare
# ---------------------------------------------------------------------------

def compare_scenarios(
    model_run_id: int,
    scenario_ids: list[int],
    include_baseline: bool,
    include_top_path: bool,
    session: Session,
    baseline_run_id: Optional[int] = None,
    compare_run_id: Optional[int] = None,
) -> dict[str, Any]:
    """Compare persisted scenario analyses and optional baseline / top real path."""

    if not scenario_ids and not include_baseline and not include_top_path:
        raise ValueError("Forneça pelo menos um cenário ou ative baseline/top_path.")

    model_run = session.get(ModelRun, model_run_id)
    if model_run is None:
        raise ValueError(f"ModelRun {model_run_id} não encontrado.")

    metrics_run_id = compare_run_id or baseline_run_id or model_run_id
    metrics_run = session.get(ModelRun, metrics_run_id)
    if metrics_run is None:
        raise ValueError(f"ModelRun {metrics_run_id} não encontrado.")

    baseline_conv_rate = float(metrics_run.observed_conversion_rate or 0.0)
    model_total_rev    = float(metrics_run.total_revenue or 0.0)

    matrix_df      = get_model_run_table(metrics_run_id, "transition_matrix", session=session)
    paths_df       = get_model_run_table(metrics_run_id, "path_summary",      session=session)
    transitions_df = get_model_run_table(metrics_run_id, "transition_counts", session=session)

    items: list[dict] = []

    for sid in scenario_ids:
        row = session.get(Scenario, sid)
        if row is None:
            raise ValueError(f"Cenário {sid} não encontrado.")
        if row.model_run_id != model_run_id:
            raise ValueError(
                f"Cenário {sid} pertence ao model run {row.model_run_id}, não {model_run_id}."
            )
        if row.analysis is None:
            graph = _ensure_graph(row, session)
            items.append(_missing_analysis_item(row, _json_str_list(graph.path_channels_json)))
        else:
            items.append(_analysis_compare_item(row))

    if include_baseline:
        items.append(_get_baseline_item(matrix_df, paths_df, transitions_df, baseline_conv_rate, model_total_rev))

    if include_top_path:
        top = _get_top_real_path_item(matrix_df, paths_df, transitions_df, baseline_conv_rate, model_total_rev)
        if top:
            items.append(top)

    if len(items) < 2:
        raise ValueError(
            f"Comparação requer pelo menos 2 itens; apenas {len(items)} disponível(is)."
        )

    winner_conversion = _find_winner(items, "composite_conversion_probability")
    winner_revenue    = _find_winner(items, "expected_revenue")
    winner_confidence = _find_winner(items, "confidence_score")
    delta = _compute_delta(items[0], items[1]) if len(items) == 2 else None

    return {
        "items": items,
        "winner_conversion": winner_conversion,
        "winner_revenue": winner_revenue,
        "winner_confidence": winner_confidence,
        "delta": delta,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

# Keys shared between ScenarioAnalysisResponse and ScenarioCompareItem
_COMPARE_KEYS = (
    "path_channels",
    "path_probability",
    "composite_conversion_probability",
    "historical_conversion_rate",
    "lift",
    "expected_revenue",
    "expected_ticket",
    "historical_support",
    "confidence_score",
    "warnings",
)


def _analyze_path_channels(
    path_channels: list[str],
    matrix_df: pd.DataFrame,
    paths_df: pd.DataFrame,
    transitions_df: pd.DataFrame,
    baseline_conv_rate: float,
    model_total_rev: float,
) -> dict[str, Any]:
    """Core path analysis; returns metrics dict without scenario_id."""
    warnings: list[str] = []

    if not path_channels:
        warnings.append("Nenhum canal definido no cenário.")
        return _empty_result(warnings)

    known_states: set[str] = set()
    if not matrix_df.empty:
        known_states = set(matrix_df["from_state"]) | set(matrix_df["to_state"])
    for ch in path_channels:
        if ch not in known_states:
            warnings.append(f"Canal hipotético ou sem dados: '{ch}'")

    path_prob       = _path_probability(path_channels, matrix_df)
    conv_given_last = _conv_prob_given_last(path_channels[-1], matrix_df)
    path_to_last    = _path_probability_no_conv(path_channels, matrix_df)
    conv_from_last  = _conv_prob_eventually(path_channels[-1], matrix_df)
    composite       = path_to_last * conv_from_last

    global_avg_ticket = _avg_ticket_from_transitions(transitions_df, model_total_rev) \
        or _avg_ticket_from_paths(paths_df, model_total_rev)

    historical_support, similar = _historical_support(path_channels, paths_df)
    avg_ticket = _avg_ticket_from_similar(similar) or global_avg_ticket
    hist_conv_rate = _historical_conversion_rate(similar)

    expected_revenue = (
        float(historical_support) * hist_conv_rate * avg_ticket
        if historical_support > 0 and hist_conv_rate > 0 and avg_ticket > 0
        else None
    )
    lift = _clean(hist_conv_rate / baseline_conv_rate) if baseline_conv_rate > 0 and hist_conv_rate > 0 else None

    if path_prob == 0.0 and not warnings:
        warnings.append(
            "Probabilidade de cadeia zero — alguma transição neste caminho não existe na matriz. "
            "Use o suporte histórico como principal métrica."
        )
    if historical_support == 0:
        warnings.append(
            "Sem suporte histórico armazenado para este padrão. "
            "Rode o modelo novamente para persistir mais caminhos (top 500)."
        )
    elif hist_conv_rate is not None and hist_conv_rate > 0.5 and historical_support < 200:
        warnings.append(
            f"Taxa de conversão histórica alta ({hist_conv_rate:.0%}) baseada em amostra pequena "
            f"({historical_support} jornadas) — interprete com cautela."
        )

    confidence = _confidence_score(path_prob, historical_support)

    return {
        "path_channels": path_channels,
        "path_probability": _clean(path_prob),
        "conversion_probability_given_last_node": _clean(conv_given_last),
        "composite_conversion_probability": _clean(composite),
        "historical_conversion_rate": _clean(hist_conv_rate) if hist_conv_rate > 0 else None,
        "lift": lift,
        "expected_revenue": _clean(expected_revenue),
        "expected_ticket": _clean(avg_ticket) if avg_ticket > 0 else None,
        "historical_support": historical_support,
        "similar_paths": similar,
        "warnings": warnings,
        "confidence_score": _clean(confidence),
    }


def _get_baseline_item(
    matrix_df: pd.DataFrame,
    paths_df: pd.DataFrame,
    transitions_df: pd.DataFrame,
    baseline_conv_rate: float,
    model_total_rev: float,
) -> dict[str, Any]:
    avg_ticket = _avg_ticket_from_transitions(transitions_df, model_total_rev) \
        or _avg_ticket_from_paths(paths_df, model_total_rev)
    total_sessions = (
        int(paths_df["count"].sum())
        if not paths_df.empty and "count" in paths_df.columns
        else 0
    )
    return {
        "source": "baseline",
        "scenario_id": None,
        "name": "Baseline (modelo atual)",
        "path_channels": [],
        "path_probability": None,
        "composite_conversion_probability": baseline_conv_rate if baseline_conv_rate > 0 else None,
        "historical_conversion_rate": baseline_conv_rate if baseline_conv_rate > 0 else None,
        "lift": 1.0,
        "expected_revenue": model_total_rev if model_total_rev > 0 else None,
        "expected_ticket": _clean(avg_ticket) if avg_ticket > 0 else None,
        "historical_support": total_sessions,
        "confidence_score": 1.0,
        "warnings": [],
    }


def _get_top_real_path_item(
    matrix_df: pd.DataFrame,
    paths_df: pd.DataFrame,
    transitions_df: pd.DataFrame,
    baseline_conv_rate: float,
    model_total_rev: float,
) -> Optional[dict[str, Any]]:
    if paths_df.empty or "path_text" not in paths_df.columns:
        return None
    sort_col = "conversion_count" if "conversion_count" in paths_df.columns else "count"
    top_row = paths_df.sort_values(sort_col, ascending=False).iloc[0]
    path_text = str(top_row.get("path_text", ""))
    path_channels = [
        n.strip() for n in path_text.split(" -> ")
        if n.strip() not in ("(start)", "Conversion", "Non-Conversion", "")
    ]
    if not path_channels:
        return None
    metrics = _analyze_path_channels(
        path_channels, matrix_df, paths_df, transitions_df,
        baseline_conv_rate, model_total_rev,
    )
    return {
        "source": "top_real_path",
        "scenario_id": None,
        "name": "Top Caminho Real",
        **{k: metrics[k] for k in _COMPARE_KEYS},
    }


def _find_winner(items: list[dict], key: str) -> Optional[str]:
    valid = [(item["name"], item[key]) for item in items if item.get(key) is not None]
    if not valid:
        return None
    return max(valid, key=lambda x: x[1])[0]


def _compute_delta(a: dict, b: dict) -> dict[str, Any]:
    """Delta = B − A (second item minus first item)."""
    def safe_delta(key: str) -> Optional[float]:
        av, bv = a.get(key), b.get(key)
        return _clean(bv - av) if av is not None and bv is not None else None

    def safe_pct(key: str) -> Optional[float]:
        av, bv = a.get(key), b.get(key)
        if av is None or bv is None or av == 0:
            return None
        return _clean((bv - av) / abs(av) * 100)

    return {
        "composite_conversion_delta": safe_delta("composite_conversion_probability"),
        "composite_conversion_pct": safe_pct("composite_conversion_probability"),
        "expected_revenue_delta": safe_delta("expected_revenue"),
        "expected_revenue_pct": safe_pct("expected_revenue"),
        "confidence_delta": safe_delta("confidence_score"),
        "historical_support_delta": safe_delta("historical_support"),
    }


def _validate_action_payload(
    action_type: str,
    channel: Optional[str],
    intensity_pct: Optional[float],
) -> None:
    allowed = {"removeChannel", "reducePresence", "redistributeBudget", "compareModels", "path"}
    if action_type not in allowed:
        raise ValueError(f"Tipo de cenário inválido: {action_type}.")
    if action_type == "removeChannel" and not channel:
        raise ValueError("channel é obrigatório para removeChannel.")
    if action_type == "reducePresence" and (not channel or intensity_pct is None):
        raise ValueError("channel e intensity_pct são obrigatórios para reducePresence.")


def _ensure_graph(row: Scenario, session: Session) -> ScenarioGraph:
    graph = row.graph
    if graph is None:
        graph = ScenarioGraph(
            scenario_id=row.id,
            nodes_json="[]",
            edges_json="[]",
            path_channels_json="[]",
        )
        session.add(graph)
        session.flush()
        row.graph = graph
    return graph


def _upsert_analysis(row: Scenario, result: dict[str, Any], session: Session) -> None:
    analysis = row.analysis
    if analysis is None:
        analysis = ScenarioAnalysis(scenario_id=row.id)
        session.add(analysis)
        row.analysis = analysis

    analysis.model_run_id = row.model_run_id
    analysis.code_version = str(result["code_version"])
    analysis.analyzed_at = result["analyzed_at"]
    analysis.path_probability = result["path_probability"]
    analysis.conversion_probability_given_last_node = result[
        "conversion_probability_given_last_node"
    ]
    analysis.composite_conversion_probability = result["composite_conversion_probability"]
    analysis.historical_conversion_rate = result["historical_conversion_rate"]
    analysis.lift = result["lift"]
    analysis.expected_revenue = result["expected_revenue"]
    analysis.expected_ticket = result["expected_ticket"]
    analysis.historical_support = int(result["historical_support"] or 0)
    analysis.confidence_score = result["confidence_score"]
    analysis.warnings_json = json.dumps(result["warnings"])
    analysis.similar_paths_json = json.dumps(result["similar_paths"])


def _analysis_compare_item(row: Scenario) -> dict[str, Any]:
    analysis = row.analysis
    graph = row.graph
    assert analysis is not None
    return {
        "source": "scenario",
        "scenario_id": row.id,
        "name": row.name,
        "path_channels": _json_str_list(graph.path_channels_json if graph else "[]"),
        "path_probability": analysis.path_probability,
        "composite_conversion_probability": analysis.composite_conversion_probability,
        "historical_conversion_rate": analysis.historical_conversion_rate,
        "lift": analysis.lift,
        "expected_revenue": analysis.expected_revenue,
        "expected_ticket": analysis.expected_ticket,
        "historical_support": analysis.historical_support,
        "confidence_score": analysis.confidence_score,
        "warnings": _json_str_list(analysis.warnings_json),
    }


def _missing_analysis_item(row: Scenario, path_channels: list[str]) -> dict[str, Any]:
    return {
        "source": "scenario",
        "scenario_id": row.id,
        "name": row.name,
        "path_channels": path_channels,
        "path_probability": None,
        "composite_conversion_probability": None,
        "historical_conversion_rate": None,
        "lift": None,
        "expected_revenue": None,
        "expected_ticket": None,
        "historical_support": 0,
        "confidence_score": None,
        "warnings": ["Cenário ainda não analisado."],
    }


def _path_probability(channels: list[str], matrix: pd.DataFrame) -> float:
    """P((start)→ch1→...→chN→Conversion) — full chain."""
    if matrix.empty:
        return 0.0
    full = ["(start)"] + channels + ["Conversion"]
    prob = 1.0
    for i in range(len(full) - 1):
        p = _lookup(full[i], full[i + 1], matrix)
        if p == 0.0:
            return 0.0
        prob *= p
    return prob


def _path_probability_no_conv(channels: list[str], matrix: pd.DataFrame) -> float:
    """P((start)→ch1→...→chN) — stops at last channel."""
    if matrix.empty or not channels:
        return 0.0
    full = ["(start)"] + channels
    prob = 1.0
    for i in range(len(full) - 1):
        p = _lookup(full[i], full[i + 1], matrix)
        if p == 0.0:
            return 0.0
        prob *= p
    return prob


def _conv_prob_given_last(last_channel: str, matrix: pd.DataFrame) -> float:
    """P(Conversion | last_channel) — single transition step."""
    return _lookup(last_channel, "Conversion", matrix)


def _conv_prob_eventually(last_channel: str, matrix: pd.DataFrame) -> float:
    """
    P(eventually reaching Conversion | currently at last_channel).
    Approximated by summing all paths last_channel → ... → Conversion in the matrix.
    We use a power-series approach: iterate up to 20 hops.
    """
    if matrix.empty:
        return 0.0
    prob_lookup = _build_lookup(matrix)
    states = sorted(set(matrix["from_state"]) | set(matrix["to_state"]))
    if last_channel not in states:
        return 0.0

    # State vector: start with 1.0 at last_channel
    v = {s: 0.0 for s in states}
    v[last_channel] = 1.0
    conv_absorbed = 0.0

    for _ in range(40):
        new_v = {s: 0.0 for s in states}
        for from_s, mass in v.items():
            if mass < 1e-12 or from_s in ("Conversion", "Non-Conversion"):
                continue
            for to_s in states:
                p = prob_lookup.get((from_s, to_s), 0.0)
                if to_s == "Conversion":
                    conv_absorbed += mass * p
                elif to_s != "Non-Conversion":
                    new_v[to_s] += mass * p
        v = new_v
        if sum(v.values()) < 1e-10:
            break

    return min(conv_absorbed, 1.0)


def _avg_ticket_from_similar(similar: list[dict]) -> float:
    """Weighted avg ticket from similar historical paths (revenue / conversions)."""
    total_rev  = sum(p["revenue"]          for p in similar if p.get("revenue"))
    total_conv = sum(p["conversion_count"] for p in similar if p.get("conversion_count"))
    return total_rev / total_conv if total_conv > 0 else 0.0


def _avg_ticket_from_transitions(transitions_df: pd.DataFrame, model_total_rev: float) -> float:
    """
    Avg ticket = model_total_revenue / n_converting_sessions.
    n_converting_sessions ≈ sum(n) of converting transitions that lead to Conversion
    (decay-weighted count, so approximately equal to number of converters).
    """
    if transitions_df.empty or model_total_rev <= 0:
        return 0.0
    mask = (
        (transitions_df.get("to_state", pd.Series(dtype=str)) == "Conversion") &
        (transitions_df.get("transition_type", pd.Series(dtype=str)) == "converting")
    )
    n_conv = float(transitions_df.loc[mask, "n"].fillna(0).sum()) if mask.any() else 0.0
    return model_total_rev / n_conv if n_conv > 0 else 0.0


def _avg_ticket_from_paths(paths_df: pd.DataFrame, model_total_rev: float) -> float:
    """Fallback: avg ticket from top-N paths in path_summary."""
    if not paths_df.empty and "conversion_count" in paths_df.columns and "revenue" in paths_df.columns:
        total_conv = float(paths_df["conversion_count"].fillna(0).sum())
        total_rev  = float(paths_df["revenue"].fillna(0).sum())
        if total_conv > 0:
            return total_rev / total_conv
    return 0.0


def _historical_conversion_rate(similar: list[dict]) -> float:
    """Weighted average conversion rate across the top similar paths."""
    if not similar:
        return 0.0
    rates   = [p["conversion_rate"] for p in similar if p.get("conversion_rate") is not None]
    counts  = [p["count"]           for p in similar if p.get("conversion_rate") is not None]
    if not rates:
        return 0.0
    total_count = sum(counts)
    if total_count == 0:
        return sum(rates) / len(rates)
    return sum(r * c for r, c in zip(rates, counts)) / total_count


def _historical_support(
    channels: list[str],
    paths_df: pd.DataFrame,
    top_n: int = 5,
) -> tuple[int, list[dict]]:
    """
    Count real paths that contain `channels` as a subsequence.
    Returns (count, top_n most similar paths).
    """
    if paths_df.empty or "path_text" not in paths_df.columns:
        return 0, []

    sep = " -> "
    matches = []
    for _, row in paths_df.iterrows():
        path_str = str(row.get("path_text", ""))
        path_nodes = [n.strip() for n in path_str.split(sep) if n.strip()]
        if _is_subsequence(channels, path_nodes):
            matches.append(row)

    if not matches:
        return 0, []

    match_df = pd.DataFrame(matches)
    total = int(match_df["count"].sum()) if "count" in match_df.columns else len(matches)

    # Top N by count
    sort_col = "count" if "count" in match_df.columns else match_df.columns[0]
    top = match_df.sort_values(sort_col, ascending=False).head(top_n)
    similar = []
    for _, r in top.iterrows():
        similar.append({
            "path": str(r.get("path_text", "")),
            "count": int(r.get("count", 0)),
            "conversion_count": int(r.get("conversion_count", 0)),
            "conversion_rate": _clean(r.get("conversion_rate")),
            "revenue": _clean(r.get("revenue")),
            "avg_ticket": _clean(r.get("avg_ticket")),
        })
    return total, similar


def _is_subsequence(needle: list[str], haystack: list[str]) -> bool:
    """Return True if needle appears as an ordered subsequence in haystack."""
    it = iter(haystack)
    return all(ch in it for ch in needle)


def _confidence_score(path_prob: float, historical_support: int) -> float:
    """Heuristic confidence [0, 1] blending probability signal and sample size."""
    prob_score = min(1.0, math.log1p(path_prob * 1e6) / 14.0) if path_prob > 0 else 0.0
    support_score = min(1.0, math.log1p(historical_support) / 7.0)
    return round((prob_score * 0.4 + support_score * 0.6), 4)


def _lookup(from_s: str, to_s: str, matrix: pd.DataFrame) -> float:
    if matrix.empty:
        return 0.0
    mask = (matrix["from_state"] == from_s) & (matrix["to_state"] == to_s)
    rows = matrix[mask]
    if rows.empty:
        return 0.0
    return float(rows["probability"].iloc[0])


def _build_lookup(matrix: pd.DataFrame) -> dict[tuple[str, str], float]:
    return {
        (str(r["from_state"]), str(r["to_state"])): float(r["probability"])
        for _, r in matrix.iterrows()
    }


def _clean(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _json_list(raw: str | None) -> list:
    try:
        value = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


def _json_str_list(raw: str | None) -> list[str]:
    return [str(item) for item in _json_list(raw)]


def _empty_result(warnings: list[str]) -> dict[str, Any]:
    return {
        "path_channels": [],
        "path_probability": None,
        "conversion_probability_given_last_node": None,
        "composite_conversion_probability": None,
        "historical_conversion_rate": None,
        "lift": None,
        "expected_revenue": None,
        "expected_ticket": None,
        "historical_support": 0,
        "similar_paths": [],
        "warnings": warnings,
        "confidence_score": 0.0,
    }


def _scenario_to_dict(row: Scenario) -> dict[str, Any]:
    graph = row.graph
    return {
        "id": row.id,
        "model_run_id": row.model_run_id,
        "name": row.name,
        "description": row.description,
        "action_type": row.action_type,
        "channel": row.channel,
        "intensity_pct": row.intensity_pct,
        "period_start": row.period_start.isoformat() if row.period_start else None,
        "period_end": row.period_end.isoformat() if row.period_end else None,
        "nodes": _json_list(graph.nodes_json) if graph else [],
        "edges": _json_list(graph.edges_json) if graph else [],
        "path_channels": _json_str_list(graph.path_channels_json) if graph else [],
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "analysis": _analysis_to_dict(row.analysis, graph) if row.analysis else None,
    }


def _analysis_to_dict(
    row: ScenarioAnalysis,
    graph: ScenarioGraph | None = None,
) -> dict[str, Any]:
    return {
        "scenario_id": row.scenario_id,
        "model_run_id": row.model_run_id,
        "code_version": row.code_version,
        "analyzed_at": row.analyzed_at.isoformat() if row.analyzed_at else None,
        "path_channels": _json_str_list(graph.path_channels_json if graph else "[]"),
        "path_probability": row.path_probability,
        "conversion_probability_given_last_node": row.conversion_probability_given_last_node,
        "composite_conversion_probability": row.composite_conversion_probability,
        "historical_conversion_rate": row.historical_conversion_rate,
        "lift": row.lift,
        "expected_revenue": row.expected_revenue,
        "expected_ticket": row.expected_ticket,
        "historical_support": row.historical_support,
        "similar_paths": _json_list(row.similar_paths_json),
        "warnings": _json_str_list(row.warnings_json),
        "confidence_score": row.confidence_score,
    }
