import { useQuery } from "@tanstack/react-query";
import { api, type OverviewDashboardResponse } from "../../../lib/api";
import { formatCompactBRL, formatMultiplier, formatPercent } from "../../../shared/format";
import { overviewMock } from "../overview.mock";
import type { MetricItem, OverviewData, PriorityRecommendation } from "../types";
import type { StatTone } from "../../../shared/ui/StatDelta";
import type { Tone } from "../../../shared/tokens/tokens";

export function useOverviewData(runId?: number, compareRunId?: number): OverviewData {
  const { data } = useQuery({
    queryKey: ["dashboard", "overview", runId, compareRunId ?? null],
    enabled: runId != null,
    queryFn: () => api.getOverviewDashboard(runId!, compareRunId),
  });

  return data ? toOverviewData(data) : overviewMock;
}

function toOverviewData(data: OverviewDashboardResponse): OverviewData {
  const spendByChannel = new Map(
    data.model_consensus.points.map((point) => [point.channel, point.spend]),
  );
  const revenueByChannel = new Map(
    data.model_consensus.points.map((point) => [point.channel, point.revenue]),
  );
  const totalSpend = data.summary.total_spend || 0;
  const totalRevenue = data.summary.total_revenue || 0;

  return {
    ...overviewMock,
    topBar: {
      ...overviewMock.topBar,
      filters: overviewMock.topBar.filters.map((filter) => {
        if (filter.id === "execution") {
          return { ...filter, value: `Execução: #${data.meta.run_id}` };
        }
        if (filter.id === "confidence") {
          return {
            ...filter,
            value: data.analysis_confidence.label,
            tone: confidenceTone(data.analysis_confidence.score),
          };
        }
        return filter;
      }),
    },
    metrics: data.metric_strip.map(metricToCard),
    priorityDecisions: {
      ...overviewMock.priorityDecisions,
      cards: data.priority_decisions.map((rec) => {
        const spend = spendByChannel.get(rec.channel) ?? 0;
        const revenue = revenueByChannel.get(rec.channel) ?? 0;
        const roas = spend > 0 ? revenue / spend : null;
        return {
          channel: rec.channel,
          icon: iconForChannel(rec.channel),
          recommendation: rec.recommendation as PriorityRecommendation,
          tone: tone(rec.recommendation_tone),
          shareSpend: totalSpend > 0 ? formatPercent(spend / totalSpend, 0) : "0%",
          shareRevenue: totalRevenue > 0 ? formatPercent(revenue / totalRevenue, 0) : "0%",
          roas: roas != null ? formatMultiplier(roas) : "-",
          description: rec.rationale[0] ?? "Recomendação calculada pelo modelo.",
          actions: ["Criar cenário", "Ver canal"],
        };
      }),
    },
    modelConsensus: {
      ...overviewMock.modelConsensus,
      axes: data.model_consensus.axes,
      points: data.model_consensus.points.map((point) => ({
        channel: point.channel,
        x: point.markov_weight_pct,
        y: point.shapley_weight_pct,
        size: formatCompactBRL(point.spend).replace("R$ ", ""),
        tone: tone(point.recommendation_tone ?? "blue"),
      })),
    },
    journeySummary: {
      ...overviewMock.journeySummary,
      columns: [
        {
          title: "Top canais de entrada",
          items: data.journey_summary.top_entries.map((item) => ({
            name: item.name,
            value: formatPercent(item.value, 0),
          })),
        },
        {
          title: "Top assistentes",
          items: data.journey_summary.top_assistants.map((item) => ({
            name: item.name,
            value: formatPercent(item.value, 0),
          })),
        },
        {
          title: "Top canais de fechamento",
          items: data.journey_summary.top_closers.map((item) => ({
            name: item.name,
            value: formatPercent(item.value, 0),
          })),
        },
      ],
      flow: data.journey_summary.flow_stages.map((item) => ({
        stage: item.name,
        value: formatPercent(item.value, 0),
      })),
    },
    analysisConfidence: {
      ...overviewMock.analysisConfidence,
      modelCalibration: [
        { label: "Confiança agregada", value: formatPercent(data.analysis_confidence.score, 0) },
        {
          label: "Gap obs/modelo",
          value:
            data.analysis_confidence.calibration_gap_pp != null
              ? `${data.analysis_confidence.calibration_gap_pp.toFixed(2).replace(".", ",")} p.p.`
              : "-",
        },
      ],
      dataQuality: [
        {
          label: "Qualidade dos dados",
          value:
            data.analysis_confidence.data_quality_score != null
              ? formatPercent(data.analysis_confidence.data_quality_score, 0)
              : "-",
        },
      ],
      summary: {
        label: `Confiança geral: ${data.analysis_confidence.label}`,
        description: `Score consolidado de ${formatPercent(data.analysis_confidence.score, 0)} para a execução #${data.meta.run_id}.`,
      },
    },
    footerNote: data.footer_note,
  };
}

function metricToCard(metric: OverviewDashboardResponse["metric_strip"][number]): MetricItem {
  const base = overviewMock.metrics.find((item) => item.id === mapMetricId(metric.id));
  return {
    id: mapMetricId(metric.id),
    title: base?.title ?? metric.label,
    value: formatMetricValue(metric.id, metric.value),
    subtitle: base?.subtitle,
    icon: base?.icon ?? "Circle",
    tone: tone(metric.tone),
    delta: metric.delta ? formatDelta(metric.delta) : undefined,
  };
}

function mapMetricId(id: string) {
  if (id === "spend") return "investment";
  if (id === "conversion_rate") return "conversionRate";
  if (id === "scale_opportunities") return "scaleOpportunities";
  if (id === "misallocated_budget") return "misallocatedBudget";
  return id;
}

function formatMetricValue(id: string, value: number | null) {
  if (value == null) return "-";
  if (id === "roas") return formatMultiplier(value);
  if (id === "conversion_rate") return formatPercent(value, 2);
  return formatCompactBRL(value);
}

function formatDelta(delta: { value: number | null; pct: number | null }) {
  const pct = delta.pct ?? 0;
  const statTone: StatTone = pct >= 0 ? "positive" : "negative";
  return {
    value: `${pct >= 0 ? "+" : ""}${formatPercent(pct, 1)}`,
    label: "vs comparação",
    tone: statTone,
  };
}

function confidenceTone(score: number): Tone {
  if (score >= 0.75) return "green";
  if (score >= 0.5) return "orange";
  return "red";
}

function tone(value: string): Tone {
  if (["blue", "green", "red", "orange", "indigo", "cyan", "neutral"].includes(value)) {
    return value as Tone;
  }
  return "neutral";
}

function iconForChannel(channel: string) {
  const lower = channel.toLowerCase();
  if (lower.includes("google")) return "Google";
  if (lower.includes("meta") || lower.includes("facebook") || lower.includes("instagram")) return "Meta";
  if (lower.includes("email")) return "Mail";
  if (lower.includes("whatsapp")) return "MessageCircle";
  if (lower.includes("display")) return "Monitor";
  return "Circle";
}
