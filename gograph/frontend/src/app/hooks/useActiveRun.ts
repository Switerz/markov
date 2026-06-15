import { useQuery } from "@tanstack/react-query";
import { api, type ModelRun } from "../../lib/api";

export function useRunsList() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: () => api.listRuns(),
    staleTime: 60_000,
  });
}

export function useActiveRun(): ModelRun | null {
  const { data } = useRunsList();
  if (!data || data.length === 0) return null;
  // pick the most recent completed run; fall back to most recent overall.
  const completed = data.find((r) => r.status === "completed");
  return completed ?? data[0];
}
