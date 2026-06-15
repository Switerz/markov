import { experimentsMock } from "../experiments.mock";
import type { ExperimentsData } from "../types";

// TODO(api): integrate with api.listScenarios + api.compareScenarios + api.analyzeScenario.
export function useExperimentsData(): ExperimentsData {
  return experimentsMock;
}
