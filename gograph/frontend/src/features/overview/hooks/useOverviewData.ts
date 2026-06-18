import { useQuery } from "@tanstack/react-query";
import {
  api,
  type ChannelRow,
  type OverviewDashboardResponse,
  type TouchpointRow,
} from "../../../lib/api";
import {
  channelTone,
  formatCompactBRL,
  formatMultiplier,
  formatPercent,
} from "../../../shared/format";
import { overviewMock } from "../overview.mock";
import type {
  ConsensusModelId,
  JourneyColumn,
  MetricItem,
  OverviewData,
  PriorityRecommendation,
} from "../types";
import type { StatTone } from "../../../shared/ui/StatDelta";
import type { Tone } from "../../../shared/tokens/tokens";

export type UseOverviewDataOptions = {
  consensusX?: ConsensusModelId;
  consensusY?: ConsensusModelId;
};

export function useOverviewData(
  runId?: number,
  compareRunId?: number,
  opts: UseOverviewDataOptions = {},
): OverviewData {
  const { data } = useQuery({
    queryKey: ["dashboard", "overview", runId, compareRunId ?? null],
    enabled: runId != null,
    queryFn: () => api.getOverviewDashboard(runId!, compareRunId),
  });
  const touchpointsQuery = useQuery({
    queryKey: ["touchpoints", runId],
    enabled: runId != null,
    queryFn: () => api.getTouchpoints(runId!),
  });
  const channelsQuery = useQuery({
    queryKey: ["channels", runId],
    enabled: runId != null,
    queryFn: () => api.getChannels(runId!),
  });

  if (!data) return overviewMock;
  return toOverviewData(data, {
    touchpoints: touchpointsQuery.data?.rows ?? [],
    channels: channelsQuery.data?.rows ?? [],
    consensusX: opts.consensusX ?? "markov",
    consensusY: opts.consensusY ?? "shapley",
  });
}

type ToOverviewContext = {
  touchpoints: TouchpointRow[];
  channels: ChannelRow[];
  consensusX: ConsensusModelId;
  consensusY: ConsensusModelId;
};

const CONSENSUS_MODELS: Array<{ id: ConsensusModelId; label: string }> = [
  { id: "markov", label: "Markov" },
  { id: "shapley", label: "Shapley" },
  { id: "last_click", label: "Último clique" },
  { id: "first_click", label: "Primeiro clique" },
];

function toOverviewData(data: OverviewDashboardResponse, ctx: ToOverviewContext): OverviewData {
  const channelsByName = new Map(ctx.channels.map((c) => [c.channel, c]));
  const spendByChannel = new Map<string, number>();
  const revenueByChannel = new Map<string, number>();
  for (const point of data.model_consensus.points) {
    spendByChannel.set(point.channel, point.spend);
    revenueByChannel.set(point.channel, point.revenue);
  }
  for (const c of ctx.channels) {
    if (!spendByChannel.has(c.channel) && c.spend != null) {
      spendByChannel.set(c.channel, c.spend);
    }
    if (!revenueByChannel.has(c.channel) && c.markov_revenue != null) {
      revenueByChannel.set(c.channel, c.markov_revenue);
    }
  }
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
    priorityDecisions: buildPriorityDecisions(data, ctx, channelsByName, totalSpend, totalRevenue),
    modelConsensus: buildModelConsensus(ctx, channelsByName),
    journeySummary: buildJourneySummary(data, ctx),
    analysisConfidence: overviewMock.analysisConfidence, // hidden in the UI; kept to preserve type contract
    footerNote: data.footer_note,
  };
}

function buildPriorityDecisions(
  data: OverviewDashboardResponse,
  ctx: ToOverviewContext,
  channelsByName: Map<string, ChannelRow>,
  totalSpend: number,
  totalRevenue: number,
) {
  // Start with the backend's priority list (these include rationale/risks) and
  // append every other channel from /channels so the carousel shows ALL breakouts
  // (Influ, TikTok, YouTube, Google sub-types, etc.).
  const seenChannels = new Set<string>();
  const cards = data.priority_decisions.map((rec) => {
    seenChannels.add(rec.channel);
    const channel = channelsByName.get(rec.channel) ?? null;
    const spend = spendOf(channel, rec.channel, ctx);
    const revenue = revenueOf(channel, rec.channel, ctx);
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
  });

  // Append remaining channels (sub-types, low-activity channels) by Shapley descending.
  const remaining = ctx.channels
    .filter((c) => !seenChannels.has(c.channel) && c.channel !== "Other")
    .sort((a, b) => (b.shapley_weight ?? 0) - (a.shapley_weight ?? 0));

  for (const c of remaining) {
    const spend = c.spend ?? 0;
    const revenue = c.markov_revenue ?? 0;
    const roas = spend > 0 ? revenue / spend : null;
    const recommendation = inferRecommendation(c);
    cards.push({
      channel: c.channel,
      icon: iconForChannel(c.channel),
      recommendation: recommendation.label,
      tone: recommendation.tone,
      shareSpend: totalSpend > 0 ? formatPercent(spend / totalSpend, 0) : "0%",
      shareRevenue: totalRevenue > 0 ? formatPercent(revenue / totalRevenue, 0) : "0%",
      roas: roas != null ? formatMultiplier(roas) : "—",
      description: recommendationDescription(c),
      actions: ["Criar cenário", "Ver canal"],
    });
  }

  return {
    ...overviewMock.priorityDecisions,
    cards,
  };
}

