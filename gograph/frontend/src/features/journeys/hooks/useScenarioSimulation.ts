import type { EstimatedMetric } from "../types";

export type ScenarioStep = { id: string; label: string };

export type ScenarioSimulationResult = {
  description: string;
  metrics: EstimatedMetric[];
};

// TODO(api): replace the static fallback with a real simulation call
// (e.g. POST /scenarios/simulate). For Phase 8 this hook returns the mock
// metrics regardless of the input path so the UI can be wired end-to-end.
export function useScenarioSimulation(
  _steps: ScenarioStep[],
  fallback: ScenarioSimulationResult,
): ScenarioSimulationResult {
  return fallback;
}
