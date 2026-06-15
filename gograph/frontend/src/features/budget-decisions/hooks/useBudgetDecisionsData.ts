import { budgetDecisionsMock } from "../budget-decisions.mock";
import type { BudgetDecisionsData, SelectedChannelDrawer } from "../types";

export type UseBudgetDecisionsData = BudgetDecisionsData & {
  // Returns the drawer payload for a given channel. For now the API doesn't
  // expose per-channel drawer state yet, so we always return the mock.
  // TODO(api): branch on the selected channel once the endpoint exists.
  getDrawerForChannel: (channel: string) => SelectedChannelDrawer;
};

// TODO(api): when the budget decisions endpoint exists, compose data from:
//   ["channels", runId]     → api.getChannels(runId)
//   ["diagnostics", runId]  → api.getDiagnostics(runId)
// and merge into BudgetDecisionsData.
export function useBudgetDecisionsData(): UseBudgetDecisionsData {
  return {
    ...budgetDecisionsMock,
    getDrawerForChannel: (_channel: string) =>
      budgetDecisionsMock.selectedChannelDrawer,
  };
}
