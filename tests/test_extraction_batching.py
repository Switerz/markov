import pandas as pd

from gograph.backend.app.schemas import ModelRunParams
from gograph.backend.app.services import extraction_service


def test_months_in_range_splits_partial_months():
    months = extraction_service.months_in_range("2026-03-15", "2026-05-02")

    assert months == [
        ("2026-03-15", "2026-03-31"),
        ("2026-04-01", "2026-04-30"),
        ("2026-05-01", "2026-05-02"),
    ]


def test_auto_batching_aggregates_monthly_transitions(monkeypatch):
    calls = []

    def fake_get_converting_transitions(**kwargs):
        calls.append(("conv", kwargs["start_date"], kwargs["end_date"]))
        return pd.DataFrame(
            [
                {
                    "from_ch": "(start)",
                    "to_ch": "Google Ads",
                    "n": 1.0,
                    "total_revenue": 100.0,
                }
            ]
        )

    def fake_get_nonconverting_transitions(**kwargs):
        calls.append(("nconv", kwargs["start_date"], kwargs["end_date"]))
        return pd.DataFrame(
            [{"from_ch": "(start)", "to_ch": "Direct", "n": 2}]
        )

    monkeypatch.setattr(
        extraction_service,
        "get_converting_transitions",
        fake_get_converting_transitions,
    )
    monkeypatch.setattr(
        extraction_service,
        "get_nonconverting_transitions",
        fake_get_nonconverting_transitions,
    )
    params = ModelRunParams(
        start_date="2026-03-01",
        end_date="2026-05-26",
        db_plausible=70,
        non_conv_scale=1.0,
        batch_mode="auto",
        batch_days=35,
    )

    converting, nonconverting = extraction_service.extract_transition_counts(params)

    assert converting["n"].iloc[0] == 3.0
    assert converting["total_revenue"].iloc[0] == 300.0
    assert nonconverting["n"].iloc[0] == 6
    assert calls == [
        ("conv", "2026-03-01", "2026-03-31"),
        ("nconv", "2026-03-01", "2026-03-31"),
        ("conv", "2026-04-01", "2026-04-30"),
        ("nconv", "2026-04-01", "2026-04-30"),
        ("conv", "2026-05-01", "2026-05-26"),
        ("nconv", "2026-05-01", "2026-05-26"),
    ]
