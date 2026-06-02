"""
Quarterly Markov Attribution — batches extraction month-by-month to avoid ClickHouse OOM.

Usage:
    python run_quarter.py

Each month is extracted separately (~100 s each). Transitions are summed locally,
then a single Markov/Shapley model is built from the combined Q1 data.

Output:
    results/attribution_<q_start>_<q_end>.xlsx
    results/transitions_converting_q.csv
    results/transitions_nonconverting_q.csv
"""

import os
import calendar
from datetime import date, timedelta

import pandas as pd

import config
from extract import (
    get_converting_transitions, get_nonconverting_transitions,
    get_channel_spend, get_total_revenue, get_conversion_rate,
)
from markov import (
    build_transition_matrix, compute_removal_effects, compute_attribution,
    compute_shapley_values, compute_shapley_attribution, calibrate_nonconv_scale,
    _conversion_probability,
)
from roas import (
    build_channel_diagnostics, compute_roas, merge_channel_diagnostics,
    merge_shapley_roas, generate_recommendations, top_converting_journeys,
)

os.makedirs("results", exist_ok=True)

# ---------------------------------------------------------------------------
# Quarter definition — override START/END here if needed
# ---------------------------------------------------------------------------
Q_START = "2026-03-01"
Q_END   = "2026-05-26"


def _months_in_range(start: str, end: str):
    """Yield (month_start, month_end) string pairs covering [start, end]."""
    d = date.fromisoformat(start)
    end_d = date.fromisoformat(end)
    while d <= end_d:
        last = calendar.monthrange(d.year, d.month)[1]
        month_end = min(date(d.year, d.month, last), end_d)
        yield str(d), str(month_end)
        d = month_end + timedelta(days=1)


