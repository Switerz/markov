"""
Markov Attribution Model — main entry point.

Usage:
    python run.py

Output:
    results/attribution_<start>_<end>.xlsx  — full attribution + ROAS report
    results/transitions_converting.csv      — raw converting transition counts
    results/transitions_nonconverting.csv   — raw non-converting transition counts
"""

import os
import pandas as pd
import numpy as np
from datetime import datetime

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


def main():
    # ------------------------------------------------------------------
    # 1. Converting transitions
    # ------------------------------------------------------------------
    print(f"[1/8] Extracting converting transitions "
          f"({config.START_DATE} → {config.END_DATE}, "
          f"decay λ={config.DECAY_LAMBDA})...")
    conv_df = get_converting_transitions(
        database_id=config.DB_PLAUSIBLE,
        start_date=config.START_DATE,
        end_date=config.END_DATE,
        lookback=config.LOOKBACK_DAYS,
        decay_lambda=config.DECAY_LAMBDA,
    )
    conv_df.to_csv("results/transitions_converting.csv", index=False)
    print(f"      {len(conv_df)} transition pairs, "
          f"R$ {conv_df['total_revenue'].sum():,.2f} total revenue (raw sum)")

    # ------------------------------------------------------------------
    # 2. Non-converting transitions
    # ------------------------------------------------------------------
    print(f"[2/8] Extracting non-converting transitions "
          f"(sample {config.NON_CONV_SAMPLE_PCT}% of non-converters)...")
    nconv_df = get_nonconverting_transitions(
        database_id=config.DB_PLAUSIBLE,
        start_date=config.START_DATE,
        end_date=config.END_DATE,
        sample_pct=config.NON_CONV_SAMPLE_PCT,
    )
    nconv_df.to_csv("results/transitions_nonconverting.csv", index=False)
    print(f"      {len(nconv_df)} transition pairs")

    # ------------------------------------------------------------------
    # 3. Auto-calibrate NON_CONV_SCALE so P(Conv|start) ≈ real rate
    # ------------------------------------------------------------------
    print("[3/8] Calibrating NON_CONV_SCALE...")
    if config.NON_CONV_SCALE is not None:
        scale = config.NON_CONV_SCALE
        print(f"      Using fixed scale from config: {scale}")
    else:
        print("      Querying observed conversion rate...")
        obs_rate = get_conversion_rate(
            database_id=config.DB_PLAUSIBLE,
            start_date=config.START_DATE,
            end_date=config.END_DATE,
            sample_pct=config.NON_CONV_SAMPLE_PCT,
        )
        print(f"      Observed conversion rate: {obs_rate:.4%}")
        scale = calibrate_nonconv_scale(conv_df, nconv_df, target_rate=obs_rate)
        print(f"      Calibrated NON_CONV_SCALE = {scale:.2f}")

    # ------------------------------------------------------------------
    # 4. Build transition matrix
    # ------------------------------------------------------------------
    print(f"[4/8] Building transition matrix (NON_CONV_SCALE = {scale:.2f})...")
    T, states = build_transition_matrix(conv_df, nconv_df, scale_nonconv=scale)
    implied_rate = _conversion_probability(T, states)
    print(f"      Matrix shape: {T.shape}, states: {len(states)}")
    print(f"      Implied P(Conversion|start) = {implied_rate:.4%}")

    # ------------------------------------------------------------------
    # 5. True revenue
    # ------------------------------------------------------------------
    print("[5/8] Fetching true total revenue (unique purchases)...")
    true_revenue = get_total_revenue(
        database_id=config.DB_PLAUSIBLE,
        start_date=config.START_DATE,
        end_date=config.END_DATE,
    )
    print(f"      R$ {true_revenue:,.2f}")

    # ------------------------------------------------------------------
    # 6. Markov removal effects + attribution
    # ------------------------------------------------------------------
    print("[6/8] Computing Markov removal effects...")
    removal_effects = compute_removal_effects(T, states)
    for ch, eff in sorted(removal_effects.items(), key=lambda x: -x[1]):
        print(f"      {ch:<30} removal_effect = {eff:.6f}")

    markov_df = compute_attribution(removal_effects, conv_df, total_revenue=true_revenue)

    # ------------------------------------------------------------------
    # 7. Shapley values + attribution
    # ------------------------------------------------------------------
    print(f"[7/8] Computing Shapley values ({config.SHAPLEY_SAMPLES} MC samples)...")
    shapley_vals = compute_shapley_values(T, states, n_samples=config.SHAPLEY_SAMPLES)
    for ch, sv in sorted(shapley_vals.items(), key=lambda x: -x[1]):
        print(f"      {ch:<30} shapley = {sv:.6f}")

    shapley_df = compute_shapley_attribution(shapley_vals, total_revenue=true_revenue)

    # ------------------------------------------------------------------
    # 8. ROAS report
    # ------------------------------------------------------------------
    print("[8/8] Building ROAS report...")
    if config.DB_DATAMART is not None:
        spend_df = get_channel_spend(
            db_datamart=config.DB_DATAMART,
            start_date=config.START_DATE,
            end_date=config.END_DATE,
        )
    else:
        print("      WARNING: DB_DATAMART not configured — ROAS will be NaN.")
        spend_df = pd.DataFrame(columns=["channel", "spend"])

    roas_df   = compute_roas(markov_df, spend_df)
    merged_df = merge_shapley_roas(roas_df, shapley_df, spend_df)
    diagnostics_df = build_channel_diagnostics(conv_df, nconv_df)
    merged_df = merge_channel_diagnostics(merged_df, diagnostics_df)
    recs_df   = generate_recommendations(merged_df, paid_channels=config.PAID_CHANNELS)
    top_df    = top_converting_journeys(conv_df)

    # ------------------------------------------------------------------
    # Excel report
    # ------------------------------------------------------------------
    fname = f"results/attribution_{config.START_DATE}_{config.END_DATE}.xlsx"
    with pd.ExcelWriter(fname, engine="openpyxl") as writer:
        # Main comparison: Markov vs Shapley side by side
        cols_main = [
            "channel",
            "attribution_weight", "attributed_revenue",
            "shapley_weight", "shapley_revenue",
            "weight_diff_pp", "attribution_alignment",
            "spend",
            "roas_markov", "roas_shapley",
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

        # Standalone Shapley sheet (sorted by Shapley weight)
        shapley_sorted = merged_df[["channel", "shapley_value", "shapley_weight", "shapley_revenue", "roas_shapley"]]\
            .sort_values("shapley_weight", ascending=False)
        shapley_sorted.to_excel(writer, sheet_name="Shapley", index=False)

        top_df.to_excel(writer, sheet_name="Top Transitions", index=False)
        conv_df.to_excel(writer, sheet_name="Converting Transitions", index=False)
        nconv_df.to_excel(writer, sheet_name="Non-Conv Transitions", index=False)

        T_df = pd.DataFrame(T, index=states, columns=states).round(6)
        T_df.to_excel(writer, sheet_name="Transition Matrix")

    print(f"\nReport saved: {fname}")
    print("\n=== Summary (Markov vs Shapley) ===")
    summary_cols = [
        "channel", "attribution_weight", "attributed_revenue",
        "shapley_weight", "shapley_revenue", "weight_diff_pp",
        "roas_markov", "roas_shapley", "attribution_alignment", "recommendation",
    ]
    print(recs_df[summary_cols].to_string(index=False))


if __name__ == "__main__":
    main()
