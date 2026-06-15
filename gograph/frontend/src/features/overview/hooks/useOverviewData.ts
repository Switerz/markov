import { overviewMock } from "../overview.mock";
import type { OverviewData } from "../types";

// TODO(api): when the Overview endpoint exists, compose data from:
//   ["overview", runId]     → api.getOverview(runId)
//   ["channels", runId]     → api.getChannels(runId)
//   ["diagnostics", runId]  → api.getDiagnostics(runId)
//   ["data-quality", runId] → api.getDataQuality(runId)
// and merge into OverviewData.
export function useOverviewData(): OverviewData {
  return overviewMock;
}
