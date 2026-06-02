import pandas as pd

from gograph.backend.app.services.journey_graph_service import build_journey_graph


def test_build_journey_graph_computes_network_metrics_cycles_and_loops():
    transitions = pd.DataFrame(
        [
            {
                "from_state": "(start)",
                "to_state": "Google Ads",
                "n": 10,
                "total_revenue": 1000.0,
                "transition_type": "converting",
            },
            {
                "from_state": "Google Ads",
                "to_state": "Email",
                "n": 6,
                "total_revenue": 600.0,
                "transition_type": "converting",
            },
            {
                "from_state": "Email",
                "to_state": "Google Ads",
                "n": 2,
                "total_revenue": 100.0,
                "transition_type": "converting",
            },
            {
                "from_state": "Email",
                "to_state": "Email",
                "n": 1,
                "total_revenue": 50.0,
                "transition_type": "converting",
            },
            {
                "from_state": "Email",
                "to_state": "Conversion",
                "n": 5,
                "total_revenue": 500.0,
                "transition_type": "converting",
            },
            {
                "from_state": "Google Ads",
                "to_state": "Non-Conversion",
                "n": 3,
                "total_revenue": None,
                "transition_type": "nonconverting",
            },
        ]
    )
    matrix = pd.DataFrame(
        [
            {"from_state": "(start)", "to_state": "Google Ads", "probability": 1.0},
            {"from_state": "Google Ads", "to_state": "Email", "probability": 0.6},
            {"from_state": "Google Ads", "to_state": "Non-Conversion", "probability": 0.3},
            {"from_state": "Email", "to_state": "Google Ads", "probability": 0.2},
            {"from_state": "Email", "to_state": "Email", "probability": 0.1},
            {"from_state": "Email", "to_state": "Conversion", "probability": 0.5},
        ]
    )

    graph = build_journey_graph(transitions, matrix)
    nodes = {row["id"]: row for row in graph["nodes"]}
    edges = {(row["source"], row["target"]): row for row in graph["edges"]}

    assert graph["summary"]["node_count"] == 5
    assert graph["summary"]["cycle_count"] == 1
    assert graph["summary"]["self_loop_count"] == 1
    assert nodes["Conversion"]["type"] == "conversion"
    assert nodes["Non-Conversion"]["type"] == "non_conversion"
    assert nodes["Google Ads"]["pagerank"] > 0
    assert nodes["Google Ads"]["in_cycle"] is True
    assert nodes["Email"]["has_self_loop"] is True
    assert edges[("Google Ads", "Email")]["probability"] == 0.6
    assert edges[("Email", "Email")]["is_self_loop"] is True