function spendOf(channel: ChannelRow | null, name: string, ctx: ToOverviewContext): number {
  if (channel?.spend != null) return channel.spend;
  const c = ctx.channels.find((x) => x.channel === name);
  return c?.spend ?? 0;
}

function revenueOf(channel: ChannelRow | null, name: string, ctx: ToOverviewContext): number {
  if (channel?.markov_revenue != null) return channel.markov_revenue;
  const c = ctx.channels.find((x) => x.channel === name);
  return c?.markov_revenue ?? 0;
}

function inferRecommendation(c: ChannelRow): { label: PriorityRecommendation; tone: Tone } {
  const rec = (c.recommendation ?? "").toLowerCase();
  if (rec.includes("scale") || rec.includes("escalar")) return { label: "Escalar", tone: "green" };
  if (rec.includes("protect") || rec.includes("defender")) return { label: "Defender", tone: "orange" };
  if (rec.includes("reduce") || rec.includes("pause") || rec.includes("reduzir")) return { label: "Reduzir", tone: "red" };
  if (rec.includes("hold") || rec.includes("monitor")) return { label: "Investigar", tone: "blue" };
  return { label: "Investigar", tone: "blue" };
}

function recommendationDescription(c: ChannelRow): string {
  const shapley = (c.shapley_weight ?? 0) * 100;
  const markov = (c.markov_weight ?? 0) * 100;
  const gap = shapley - markov;
  if (Math.abs(gap) >= 2) {
    return gap > 0
      ? `Shapley subestimado pelo Markov em ${Math.abs(gap).toFixed(1)} p.p. — avaliar.`
      : `Markov superestima em ${Math.abs(gap).toFixed(1)} p.p. vs. Shapley.`;
  }
  if ((c.spend ?? 0) === 0 && shapley > 1) {
    return `Sem mídia paga, mas Shapley aponta ${shapley.toFixed(1)}% — canal orgânico relevante.`;
  }
  if ((c.roas_shapley ?? 0) > 3) {
    return `ROAS Shapley alto (${formatMultiplier(c.roas_shapley ?? 0)}) — candidato a escala.`;
  }
  return "Avaliar contribuição na cadeia.";
}

function buildModelConsensus(
  ctx: ToOverviewContext,
  channelsByName: Map<string, ChannelRow>,
) {
  const availableModels = CONSENSUS_MODELS;
  const xLabel = availableModels.find((m) => m.id === ctx.consensusX)?.label ?? "Markov";
  const yLabel = availableModels.find((m) => m.id === ctx.consensusY)?.label ?? "Shapley";

  // Show only channels with meaningful presence on either axis to keep the
  // matrix readable. A channel passes if EITHER axis has >=1% weight OR it
  // has measurable spend.
  const MIN_WEIGHT_PCT = 1;
  const candidates = ctx.channels.filter((c) => {
    if (c.channel === "Other") return false;
    const x = modelWeightPct(c, ctx.consensusX);
    const y = modelWeightPct(c, ctx.consensusY);
    const hasSpend = (c.spend ?? 0) > 0;
    return hasSpend || x >= MIN_WEIGHT_PCT || y >= MIN_WEIGHT_PCT;
  });

  // Hard cap: top 12 channels by max(x, y) so the chart never gets cluttered.
  const points = candidates
    .map((c) => {
      const x = modelWeightPct(c, ctx.consensusX);
      const y = modelWeightPct(c, ctx.consensusY);
      const spend = c.spend ?? channelsByName.get(c.channel)?.spend ?? 0;
      return {
        channel: c.channel,
        rawX: x,
        rawY: y,
        x: scaleToMatrix(x),
        y: scaleToMatrix(y),
        size: spend > 0 ? formatCompactBRL(spend).replace("R$ ", "") : "—",
        tone: tone(toneForRecommendation(c.recommendation)),
      };
    })
    .sort((a, b) => Math.max(b.rawX, b.rawY) - Math.max(a.rawX, a.rawY))
    .slice(0, 12)
    .map(({ rawX: _x, rawY: _y, ...rest }) => rest);

  return {
    ...overviewMock.modelConsensus,
    axes: { x: xLabel, y: yLabel },
    points,
    availableModels,
    selectedX: ctx.consensusX,
    selectedY: ctx.consensusY,
  };
}

