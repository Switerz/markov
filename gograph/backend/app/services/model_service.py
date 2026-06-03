"""Single-call orchestration service for the GoGraph analytical engine."""

from time import perf_counter
from typing import Optional, Set

import pandas as pd

import config
from extract import get_funnel_enriched_paths
from gograph.backend.app.schemas import ModelRunParams, ModelRunResult
from gograph.backend.app.services import (
    attribution_service, extraction_service, path_service
)
from gograph.backend.app.services.insight_service import compute_data_quality
from gograph.backend.app.services.loop_service import (
    compute_loop_diagnostics,
)
from gograph.backend.app.services.sequential_service import compute_sequential_effects
from gograph.backend.app.services.funnel_markov_service import (
    run_funnel_markov,
)
from gograph.backend.app.services.roas_service import (
    compute_channel_diagnostics,
    compute_roas
)


def params_from_config() -> ModelRunParams:
    return ModelRunParams(
        start_date=config.START_DATE,
        end_date=config.END_DATE,
        db_plausible=config.DB_PLAUSIBLE,
        db_datamart=config.DB_DATAMART,
        lookback_days=config.LOOKBACK_DAYS,
        non_conv_sample_pct=config.NON_CONV_SAMPLE_PCT,
        non_conv_scale=config.NON_CONV_SCALE,
        decay_lambda=config.DECAY_LAMBDA,
        shapley_samples=config.SHAPLEY_SAMPLES,
        batch_mode=config.MODEL_BATCH_MODE,
        batch_days=config.MODEL_BATCH_DAYS,
        censorship_days=config.CENSORSHIP_DAYS,
    )


