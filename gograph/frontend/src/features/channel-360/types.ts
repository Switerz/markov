import type { Tone } from "../../shared/tokens/tokens";
import type { StatTone } from "../../shared/ui/StatDelta";

// Domain shapes for the Channel 360 screen. Mirrors the JSON contract in
// docs/gograph-refactor-instrucoes/03-canal-360-google-ads.md.
// The JSON uses `purple` for one segment; the local tone system has no
// purple, so we translate it to `indigo` in the mock. All shapes here
// already use the canonical `Tone` union.

export type ChannelScreenMeta = {
  id: string;
  title: string;
  route: string;
  activeNav: string;
  breadcrumb: string[];
  channel: {
    name: string;
    logo: string;
    recommendation: string;
    recommendationTone: Tone;
  };
};

export type ChannelFilter =
  | { id: string; type: "dateRange"; icon?: string; label?: string; value: string }
  | { id: string; type: "select"; icon?: string; label?: string; value: string };

export type ChannelAction = {
  id: string;
  label: string;
  icon: string;
  variant: "primary" | "secondary";
};

export type ChannelTopBar = {
  filters: ChannelFilter[];
  actions: ChannelAction[];
};

export type ChannelMetric = {
  id: string;
  title: string;
  value: string;
  icon: string;
  tone: Tone;
  delta?: { value: string; label: string; tone: StatTone };
};

export type AttributionEfficiencyRow = {
  model: string;
  investmentShare: string;
  investmentBar: number; // 0..100
  attributedRevenue: string;
  revenueShare: string;
  relativeEfficiency: string;
  efficiencyTone: Tone;
};

export type AttributionEfficiency = {
  title: string;
  subtitle: string;
  rows: AttributionEfficiencyRow[];
  formula: string;
};

export type JourneyRoleSlice = {
  label: string;
  description: string;
  value: number;
  tone: Tone;
};

export type JourneyRole = {
  title: string;
  subtitle: string;
  donut: JourneyRoleSlice[];
};

export type RecommendationEvidence = {
  title: string;
  badge: string;
  whyIncreaseInvestment: string[];
  risks: string[];
  bestPractices: string[];
  confidenceBox: { title: string; link: string };
};

export type AdjacentChannelRow = {
  rank: number;
  channel: string;
  participation: string;
  journeys: string;
};

export type AdjacentChannels = {
  title: string;
  subtitle: string;
  rows: AdjacentChannelRow[];
};

export type AdjacentChannelsBlock = {
  channelsBefore: AdjacentChannels;
  channelsAfter: AdjacentChannels;
};

export type RelevantSequence = {
  path: string[];
  uplift: string;
  frequencyMedian: string;
  baseline: string;
  sequenceConversion: string;
  action: string;
};

export type RelevantSequences = {
  title: string;
  subtitle: string;
  items: RelevantSequence[];
  note: string;
};

export type TimeEvolutionControl = {
  id: string;
  label?: string;
  value: string;
};

export type TimeEvolutionSeries = {
  month: string;
  markov: number;
  shapley: number;
  lastClick: number;
  roas: string;
};

export type TimeEvolution = {
  title: string;
  subtitle: string;
  controls: TimeEvolutionControl[];
  series: TimeEvolutionSeries[];
};

export type QuickDetailRow = { label: string; value: string };

export type QuickDetails = {
  title: string;
  items: QuickDetailRow[];
};

export type Channel360Data = {
  screen: ChannelScreenMeta;
  topBar: ChannelTopBar;
  metricStrip: ChannelMetric[];
  attributionEfficiency: AttributionEfficiency;
  journeyRole: JourneyRole;
  recommendationEvidence: RecommendationEvidence;
  tables: AdjacentChannelsBlock;
  relevantSequences: RelevantSequences;
  timeEvolution: TimeEvolution;
  quickDetails: QuickDetails;
};
