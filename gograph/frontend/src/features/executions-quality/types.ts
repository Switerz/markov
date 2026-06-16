import type { Tone } from "../../shared/tokens/tokens";
import type { StatTone } from "../../shared/ui/StatDelta";

export type ExecutionsScreenMeta = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  activeNav: string;
};

export type TopBarActionVariant = "primary" | "secondary" | "icon";

export type TopBarAction = {
  id: string;
  label: string;
  icon: string;
  variant: TopBarActionVariant;
};

export type SummaryMetric = {
  id: string;
  title: string;
  value: string;
  icon: string;
  tone: Tone;
  subtitle?: string;
  badge?: string;
  delta?: { value: string; label: string; tone: StatTone };
};

export type ExecutionStatusTone = "green" | "blue" | "orange" | "red" | "neutral";
export type ConfidenceBadge = "Alta" | "Média" | "Baixa" | "—";

export type ExecutionHistoryRow = {
  id: string;
  period: string;
  status: string;
  statusTone: ExecutionStatusTone;
  revenue: string;
  observedConversion: string;
  modeledConversion: string;
  confidence: string;
  confidenceBadge?: ConfidenceBadge;
  runtime: string;
  createdBy: string;
  createdAt: string;
  selected?: boolean;
};

export type ExecutionHistoryControl = {
  id: string;
  label?: string;
  placeholder?: string;
  icon?: string;
};

export type ExecutionHistory = {
  title: string;
  controls: ExecutionHistoryControl[];
  columns: string[];
  rows: ExecutionHistoryRow[];
  pagination: { summary: string; pages: (number | "...")[] };
};

export type TrustCenter = {
  title: string;
  overallConfidence: { value: string; badge: ConfidenceBadge; delta: string };
  modelCalibration: { label: string; value: string }[];
  dataQuality: { label: string; value: string }[];
  alerts: { title: string; items: string[]; action: string };
  checks: { title: string; value: string; description: string; action: string };
};

export type CompareChannelChange = {
  channel: string;
  from: string;
  to: string;
  delta: string;
  tone: StatTone;
};

export type CompareExecutions = {
  title: string;
  from: string;
  to: string;
  variation: { title: string; value: string; delta: string };
  channelContributionChange: CompareChannelChange[];
  legend: { label: string; tone: Tone }[];
  action: string;
};

export type ExecutionDetailsTab = "Parâmetros" | "Entradas" | "Saídas" | "Logs";

export type ExecutionDetailsPanelData = {
  title: string;
  period: string;
  status: string;
  createdAt: string;
  createdBy: string;
  tabs: ExecutionDetailsTab[];
  activeTab: ExecutionDetailsTab;
  modelParameters: { label: string; value: string }[];
  inputs: {
    source: string;
    query: string;
    rows: string;
    period: string;
    hash: string;
  }[];
  outputs: { label: string; value: string }[];
  logs: {
    step: string;
    status: string;
    duration: string;
    message: string;
    createdAt: string;
  }[];
  notes: { title: string; value: string; action: string };
  confidenceBox: { title: string; description: string; action: string };
  actions: TopBarAction[];
};

export type ExecutionsQualityData = {
  screen: ExecutionsScreenMeta;
  topBar: { actions: TopBarAction[] };
  summaryMetrics: SummaryMetric[];
  executionHistory: ExecutionHistory;
  trustCenter: TrustCenter;
  compareExecutions: CompareExecutions;
  executionDetailsPanel: ExecutionDetailsPanelData;
};
