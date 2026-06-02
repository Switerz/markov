"""Sandbox service: CRUD for scenarios and path-metric analysis."""

from __future__ import annotations

import json
import math
from typing import Any, Optional

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from gograph.backend.app.db.models import Scenario
from gograph.backend.app.services.persistence_service import (
    get_model_run_table,
    session_scope,
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
) -> dict[str, Any]:
    scenario = Scenario(
        model_run_id=model_run_id,
        name=name,
        description=description,
        nodes_json=json.dumps(nodes),
        edges_json=json.dumps(edges),
        path_channels_json=json.dumps(path_channels),
    )
    session.add(scenario)
    session.flush()
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
) -> Optional[dict[str, Any]]:
    row = session.get(Scenario, scenario_id)
    if row is None:
        return None
    if name is not None:
        row.name = name
    if description is not None:
        row.description = description
    if nodes is not None:
        row.nodes_json = json.dumps(nodes)
    if edges is not None:
        row.edges_json = json.dumps(edges)
    if path_channels is not None:
        row.path_channels_json = json.dumps(path_channels)
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
    transition matrix and attribution results.

    Returns a dict with:
      path_probability, conversion_probability_given_last_node,
      composite_conversion_probability, expected_revenue, expected_ticket,
      historical_support, similar_paths, warnings, confidence_score
    """
    row = session.get(Scenario, scenario_id)
    if row is None:
        raise ValueError(f"Scenario {scenario_id} not found.")

    path_channels: list[str] = json.loads(row.path_channels_json)
    model_run_id: int = row.model_run_id

    matrix_df = get_model_run_table(model_run_id, "transition_matrix", session=session)
    attribution_df = get_model_run_table(model_run_id, "attribution_results", session=session)
    paths_df = get_model_run_table(model_run_id, "path_summary", session=session)

    warnings: list[str] = []

    if not path_channels:
        warnings.append("Nenhum canal definido no cenário.")
        return _empty_result(warnings)

    # Detect hypothetical nodes (not in matrix)
    known_states = set()
    if not matrix_df.empty:
        known_states = set(matrix_df["from_state"]) | set(matrix_df["to_state"])
    for ch in path_channels:
        if ch not in known_states:
            warnings.append(f"Canal hipotético ou sem dados: '{ch}'")

    # --- Metrics ---
    path_prob = _path_probability(path_channels, matrix_df)
    conv_given_last = _conv_prob_given_last(path_channels[-1], matrix_df)

    # P(reaching last channel via path) × P(eventually converting from last node)
    path_to_last = _path_probability_no_conv(path_channels, matrix_df)
    conv_from_last = _conv_prob_eventually(path_channels[-1], matrix_df)
    composite = path_to_last * conv_from_last

    total_revenue = float(
        attribution_df["markov_revenue"].sum()
        if not attribution_df.empty and "markov_revenue" in attribution_df.columns
        else 0.0
    )
    n_conv_weight = _total_conversion_weight(matrix_df)
    avg_ticket = total_revenue / n_conv_weight if n_conv_weight > 0 else 0.0
    expected_revenue = composite * total_revenue if total_revenue > 0 else 0.0
    expected_ticket = avg_ticket

    historical_support, similar = _historical_support(path_channels, paths_df)

    if path_prob == 0.0 and not warnings:
        warnings.append("Probabilidade zero — verifique se todos os canais têm transições na matriz.")

    confidence = _confidence_score(path_prob, historical_support)

    return {
        "scenario_id": scenario_id,
        "path_channels": path_channels,
        "path_probability": _clean(path_prob),
        "conversion_probability_given_last_node": _clean(conv_given_last),
        "composite_conversion_probability": _clean(composite),
        "expected_revenue": _clean(expected_revenue),
        "expected_ticket": _clean(expected_ticket),
        "historical_support": historical_support,
        "similar_paths": similar,
        "warnings": warnings,
        "confidence_score": _clean(confidence),
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

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


def _total_conversion_weight(matrix: pd.DataFrame) -> float:
    """Sum of n-weights flowing into Conversion (proxy for relative conversion volume)."""
    if matrix.empty:
        return 0.0
    into_conv = matrix[matrix["to_state"] == "Conversion"]["probability"].sum()
    return float(into_conv) if into_conv > 0 else 1.0


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
            "conversion_rate": _clean(r.get("conversion_rate")),
            "revenue": _clean(r.get("revenue")),
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


def _empty_result(warnings: list[str]) -> dict[str, Any]:
    return {
        "path_channels": [],
        "path_probability": None,
        "conversion_probability_given_last_node": None,
        "composite_conversion_probability": None,
        "expected_revenue": None,
        "expected_ticket": None,
        "historical_support": 0,
        "similar_paths": [],
        "warnings": warnings,
        "confidence_score": 0.0,
    }


def _scenario_to_dict(row: Scenario) -> dict[str, Any]:
    return {
        "id": row.id,
        "model_run_id": row.model_run_id,
        "name": row.name,
        "description": row.description,
        "nodes": json.loads(row.nodes_json),
        "edges": json.loads(row.edges_json),
        "path_channels": json.loads(row.path_channels_json),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
