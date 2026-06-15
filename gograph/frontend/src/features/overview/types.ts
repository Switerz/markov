import type { Tone } from "../../shared/tokens/tokens";
import type { StatTone } from "../../shared/ui/StatDelta";

// Tones in the contract JSON: "green" | "orange" | "blue" | "red" | "purple".
// The design system replaces purple #8B5CF6 with indigo #5B4FE5 — in this feature
// we map JSON "purple" → "indigo" both for metric tones and consensus point tones.

export type ScreenMeta = {
  id: string;
  title: string;
  subtitle: string | null;
  route: string;
  activeNav: string;
};

export type FilterAccount = {
  id: "account";
  type: "select";
  icon: string;
  value: string;
};

export type FilterDateRange = {
  id: string;
  type: "dateRange";
  icon?: string;
  label?: string;
  value: string;
};

export type FilterExecution = {
  id: "execution";
  type: "select";
  icon: string;
  value: string;
};

export type FilterConfidence = {
  id: "confidence";
  type: "status";
  icon: string;
  label: string;
  value: string;
  tone: Tone;
};

export type FilterItem =
  | FilterAccount
  | FilterDateRange
  | FilterExecution
  | FilterConfidence;

export type ActionItem = {
  id: string;
  label: string;
  icon: string;
  variant: "primary" | "secondary";
};

export type MetricItem = {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  tone: Tone;
  delta?: { value: string; label: string; tone: StatTone };
};

export type PriorityRecommendation =
  | "Escalar"
  | "Defender"
  | "Investigar"
  | "Reduzir";

export type PriorityDecision = {
  channel: string;
  icon: string;
  recommendation: PriorityRecommendation;
  tone: Tone;
  shareSpend: string;
  shareRevenue: string;
  roas: string;
  description: string;
  actions: string[];
};

export type PriorityDecisions = {
  title: string;
  subtitle: string;
  sort: string;
  cards: PriorityDecision[];
};

export type QuadrantPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type QuadrantSpec = {
  label: string;
  position: QuadrantPosition;
  description: string;
};

export type ConsensusPoint = {
  channel: string;
  x: number;
  y: number;
  size: string;
  tone: Tone;
};

export type ModelConsensus = {
  title: string;
  subtitle: string;
  viewBy: string;
  axes: { x: string; y: string };
  quadrants: QuadrantSpec[];
  points: ConsensusPoint[];
  legend: string[];
};

export type JourneyColumnItem = { name: string; value: string };

export type JourneyColumn = {
  title: string;
  items: JourneyColumnItem[];
};

export type JourneyFlowStep = {
  stage: string;
  value: string;
  amount?: string;
};

export type JourneySummary = {
  title: string;
  columns: JourneyColumn[];
  flow: JourneyFlowStep[];
  averageTimeToConversion: string;
};

export type ConfidenceItem = { label: string; value: string };

export type AnalysisConfidence = {
  title: string;
  modelCalibration: ConfidenceItem[];
  dataQuality: ConfidenceItem[];
  summary: { label: string; description: string };
};

export type OverviewData = {
  screen: ScreenMeta;
  topBar: { filters: FilterItem[]; actions: ActionItem[] };
  metrics: MetricItem[];
  priorityDecisions: PriorityDecisions;
  modelConsensus: ModelConsensus;
  journeySummary: JourneySummary;
  analysisConfidence: AnalysisConfidence;
  footerNote: string;
};
