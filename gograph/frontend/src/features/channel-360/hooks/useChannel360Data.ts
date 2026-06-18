import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  api,
  type ChannelRow,
  type DiagnosticRow,
  type ModelRunSummaryRow,
  type SequentialEffectRow,
  type TouchpointRow,
  type TransitionRow,
} from "../../../lib/api";
import { useActiveRun } from "../../../app/hooks/useActiveRun";
import {
  formatBRL,
  formatCompactBRL,
  formatMultiplier,
  formatNumber,
  formatPercent,
  slugify,
} from "../../../shared/format";
import type { Tone } from "../../../shared/tokens/tokens";
import { channel360Mock } from "../channel-360.mock";
import type {
  AdjacentChannelRow,
  Channel360Data,
  ChannelMetric,
  RelevantSequence,
} from "../types";

// Channel 360 composes from 6 endpoints, filtering by the channel resolved from the URL slug.
// Falls back to the mock when no run is selected or the run is still loading.
export function useChannel360Data(): Channel360Data {
  const { slug } = useParams<{ slug: string }>();
  const activeRun = useActiveRun();
  const runId = activeRun?.id;

  const channelsQuery = useQuery({
    queryKey: ["channels", runId],
    enabled: runId != null,
    queryFn: () => api.getChannels(runId!),
  });
  const touchpointsQuery = useQuery({
    queryKey: ["touchpoints", runId],
    enabled: runId != null,
    queryFn: () => api.getTouchpoints(runId!),
  });
  const diagnosticsQuery = useQuery({
    queryKey: ["diagnostics", runId],
    enabled: runId != null,
    queryFn: () => api.getDiagnostics(runId!),
  });
  const transitionsQuery = useQuery({
    queryKey: ["transitions", runId],
    enabled: runId != null,
    queryFn: () => api.getTransitions(runId!),
  });
  const summaryQuery = useQuery({
    queryKey: ["summary", runId],
    enabled: runId != null,
    queryFn: () => api.getSummary(runId!),
  });

  // Resolve channel name from slug using the channels response.
  const channelName = useMemo(() => {
    const rows = channelsQuery.data?.rows ?? [];
    if (rows.length === 0) return null;
    const target = (slug ?? "").toLowerCase();
    const match = rows.find((r) => slugify(r.channel) === target);
    return match?.channel ?? rows[0]?.channel ?? null;
  }, [channelsQuery.data, slug]);

  // Channel 360 needs sequences ending at this channel (current_channel == channelName),
  // which the endpoint can't filter directly. Fetch the full table and filter client-side.
  const sequentialQuery = useQuery({
    queryKey: ["sequential-effects", runId, "all"],
    enabled: runId != null,
    queryFn: () => api.getSequentialEffects(runId!),
  });

  return useMemo(() => {
    if (
      !channelName ||
      !channelsQuery.data ||
      !touchpointsQuery.data ||
      !diagnosticsQuery.data ||
      !transitionsQuery.data ||
      !summaryQuery.data
    ) {
      return channel360Mock;
    }
    return composeChannel360({
      channelName,
      channels: channelsQuery.data.rows,
      touchpoints: touchpointsQuery.data.rows,
      diagnostics: diagnosticsQuery.data.rows,
      transitions: transitionsQuery.data.rows,
      sequential: sequentialQuery.data?.rows ?? [],
      summary: summaryQuery.data,
      runMeta: activeRun
        ? {
            id: activeRun.id,
            start_date: activeRun.start_date,
            end_date: activeRun.end_date,
            decay: Number(activeRun.parameters?.decay_lambda ?? 0.05),
            lookback: Number(activeRun.parameters?.lookback_days ?? 30),
          }
        : null,
    });
  }, [
    channelName,
    channelsQuery.data,
    touchpointsQuery.data,
    diagnosticsQuery.data,
    transitionsQuery.data,
    sequentialQuery.data,
    summaryQuery.data,
    activeRun,
  ]);
}

