import pandas as pd

from gograph.backend.app.schemas import ModelRunParams, ModelRunResult
from gograph.backend.app.services.export_service import export_model_run_to_excel
from gograph.backend.app.services.model_service import run_model


def _sample_inputs():
    converting = pd.DataFrame(
        [
            {
                "from_ch": "(start)",
                "to_ch": "Google Ads / Search",
                "n": 10,
                "total_revenue": 1000.0,
            },
            {
                "from_ch": "Google Ads / Search",
                "to_ch": "Email",
                "n": 6,
                "total_revenue": 600.0,
            },
            {
                "from_ch": "Email",
                "to_ch": "Conversion",
                "n": 6,
                "total_revenue": 600.0,
            },
            {
                "from_ch": "Google Ads / Search",
                "to_ch": "Conversion",
                "n": 4,
                "total_revenue": 400.0,
            },
        ]
    )
    nonconverting = pd.DataFrame(
        [
            {"from_ch": "(start)", "to_ch": "Google Ads / Search", "n": 5},
            {"from_ch": "Google Ads / Search", "to_ch": "Non-Conversion", "n": 5},
            {"from_ch": "(start)", "to_ch": "Direct", "n": 5},
            {"from_ch": "Direct", "to_ch": "Non-Conversion", "n": 5},
        ]
    )
    spend = pd.DataFrame(
        [
            {"channel": "Google Ads / Search", "spend": 200.0},
            {"channel": "Email", "spend": 0.0},
        ]
    )
    return converting, nonconverting, spend


def test_run_model_accepts_injected_dataframes_without_metabase():
    converting, nonconverting, spend = _sample_inputs()
    params = ModelRunParams(
        start_date="2026-03-01",
        end_date="2026-03-31",
        db_plausible=70,
        db_datamart=63,
        non_conv_scale=1.0,
        shapley_samples=25,
    )

    result = run_model(
        params=params,
        converting_transitions=converting,
        nonconverting_transitions=nonconverting,
        spend=spend,
        total_revenue=1000.0,
        observed_conversion_rate=0.5,
        paid_channels={"Google Ads / Search"},
    )

    assert isinstance(result, ModelRunResult)
    assert result.parameters == params
    assert result.non_conv_scale == 1.0
    assert result.total_revenue == 1000.0
    assert result.transition_matrix.loc["Conversion", "Conversion"] == 1.0
    assert {"Google Ads / Search", "Email"}.issubset(set(result.roas_results["channel"]))
    assert "model_conversion_rate" in result.summary()


def test_export_model_run_to_excel_writes_expected_file(tmp_path):
    converting, nonconverting, spend = _sample_inputs()
    params = ModelRunParams(
        start_date="2026-03-01",
        end_date="2026-03-31",
        db_plausible=70,
        non_conv_scale=1.0,
        shapley_samples=10,
    )
    result = run_model(
        params=params,
        converting_transitions=converting,
        nonconverting_transitions=nonconverting,
        spend=spend,
        total_revenue=1000.0,
        observed_conversion_rate=0.5,
    )

    output_path = export_model_run_to_excel(result, tmp_path / "model_run.xlsx")

    assert output_path.exists()
    assert output_path.stat().st_size > 0
