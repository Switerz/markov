import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  api,
  type GraphResponse,
  type LoopDiagnosticRow,
  type PathRow,
} from "../../../lib/api";
import { useActiveRun } from "../../../app/hooks/useActiveRun";
import {
  formatBRL,
  formatCompactBRL,
  formatNumber,
  formatPercent,
} from "../../../shared/format";
import type { Tone } from "../../../shared/tokens/tokens";
import { journeysMock } from "../journeys.mock";
import type {
  FlowNode,
  JourneyFlow,
  JourneysData,
  LoopRow,
  OutcomeNode,
  TopPathRow,
} from "../types";

// Filter behaviour is client-side over the API rows.

export type JourneyLengthBucket =
  | "all"
  | "1"
  | "2"
  | "3-5"
  | "6-10"
  | "10+";

export type JourneyFiltersState = {
  hideDirect: boolean;
  hideSelfLoops: boolean;
  journeyLength: JourneyLengthBucket;
  origin: string; // "all" or a channel name
  destination: string; // "all" or a channel name
};

export const DEFAULT_JOURNEY_FILTERS: JourneyFiltersState = {
  hideDirect: false,
  hideSelfLoops: false,
  journeyLength: "all",
  origin: "all",
  destination: "all",
};

function pathContainsDirect(path: string): boolean {
  return /\bdirect\b|\bdiretos\b/i.test(path);
}

