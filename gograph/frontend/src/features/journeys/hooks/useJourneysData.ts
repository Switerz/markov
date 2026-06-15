import { journeysMock } from "../journeys.mock";
import type { JourneysData } from "../types";

// TODO(api): compose from api.getGraph(runId) + api.getPaths(runId)
// + api.getLoops(runId) + api.getLoopDiagnostics(runId).
export function useJourneysData(): JourneysData {
  return journeysMock;
}