type ComposeInput = {
  channelName: string;
  channels: ChannelRow[];
  touchpoints: TouchpointRow[];
  diagnostics: DiagnosticRow[];
  transitions: TransitionRow[];
  sequential: SequentialEffectRow[];
  summary: ModelRunSummaryRow;
  runMeta: {
    id: number;
    start_date: string;
    end_date: string;
    decay: number;
    lookback: number;
  } | null;
};

function composeChannel360(input: ComposeInput): Channel360Data {
  const { channelName, channels, touchpoints, diagnostics, transitions, sequential, summary, runMeta } = input;
  const base = channel360Mock;
  const slug = slugify(channelName);

  const channel = channels.find((c) => c.channel === channelName) ?? null;
  const touchpoint = touchpoints.find((t) => t.channel === channelName) ?? null;
  const diagnostic = diagnostics.find((d) => d.channel === channelName) ?? null;
  const totalChannelRevenue = channels.reduce((acc, c) => acc + (c.markov_revenue ?? 0), 0);
  const totalShapleyRevenue = channels.reduce((acc, c) => acc + (c.shapley_revenue ?? 0), 0);
  const totalLastClickRevenue = channels.reduce((acc, c) => acc + (c.last_click_revenue ?? 0), 0);
  const totalSpend = channels.reduce((acc, c) => acc + (c.spend ?? 0), 0);
  const avgShapleyRoas =
    channels.filter((c) => (c.roas_shapley ?? 0) > 0).reduce((acc, c) => acc + (c.roas_shapley ?? 0), 0) /
      Math.max(1, channels.filter((c) => (c.roas_shapley ?? 0) > 0).length);

  const recommendation = channel?.recommendation ?? "Hold / Monitor";
  const recommendationTone = recommendationToTone(recommendation);

  // ---- screen ----
  const screen = {
    ...base.screen,
    id: `channel-360-${slug}`,
    title: channelName,
    route: `/performance/canais/${slug}`,
    channel: {
      name: channelName,
      logo: iconForChannel(channelName),
      recommendation,
      recommendationTone,
    },
  };

  // ---- metricStrip ----
  const journeyPresenceShare =
    (touchpoint?.conv_first_touch_share ?? 0) +
    (touchpoint?.conv_middle_touch_share ?? 0) +
    (touchpoint?.conv_last_touch_share ?? 0);
  const roasConsensus = average([
    channel?.roas_markov ?? null,
    channel?.roas_shapley ?? null,
  ]);

  const metricStrip: ChannelMetric[] = [
    {
      id: "investment",
      title: "Investimento",
      value: channel?.spend != null ? formatCompactBRL(channel.spend) : "—",
      icon: "ChartNoAxesCombined",
      tone: "blue",
    },
    {
      id: "attributedRevenue",
      title: "Receita atribuída (Markov)",
      value: channel?.markov_revenue != null ? formatCompactBRL(channel.markov_revenue) : "—",
      icon: "DollarSign",
      tone: "indigo",
    },
    {
      id: "shapleyRevenue",
      title: "Receita atribuída (Shapley)",
      value: channel?.shapley_revenue != null ? formatCompactBRL(channel.shapley_revenue) : "—",
      icon: "Sparkles",
      tone: "cyan",
    },
    {
      id: "roasConsensus",
      title: "ROAS (consenso)",
      value: roasConsensus != null ? formatMultiplier(roasConsensus) : "—",
      icon: "ShieldCheck",
      tone: "cyan",
    },
    {
      id: "journeyPresence",
      title: "Presença em jornadas convertidas",
      value: formatPercent(journeyPresenceShare, 1),
      icon: "CircleGauge",
      tone: "blue",
    },
    {
      id: "dominantRole",
      title: "Papel predominante",
      value: diagnostic?.channel_role ?? touchpoint?.touchpoint_role ?? "—",
      icon: "Route",
      tone: "blue",
    },
  ];

  // ---- attributionEfficiency ----
  const markovShare = totalChannelRevenue > 0 ? (channel?.markov_revenue ?? 0) / totalChannelRevenue : 0;
  const shapleyShare = totalShapleyRevenue > 0 ? (channel?.shapley_revenue ?? 0) / totalShapleyRevenue : 0;
  const lastClickShare =
    totalLastClickRevenue > 0 ? (channel?.last_click_revenue ?? 0) / totalLastClickRevenue : 0;
  const spendShare = totalSpend > 0 ? (channel?.spend ?? 0) / totalSpend : 0;

  const attributionEfficiency = {
    ...base.attributionEfficiency,
    rows: [
      {
        model: "Markov",
        investmentShare: formatPercent(spendShare, 0),
        investmentBar: Math.round(spendShare * 100),
        attributedRevenue: channel?.markov_revenue != null ? formatCompactBRL(channel.markov_revenue) : "—",
        revenueShare: formatPercent(markovShare, 0),
        relativeEfficiency: efficiencyText(channel?.roas_markov, avgShapleyRoas),
        efficiencyTone: efficiencyTone(channel?.roas_markov, avgShapleyRoas),
      },
      {
        model: "Shapley",
        investmentShare: formatPercent(spendShare, 0),
        investmentBar: Math.round(spendShare * 100),
        attributedRevenue: channel?.shapley_revenue != null ? formatCompactBRL(channel.shapley_revenue) : "—",
        revenueShare: formatPercent(shapleyShare, 0),
        relativeEfficiency: efficiencyText(channel?.roas_shapley, avgShapleyRoas),
        efficiencyTone: efficiencyTone(channel?.roas_shapley, avgShapleyRoas),
      },
      {
        model: "Receita observada (último clique)",
        investmentShare: formatPercent(spendShare, 0),
        investmentBar: Math.round(spendShare * 100),
        attributedRevenue:
          channel?.last_click_revenue != null ? formatCompactBRL(channel.last_click_revenue) : "—",
        revenueShare: formatPercent(lastClickShare, 0),
        relativeEfficiency: efficiencyText(channel?.last_click_roas, avgShapleyRoas),
        efficiencyTone: efficiencyTone(channel?.last_click_roas, avgShapleyRoas),
      },
    ],
  };

  // ---- journeyRole ----
  const firstTouch = touchpoint?.conv_first_touch_share ?? 0;
  const middleTouch = touchpoint?.conv_middle_touch_share ?? 0;
  const lastTouch = touchpoint?.conv_last_touch_share ?? 0;
  const touchTotal = firstTouch + middleTouch + lastTouch;
  const donut =
    touchTotal > 0
      ? [
          { label: "First touch", description: "Início de jornada", value: Math.round((firstTouch / touchTotal) * 100), tone: "blue" as Tone },
          { label: "Middle touch", description: "Meio de jornada", value: Math.round((middleTouch / touchTotal) * 100), tone: "indigo" as Tone },
          { label: "Last touch", description: "Fim de jornada", value: Math.round((lastTouch / touchTotal) * 100), tone: "green" as Tone },
        ]
      : base.journeyRole.donut;

  const journeyRole = { ...base.journeyRole, donut };

  // ---- recommendationEvidence ----
  const recommendationEvidence = {
    ...base.recommendationEvidence,
    badge: recommendation,
    whyIncreaseInvestment: buildRationale({ channel, touchpoint, avgShapleyRoas, journeyPresenceShare }),
    risks: buildRisks(channel),
    bestPractices: base.recommendationEvidence.bestPractices,
    confidenceBox: {
      title: `Recomendação baseada em consenso entre Markov, Shapley e dados observados (${recommendation}).`,
      link: "Ver detalhes técnicos",
    },
  };

  // ---- tables (adjacent channels) ----
  const before = adjacentRows(transitions, "to_state", channelName);
  const after = adjacentRows(transitions, "from_state", channelName);
  const tables = {
    channelsBefore: {
      title: `Canais que levam até ${channelName}`,
      subtitle: `Top canais que antecedem ${channelName} nas jornadas.`,
      rows: before,
    },
    channelsAfter: {
      title: `Canais mais acessados depois de ${channelName}`,
      subtitle: `Top canais que aparecem após ${channelName} nas jornadas.`,
      rows: after,
    },
  };

  // ---- relevantSequences ----
  // Channel is the CURRENT step. Sort by lift desc, take top 5.
  const sequenceItems: RelevantSequence[] = sequential
    .filter(
      (s) =>
        s.current_channel === channelName &&
        s.previous_channel !== "(start)" &&
        (s.support ?? 0) >= 20 &&
        (s.lift_vs_baseline ?? null) != null,
    )
    .sort((a, b) => (b.lift_vs_baseline ?? 0) - (a.lift_vs_baseline ?? 0))
    .slice(0, 5)
    .map((s) => {
      const liftPct = ((s.lift_vs_baseline ?? 1) - 1) * 100;
      return {
        path: [s.previous_channel, s.current_channel],
        uplift: `${liftPct >= 0 ? "+" : ""}${liftPct.toFixed(0)}%`,
        frequencyMedian: s.support != null ? formatNumber(s.support) : "—",
        baseline:
          s.conversion_probability_baseline != null
            ? formatPercent(s.conversion_probability_baseline, 2)
            : "—",
        sequenceConversion:
          s.conversion_probability_pair != null
            ? formatPercent(s.conversion_probability_pair, 2)
            : "—",
        action: "Ver detalhes",
      };
    });

  const relevantSequences = {
    ...base.relevantSequences,
    title: "Sequências relevantes",
    subtitle: `Sequências onde ${channelName} aparece e geram uplift.`,
    items: sequenceItems.length > 0 ? sequenceItems : base.relevantSequences.items,
    note: sequenceItems.length > 0
      ? "Uplift = (conversão da sequência / conversão base do canal) − 1. Não implica causalidade."
      : base.relevantSequences.note,
  };

  // ---- quickDetails ----
  const quickDetails = {
    ...base.quickDetails,
    items: [
      { label: "Canal", value: channelName },
      { label: "Modelagem", value: "Markov + Shapley" },
      {
        label: "Janela de atribuição",
        value: runMeta ? `${runMeta.lookback} dias / decay λ=${runMeta.decay}` : "30 dias / decay λ=0,05",
      },
      {
        label: "Período da execução",
        value: runMeta ? `${formatDate(runMeta.start_date)} – ${formatDate(runMeta.end_date)}` : "—",
      },
      {
        label: "Confiança do modelo",
        value: summary.confidence_label ?? formatPercent(summary.confidence_score ?? 0, 0),
      },
      { label: "Receita atribuída total (Markov)", value: formatBRL(channel?.markov_revenue ?? 0) },
    ],
  };

  return {
    ...base,
    screen,
    metricStrip,
    attributionEfficiency,
    journeyRole,
    recommendationEvidence,
    tables,
    relevantSequences,
    timeEvolution: base.timeEvolution, // deferred — needs historical bucketed runs
    quickDetails,
  };
}

