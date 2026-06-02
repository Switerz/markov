"""Journey graph builders for persisted model run transitions."""

from __future__ import annotations

from typing import Any

import networkx as nx
import pandas as pd


def build_journey_graph(
    transitions: pd.DataFrame,
    matrix: pd.DataFrame,
    max_cycles: int = 25,
) -> dict[str, Any]:
    """
    Build a graph payload from persisted transition counts and probabilities.

    Transition counts are preferred for edge volume and revenue. The transition
    matrix fills probabilities, and can also provide a sparse fallback graph when
    no count rows were persisted.
    """
    normalized_transitions = _normalize_transition_counts(transitions)
    normalized_matrix = _normalize_transition_matrix(matrix)

    if normalized_transitions.empty and normalized_matrix.empty:
        return {
            "nodes": [],
            "edges": [],
            "cycles": [],
            "self_loops": [],
            "summary": _summary(0, 0, 0, 0),
        }

    probability_by_edge = _probability_lookup(normalized_matrix)
    edges_df = _edge_rows(normalized_transitions, normalized_matrix, probability_by_edge)
    graph = _to_networkx_graph(edges_df)

    centrality = nx.degree_centrality(graph) if graph.number_of_nodes() else {}
    in_centrality = nx.in_degree_centrality(graph) if graph.number_of_nodes() else {}
    out_centrality = nx.out_degree_centrality(graph) if graph.number_of_nodes() else {}
    pagerank = _pagerank(graph)
    cycles = _cycles(graph, max_cycles=max_cycles)
    nodes_in_cycles = {node for cycle in cycles for node in cycle["nodes"]}
    self_loop_nodes = {source for source, target in nx.selfloop_edges(graph)}

    nodes = []
    for state in sorted(graph.nodes):
        in_count = _weighted_degree(graph.in_edges(state, data=True))
        out_count = _weighted_degree(graph.out_edges(state, data=True))
        revenue = _incoming_revenue(graph, state)
        count_for_ticket = in_count if _state_type(state) in {"conversion", "non_conversion"} else out_count
        nodes.append(
            {
                "id": state,
                "label": state,
                "type": _state_type(state),
                "in_count": in_count,
                "out_count": out_count,
                "count": in_count + out_count,
                "revenue": revenue,
                "avg_ticket": revenue / count_for_ticket if count_for_ticket else None,
                "degree_centrality": centrality.get(state, 0.0),
                "in_degree_centrality": in_centrality.get(state, 0.0),
                "out_degree_centrality": out_centrality.get(state, 0.0),
                "pagerank": pagerank.get(state, 0.0),
                "has_self_loop": state in self_loop_nodes,
                "in_cycle": state in nodes_in_cycles,
            }
        )

    edges = [_edge_to_dict(row) for row in edges_df.to_dict("records")]
    self_loops = [
        {
            "node": edge["source"],
            "count": edge["count"],
            "probability": edge["probability"],
            "revenue": edge["revenue"],
            "avg_ticket": edge["avg_ticket"],
        }
        for edge in edges
        if edge["source"] == edge["target"]
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "cycles": cycles,
        "self_loops": self_loops,
        "summary": _summary(
            len(nodes),
            len(edges),
            len(cycles),
            len(self_loops),
        ),
    }


def _normalize_transition_counts(transitions: pd.DataFrame) -> pd.DataFrame:
    if transitions.empty:
        return pd.DataFrame(
            columns=["from_state", "to_state", "n", "total_revenue", "transition_type"]
        )

    renamed = transitions.rename(
        columns={
            "from_ch": "from_state", "to_ch": "to_state",
            "n": "n", "count": "n", # Mapeia ambos para 'n'
            "total_revenue": "total_revenue", "revenue": "total_revenue"
        }
    ).copy()
    
    # Garante colunas mínimas
    for column, default in [("from_state", None), ("to_state", None), ("n", 0.0), ("total_revenue", 0.0)]:
        if column not in renamed.columns:
            renamed[column] = default

    renamed = renamed.dropna(subset=["from_state", "to_state"])
    renamed["from_state"] = renamed["from_state"].astype(str)
    renamed["to_state"] = renamed["to_state"].astype(str)
    renamed["n"] = pd.to_numeric(renamed["n"], errors="coerce").fillna(0.0)
    renamed["total_revenue"] = pd.to_numeric(
        renamed["total_revenue"], errors="coerce"
    ).fillna(0.0)
    renamed["transition_type"] = renamed["transition_type"].fillna("observed").astype(str)
    return renamed


def _normalize_transition_matrix(matrix: pd.DataFrame) -> pd.DataFrame:
    if matrix.empty:
        return pd.DataFrame(columns=["from_state", "to_state", "probability"])

    if {"from_state", "to_state", "probability"}.issubset(matrix.columns):
        normalized = matrix[["from_state", "to_state", "probability"]].copy()
    else:
        records = []
        for from_state, row in matrix.iterrows():
            for to_state, probability in row.items():
                records.append(
                    {
                        "from_state": from_state,
                        "to_state": to_state,
                        "probability": probability,
                    }
                )
        normalized = pd.DataFrame(records)

    normalized = normalized.dropna(subset=["from_state", "to_state"])
    normalized["from_state"] = normalized["from_state"].astype(str)
    normalized["to_state"] = normalized["to_state"].astype(str)
    normalized["probability"] = pd.to_numeric(
        normalized["probability"], errors="coerce"
    ).fillna(0.0)
    return normalized[normalized["probability"] > 0.0]


