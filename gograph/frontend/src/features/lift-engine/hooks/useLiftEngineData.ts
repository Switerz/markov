import { useQuery } from "@tanstack/react-query";
import { api, type LiftInsightItem } from "../../../lib/api";
import { useActiveRun } from "../../../app/hooks/useActiveRun";
import { liftEngineMock } from "../lift-engine.mock";
import type { LiftCategory, LiftEngineData, LiftInsight } from "../types";

export type LiftFiltersState = {
  category: LiftCategory | "todos";
  confidence: "todos" | "alta" | "media" | "baixa";
  minLift: number;
};

export const DEFAULT_LIFT_FILTERS: LiftFiltersState = {
  category: "todos",
  confidence: "todos",
  minLift: 0,
};

export type LiftEngineState = {
  data: LiftEngineData;
  runId: number | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
  isLoading: boolean;
  isMock: boolean;
};

export function useLiftEngineData(filters: LiftFiltersState = DEFAULT_LIFT_FILTERS): LiftEngineState {
  const activeRun = useActiveRun();
  const runId = activeRun?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["lift-engine", runId],
    enabled: runId != null,
    queryFn: () => api.getLiftEngine(runId!),
  });

  if (!data) {
    return {
      data: applyFilters(liftEngineMock, filters),
      runId,
      startDate: activeRun?.start_date,
      endDate: activeRun?.end_date,
      isLoading: runId != null && isLoading,
      isMock: true,
    };
  }

  const insights: LiftInsight[] = data.insights.map(mapInsight);
  const filtered = applyFiltersToInsights(insights, filters);

  return {
    data: {
      screen: liftEngineMock.screen,
      metrics: {
        totalInsights: filtered.length,
        avgLift: data.avg_lift,
        criticalCount: data.critical_count,
        estimatedRevImpact: data.estimated_rev_impact || "—",
      },
      insights: filtered,
    },
    runId,
    startDate: activeRun?.start_date,
    endDate: activeRun?.end_date,
    isLoading: false,
    isMock: false,
  };
}

function mapInsight(item: LiftInsightItem): LiftInsight {
  return {
    id: item.id,
    title: item.title,
    category: item.category as LiftInsight["category"],
    liftPct: item.lift_pct,
    confidence: item.confidence as LiftInsight["confidence"],
    priority: item.priority as LiftInsight["priority"],
    evidence: item.evidence,
    hypothesis: item.hypothesis,
    actions: item.actions,
    baseConvRate: item.base_conv_rate ?? undefined,
    liftConvRate: item.lift_conv_rate ?? undefined,
    baseLabel: item.base_label ?? undefined,
    liftLabel: item.lift_label ?? undefined,
  };
}

function applyFilters(data: LiftEngineData, filters: LiftFiltersState): LiftEngineData {
  return { ...data, insights: applyFiltersToInsights(data.insights, filters) };
}

function applyFiltersToInsights(insights: LiftInsight[], filters: LiftFiltersState): LiftInsight[] {
  return insights.filter((ins) => {
    if (filters.category !== "todos" && ins.category !== filters.category) return false;
    if (filters.confidence !== "todos" && ins.confidence !== filters.confidence) return false;
    if (ins.liftPct < filters.minLift) return false;
    return true;
  });
}
