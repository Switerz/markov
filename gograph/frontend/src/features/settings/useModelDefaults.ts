import { useCallback, useEffect, useState } from "react";
import type { ModelRunCreatePayload } from "../../lib/api";

// Default model parameters persisted in localStorage. Replaces .env-baked
// values so users can tune the model from the UI.
export type ModelDefaults = {
  lookback_days: number;
  decay_lambda: number;
  shapley_samples: number;
  non_conv_sample_pct: number;
  non_conv_scale: number | null;
  censorship_days: number;
  batch_mode: "auto" | "always" | "never";
  batch_days: number;
  db_plausible: number;
  db_datamart: number | null;
};

export const DEFAULT_MODEL_DEFAULTS: ModelDefaults = {
  lookback_days: 30,
  decay_lambda: 0.05,
  shapley_samples: 5000,
  non_conv_sample_pct: 1,
  non_conv_scale: null,
  censorship_days: 0,
  batch_mode: "auto",
  batch_days: 35,
  db_plausible: 70,
  db_datamart: 63,
};

const STORAGE_KEY = "gograph.modelDefaults.v1";

function readStorage(): ModelDefaults {
  if (typeof window === "undefined") return DEFAULT_MODEL_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MODEL_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ModelDefaults>;
    return { ...DEFAULT_MODEL_DEFAULTS, ...parsed };
  } catch {
    return DEFAULT_MODEL_DEFAULTS;
  }
}

function writeStorage(value: ModelDefaults): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("gograph:modelDefaultsChanged"));
  } catch {
    // ignore
  }
}

export function useModelDefaults(): {
  defaults: ModelDefaults;
  setDefaults: (next: ModelDefaults) => void;
  resetDefaults: () => void;
  asRunPayload: () => Partial<ModelRunCreatePayload>;
} {
  const [defaults, setDefaultsState] = useState<ModelDefaults>(() => readStorage());

  useEffect(() => {
    const refresh = () => setDefaultsState(readStorage());
    window.addEventListener("gograph:modelDefaultsChanged", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("gograph:modelDefaultsChanged", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const setDefaults = useCallback((next: ModelDefaults) => {
    writeStorage(next);
    setDefaultsState(next);
  }, []);

  const resetDefaults = useCallback(() => {
    writeStorage(DEFAULT_MODEL_DEFAULTS);
    setDefaultsState(DEFAULT_MODEL_DEFAULTS);
  }, []);

  const asRunPayload = useCallback((): Partial<ModelRunCreatePayload> => {
    return {
      lookback_days: defaults.lookback_days,
      decay_lambda: defaults.decay_lambda,
      shapley_samples: defaults.shapley_samples,
      non_conv_sample_pct: defaults.non_conv_sample_pct,
      non_conv_scale: defaults.non_conv_scale,
      batch_mode: defaults.batch_mode,
      batch_days: defaults.batch_days,
      db_plausible: defaults.db_plausible,
      db_datamart: defaults.db_datamart,
    };
  }, [defaults]);

  return { defaults, setDefaults, resetDefaults, asRunPayload };
}