function pathSteps(path: string): string[] {
  return path
    .split(/\s*(?:->|>|→)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function lengthBucketMatches(
  hops: number,
  bucket: JourneyLengthBucket,
): boolean {
  switch (bucket) {
    case "all":
      return true;
    case "1":
      return hops === 1;
    case "2":
      return hops === 2;
    case "3-5":
      return hops >= 3 && hops <= 5;
    case "6-10":
      return hops >= 6 && hops <= 10;
    case "10+":
      return hops > 10;
  }
}

export function filterTopPaths(
  rows: TopPathRow[],
  f: JourneyFiltersState,
): TopPathRow[] {
  return rows.filter((r) => {
    if (f.hideDirect && pathContainsDirect(r.path)) return false;
    const steps = pathSteps(r.path);
    const hops = Math.max(0, steps.length - 1);
    if (!lengthBucketMatches(hops, f.journeyLength)) return false;
    if (f.origin !== "all" && steps[0] !== f.origin) return false;
    if (
      f.destination !== "all" &&
      steps[steps.length - 1] !== f.destination
    ) {
      return false;
    }
    return true;
  });
}

export function filterLoops(
  rows: LoopRow[],
  f: JourneyFiltersState,
): LoopRow[] {
  return rows.filter((r) => {
    if (f.hideDirect && pathContainsDirect(r.pattern)) return false;
    if (f.hideSelfLoops) {
      const m = r.pattern.split(/\s*(?:->|>|→)\s*/).map((s) => s.trim());
      if (m.length === 2 && m[0] === m[1]) return false;
    }
    return true;
  });
}

export function useJourneysData(
  filters: JourneyFiltersState = DEFAULT_JOURNEY_FILTERS,
): JourneysData {
  const activeRun = useActiveRun();
  const runId = activeRun?.id;

  const pathsQuery = useQuery({
    queryKey: ["paths", runId],
    enabled: runId != null,
    queryFn: () => api.getPaths(runId!),
  });
  const loopDiagnosticsQuery = useQuery({
    queryKey: ["loop-diagnostics", runId],
    enabled: runId != null,
    queryFn: () => api.getLoopDiagnostics(runId!),
  });
  const graphQuery = useQuery({
    queryKey: ["graph", runId],
    enabled: runId != null,
    queryFn: () => api.getGraph(runId!),
  });

  return useMemo(() => {
    const base = journeysMock;
    const hasData =
      pathsQuery.data?.rows && loopDiagnosticsQuery.data?.rows && graphQuery.data;

    if (!hasData) {
      // Fallback to mock while loading or when no run is selected.
      const filteredTopPaths = filterTopPaths(base.topPaths.rows, filters);
      const filteredLoops = filterLoops(base.loopsAndPatterns.items, filters);
      return {
        ...base,
        topPaths: { ...base.topPaths, rows: filteredTopPaths },
        loopsAndPatterns: { ...base.loopsAndPatterns, items: filteredLoops },
      };
    }

    const topPathRows = pathRowsToTopPaths(pathsQuery.data!.rows);
    const loopRows = loopDiagnosticsToLoops(loopDiagnosticsQuery.data!.rows);
    const journeyFlow = graphToJourneyFlow(graphQuery.data!);

    const filteredTopPaths = filterTopPaths(topPathRows, filters);
    const filteredLoops = filterLoops(loopRows, filters);

    return {
      ...base,
      journeyFlow,
      topPaths: { ...base.topPaths, rows: filteredTopPaths },
      loopsAndPatterns: { ...base.loopsAndPatterns, items: filteredLoops },
    };
  }, [filters, pathsQuery.data, loopDiagnosticsQuery.data, graphQuery.data]);
}

// ---------------------------------------------------------------------------
// Top Paths
// ---------------------------------------------------------------------------

function pathRowsToTopPaths(rows: PathRow[]): TopPathRow[] {
  // Use top 20 by revenue. Skip empty path rows and paths that are just "(start)".
  const cleaned = rows
    .filter((r) => r.path_text && r.path_text.trim() !== "(start)")
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
    .slice(0, 20);

  const totalCount = cleaned.reduce((acc, r) => acc + (r.count ?? 0), 0);

  return cleaned.map((row, idx) => {
    const participation = totalCount > 0 ? (row.count ?? 0) / totalCount : 0;
    return {
      rank: idx + 1,
      path: prettifyPath(row.path_text),
      participation: formatPercent(participation, 2),
      delta: "—", // requires comparison run
      revenue: row.revenue != null ? formatCompactBRL(row.revenue) : "—",
      conversions: row.conversion_count != null ? formatNumber(row.conversion_count) : "—",
      ticket: row.avg_ticket != null ? formatBRL(row.avg_ticket) : "—",
      timeToConversion: "—", // not in schema
    };
  });
}

function prettifyPath(raw: string): string {
  // Normalize " -> " to " > " for the existing splitter in filterTopPaths and TopPathsTable.
  return raw.replace(/\s*->\s*/g, " > ");
}

// ---------------------------------------------------------------------------
// Loops & Patterns
// ---------------------------------------------------------------------------

function loopDiagnosticsToLoops(rows: LoopDiagnosticRow[]): LoopRow[] {
  // Top 6 self-loop channels by support; render each as "X > X" with conversion
  // metrics. Tone reflects loop conversion lift (green = positive, red = negative).
  const ranked = rows
    .filter((r) => (r.self_loop_count ?? 0) > 0 && (r.support ?? 0) > 0)
    .sort((a, b) => (b.self_loop_count ?? 0) - (a.self_loop_count ?? 0))
    .slice(0, 6);

  return ranked.map((r) => {
    const repeats = r.max_consecutive_repeats ?? r.avg_consecutive_repeats ?? 2;
    const description = repeats > 2 ? `Loop até ${Math.round(repeats)} toques` : "Loop de 2 toques";
    return {
      pattern: `${r.channel} > ${r.channel}`,
      description,
      participation: formatPercent(r.self_loop_rate ?? 0, 1),
      conversion: r.loop_conversion_rate != null ? formatPercent(r.loop_conversion_rate, 1) : "—",
      tone: loopTone(r.loop_conversion_lift),
    };
  });
}

function loopTone(lift: number | null | undefined): Tone {
  if (lift == null) return "neutral";
  if (lift > 0.1) return "green";
  if (lift < -0.1) return "red";
  return "neutral";
}

// ---------------------------------------------------------------------------
// Journey Flow (Sankey)
// ---------------------------------------------------------------------------

function graphToJourneyFlow(graph: GraphResponse): JourneyFlow {
  const base = journeysMock.journeyFlow;

  // Total journeys = sum of in_count for conversion + non_conversion.
  const conversionNode = graph.nodes.find((n) => n.type === "conversion");
  const nonConversionNode = graph.nodes.find((n) => n.type === "non_conversion");
  const totalJourneys =
    (conversionNode?.in_count ?? 0) + (nonConversionNode?.in_count ?? 0);

  // Left nodes: channels receiving most traffic from "(start)" / "start".
  const startEdges = graph.edges
    .filter((e) => e.source === "(start)" || e.source === "start")
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const leftNodes: FlowNode[] = startEdges.map((e) => {
    const node = graph.nodes.find((n) => n.id === e.target);
    const value = totalJourneys > 0 ? e.count / totalJourneys : 0;
    return {
      channel: e.target,
      value: formatPercent(value, 1),
      tone: channelTone(e.target),
      icon: iconForChannel(node?.label ?? e.target),
    };
  });

  // Middle nodes: top channels by pagerank that are not start/outcome.
  const middleCandidates = graph.nodes
    .filter((n) => n.type === "channel")
    .sort((a, b) => (b.pagerank ?? 0) - (a.pagerank ?? 0))
    .slice(0, 6);

  const middleNodes: FlowNode[] = middleCandidates.map((node) => {
    const value = totalJourneys > 0 ? node.in_count / totalJourneys : 0;
    return {
      channel: node.id,
      value: formatPercent(value, 1),
      tone: channelTone(node.id),
      icon: iconForChannel(node.label),
    };
  });

  // Outcome nodes: conversion + non-conversion.
  const outcomeNodes: OutcomeNode[] = [];
  if (conversionNode && totalJourneys > 0) {
    outcomeNodes.push({
      label: "Conversão",
      value: formatPercent(conversionNode.in_count / totalJourneys, 1),
      tone: "green",
      icon: "CircleCheck",
    });
  }
  if (nonConversionNode && totalJourneys > 0) {
    outcomeNodes.push({
      label: "Não converteu",
      value: formatPercent(nonConversionNode.in_count / totalJourneys, 1),
      tone: "red",
      icon: "CircleX",
    });
  }

  return {
    ...base,
    leftNodes: leftNodes.length > 0 ? leftNodes : base.leftNodes,
    middleNodes: middleNodes.length > 0 ? middleNodes : base.middleNodes,
    outcomeNodes: outcomeNodes.length > 0 ? outcomeNodes : base.outcomeNodes,
    footer: {
      ...base.footer,
      coverage: totalJourneys > 0
        ? `Baseado em ${formatNumber(Math.round(totalJourneys))} jornadas analisadas`
        : base.footer.coverage,
    },
  };
}

function channelTone(channel: string): Tone {
  const lower = channel.toLowerCase();
  if (lower.includes("google")) return "blue";
  if (lower.includes("meta") || lower.includes("facebook")) return "indigo";
  if (lower.includes("instagram")) return "indigo";
  if (lower.includes("email")) return "cyan";
  if (lower.includes("whatsapp")) return "green";
  if (lower.includes("sms")) return "orange";
  if (lower.includes("organic")) return "neutral";
  if (lower.includes("direct")) return "neutral";
  if (lower.includes("referral")) return "neutral";
  if (lower.includes("display")) return "red";
  return "neutral";
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
  return "ExternalLink";
}
