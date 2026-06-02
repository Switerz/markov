import pandas as pd

from roas import build_channel_diagnostics, generate_recommendations


def test_build_channel_diagnostics_flags_nonconverter_presence():
    converting = pd.DataFrame(
        [
            {"from_ch": "(start)", "to_ch": "Google Ads", "n": 10},
            {"from_ch": "Google Ads", "to_ch": "Conversion", "n": 10},
            {"from_ch": "(start)", "to_ch": "Paid Social / Facebook", "n": 2},
            {"from_ch": "Paid Social / Facebook", "to_ch": "Conversion", "n": 2},
        ]
    )
    nonconverting = pd.DataFrame(
        [
            {"from_ch": "(start)", "to_ch": "Paid Social / Facebook", "n": 90},
            {"from_ch": "Paid Social / Facebook", "to_ch": "Non-Conversion", "n": 90},
            {"from_ch": "(start)", "to_ch": "Google Ads", "n": 10},
            {"from_ch": "Google Ads", "to_ch": "Non-Conversion", "n": 10},
        ]
    )

    diagnostics = build_channel_diagnostics(converting, nonconverting)
    facebook = diagnostics.loc[
        diagnostics["channel"] == "Paid Social / Facebook"
    ].iloc[0]

    assert facebook["nonconv_presence_share"] == 0.9
    assert facebook["presence_gap_pp"] < 0


def test_generate_recommendations_marks_markov_dominant_paid_channel():
    df = pd.DataFrame(
        [
            {
                "channel": "Google Ads",
                "attribution_weight": 0.55,
                "shapley_weight": 0.22,
                "spend": 100,
                "roas_markov": 5.0,
                "roas_shapley": 2.0,
                "conv_presence_share": 0.4,
                "nonconv_presence_share": 0.2,
            }
        ]
    )

    recs = generate_recommendations(df, paid_channels={"Google Ads"})

    assert recs["attribution_alignment"].iloc[0] == "Markov-dominant / check incrementality"
    assert recs["recommendation"].iloc[0] == "Scale Up - Check Incrementality"


def test_generate_recommendations_flags_high_presence_low_value():
    df = pd.DataFrame(
        [
            {
                "channel": "Paid Social / Facebook",
                "attribution_weight": 0.0,
                "shapley_weight": 0.0,
                "spend": 100,
                "roas_markov": 0.0,
                "roas_shapley": 0.0,
                "conv_presence_share": 0.2,
                "nonconv_presence_share": 0.55,
            }
        ]
    )

    recs = generate_recommendations(df, paid_channels={"Paid Social / Facebook"})

    assert recs["presence_warning"].iloc[0] == "Over-indexes in non-converting journeys"
    assert recs["recommendation"].iloc[0] == "Investigate High Presence Low Value"
