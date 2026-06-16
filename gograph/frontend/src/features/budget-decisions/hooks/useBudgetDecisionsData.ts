import { useQuery } from "@tanstack/react-query";
import { api, type BudgetDashboardResponse } from "../../../lib/api";
import { formatCompactBRL, formatMultiplier, formatPercent } from "../../../shared/format";
import { budgetDecisionsMock } from "../budget-decisions.mock";
import { recommendationTone } from "../tone";
import type {
  BudgetDecisionsData,
  ChannelTableRow,
  SelectedChannelDrawer,
} from "../types";
import type { Tone } from "../../../shared/tokens/tokens";

export type UseBudgetDecisionsData = BudgetDecisionsData & {
  getDrawerForChannel: (channel: string) => SelectedChannelDrawer;
};

export function useBudgetDecisionsData(runId?: number, compareRunId?: number): UseBudgetDecisionsData {
  const { data } = useQuery({
    queryKey: ["dashboard", "budget", runId, compareRunId ?? null],
    enabled: runId != null,
    queryFn: () => api.getBudgetDashboard(runId!, compareRunId),
  });

  if (!data) {
    return {
      ...budgetDecisionsMock,
      getDrawerForChannel: (_channel: string) =>
        budgetDecisionsMock.selectedChannelDrawer,
    };
  }

  return toBudgetData(data);
}

function toBudgetData(data: BudgetDashboardResponse): UseBudgetDecisionsData {
  const rows: ChannelTableRow[] = data.channels_table.map((row) => ({
    channel: row.channel,
    recommendation: row.recommendation,
    tone: tone(row.tone),
    spend: formatCompactBRL(row.spend),
    spendDelta: formatSignedPercent(row.suggested_budget_delta_pct),
    revenue: formatCompactBRL(row.revenue),
    revenueDelta: formatSignedCurrency(row.estimated_revenue_delta),
    roasMarkov: row.roas_markov != null ? formatMultiplier(row.roas_markov) : "-",
    roasMarkovDelta: "-",
    roasShapley: row.roas_shapley != null ? formatMultiplier(row.roas_shapley) : "-",
    roasShapleyDelta: "-",
    consensus: formatPercent(row.consensus_score, 0),
    role: row.role ?? "A revisar",
    presence: Math.max(1, Math.min(5, Math.round(row.presence_score * 5))),
    action: "open",
  }));

  const defaultDrawer = drawerFromBackend(data.selected_channel_drawer, rows[0]);

  return {
    ...budgetDecisionsMock,
    topBar: {
      ...budgetDecisionsMock.topBar,
      filters: budgetDecisionsMock.topBar.filters.map((filter) =>
        filter.id === "execution"
          ? { ...filter, value: `Execução: #${data.meta.run_id}` }
          : filter,
      ),
    },
    summaryCards: data.summary_cards.map((card) => ({
      id: card.id,
      title: card.label,
      value: String(card.count),
      subtitle: `${formatCompactBRL(Math.abs(card.estimated_revenue_delta))} estimados`,
      icon: iconForSummary(card.label),
      tone: tone(card.tone),
    })),
    allocationMatrix: {
      ...budgetDecisionsMock.allocationMatrix,
      points: data.allocation_matrix.map((point) => ({
        channel: point.channel,
        x: point.spend_share_pct,
        y: point.revenue_share_pct,
        revenue: formatCompactBRL(point.revenue),
        recommendation: point.recommendation,
        tone: tone(point.tone),
      })),
    },
    opportunitiesAndRisks: {
      ...budgetDecisionsMock.opportunitiesAndRisks,
      scaleOpportunities: data.opportunities_and_risks.opportunities.map((rec) => ({
        channel: rec.channel,
        impact: formatSignedCurrency(rec.estimated_revenue_delta),
        roasMarkov:
          rec.estimated_roas_min != null && rec.estimated_roas_max != null
            ? `${formatMultiplier((rec.estimated_roas_min + rec.estimated_roas_max) / 2)}`
            : "-",
      })),
      reductionRisks: data.opportunities_and_risks.risks.map((rec) => ({
        channel: rec.channel,
        impact: formatSignedCurrency(rec.estimated_revenue_delta),
        reason: rec.risks[0] ?? "Queda potencial de receita",
      })),
    },
    channelsTable: {
      ...budgetDecisionsMock.channelsTable,
      rows,
      pagination: `Exibindo 1-${rows.length} de ${rows.length} canais`,
    },
    selectedChannelDrawer: defaultDrawer,
    getDrawerForChannel: (channel: string) => ({
      ...defaultDrawer,
      channel,
      recommendation:
        rows.find((row) => row.channel === channel)?.recommendation ??
        defaultDrawer.recommendation,
      tone:
        rows.find((row) => row.channel === channel)?.tone ??
        defaultDrawer.tone,
    }),
  };
}

function drawerFromBackend(
  drawer: BudgetDashboardResponse["selected_channel_drawer"],
  firstRow?: ChannelTableRow,
): SelectedChannelDrawer {
  if (!drawer) {
    return {
      ...budgetDecisionsMock.selectedChannelDrawer,
      channel: firstRow?.channel ?? budgetDecisionsMock.selectedChannelDrawer.channel,
      recommendation: firstRow?.recommendation ?? budgetDecisionsMock.selectedChannelDrawer.recommendation,
      tone: firstRow?.tone ?? budgetDecisionsMock.selectedChannelDrawer.tone,
    };
  }

  return {
    ...budgetDecisionsMock.selectedChannelDrawer,
    channel: drawer.channel,
    recommendation: drawer.recommendation,
    tone: tone(drawer.tone),
    recommendationCard: {
      title: "Recomendação",
      badge: drawer.recommendation,
      description: drawer.rationale[0] ?? "Recomendação calculada pelo modelo.",
    },
    rationale: drawer.rationale,
    suggestedAction: {
      ...budgetDecisionsMock.selectedChannelDrawer.suggestedAction,
      description: `Ajuste sugerido de ${formatSignedPercent(drawer.suggested_budget_delta_pct)} para o canal.`,
      slider: {
        min: "-50%",
        current: "Atual",
        selected: formatSignedPercent(drawer.suggested_budget_delta_pct),
        max: "+50%",
      },
      estimatedImpact: {
        revenue: formatSignedCurrency(drawer.estimated_revenue_delta),
        roas:
          drawer.estimated_roas_min != null && drawer.estimated_roas_max != null
            ? `${formatMultiplier(drawer.estimated_roas_min)} - ${formatMultiplier(drawer.estimated_roas_max)}`
            : "-",
      },
    },
  };
}

function tone(value: string): Tone {
  if (["blue", "green", "red", "orange", "indigo", "cyan", "neutral"].includes(value)) {
    return value as Tone;
  }
  return recommendationTone(value);
}

function formatSignedPercent(value?: number | null) {
  if (value == null) return "0%";
  return `${value >= 0 ? "+" : ""}${formatPercent(value, 0)}`;
}

function formatSignedCurrency(value?: number | null) {
  if (value == null) return "R$ 0";
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${formatCompactBRL(Math.abs(value))}`;
}

function iconForSummary(label: string) {
  switch (label) {
    case "Escalar":
      return "TrendingUp";
    case "Defender":
      return "Shield";
    case "Investigar":
      return "Search";
    case "Reduzir":
      return "CornerDownRight";
    default:
      return "Circle";
  }
}