function modelWeightPct(c: ChannelRow, model: ConsensusModelId): number {
  switch (model) {
    case "markov":
      return (c.markov_weight ?? 0) * 100;
    case "shapley":
      return (c.shapley_weight ?? 0) * 100;
    case "last_click":
      return c.last_click_revenue != null && c.markov_revenue != null
        ? (c.last_click_revenue / Math.max(1, totalRevenueFor("markov", [c]) || 1)) * 100
        : 0;
    case "first_click":
      return c.first_click_revenue != null && c.markov_revenue != null
        ? (c.first_click_revenue / Math.max(1, totalRevenueFor("markov", [c]) || 1)) * 100
        : 0;
  }
}

function totalRevenueFor(_model: ConsensusModelId, rows: ChannelRow[]): number {
  // total revenue across all channels (used for normalization).
  // We sum markov_revenue as the canonical total for last/first click % share.
  return rows.reduce((acc, c) => acc + (c.markov_revenue ?? 0), 0);
}

function scaleToMatrix(pct: number): number {
  // Map 0..100 % into -100..100 (50 == 0). Cap at -100..100.
  return Math.max(-100, Math.min(100, (pct - 50) * 2));
}

function toneForRecommendation(rec: string | null | undefined): string {
  const r = (rec ?? "").toLowerCase();
  if (r.includes("scale") || r.includes("escalar")) return "green";
  if (r.includes("protect")) return "orange";
  if (r.includes("reduce") || r.includes("pause")) return "red";
  return "blue";
}

function buildJourneySummary(
  data: OverviewDashboardResponse,
  ctx: ToOverviewContext,
) {
  // 4 columns built from /touchpoints when available, with fallback to /dashboard/overview.
  const entryColumn: JourneyColumn =
    topByTouchpoint(ctx.touchpoints, "first", "Top canais de entrada") ??
    fallbackColumn("Top canais de entrada", data.journey_summary.top_entries);
  const middleColumn: JourneyColumn =
    topByTouchpoint(ctx.touchpoints, "middle", "Top canais de meio") ??
    fallbackColumn("Top canais de meio", []);
  const assistColumn: JourneyColumn =
    topByAssist(ctx.touchpoints) ??
    fallbackColumn(
      "Top canais de assistência",
      data.journey_summary.top_assistants,
    );
  const closerColumn: JourneyColumn =
    topByTouchpoint(ctx.touchpoints, "last", "Top canais de fim") ??
    fallbackColumn("Top canais de fim", data.journey_summary.top_closers);

  return {
    ...overviewMock.journeySummary,
    columns: [entryColumn, middleColumn, assistColumn, closerColumn],
    flow: data.journey_summary.flow_stages.map((item) => ({
      stage: item.name,
      value: formatPercent(item.value, 0),
    })),
  };
}

function fallbackColumn(
  title: string,
  items: Array<{ name: string; value: number }>,
): JourneyColumn {
  return {
    title,
    items: items.slice(0, 5).map((item) => ({
      name: item.name,
      value: formatPercent(item.value, 0),
      valueRaw: item.value,
      tone: channelTone(item.name),
    })),
  };
}

function topByTouchpoint(
  touchpoints: TouchpointRow[],
  bucket: "first" | "middle" | "last",
  title: string,
): JourneyColumn | null {
  if (touchpoints.length === 0) return null;
  const field =
    bucket === "first"
      ? "conv_first_touch_share"
      : bucket === "middle"
        ? "conv_middle_touch_share"
        : "conv_last_touch_share";
  const sorted = [...touchpoints]
    .filter((t) => t.channel !== "Other" && (t[field] ?? 0) > 0)
    .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
    .slice(0, 5);
  if (sorted.length === 0) return null;
  return {
    title,
    items: sorted.map((t) => ({
      name: t.channel,
      value: formatPercent(t[field] ?? 0, 0),
      valueRaw: t[field] ?? 0,
      tone: channelTone(t.channel),
    })),
  };
}

function topByAssist(touchpoints: TouchpointRow[]): JourneyColumn | null {
  if (touchpoints.length === 0) return null;
  const totalAssists = touchpoints.reduce((acc, t) => acc + (t.assist_count ?? 0), 0);
  if (totalAssists === 0) return null;
  const sorted = [...touchpoints]
    .filter((t) => t.channel !== "Other" && (t.assist_count ?? 0) > 0)
    .sort((a, b) => (b.assist_count ?? 0) - (a.assist_count ?? 0))
    .slice(0, 5);
  if (sorted.length === 0) return null;
  return {
    title: "Top canais de assistência",
    items: sorted.map((t) => ({
      name: t.channel,
      value: formatPercent((t.assist_count ?? 0) / totalAssists, 0),
      valueRaw: (t.assist_count ?? 0) / totalAssists,
      tone: channelTone(t.channel),
    })),
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
