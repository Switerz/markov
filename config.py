"""Runtime configuration for the attribution pipeline.

Values can be overridden with environment variables. Keep real credentials in a
local .env or shell environment, never in this file.
"""

import os
from typing import Optional

from dotenv import load_dotenv


load_dotenv(override=True)


def _env_int(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


def _env_float(name: str, default: float) -> float:
    return float(os.getenv(name, str(default)))


def _env_optional_float(name: str, default: Optional[float] = None) -> Optional[float]:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    if value.strip().lower() in {"none", "null"}:
        return None
    return float(value)


METABASE_URL = os.getenv("METABASE_URL", "")
METABASE_API_KEY = os.getenv("METABASE_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///gograph.db")

# ClickHouse (Plausible) via Metabase
DB_PLAUSIBLE = _env_int("DB_PLAUSIBLE", 70)

# Data Mart (gold tables: google_ads_consolidated, vw_meta_segment_performance)
DB_DATAMART = _env_int("DB_DATAMART", 63)

# Analysis window
START_DATE = os.getenv("START_DATE", "2026-03-01")
END_DATE   = os.getenv("END_DATE", "2026-03-31")

# How many days before a purchase to look for prior sessions
LOOKBACK_DAYS = _env_int("LOOKBACK_DAYS", 30)

# Sample rate for non-converting paths (1% of non-converters)
NON_CONV_SAMPLE_PCT = _env_int("NON_CONV_SAMPLE_PCT", 1)

# Scale factor applied to non-converting path counts when building the transition matrix.
# Set to None to auto-calibrate so that P(Conversion|start) matches the observed rate.
NON_CONV_SCALE = _env_optional_float("NON_CONV_SCALE", None)

# Exponential time-decay lambda applied to converting transitions.
# Weight of a session t days before conversion = exp(-DECAY_LAMBDA * t).
# 0.05 → ~50% weight at 14 days; 0.0 → no decay (uniform weight).
DECAY_LAMBDA = _env_float("DECAY_LAMBDA", 0.05)

# Monte Carlo samples for Shapley estimation. More = more accurate but slower.
# 5 000 samples runs in ~5–10 s for 18 channels.
SHAPLEY_SAMPLES = _env_int("SHAPLEY_SAMPLES", 5000)

# Transition extraction batching. auto uses monthly batches for long windows.
MODEL_BATCH_MODE = os.getenv("MODEL_BATCH_MODE", "auto")
MODEL_BATCH_DAYS = _env_int("MODEL_BATCH_DAYS", 35)

# Right-censorship horizon for non-converting journeys.
# Non-converting users whose last session is within this many days of end_date
# are excluded from the Non-Conversion transition counts — their journey outcome
# is still unknown (censored). Converts units: 0 = disabled (backward-compatible).
# Recommended values to test: 7, 14, 30.
CENSORSHIP_DAYS = _env_int("CENSORSHIP_DAYS", 0)

# Markov states — classified in SQL via utm_medium + utm_source only.
# utm_campaign is intentionally ignored: naming conventions are inconsistent
# and all Google CPC types share the same medium/source pair.
TRACKED_STATES = {
    # Paid Social
    "Paid Meta Ads",
    # Google (all CPC types unified: Search, Shopping, PMax, Demand Gen)
    "Google Ads",
    # Other paid
    "Display / Retargeting",
    # CRM / owned
    "Email",
    "WhatsApp CRM",
    "SMS",
    # Organic
    "Organic Social / Instagram",
    "Organic Social / Facebook",
    "Organic Search",
    "Direct",
    # Misc
    "Influencers",
    "Clube GoCase",
    "Referral",
    "Other",
}

# States that represent paid spend (used for ROAS calculation)
PAID_CHANNELS = {
    "Paid Meta Ads",
    "Google Ads",
    "Display / Retargeting",
}
