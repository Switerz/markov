import type { Tone } from "../../shared/tokens/tokens";

export type AudienceFilterValue = string;

export type JourneyFilter =
  | { id: string; type: "select"; icon?: string; label?: string; value: string }
  | { id: string; type: "dateRange"; icon?: string; label?: string; value: string }
  | { id: string; type: "switch"; label: string; value: boolean };

export type ViewTabId = "flow" | "graph" | "paths" | "matrix";

export type ViewTab = {
  id: ViewTabId;
  label: string;
  icon: string;
  active?: boolean;
};

export type FlowNode = {
  channel: string;
  value: string;
  tone?: Tone;
  icon?: string;
};

export type OutcomeNode = {
  label: string;
  value: string;
  tone: Tone;
  icon: string;
};

export type JourneyFlow = {
  title: string;
  subtitle: string;
  leftNodes: FlowNode[];
  middleNodes: FlowNode[];
  outcomeNodes: OutcomeNode[];
  footer: { coverage: string; legend: string; action: string };
};

export type BuilderStep = { step: number; label: string; tone?: Tone };

export type EstimatedMetric = {
  title: string;
  value: string;
  subtitle?: string;
};

export type JourneyBuilder = {
  title: string;
  subtitle: string;
  path: BuilderStep[];
  actions: { id: string; label: string; icon: string }[];
  quickSuggestions: string[];
  estimatedInterpretation: {
    description: string;
    metrics: EstimatedMetric[];
  };
  primaryAction: string;
  secondaryAction: string;
};

export type TopPathRow = {
  rank: number;
  path: string;
  participation: string;
  delta: string;
  revenue: string;
  conversions: string;
  ticket: string;
  timeToConversion: string;
};

export type TopPaths = {
  title: string;
  columns: string[];
  rows: TopPathRow[];
  action: string;
};

export type TransitionMatrixData = {
  title: string;
  metric: string;
  columns: string[];
  rows: { from: string; values: (number | null)[] }[];
  action: string;
};

export type LoopRow = {
  pattern: string;
  description: string;
  participation: string;
  conversion: string;
  tone: Tone;
};

export type LoopsPatterns = {
  title: string;
  filter: string;
  columns: string[];
  items: LoopRow[];
  action: string;
};

export type ButtonVariant = "primary" | "secondary";

export type TopBarAction = {
  id: string;
  label: string;
  icon: string;
  variant: ButtonVariant;
};

export type JourneysScreen = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  activeNav: string;
};

export type FlowMetric = { label: string; value: string };

export type JourneysData = {
  screen: JourneysScreen;
  topBar: { actions: TopBarAction[] };
  filters: JourneyFilter[];
  viewTabs: ViewTab[];
  flowMetric: FlowMetric;
  journeyFlow: JourneyFlow;
  journeyBuilder: JourneyBuilder;
  topPaths: TopPaths;
  transitionMatrix: TransitionMatrixData;
  loopsAndPatterns: LoopsPatterns;
};
