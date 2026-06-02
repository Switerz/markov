import pandas as pd

from gograph.backend.app.services.journey_insight_service import (
    compute_touchpoint_metrics,
    generate_channel_insights,
)


def _transition_counts():
    return pd.DataFrame(
        [
            {"from_state": "(start)", "to_state": "Google Ads", "n": 10, "transition_type": "converting"},
            {"from_state": "Google Ads", "to_state": "Email", "n": 6, "transition_type": "converting"},
            {"from_state": "Email", "to_state": "Conversion", "n": 6, "transition_type": "converting"},
            {"from_state": "Google Ads", "to_state": "Conversion", "n": 4, "transition_type": "converting"},
            {"from_state": "(start)", "to_state": "Paid Meta Ads", "n": 8, "transition_type": "nonconverting"},
            {"from_state": "Paid Meta Ads", "to_state": "Non-Conversion", "n": 8, "transition_type": "nonconverting"},
            {"from_state": "(start)", "to_state": "Google Ads", "n": 2, "transition_type": "nonconverting"},
            {"from_state": "Google Ads", "to_state": "Non-Conversion", "n": 2, "transition_type": "nonconverting"},
        ]
    )


def test_compute_touchpoint_metrics_uses_separate_denominators():
    touchpoints = compute_touchpoint_metrics(_transition_counts())

    google = touchpoints.loc[touchpoints["channel"] == "Google Ads"].iloc[0]
    email = touchpoints.loc[touchpoints["channel"] == "Email"].iloc[0]
    meta = touchpoints.loc[touchpoints["channel"] == "Paid Meta Ads"].iloc[0]

    assert google["conv_first_touch_share"] == 1.0
    assert email["conv_middle_touch_share"] == 1.0
    assert email["conv_last_touch_share"] == 0.6
    assert meta["nonconv_first_touch_share"] == 0.8
    assert meta["nonconv_last_touch_share"] == 0.8
    assert meta["dropoff_after_touch"] == 1.0


def test_generate_channel_insights_returns_evidence_and_limitation():
    touchpoints = compute_touchpoint_metrics(_transition_counts())
    attribution = pd.DataFrame(
        [
            {
                "channel": "Google Ads",
                "markov_weight": 0.4,
                "shapley_weight": 0.3,
                "spend": 100.0,
                "roas_markov": 4.0,
            },
            {
                "channel": "Paid Meta Ads",
                "markov_weight": 0.0,
                "shapley_weight": 0.0,
                "spend": 50.0,
                "roas_markov": 0.0,
            },
        ]
    )

    insights = generate_channel_insights(attribution, touchpoints)

    assert not insights.empty
    assert "Scale Up" in set(insights["title"])
    assert "Investigate Dropoff" in set(insights["title"])
    assert insights["limitation"].str.contains("incrementalidade causal").all()