function adjacentRows(
  transitions: TransitionRow[],
  matchField: "to_state" | "from_state",
  channelName: string,
): AdjacentChannelRow[] {
  const partnerField = matchField === "to_state" ? "from_state" : "to_state";
  const filtered = transitions.filter(
    (t) =>
      t[matchField] === channelName &&
      t[partnerField] !== channelName &&
      t[partnerField] !== "(start)" &&
      t[partnerField] !== "Conversion" &&
      t[partnerField] !== "Non-Conversion",
  );
  const totals = filtered.reduce((acc, t) => acc + (t.n ?? 0), 0);
  return filtered
    .sort((a, b) => (b.n ?? 0) - (a.n ?? 0))
    .slice(0, 5)
    .map((t, idx) => ({
      rank: idx + 1,
      channel: t[partnerField] as string,
      participation: totals > 0 ? formatPercent((t.n ?? 0) / totals, 0) : "0%",
      journeys: formatNumber(t.n ?? 0),
    }));
}

function buildRationale(args: {
  channel: ChannelRow | null;
  touchpoint: TouchpointRow | null;
  avgShapleyRoas: number;
  journeyPresenceShare: number;
}): string[] {
  const items: string[] = [];
  const { channel, touchpoint, avgShapleyRoas, journeyPresenceShare } = args;
  if (channel?.roas_shapley != null) {
    const delta = avgShapleyRoas > 0 ? ((channel.roas_shapley / avgShapleyRoas) - 1) * 100 : 0;
    const cmp = delta >= 0 ? "acima" : "abaixo";
    items.push(
      `ROAS Shapley ${formatMultiplier(channel.roas_shapley)}, ${cmp} da média Shapley (${formatMultiplier(avgShapleyRoas)}).`,
    );
  }
  if (journeyPresenceShare > 0) {
    items.push(`Presença em jornadas convertidas: ${formatPercent(journeyPresenceShare, 1)}.`);
  }
  if (touchpoint?.touchpoint_role) {
    items.push(`Papel observado nos toques: ${touchpoint.touchpoint_role}.`);
  }
  if (channel?.shapley_weight != null && channel?.markov_weight != null) {
    const gap = (channel.shapley_weight - channel.markov_weight) * 100;
    if (Math.abs(gap) > 1) {
      const direction = gap > 0 ? "subestima" : "superestima";
      items.push(
        `Markov ${direction} o canal em ${Math.abs(gap).toFixed(1)} p.p. vs. Shapley (sinal de revisão).`,
      );
    }
  }
  if (items.length === 0) {
    items.push("Sem evidências consolidadas para esta execução.");
  }
  return items;
}