def main():
    months = list(_months_in_range(Q_START, Q_END))
    print(f"Quarter {Q_START} → {Q_END}  ({len(months)} months: {[m[0] for m in months]})")

    # ------------------------------------------------------------------
    # 1 & 2. Extract transitions month-by-month, accumulate
    # ------------------------------------------------------------------
    all_conv  = []
    all_nconv = []

    for i, (ms, me) in enumerate(months, 1):
        print(f"\n[{i}/{len(months)}] Month {ms} → {me}")

        print(f"  Converting transitions (decay λ={config.DECAY_LAMBDA})...")
        c = get_converting_transitions(
            database_id=config.DB_PLAUSIBLE,
            start_date=ms, end_date=me,
            lookback=config.LOOKBACK_DAYS,
            decay_lambda=config.DECAY_LAMBDA,
        )
        print(f"  → {len(c)} pairs, R$ {c['total_revenue'].sum():,.0f}")
        all_conv.append(c)

        print(f"  Non-converting transitions (sample {config.NON_CONV_SAMPLE_PCT}%)...")
        n = get_nonconverting_transitions(
            database_id=config.DB_PLAUSIBLE,
            start_date=ms, end_date=me,
            sample_pct=config.NON_CONV_SAMPLE_PCT,
        )
        print(f"  → {len(n)} pairs")
        all_nconv.append(n)

    # Aggregate across months
    conv_df = (
        pd.concat(all_conv, ignore_index=True)
        .groupby(["from_ch", "to_ch"], as_index=False)
        .agg(n=("n", "sum"), total_revenue=("total_revenue", "sum"))
    )
    nconv_df = (
        pd.concat(all_nconv, ignore_index=True)
        .groupby(["from_ch", "to_ch"], as_index=False)
        .agg(n=("n", "sum"))
    )

    conv_df.to_csv("results/transitions_converting_q.csv", index=False)
    nconv_df.to_csv("results/transitions_nonconverting_q.csv", index=False)
    print(f"\nAggregated: {len(conv_df)} converting pairs, "
          f"{len(nconv_df)} non-converting pairs")

    # ------------------------------------------------------------------
    # 3. Auto-calibrate NON_CONV_SCALE over the full quarter
    # ------------------------------------------------------------------
    print("\n[Calibration] Querying observed conversion rate for full quarter...")
    if config.NON_CONV_SCALE is not None:
        scale = config.NON_CONV_SCALE
        print(f"  Using fixed scale from config: {scale}")
    else:
        obs_rate = get_conversion_rate(
            database_id=config.DB_PLAUSIBLE,
            start_date=Q_START, end_date=Q_END,
            sample_pct=config.NON_CONV_SAMPLE_PCT,
        )
        print(f"  Observed conversion rate: {obs_rate:.4%}")
        scale = calibrate_nonconv_scale(conv_df, nconv_df, target_rate=obs_rate)
        print(f"  Calibrated NON_CONV_SCALE = {scale:.2f}")

    # ------------------------------------------------------------------
    # 4. Build matrix
    # ------------------------------------------------------------------
    print(f"\n[Model] Building transition matrix (scale={scale:.2f})...")
    T, states = build_transition_matrix(conv_df, nconv_df, scale_nonconv=scale)
    implied = _conversion_probability(T, states)
    print(f"  Matrix shape: {T.shape}  |  P(Conv|start) = {implied:.4%}")

    # ------------------------------------------------------------------
    # 5. True revenue for the full quarter
    # ------------------------------------------------------------------
    print("[Revenue] Fetching true total revenue...")
    true_revenue = get_total_revenue(
        database_id=config.DB_PLAUSIBLE,
        start_date=Q_START, end_date=Q_END,
    )
    print(f"  R$ {true_revenue:,.2f}")

    # ------------------------------------------------------------------
    # 6. Markov
    # ------------------------------------------------------------------
    print("[Markov] Computing removal effects...")
    removal_effects = compute_removal_effects(T, states)
    markov_df = compute_attribution(removal_effects, conv_df, total_revenue=true_revenue)

    # ------------------------------------------------------------------
    # 7. Shapley
    # ------------------------------------------------------------------
    print(f"[Shapley] Computing ({config.SHAPLEY_SAMPLES} MC samples)...")
    shapley_vals = compute_shapley_values(T, states, n_samples=config.SHAPLEY_SAMPLES)
    shapley_df   = compute_shapley_attribution(shapley_vals, total_revenue=true_revenue)

    # ------------------------------------------------------------------
    # 8. ROAS & report
    # ------------------------------------------------------------------
    print("[ROAS] Fetching spend for full quarter...")
    if config.DB_DATAMART is not None:
        spend_df = get_channel_spend(
            db_datamart=config.DB_DATAMART,
            start_date=Q_START, end_date=Q_END,
        )
    else:
        spend_df = pd.DataFrame(columns=["channel", "spend"])

    roas_df   = compute_roas(markov_df, spend_df)
    merged_df = merge_shapley_roas(roas_df, shapley_df, spend_df)
    diagnostics_df = build_channel_diagnostics(conv_df, nconv_df)
    merged_df = merge_channel_diagnostics(merged_df, diagnostics_df)
    recs_df   = generate_recommendations(merged_df, paid_channels=config.PAID_CHANNELS)
    top_df    = top_converting_journeys(conv_df)

    fname = f"results/attribution_{Q_START}_{Q_END}.xlsx"
    with pd.ExcelWriter(fname, engine="openpyxl") as writer:
        cols_main = [
            "channel",
            "attribution_weight", "attributed_revenue",
            "shapley_weight", "shapley_revenue",
            "weight_diff_pp", "attribution_alignment",
            "spend", "roas_markov", "roas_shapley",
            "channel_role", "paid_actionability", "presence_warning", "recommendation",
            "conv_presence_share", "nonconv_presence_share", "presence_gap_pp",
        ]
        recs_df[cols_main].to_excel(writer, sheet_name="Attribution & ROAS", index=False)

        diagnostics_cols = [
            "channel",
            "channel_role", "paid_actionability",
            "conv_start_share", "conv_last_share", "conv_middle_in_share",
            "nonconv_start_share", "nonconv_last_share", "nonconv_middle_in_share",
            "conv_self_loop_share", "nonconv_self_loop_share",
            "conv_presence_share", "nonconv_presence_share", "presence_gap_pp",
            "presence_warning",
        ]
        recs_df[diagnostics_cols].to_excel(writer, sheet_name="Channel Diagnostics", index=False)

        shapley_sorted = merged_df[["channel","shapley_value","shapley_weight","shapley_revenue","roas_shapley"]]\
            .sort_values("shapley_weight", ascending=False)
        shapley_sorted.to_excel(writer, sheet_name="Shapley", index=False)
        top_df.to_excel(writer, sheet_name="Top Transitions", index=False)
        conv_df.to_excel(writer, sheet_name="Converting Transitions", index=False)
        nconv_df.to_excel(writer, sheet_name="Non-Conv Transitions", index=False)
        T_df = pd.DataFrame(T, index=states, columns=states).round(6)
        T_df.to_excel(writer, sheet_name="Transition Matrix")

    print(f"\nReport saved: {fname}")
    print("\n=== Q1 Summary ===")
    cols_summary = [
        "channel","attribution_weight","attributed_revenue",
        "shapley_weight","shapley_revenue","weight_diff_pp",
        "roas_markov","roas_shapley","attribution_alignment","recommendation",
    ]
    print(recs_df[cols_summary].to_string(index=False))


if __name__ == "__main__":
    main()
