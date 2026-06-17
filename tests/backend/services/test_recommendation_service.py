from gograph.backend.app.services.recommendation_service import derive_recommendations


def test_escalar_when_high_consensus_high_roas():
    rows = [
        {
            "channel": "Google Ads",
            "markov_weight": 0.40,
            "shapley_weight": 0.38,
            "markov_revenue": 7_500_000,
            "roas_markov": 7.5,
            "roas_shapley": 7.1,
            "spend": 1_000_000,
            "conv_presence_share": 0.35,
        }
    ]

    result = derive_recommendations(rows)

    assert result[0]["recommendation"] == "Escalar"
    assert result[0]["recommendation_tone"] == "green"
    assert len(result[0]["rationale"]) >= 3


def test_reduzir_when_low_roas_low_presence():
    rows = [
        {
            "channel": "Display",
            "markov_weight": 0.01,
            "shapley_weight": 0.01,
            "markov_revenue": 50_000,
            "roas_markov": 0.5,
            "roas_shapley": 0.4,
            "spend": 100_000,
            "conv_presence_share": 0.03,
            "nonconv_presence_share": 0.04,
            "pfc_weight": 0.01,
        }
    ]

    result = derive_recommendations(rows)

    assert result[0]["recommendation"] == "Reduzir"
    assert result[0]["recommendation_tone"] == "red"
    assert result[0]["suggested_budget_delta_pct"] < 0


def test_priority_rank_by_revenue_delta():
    rows = [
        {
            "channel": "Small",
            "markov_weight": 0.20,
            "shapley_weight": 0.20,
            "markov_revenue": 1_000_000,
            "roas_markov": 5.0,
            "roas_shapley": 5.0,
            "spend": 100_000,
            "conv_presence_share": 0.20,
        },
        {
            "channel": "Large",
            "markov_weight": 0.25,
            "shapley_weight": 0.24,
            "markov_revenue": 4_000_000,
            "roas_markov": 4.0,
            "roas_shapley": 4.0,
            "spend": 1_000_000,
            "conv_presence_share": 0.25,
        },
    ]

    result = derive_recommendations(rows)

    assert result[0]["channel"] == "Large"
    assert result[0]["priority_rank"] == 1
    assert result[1]["priority_rank"] == 2
