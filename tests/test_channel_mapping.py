import config
from extract import META_COST_SQL, _state_sql


def test_paid_meta_ads_is_canonical_paid_social_state():
    sql = _state_sql("s")

    assert "Paid Meta Ads" in config.TRACKED_STATES
    assert "Paid Meta Ads" in config.PAID_CHANNELS
    assert "Paid Social / Facebook" not in config.TRACKED_STATES
    assert "Paid Social / Instagram" not in config.TRACKED_STATES
    assert "'Paid Meta Ads'" in sql
    assert "instagram" in sql
    assert "facebook" in sql


def test_meta_spend_maps_to_paid_meta_ads():
    assert "'Paid Meta Ads' AS channel" in META_COST_SQL