function buildRisks(channel: ChannelRow | null): string[] {
  const risks: string[] = [];
  if (channel?.spend != null && channel.spend > 0 && (channel.roas_markov ?? 0) < 1) {
    risks.push(`ROAS Markov abaixo de 1 (${formatMultiplier(channel.roas_markov ?? 0)}) — risco de ineficiência.`);
  }
  if (channel?.confidence_score != null && channel.confidence_score < 0.6) {
    risks.push(`Baixa confiança da recomendação (${formatPercent(channel.confidence_score, 0)}).`);
  }
  if (channel?.shapley_weight != null && channel?.markov_weight != null) {
    const delta = Math.abs(channel.shapley_weight - channel.markov_weight) * 100;
    if (delta > 5) {
      risks.push(`Divergência grande Markov↔Shapley (${delta.toFixed(1)} p.p.) — atribuição instável.`);
    }
  }
  if (risks.length === 0) {
    risks.push("Sem riscos críticos identificados nesta execução.");
  }
  return risks;
}

function efficiencyText(roas: number | null | undefined, avgRoas: number): string {
  if (roas == null || avgRoas <= 0) return "—";
  return formatMultiplier(roas / avgRoas);
}

function efficiencyTone(roas: number | null | undefined, avgRoas: number): Tone {
  if (roas == null || avgRoas <= 0) return "neutral";
  const ratio = roas / avgRoas;
  if (ratio >= 1.1) return "green";
  if (ratio <= 0.85) return "red";
  return "neutral";
}

function recommendationToTone(rec: string): Tone {
  const r = rec.toLowerCase();
  if (r.includes("scale") || r.includes("protect")) return "green";
  if (r.includes("hold") || r.includes("monitor")) return "blue";
  if (r.includes("reduce") || r.includes("pause") || r.includes("cut")) return "red";
  return "neutral";
}

function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${d} ${months[Number(m) - 1]} ${y}`;
  } catch {
    return iso;
  }
}

function iconForChannel(channel: string): string {
  const lower = channel.toLowerCase();
  if (lower.includes("google")) return "GoogleAds";
  if (lower.includes("meta") || lower.includes("facebook")) return "Facebook";
  if (lower.includes("instagram")) return "Instagram";
  if (lower.includes("tiktok")) return "TikTok";
  if (lower.includes("email")) return "Mail";
  if (lower.includes("whatsapp")) return "MessageCircle";
  if (lower.includes("sms")) return "Smartphone";
  if (lower.includes("display")) return "Monitor";
  if (lower.includes("organic")) return "Globe";
  if (lower.includes("direct")) return "Link";
  return "Circle";
}
