import { useMemo } from "react";
import { journeysMock } from "../journeys.mock";
import type { JourneysData, LoopRow, TopPathRow } from "../types";

// TODO(api): compose from api.getGraph(runId) + api.getPaths(runId)
// + api.getLoops(runId) + api.getLoopDiagnostics(runId).
//
// Filter behaviour today is purely client-side over the mock rows. When the
// API is wired, the same `JourneyFiltersState` shape can be lifted into the
// query key so the server returns filtered data and we drop the local pass.

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
  // Splits "A > B > Conversão" into ["A", "B", "Conversão"]. Accepts either
  // ASCII ">" or unicode arrow "→".
  return path
    .split(/\s*(?:>|→)\s*/)
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
      // "Foo → Foo" pattern (same channel on both sides).
      const m = r.pattern.split(/\s*(?:>|→)\s*/).map((s) => s.trim());
      if (m.length === 2 && m[0] === m[1]) return false;
    }
    return true;
  });
}

export function useJourneysData(
  filters: JourneyFiltersState = DEFAULT_JOURNEY_FILTERS,
): JourneysData {
  return useMemo(() => {
    const base = journeysMock;
    const filteredTopPaths = filterTopPaths(base.topPaths.rows, filters);
    const filteredLoops = filterLoops(base.loopsAndPatterns.items, filters);
    return {
      ...base,
      topPaths: { ...base.topPaths, rows: filteredTopPaths },
      loopsAndPatterns: {
        ...base.loopsAndPatterns,
        items: filteredLoops,
      },
    };
  }, [filters]);
}
