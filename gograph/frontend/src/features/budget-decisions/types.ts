import type { Tone } from "../../shared/tokens/tokens";

export type SummaryCard = {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  tone: Tone;
};

export type AllocationPoint = {
  channel: string;
  x: number;
  y: number;
  revenue: string;
  recommendation: string;
  tone: Tone;
};

export type AllocationQuadrant = {
  label: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  description: string;
};

export type AllocationMatrixData = {
  title: string;
  subtitle: string;
  axes: { x: string; y: string };
  scale: { x: string[]; y: string[] };
  quadrants: AllocationQuadrant[];
  points: AllocationPoint[];
  helper: string;
};

export type ScaleOpportunity = {
  channel: string;
  impact: string;
  roasMarkov: string;
};

export type ReductionRisk = {
  channel: string;
  impact: string;
  reason: string;
};

export type OpportunitiesRisksData = {
  title: string;
  scaleOpportunities: ScaleOpportunity[];
  reductionRisks: ReductionRisk[];
  technicalNote: string;
};

export type ChannelRowDelta = string;

export type ChannelTableRow = {
  channel: string;
  recommendation: string;
  tone: Tone;
  spend: string;
  spendDelta: ChannelRowDelta;
  revenue: string;
  revenueDelta: ChannelRowDelta;
  roasMarkov: string;
  roasMarkovDelta: ChannelRowDelta;
  roasShapley: string;
  roasShapleyDelta: ChannelRowDelta;
  consensus: string;
  role: string;
  presence: number;
  action: "open";
};

export type ChannelsTableControl = {
  id: string;
  label?: string;
  placeholder?: string;
  icon?: string;
};

export type ChannelsTableData = {
  title: string;
  controls: ChannelsTableControl[];
  columns: string[];
  rows: ChannelTableRow[];
  pagination: string;
};

export type ChannelDetailsTab = "Resumo" | "Jornada" | "Impactos" | "Cenários";

export type DrawerTransitionRow = { channel: string; value: string };

export type DrawerMetric = { title: string; value: string; delta: string };

export type DrawerSuggestedAction = {
  title: string;
  description: string;
  slider: { min: string; current: string; selected: string; max: string };
  estimatedImpact: { revenue: string; roas: string };
};

export type SelectedChannelDrawer = {
  channel: string;
  recommendation: string;
  tone: Tone;
  tabs: ChannelDetailsTab[];
  metrics: DrawerMetric[];
  recommendationCard: { title: string; badge: string; description: string };
  rationale: string[];
  journeyRole: { label: string; description: string };
  transitions: { before: DrawerTransitionRow[]; after: DrawerTransitionRow[] };
  suggestedAction: DrawerSuggestedAction;
  actions: string[];
};

export type BudgetDecisionsFilter = {
  id: string;
  type: string;
  icon?: string;
  label?: string;
  value: string;
};

export type BudgetDecisionsAction = {
  id: string;
  label: string;
  icon: string;
  variant: "primary" | "secondary";
};

export type BudgetDecisionsData = {
  screen: { id: string; title: string; route: string; activeNav: string };
  topBar: {
    filters: BudgetDecisionsFilter[];
    actions: BudgetDecisionsAction[];
  };
  summaryCards: SummaryCard[];
  allocationMatrix: AllocationMatrixData;
  opportunitiesAndRisks: OpportunitiesRisksData;
  channelsTable: ChannelsTableData;
  selectedChannelDrawer: SelectedChannelDrawer;
};