def _edge_rows(
    transitions: pd.DataFrame,
    matrix: pd.DataFrame,
    probability_by_edge: dict[tuple[str, str], float],
) -> pd.DataFrame:
    if not transitions.empty:
        grouped = (
            transitions.groupby(["from_state", "to_state"], as_index=False)
            .agg(
                count=("n", "sum"),
                revenue=("total_revenue", "sum"),
                transition_types=("transition_type", _join_unique),
            )
            .sort_values(["count", "revenue"], ascending=False)
        )
        grouped["probability"] = grouped.apply(
            lambda row: probability_by_edge.get(
                (row["from_state"], row["to_state"]),
                _count_probability(row, grouped),
            ),
            axis=1,
        )
    else:
        grouped = matrix.rename(columns={"from_state": "from_state", "to_state": "to_state"})
        grouped["count"] = 0.0
        grouped["revenue"] = 0.0
        grouped["transition_types"] = "matrix"

    grouped["avg_ticket"] = grouped.apply(
        lambda row: row["revenue"] / row["count"] if row["count"] else None,
        axis=1,
    )
    grouped["is_self_loop"] = grouped["from_state"] == grouped["to_state"]
    return grouped[
        [
            "from_state",
            "to_state",
            "count",
            "probability",
            "revenue",
            "avg_ticket",
            "transition_types",
            "is_self_loop",
        ]
    ].reset_index(drop=True)


def _probability_lookup(matrix: pd.DataFrame) -> dict[tuple[str, str], float]:
    if matrix.empty:
        return {}
    return {
        (str(row["from_state"]), str(row["to_state"])): float(row["probability"])
        for row in matrix.to_dict("records")
    }


def _count_probability(row: pd.Series, edges: pd.DataFrame) -> float | None:
    source_total = edges.loc[edges["from_state"] == row["from_state"], "count"].sum()
    if not source_total:
        return None
    return float(row["count"] / source_total)


def _to_networkx_graph(edges: pd.DataFrame) -> nx.DiGraph:
    graph = nx.DiGraph()
    for row in edges.to_dict("records"):
        graph.add_edge(
            row["from_state"],
            row["to_state"],
            count=float(row["count"] or 0.0),
            revenue=float(row["revenue"] or 0.0),
            probability=row["probability"],
        )
    return graph


def _pagerank(graph: nx.DiGraph) -> dict[str, float]:
    if graph.number_of_nodes() == 0:
        return {}
    try:
        return nx.pagerank(graph, weight="count")
    except nx.PowerIterationFailedConvergence:
        return {node: 0.0 for node in graph.nodes}


def _cycles(graph: nx.DiGraph, max_cycles: int) -> list[dict[str, Any]]:
    cycles = []
    for cycle in nx.simple_cycles(graph):
        if len(cycle) <= 1:
            continue
        cycle_edges = []
        total_count = 0.0
        total_revenue = 0.0
        for source, target in zip(cycle, cycle[1:] + cycle[:1]):
            data = graph.get_edge_data(source, target, default={})
            edge_count = float(data.get("count") or 0.0)
            edge_revenue = float(data.get("revenue") or 0.0)
            total_count += edge_count
            total_revenue += edge_revenue
            cycle_edges.append({"source": source, "target": target, "count": edge_count})
        cycles.append(
            {
                "nodes": cycle,
                "edges": cycle_edges,
                "count": total_count,
                "revenue": total_revenue,
            }
        )
        if len(cycles) >= max_cycles:
            break
    return sorted(cycles, key=lambda item: item["count"], reverse=True)


def _edge_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": row["from_state"],
        "target": row["to_state"],
        "count": float(row["count"] or 0.0),
        "probability": _clean_float(row["probability"]),
        "revenue": float(row["revenue"] or 0.0),
        "avg_ticket": _clean_float(row["avg_ticket"]),
        "transition_types": row["transition_types"],
        "is_self_loop": bool(row["is_self_loop"]),
    }


def _summary(
    node_count: int,
    edge_count: int,
    cycle_count: int,
    self_loop_count: int,
) -> dict[str, int]:
    return {
        "node_count": node_count,
        "edge_count": edge_count,
        "cycle_count": cycle_count,
        "self_loop_count": self_loop_count,
    }


def _weighted_degree(edges: Any) -> float:
    return float(sum(data.get("count") or 0.0 for _, _, data in edges))


def _incoming_revenue(graph: nx.DiGraph, state: str) -> float:
    return float(
        sum(data.get("revenue") or 0.0 for _, _, data in graph.in_edges(state, data=True))
    )


def _join_unique(values: pd.Series) -> str:
    return ", ".join(sorted({str(value) for value in values if pd.notna(value)}))


def _clean_float(value: Any) -> float | None:
    if pd.isna(value):
        return None
    return float(value)


def _state_type(state: str) -> str:
    if state == "(start)":
        return "start"
    if state == "Conversion":
        return "conversion"
    if state == "Non-Conversion":
        return "non_conversion"
    return "channel"
