export type ScenarioStep = { id: string; label: string };

export type ScenarioSimulationResult<TMetric = unknown> = {
  description: string;
  metrics: TMetric[];
};

// TODO(api): replace the static fallback with a real simulation call
// (e.g. POST /scenarios/simulate). For now this hook returns the provided
// fallback regardless of the input path so the UI can be wired end-to-end.
// Lives in shared/hooks so it can be reused by Journeys and Experiments
// without cross-feature imports.
export function useScenarioSimulation<TMetric>(
  _steps: ScenarioStep[],
  fallback: ScenarioSimulationResult<TMetric>,
): ScenarioSimulationResult<TMetric> {
  return fallback;
}