def run_model(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    params: Optional[ModelRunParams] = None,
    converting_transitions: Optional[pd.DataFrame] = None,
    nonconverting_transitions: Optional[pd.DataFrame] = None,
    spend: Optional[pd.DataFrame] = None,
    total_revenue: Optional[float] = None,
    observed_conversion_rate: Optional[float] = None,
    raw_paths: Optional[pd.DataFrame] = None,
    paid_channels: Optional[Set[str]] = None,
) -> ModelRunResult:
    """
    Run the full attribution engine through a reusable service contract.

    DataFrames can be injected for tests or persisted re-runs. When they are not
    provided, the service extracts data through the current Metabase functions.
    """
    started = perf_counter()
    params = params or params_from_config()
    if start_date is not None or end_date is not None:
        params = ModelRunParams(
            **{
                **params.to_dict(),
                "start_date": start_date or params.start_date,
                "end_date": end_date or params.end_date,
            }
        )

    if converting_transitions is None or nonconverting_transitions is None:
        converting_transitions, nonconverting_transitions = (
            extraction_service.extract_transition_counts(params)
        )

    if converting_transitions.empty:
        raise RuntimeError(
            f"Nenhuma transição de conversão extraída para {params.start_date}–{params.end_date}. "
            "Verifique se a tabela de compras tem dados para o período e se o join com sessões está "
            "funcionando. Pode ser uma falha transitória — tente rodar novamente."
        )

    if observed_conversion_rate is None and params.non_conv_scale is None:
        observed_conversion_rate = extraction_service.extract_observed_conversion_rate(params)

    scale = attribution_service.calibrate_nonconv_scale(
        converting_transitions,
        nonconverting_transitions,
        fixed_scale=params.non_conv_scale,
        observed_conversion_rate=observed_conversion_rate,
    )
    T, states = attribution_service.build_transition_matrix(
        converting_transitions,
        nonconverting_transitions,
        scale_nonconv=scale,
    )
    model_conversion_rate = attribution_service.compute_model_conversion_probability(
        T,
        states,
    )

    if total_revenue is None:
        total_revenue = extraction_service.extract_total_revenue(params)
    if spend is None:
        spend = extraction_service.extract_spend(params)

    markov_results = attribution_service.compute_markov_attribution(
        T,
        states,
        converting_transitions,
        total_revenue=total_revenue,
    )
    shapley_results = attribution_service.compute_shapley_attribution(
        T,
        states,
        total_revenue=total_revenue,
        n_samples=params.shapley_samples,
        seed=params.shapley_seed,
    )
    diagnostics = compute_channel_diagnostics(
        converting_transitions,
        nonconverting_transitions,
    )
    roas_results = compute_roas(
        markov_results,
        shapley_results,
        spend,
        diagnostics,
        paid_channels=paid_channels or config.PAID_CHANNELS,
    )
    data_quality = compute_data_quality(
        converting_transitions,
        nonconverting_transitions,
        spend,
        observed_conversion_rate,
        model_conversion_rate,
    )
    transition_matrix = pd.DataFrame(T, index=states, columns=states).round(6)

    # Sprint 7: Path Intelligence — extract only if not injected, fail gracefully
    if raw_paths is None:
        try:
            raw_paths = extraction_service.extract_raw_paths(params)
        except Exception:
            raw_paths = pd.DataFrame()
    # top_n=500 stores enough paths to make sandbox historical analysis reliable.
    # The raw_paths SQL aggregates by path_sequence so 500 rows is still light.
    top_paths = path_service.enrich_raw_paths(raw_paths, transition_matrix, top_n=500)

    transition_counts = attribution_service.build_transition_counts(
        converting_transitions,
        nonconverting_transitions,
    )

    # -----------------------------------------------------------------
    # Sprint 11 — Loop Diagnostics (works on existing raw_paths)
    # -----------------------------------------------------------------
    try:
        loop_diagnostics = compute_loop_diagnostics(raw_paths) if not raw_paths.empty else pd.DataFrame()
    except Exception:
        loop_diagnostics = pd.DataFrame()

    # -----------------------------------------------------------------
    # Sprint 14 — Sequential Effects / Order-2 Diagnostics
    # -----------------------------------------------------------------
    try:
        sequential_effects = compute_sequential_effects(raw_paths) if not raw_paths.empty else pd.DataFrame()
    except Exception:
        sequential_effects = pd.DataFrame()

    # -----------------------------------------------------------------
    # Sprint 13 — Funnel Stage Markov (requires Events V2, graceful fallback)
    # -----------------------------------------------------------------
    funnel_state_df: pd.DataFrame = pd.DataFrame()
    funnel_channel_df: pd.DataFrame = pd.DataFrame()
    try:
        funnel_paths = get_funnel_enriched_paths(
            database_id=params.db_plausible,
            start_date=params.start_date,
            end_date=params.end_date,
            lookback=params.lookback_days,
        )
        if not funnel_paths.empty:
            funnel_state_df, funnel_channel_df = run_funnel_markov(
                funnel_paths=funnel_paths,
                total_revenue=float(total_revenue),
                non_conv_scale=scale,
                shapley_samples=min(params.shapley_samples, 1000),
            )
    except Exception:
        pass

    runtime_seconds = perf_counter() - started

    return ModelRunResult(
        parameters=params,
        transition_counts=transition_counts,
        transition_matrix=transition_matrix,
        states=states,
        markov_results=markov_results,
        shapley_results=shapley_results,
        roas_results=roas_results,
        diagnostics=diagnostics,
        top_paths=top_paths,
        data_quality=data_quality,
        observed_conversion_rate=observed_conversion_rate,
        model_conversion_rate=model_conversion_rate,
        total_revenue=float(total_revenue),
        total_spend=float(spend["spend"].sum()) if "spend" in spend.columns else 0.0,
        non_conv_scale=scale,
        runtime_seconds=runtime_seconds,
        loop_diagnostics=loop_diagnostics if not loop_diagnostics.empty else None,
        funnel_state_attribution=funnel_state_df if not funnel_state_df.empty else None,
        funnel_channel_attribution=funnel_channel_df if not funnel_channel_df.empty else None,
        sequential_effects=sequential_effects if not sequential_effects.empty else None,
    )
