export type LiftCategory = "canal" | "sequencia" | "conteudo" | "pagina" | "evento";
export type LiftPriority = "baixa" | "media" | "alta" | "critica";
export type LiftConfidence = "baixa" | "media" | "alta";

export type LiftInsight = {
  id: string;
  title: string;
  category: LiftCategory;
  liftPct: number;
  confidence: LiftConfidence;
  priority: LiftPriority;
  evidence: string[];
  hypothesis: string;
  actions: string[];
  baseConvRate?: number;
  liftConvRate?: number;
  baseLabel?: string;
  liftLabel?: string;
};

export type LiftMetricSummary = {
  totalInsights: number;
  avgLift: number;
  criticalCount: number;
  estimatedRevImpact: string;
};

export type LiftEngineData = {
  screen: { title: string; subtitle: string };
  metrics: LiftMetricSummary;
  insights: LiftInsight[];
};
