"""Sprint 7: Path Intelligence Service — sequence analysis and ranking."""

from __future__ import annotations

from typing import List

import pandas as pd

SEPARATOR = " -> "
_TERMINAL_STATES = {"(start)", "Conversion", "Non-Conversion"}


def enrich_raw_paths(
    paths_df: pd.DataFrame,
    transition_matrix: pd.DataFrame | None = None,
    top_n: int = 50,
) -> pd.DataFrame:
    """
    Aggregate and enrich raw path sequences from extract.get_raw_paths().

    Input columns (from SQL):
        path_sequence (str), converted (int 0/1), revenue (float), occurrences (int)

    Each (path_sequence, converted) pair is one row. This function aggregates across
    both converted=0 and converted=1 rows for the same path_sequence, then computes
    all Sprint 7 metrics.

    Returns one enriched row per unique path_sequence, sorted by total_revenue desc,
    limited to top_n.
    """
    if paths_df.empty:
        return pd.DataFrame()

    df = paths_df.copy()
    df["occurrences"] = pd.to_numeric(df["occurrences"], errors="coerce").fillna(0).astype(int)
    df["converted"] = pd.to_numeric(df["converted"], errors="coerce").fillna(0).astype(int)
    df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce").fillna(0.0)

    # Pre-compute per-row converting/non-converting counts before groupby
    df["converting_occurrences"] = df["converted"] * df["occurrences"]
    df["nonconverting_occurrences"] = (1 - df["converted"]) * df["occurrences"]

    stats = (
        df.groupby("path_sequence", as_index=False)
        .agg(
            occurrences=("occurrences", "sum"),
            conversions=("converting_occurrences", "sum"),
            nonconversion_count=("nonconverting_occurrences", "sum"),
            total_revenue=("revenue", "sum"),
        )
    )

    stats["conversion_rate"] = (
        stats["conversions"] / stats["occurrences"].replace(0, pd.NA)
    ).fillna(0.0)
    stats["avg_revenue"] = (
        stats["total_revenue"] / stats["conversions"].replace(0, pd.NA)
    ).fillna(0.0)

    paths_as_lists = stats["path_sequence"].apply(lambda p: p.split(SEPARATOR))
    stats["path_length"] = paths_as_lists.apply(len)
    stats["contains_loop"] = paths_as_lists.apply(
        lambda p: len(detect_repeated_nodes(p)) > 0
    )
    stats["has_cycle"] = paths_as_lists.apply(lambda p: len(detect_cycles(p)) > 0)

    if transition_matrix is not None and not transition_matrix.empty:
        stats["path_probability"] = paths_as_lists.apply(
            lambda p: compute_path_probability(p, transition_matrix)
        )
    else:
        stats["path_probability"] = None

    stats["confidence_score"] = stats.apply(_confidence_score, axis=1)

    return (
        stats
        .sort_values("total_revenue", ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )


def rank_paths_by_conversion(
    paths_df: pd.DataFrame,
    top_n: int = 10,
) -> pd.DataFrame:
    """Top paths by conversion rate (only paths with at least one conversion)."""
    enriched = enrich_raw_paths(paths_df, top_n=max(top_n * 20, 500))
    if enriched.empty:
        return pd.DataFrame()
    converting = enriched[enriched["conversions"] > 0].copy()
    return (
        converting
        .sort_values("conversion_rate", ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )


def rank_paths_by_revenue(
    paths_df: pd.DataFrame,
    top_n: int = 10,
) -> pd.DataFrame:
    """Top paths by total attributed revenue."""
    enriched = enrich_raw_paths(paths_df, top_n=max(top_n * 20, 500))
    if enriched.empty:
        return pd.DataFrame()
    return (
        enriched[enriched["total_revenue"] > 0]
        .sort_values("total_revenue", ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )


def rank_paths_by_dropoff(
    paths_df: pd.DataFrame,
    top_n: int = 10,
) -> pd.DataFrame:
    """Top non-converting paths by volume — highest absolute user dropoff."""
    enriched = enrich_raw_paths(paths_df, top_n=max(top_n * 20, 500))
    if enriched.empty:
        return pd.DataFrame()
    return (
        enriched[enriched["nonconversion_count"] > 0]
        .sort_values("nonconversion_count", ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )


def detect_repeated_nodes(path: List[str]) -> List[str]:
    """
    Channels that appear more than once in a single path (repeated touchpoints).
    Terminal states (start, Conversion, Non-Conversion) are excluded.
    """
    seen: set[str] = set()
    repeated: list[str] = []
    for node in path:
        if node in seen and node not in _TERMINAL_STATES and node not in repeated:
            repeated.append(node)
        seen.add(node)
    return repeated


def detect_loops_in_path(path: List[str]) -> List[str]:
    """Alias for detect_repeated_nodes (backwards compatibility)."""
    return detect_repeated_nodes(path)


def detect_cycles(path: List[str]) -> List[tuple[str, int, int]]:
    """
    Detect ordered re-entries: A → other channels → A again (A → B → A pattern).
    Consecutive repetition (A → A self-loop) is excluded — those are self-loops.
    Returns list of (channel, first_index, second_index) for the first re-entry
    of each channel. Indices are relative to the filtered path (no terminal states).
    """
    filtered = [n for n in path if n not in _TERMINAL_STATES]
    cycles: list[tuple[str, int, int]] = []
    first_seen: dict[str, int] = {}
    reported: set[str] = set()
    for i, node in enumerate(filtered):
        if node in first_seen and i > first_seen[node] + 1 and node not in reported:
            cycles.append((node, first_seen[node], i))
            reported.add(node)
        elif node not in first_seen:
            first_seen[node] = i
    return cycles


def compute_path_probability(
    path: List[str],
    transition_matrix: pd.DataFrame,
) -> float:
    """
    Probability of a converting journey through these channels.
    Prepends (start) and appends Conversion to build the full chain.
    Returns 0.0 if any transition in the chain is missing from the matrix.
    """
    channel_nodes = [n for n in path if n not in _TERMINAL_STATES]
    full_path = ["(start)"] + channel_nodes + ["Conversion"]
    prob = 1.0
    try:
        for i in range(len(full_path) - 1):
            origin = full_path[i]
            dest = full_path[i + 1]
            if origin in transition_matrix.index and dest in transition_matrix.columns:
                prob *= float(transition_matrix.at[origin, dest])
            else:
                return 0.0
    except Exception:
        return 0.0
    return prob


def compute_path_revenue(paths_df: pd.DataFrame) -> dict[str, float]:
    """Summary revenue statistics across all paths in the DataFrame."""
    if paths_df.empty:
        return {"total_revenue": 0.0, "avg_revenue_per_path": 0.0, "max_revenue": 0.0}
    col = "total_revenue" if "total_revenue" in paths_df.columns else "revenue"
    revenues = pd.to_numeric(
        paths_df.get(col, pd.Series(dtype=float)), errors="coerce"
    ).fillna(0.0)
    return {
        "total_revenue": float(revenues.sum()),
        "avg_revenue_per_path": float(revenues.mean()),
        "max_revenue": float(revenues.max()),
    }


def compute_path_avg_ticket(paths_df: pd.DataFrame) -> float:
    """Mean average ticket across converting paths (excludes zero-ticket rows)."""
    if paths_df.empty:
        return 0.0
    col = "avg_revenue" if "avg_revenue" in paths_df.columns else "avg_ticket"
    if col not in paths_df.columns:
        return 0.0
    vals = pd.to_numeric(paths_df[col], errors="coerce").fillna(0.0)
    non_zero = vals[vals > 0]
    return float(non_zero.mean()) if not non_zero.empty else 0.0


def _confidence_score(row: pd.Series) -> float:
    """Confidence score [0, 1] based on sample size and conversion signal."""
    n = float(row.get("occurrences", 0) or 0)
    cr = float(row.get("conversion_rate", 0) or 0)
    if n >= 100:
        return min(1.0, 0.5 + cr)
    if n >= 20:
        return min(0.8, 0.3 + cr)
    if n >= 5:
        return min(0.5, 0.1 + cr)
    return min(0.2, cr)
