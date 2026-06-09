"""
One-shot cache extraction. Used to feed parallel hypothesis-testing agents
without hammering ClickHouse 3× simultaneously.

Outputs to /tmp/markov_cache/:
  raw_paths.pkl
  conv.pkl
  nconv.pkl
  spend.pkl
  params.json  {total_revenue, scale, target_rate, start, end, lookback}
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import config
from extract import (
    get_channel_spend,
    get_conversion_rate,
    get_converting_transitions,
    get_nonconverting_transitions,
    get_raw_paths,
    get_total_revenue,
)
from markov import calibrate_nonconv_scale


CACHE_DIR = Path("/tmp/markov_cache")


def main(start: str, end: str) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Janela: {start} a {end}, lookback={config.LOOKBACK_DAYS}d")

    print("→ raw_paths (no_limit=True) …")
    raw = get_raw_paths(
        database_id=config.DB_PLAUSIBLE,
        start_date=start,
        end_date=end,
        lookback=config.LOOKBACK_DAYS,
        no_limit=True,
        nonconv_sample_pct=config.NON_CONV_SAMPLE_PCT,
    )
    raw.to_pickle(CACHE_DIR / "raw_paths.pkl")
    print(f"   rows={len(raw):,}")

    print("→ converting transitions …")
    conv = get_converting_transitions(
        database_id=config.DB_PLAUSIBLE,
        start_date=start, end_date=end,
        lookback=config.LOOKBACK_DAYS,
        decay_lambda=config.DECAY_LAMBDA,
    )
    conv.to_pickle(CACHE_DIR / "conv.pkl")
    print(f"   rows={len(conv):,}")

    print("→ non-converting transitions …")
    nconv = get_nonconverting_transitions(
        database_id=config.DB_PLAUSIBLE,
        start_date=start, end_date=end,
        sample_pct=config.NON_CONV_SAMPLE_PCT,
        censorship_days=config.CENSORSHIP_DAYS,
    )
    nconv.to_pickle(CACHE_DIR / "nconv.pkl")
    print(f"   rows={len(nconv):,}")

    print("→ spend …")
    spend = get_channel_spend(
        db_datamart=config.DB_DATAMART, start_date=start, end_date=end
    )
    spend.to_pickle(CACHE_DIR / "spend.pkl")
    print(f"   channels={len(spend)}")

    print("→ params (total_revenue, scale) …")
    total_revenue = get_total_revenue(
        database_id=config.DB_PLAUSIBLE, start_date=start, end_date=end
    )
    if config.NON_CONV_SCALE is None:
        target_rate = get_conversion_rate(
            database_id=config.DB_PLAUSIBLE,
            start_date=start, end_date=end,
            sample_pct=config.NON_CONV_SAMPLE_PCT,
            censorship_days=config.CENSORSHIP_DAYS,
        )
        scale = calibrate_nonconv_scale(conv, nconv, target_rate=target_rate)
    else:
        target_rate = None
        scale = config.NON_CONV_SCALE

    params = {
        "start": start,
        "end": end,
        "lookback": config.LOOKBACK_DAYS,
        "decay_lambda": config.DECAY_LAMBDA,
        "total_revenue": float(total_revenue),
        "non_conv_scale": float(scale),
        "target_conversion_rate": float(target_rate) if target_rate is not None else None,
        "non_conv_sample_pct": config.NON_CONV_SAMPLE_PCT,
    }
    (CACHE_DIR / "params.json").write_text(json.dumps(params, indent=2))
    print(json.dumps(params, indent=2))

    print(f"\n✓ Cache em {CACHE_DIR}")


if __name__ == "__main__":
    s = sys.argv[1] if len(sys.argv) > 1 else config.START_DATE
    e = sys.argv[2] if len(sys.argv) > 2 else config.END_DATE
    main(s, e)
