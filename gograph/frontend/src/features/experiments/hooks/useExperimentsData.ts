import { experimentsMock } from "../experiments.mock";
import type { ExperimentsData } from "../types";

// Static screen chrome; live scenarios are loaded by useScenarios.
export function useExperimentsData(): ExperimentsData {
  return experimentsMock;
}
