"""ROAS calculation and channel recommendations."""

import pandas as pd
import numpy as np
from typing import Optional, Set

SPECIAL_STATES = {"(start)", "Conversion", "Non-Conversion"}


def compute_roas(
    attribution_df: pd.DataFrame,
    spend_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Merge Markov attribution with spend data to compute ROAS per channel.

    attribution_df: output of markov.compute_attribution()
    spend_df:       columns [channel, spend]
    """
    df = attribution_df.merge(spend_df, on="channel", how="left")
    df["spend"] = df["spend"].fillna(0.0)
    df["roas_markov"] = np.where(
        df["spend"].fillna(0) > 0,
        df["attributed_revenue"] / df["spend"].replace(0, np.nan),
        np.nan,
    )
    return df


def merge_shapley_roas(
    roas_df: pd.DataFrame,
    shapley_df: pd.DataFrame,
    spend_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Merge Markov ROAS with Shapley attribution into a single comparison DataFrame.
    Adds columns: shapley_value, shapley_weight, shapley_revenue, roas_shapley.
    """
    shapley_with_roas = shapley_df.merge(spend_df, on="channel", how="left")
    shapley_with_roas["spend"] = shapley_with_roas["spend"].fillna(0.0)
    shapley_with_roas["roas_shapley"] = np.where(
        shapley_with_roas["spend"] > 0,
        shapley_with_roas["shapley_revenue"] / shapley_with_roas["spend"].replace(0, np.nan),
        np.nan,
    )
    merged = roas_df.merge(
        shapley_with_roas[["channel", "shapley_value", "shapley_weight", "shapley_revenue", "roas_shapley"]],
        on="channel",
        how="left",
    )
    return merged


def build_channel_diagnostics(
    converting_df: pd.DataFrame,
    nonconverting_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Channel presence diagnostics used to qualify attribution recommendations.

    Shares are computed separately for converting and non-converting journeys so
    high-volume channels can be flagged when they appear often without creating
    corresponding attribution value.
    """
    conv = converting_df.copy()
    nconv = nonconverting_df.copy()
    conv["n"] = pd.to_numeric(conv["n"], errors="coerce").fillna(0.0)
    nconv["n"] = pd.to_numeric(nconv["n"], errors="coerce").fillna(0.0)

    channels = (
        set(conv["from_ch"]) | set(conv["to_ch"]) |
        set(nconv["from_ch"]) | set(nconv["to_ch"])
    ) - SPECIAL_STATES
    rows = pd.DataFrame({"channel": sorted(channels)})

    def _share(df: pd.DataFrame, mask, group_col: str, name: str) -> pd.DataFrame:
        subset = df.loc[mask].copy()
        total = subset["n"].sum()
        if total <= 0:
            return pd.DataFrame({"channel": [], name: []})
        grouped = subset.groupby(group_col, as_index=False)["n"].sum()
        grouped = grouped.rename(columns={group_col: "channel", "n": name})
        grouped[name] = grouped[name] / total
        return grouped

    def _self_loop_share(df: pd.DataFrame, name: str) -> pd.DataFrame:
        total = df["n"].sum()
        if total <= 0:
            return pd.DataFrame({"channel": [], name: []})
        subset = df[
            (df["from_ch"] == df["to_ch"]) &
            (~df["from_ch"].isin(SPECIAL_STATES))
        ]
        grouped = subset.groupby("from_ch", as_index=False)["n"].sum()
        grouped = grouped.rename(columns={"from_ch": "channel", "n": name})
        grouped[name] = grouped[name] / total
        return grouped

    diagnostics = rows
    specs = [
        _share(conv, conv["from_ch"] == "(start)", "to_ch", "conv_start_share"),
        _share(conv, conv["to_ch"] == "Conversion", "from_ch", "conv_last_share"),
        _share(
            conv,
            (conv["from_ch"] != "(start)") &
            (~conv["to_ch"].isin(["Conversion", "Non-Conversion"])),
            "to_ch",
            "conv_middle_in_share",
        ),
        _share(nconv, nconv["from_ch"] == "(start)", "to_ch", "nonconv_start_share"),
        _share(nconv, nconv["to_ch"] == "Non-Conversion", "from_ch", "nonconv_last_share"),
        _share(
            nconv,
            (nconv["from_ch"] != "(start)") &
            (~nconv["to_ch"].isin(["Conversion", "Non-Conversion"])),
            "to_ch",
            "nonconv_middle_in_share",
        ),
        _self_loop_share(conv, "conv_self_loop_share"),
        _self_loop_share(nconv, "nonconv_self_loop_share"),
    ]
    for spec in specs:
        diagnostics = diagnostics.merge(spec, on="channel", how="left")

    share_cols = [c for c in diagnostics.columns if c != "channel"]
    diagnostics[share_cols] = diagnostics[share_cols].fillna(0.0)
    diagnostics["conv_presence_share"] = diagnostics[
        ["conv_start_share", "conv_last_share", "conv_middle_in_share"]
    ].max(axis=1)
    diagnostics["nonconv_presence_share"] = diagnostics[
        ["nonconv_start_share", "nonconv_last_share", "nonconv_middle_in_share"]
    ].max(axis=1)
    diagnostics["presence_gap_pp"] = (
        diagnostics["conv_presence_share"] -
        diagnostics["nonconv_presence_share"]
    ) * 100
    return diagnostics


def merge_channel_diagnostics(
    attribution_df: pd.DataFrame,
    diagnostics_df: pd.DataFrame,
) -> pd.DataFrame:
    """Attach channel presence diagnostics to the attribution/ROAS table."""
    df = attribution_df.merge(diagnostics_df, on="channel", how="left")
    diagnostic_cols = [c for c in diagnostics_df.columns if c != "channel"]
    df[diagnostic_cols] = df[diagnostic_cols].fillna(0.0)
    return df


def generate_recommendations(
    roas_df: pd.DataFrame,
    roas_threshold: float = 3.0,
    paid_channels: Optional[Set[str]] = None,
    material_weight: float = 0.05,
    conflict_pp: float = 5.0,
    high_presence_share: float = 0.20,
) -> pd.DataFrame:
    """
    Combined attribution recommendations.

    Markov remains the operational baseline for ROAS, while Shapley and
    transition presence qualify whether the action is consensus, assistive,
    demand-capture, or an attribution conflict that needs investigation.
    """
    df = roas_df.copy()
    paid_channels = set(paid_channels or [])

    for col in ["attribution_weight", "shapley_weight", "spend"]:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    for col in [
        "conv_presence_share", "nonconv_presence_share",
        "conv_start_share", "conv_last_share", "conv_middle_in_share",
        "nonconv_start_share", "nonconv_last_share", "nonconv_middle_in_share",
    ]:
        if col not in df.columns:
            df[col] = 0.0

    df["weight_diff_pp"] = (df["shapley_weight"] - df["attribution_weight"]) * 100
    df["abs_weight_diff_pp"] = df["weight_diff_pp"].abs()
    df["paid_actionability"] = np.where(
        df["channel"].isin(paid_channels) | (df["spend"] > 0),
        "Paid / budget-actionable",
        "Context / owned / no spend",
    )
    df["channel_role"] = "Other / review mapping"
    df.loc[df["channel"].isin(paid_channels) | (df["spend"] > 0), "channel_role"] = "Paid media"
    df.loc[df["channel"].isin(["Email", "WhatsApp CRM", "SMS"]), "channel_role"] = "Owned CRM"
    df.loc[df["channel"].str.contains("Organic", case=False, na=False), "channel_role"] = "Organic"
    df.loc[df["channel"].isin(["Direct", "Other"]), "channel_role"] = "Context / tracking"
    df.loc[df["channel"].isin(["Referral", "Influencers", "Clube GoCase"]), "channel_role"] = "Partner / community"

    df["attribution_alignment"] = "Aligned / low conflict"
    no_signal = (df["attribution_weight"] < 0.005) & (df["shapley_weight"] < 0.005)
    markov_dominant = (
        (df["attribution_weight"] >= material_weight) &
        (df["shapley_weight"] < df["attribution_weight"] * 0.6) &
        (df["abs_weight_diff_pp"] >= conflict_pp)
    )
    shapley_dominant = (
        (df["shapley_weight"] >= material_weight) &
        (df["shapley_weight"] > df["attribution_weight"] * 1.75) &
        (df["abs_weight_diff_pp"] >= conflict_pp)
    )
    consensus = (
        (df["attribution_weight"] >= material_weight) &
        (df["shapley_weight"] >= material_weight) &
        (df["abs_weight_diff_pp"] < conflict_pp)
    )
    df.loc[no_signal, "attribution_alignment"] = "No attribution signal"
    df.loc[consensus, "attribution_alignment"] = "Consensus value"
    df.loc[markov_dominant, "attribution_alignment"] = "Markov-dominant / check incrementality"
    df.loc[shapley_dominant, "attribution_alignment"] = "Shapley-dominant / assist channel"

    df["presence_warning"] = ""
    high_presence_low_value = (
        (df[["conv_presence_share", "nonconv_presence_share"]].max(axis=1) >= high_presence_share) &
        ((df["attribution_weight"] + df["shapley_weight"]) < material_weight)
    )
    nonconv_heavy = (
        (df["nonconv_presence_share"] >= high_presence_share) &
        (df["nonconv_presence_share"] > df["conv_presence_share"] * 1.25)
    )
    df.loc[high_presence_low_value, "presence_warning"] = "High presence, low attributed value"
    df.loc[nonconv_heavy, "presence_warning"] = "Over-indexes in non-converting journeys"

    df["recommendation"] = "Hold / Monitor"

    paid = df["paid_actionability"] == "Paid / budget-actionable"
    strong_scale = (
        paid &
        (df["roas_markov"] >= roas_threshold) &
        (df["roas_shapley"] >= roas_threshold * 0.75) &
        (df["attribution_alignment"].isin(["Consensus value", "Aligned / low conflict"]))
    )
    scale_test = (
        paid &
        (df["roas_markov"] >= roas_threshold) &
        (df["attribution_alignment"] == "Markov-dominant / check incrementality")
    )
    weak_paid = (
        paid &
        (df["roas_markov"] < roas_threshold * 0.5) &
        (df["roas_shapley"] < roas_threshold * 0.5) &
        (df["attribution_weight"] < material_weight) &
        (df["shapley_weight"] < material_weight)
    )
    assist = (
        (df["attribution_alignment"] == "Shapley-dominant / assist channel") &
        (df["shapley_weight"] >= material_weight)
    )
    no_spend_value = (
        ~paid &
        ((df["attribution_weight"] >= material_weight) | (df["shapley_weight"] >= material_weight))
    )

    df.loc[strong_scale, "recommendation"] = "Scale Up - Strong Consensus"
    df.loc[scale_test, "recommendation"] = "Scale Up - Check Incrementality"
    df.loc[weak_paid, "recommendation"] = "Scale Down - Weak Consensus"
    df.loc[assist, "recommendation"] = "Protect / Assist Channel"
    df.loc[no_spend_value, "recommendation"] = "Non-Paid / Context Channel"
    df.loc[
        (df["abs_weight_diff_pp"] >= conflict_pp) &
        ~(strong_scale | scale_test | assist | no_spend_value),
        "recommendation",
    ] = "Investigate Attribution Conflict"
    df.loc[
        df["presence_warning"].ne("") &
        ~(strong_scale | scale_test | assist | no_spend_value),
        "recommendation",
    ] = "Investigate High Presence Low Value"

    df["_paid_sort"] = np.where(df["paid_actionability"] == "Paid / budget-actionable", 0, 1)
    sort_cols = ["_paid_sort", "roas_markov", "shapley_weight", "attribution_weight"]
    df = df.sort_values(sort_cols, ascending=[True, False, False, False], na_position="last")
    df = df.drop(columns=["_paid_sort"])
    return df


def top_converting_journeys(converting_df: pd.DataFrame, top_n: int = 20) -> pd.DataFrame:
    """
    Aggregate the most common converting channel sequences and their revenue.
    Useful for audience and remarketing insights.
    """
    return (
        converting_df
        .groupby(["from_ch", "to_ch"])
        .agg(transitions=("n", "sum"), revenue=("total_revenue", "sum"))
        .reset_index()
        .sort_values("transitions", ascending=False)
        .head(top_n)
    )
