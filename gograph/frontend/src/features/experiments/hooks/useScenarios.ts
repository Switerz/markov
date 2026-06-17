import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type Scenario,
  type ScenarioAnalysis,
  type ScenarioCreatePayload,
} from "../../../lib/api";

const scenariosKey = (runId: number | undefined) => ["scenarios", runId] as const;

export function useScenarios(runId: number | undefined) {
  return useQuery({
    queryKey: scenariosKey(runId),
    enabled: runId != null,
    queryFn: () => api.listScenarios(runId!),
    staleTime: 30_000,
  });
}

export function useCreateScenario(runId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<ScenarioCreatePayload, "model_run_id">) => {
      if (runId == null) throw new Error("Nenhuma execução ativa.");
      return api.createScenario({ ...payload, model_run_id: runId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scenariosKey(runId) });
    },
  });
}

export function useAnalyzeScenario(runId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: number) => api.analyzeScenario(scenarioId),
    onSuccess: (analysis: ScenarioAnalysis) => {
      void queryClient.invalidateQueries({ queryKey: scenariosKey(runId) });
      void queryClient.invalidateQueries({
        queryKey: ["scenario", analysis.scenario_id],
      });
    },
  });
}

export function useDeleteScenario(runId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: number) => api.deleteScenario(scenarioId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: scenariosKey(runId) });
    },
  });
}

export type SavedScenario = Scenario;
