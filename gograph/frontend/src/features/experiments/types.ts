import type { Tone } from "../../shared/tokens/tokens";
import type { StatTone } from "../../shared/ui/StatDelta";

export type ExperimentScreenMeta = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  activeNav: string;
};

export type ExecutionContext = { label: string; value: string; icon: string };

export type TopBarAction = {
  id: string;
  label: string;
  icon: string;
  variant: "primary" | "secondary" | "icon";
};

export type ScenarioActionType = {
      id:
    | "removeChannel"
    | "reducePresence"
    | "redistributeBudget"
    | "compareModels"
    | "path";
  label: string;
  icon: string;
  active?: boolean;
};

export type ScenarioField =
  | {
      id: "channel";
      label: string;
      type: "select";
      value: string;
      icon?: string;
    }
  | { id: "action"; label: string; type: "select"; value: string }
  | {
      id: "intensity";
      label: string;
      type: "slider";
      value: number;
      marks: string[];
    }
  | {
      id: "period";
      label: string;
      type: "dateRange";
      value: string;
      icon?: string;
    }
  | { id: "advancedOptions"; label: string; type: "accordion" };

export type ScenarioBuilder = {
  title: string;
  subtitle: string;
  actionTypes: ScenarioActionType[];
  fields: ScenarioField[];
  primaryAction: { label: string; icon: string };
};

export type ComparisonMetric = {
  label: string;
  value: string;
  delta?: string;
  tone?: StatTone;
};

export type ComparisonColumn = {
  title: string;
  period?: string;
  metrics: ComparisonMetric[];
};

export type BaselineVsScenario = {
  title: string;
  legend: { label: string; tone: Tone }[];
  baseline: ComparisonColumn;
  scenario: ComparisonColumn;
  delta: { title: string; metrics: ComparisonMetric[] };
};

export type WaterfallStepData = {
  label: string;
  value: number;
  display: string;
  type: "start" | "positive" | "negative" | "bridge" | "end";
};

export type RedistributionChart = {
  title: string;
  subtitle: string;
  control: string;
  waterfall: WaterfallStepData[];
  note: string;
};

export type ScenarioInsightsData = {
  title: string;
  hypothesis: string;
  mainLearnings: string[];
  riskBox: { title: string; items: string[] };
  nextRecommendedTest: {
    title: string;
    description: string;
    estimatedImpact: { revenue: string; roas: string; confidence: string };
  };
  actions: {
    id: string;
    label: string;
    icon: string;
    variant: "primary" | "secondary";
  }[];
};

export type ScenarioRow = {
  scenario: string;
  description: string;
  conversionProbability: string;
  conversionDelta?: string;
  revenue: string;
  revenueDelta?: string;
  investment: string;
  investmentDelta?: string;
  roas: string;
  roasDelta?: string;
  impact: string;
  impactDelta?: string;
  tone: Tone;
};

export type ScenarioComparisonTable = {
  title: string;
  columns: string[];
  rows: ScenarioRow[];
  action: string;
};

export type ExperimentsData = {
  screen: ExperimentScreenMeta;
  topBar: { executionContext: ExecutionContext; actions: TopBarAction[] };
  scenarioBuilder: ScenarioBuilder;
  baselineVsScenario: BaselineVsScenario;
  redistributionChart: RedistributionChart;
  scenarioInsights: ScenarioInsightsData;
  scenarioComparisonTable: ScenarioComparisonTable;
};
