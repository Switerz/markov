import { executionsQualityMock } from "../executions-quality.mock";
import type { ExecutionsQualityData } from "../types";

// TODO(api): integrate with api.listRuns() + api.getOverview(id) + api.getDataQuality(id).
export function useExecutionsQualityData(): ExecutionsQualityData {
  return executionsQualityMock;
}
