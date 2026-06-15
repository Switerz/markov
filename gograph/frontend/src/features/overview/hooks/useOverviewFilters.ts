import { useCallback, useState } from "react";
import type { DateRange } from "../../../shared/ui";

// State container for the Overview top-bar filters.
//
// The mock data currently drives every visible row in the page — these filter
// values exist only to make the controls interactive. When an API-backed
// overview endpoint exists, lift the same `OverviewFilters` shape into the
// query key so the data refetches on change.
export type OverviewFilters = {
  account: string;
  period: DateRange;
  compareWith: DateRange;
  executionId: string | null;
};

const INITIAL: OverviewFilters = {
  account: "GoCase",
  period: { from: null, to: null },
  compareWith: { from: null, to: null },
  executionId: null,
};

export function useOverviewFilters() {
  const [filters, setFilters] = useState<OverviewFilters>(INITIAL);

  const set = useCallback(
    <K extends keyof OverviewFilters>(key: K, value: OverviewFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => setFilters(INITIAL), []);

  return { filters, set, reset };
}
