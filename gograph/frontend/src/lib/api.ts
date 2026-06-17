const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export type ModelRun = {
  id: number;
  start_date: string;
  end_date: string;
  created_at: string | null;
  status: string;
  parameters: Record<string, unknown>;
  observed_conversion_rate: number | null;
  model_conversion_rate: number;
  total_revenue: number;
  total_spend: number;
  runtime_seconds: number;
  error_message?: string | null;
  funnel_model_active?: boolean | null;
};

export type TableResponse<T = Record<string, unknown>> = {
  model_run_id: number;
  table: string;
  rows: T[];
};

export type ChannelRow = {
  channel: string;
  model_type?: string | null;
  markov_weight?: number | null;
  markov_revenue?: number | null;
  removal_effect?: number | null;
  shapley_weight?: number | null;
  shapley_revenue?: number | null;
  shapley_value?: number | null;
  spend?: number | null;
  roas_markov?: number | null;
  roas_shapley?: number | null;
  first_click_revenue?: number | null;
  first_click_roas?: number | null;
  last_click_revenue?: number | null;
  last_click_roas?: number | null;
  // PFC (Position-Frequency-Causal) — exposed via Block 1
  // TODO(api): surface in Channel 360 UI (Block 2).
  pfc_weight?: number | null;
  pfc_delta_pp?: number | null;
  recommendation?: string | null;
  confidence_score?: number | null;
};

export type DiagnosticRow = {
  channel: string;
  channel_role?: string | null;
  touchpoint_role?: string | null;
  presence_converting?: number | null;
  presence_nonconverting?: number | null;
  first_touch_share?: number | null;
  middle_touch_share?: number | null;
  last_touch_share?: number | null;
  assist_count?: number | null;
  closer_count?: number | null;
  starter_count?: number | null;
  markov_shapley_delta_pp?: number | null;
  diagnostic_label?: string | null;
  diagnostic_text?: string | null;
};

export type DataQualityRow = {
  check_name: string;
  status: string;
  severity: string;
  detail?: string | null;
  score?: number | null;
  affected_rows?: number | null;
  recommendation?: string | null;
};

export type ModelRunSummaryRow = {
  observed_conversion_rate?: number | null;
  model_conversion_rate: number;
  total_revenue: number;
  total_spend: number;
  total_conversions: number;
  total_nonconversions_sampled: number;
  non_conv_scale?: number | null;
  state_count: number;
  channel_count: number;
  path_count: number;
  transition_count: number;
  confidence_score: number;
  confidence_label: string;
};

export type ModelRunInputRow = {
  source: string;
  database_id?: number | null;
  query_name: string;
  row_count: number;
  date_min?: string | null;
  date_max?: string | null;
  data_hash: string;
  extracted_at?: string | null;
};

export type ModelRunLogRow = {
  step: string;
  status: string;
  message?: string | null;
  duration_seconds?: number | null;
  created_at?: string | null;
};

export type InsightRow = {
  channel: string;
  title: string;
  description: string;
  evidence: string;
  metric: string;
  severity: string;
  confidence: string;
  recommendation: string;
  limitation: string;
};

export type TouchpointRow = {
  channel: string;
  conv_first_touch_share: number;
  conv_middle_touch_share: number;
  conv_last_touch_share: number;
  nonconv_first_touch_share: number;
  nonconv_middle_touch_share: number;
  nonconv_last_touch_share: number;
  starter_count: number;
  assist_count: number;
  closer_count: number;
  dropoff_after_touch: number;
  touchpoint_role: string;
};

export type GraphNode = {
  id: string;
  label: string;
  type: "start" | "channel" | "conversion" | "non_conversion";
  in_count: number;
  out_count: number;
  count: number;
  revenue: number;
  avg_ticket?: number | null;
  degree_centrality: number;
  in_degree_centrality: number;
  out_degree_centrality: number;
  pagerank: number;
  has_self_loop: boolean;
  in_cycle: boolean;
};

export type GraphEdge = {
  source: string;
  target: string;
  count: number;
  probability?: number | null;
  revenue: number;
  avg_ticket?: number | null;
  transition_types: string;
  is_self_loop: boolean;
};

export type GraphCycle = {
  nodes: string[];
  count: number;
  revenue: number;
};

export type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles: GraphCycle[];
  self_loops: Array<{
    node: string;
    count: number;
    probability?: number | null;
    revenue: number;
    avg_ticket?: number | null;
  }>;
  summary: {
    node_count: number;
    edge_count: number;
    cycle_count: number;
    self_loop_count: number;
  };
};

export type PathRow = {
  path_text: string;
  path_length?: number | null;
  count?: number | null;
  conversion_count?: number | null;
  nonconversion_count?: number | null;
  conversion_rate?: number | null;
  revenue?: number | null;
  avg_ticket?: number | null;
  path_probability?: number | null;
  contains_loop?: boolean | null;
  confidence_score?: number | null;
};

// ---------------------------------------------------------------------------
// Sprint 11 — Loop diagnostics
// ---------------------------------------------------------------------------

export type LoopDiagnosticRow = {
  channel: string;
  self_loop_count?: number | null;
  self_loop_rate?: number | null;
  avg_consecutive_repeats?: number | null;
  median_consecutive_repeats?: number | null;
  max_consecutive_repeats?: number | null;
  loop_conversion_rate?: number | null;
  nonloop_conversion_rate?: number | null;
  loop_conversion_lift?: number | null;
  exit_distribution_json?: string | null;
  support?: number | null;
  confidence?: string | null;
};

// ---------------------------------------------------------------------------
// Sprint 13 — Funnel Stage Attribution
// ---------------------------------------------------------------------------

export type FunnelAttributionRow = {
  state: string;
  channel: string;
  funnel_stage: string;
  markov_weight?: number | null;
  markov_revenue?: number | null;
  removal_effect?: number | null;
  shapley_weight?: number | null;
  shapley_revenue?: number | null;
  presence_converting?: number | null;
  presence_nonconverting?: number | null;
  support?: number | null;
  confidence?: string | null;
};

// ---------------------------------------------------------------------------
// Sprint 16 — Funnel Attribution Validation
// ---------------------------------------------------------------------------

export type FunnelValidationRow = {
  channel: string;
  funnel_markov_weight: number;
  raw_markov_weight: number;
  low_intent_weight: number;
  product_interest_weight: number;
  cart_intent_weight: number;
  checkout_weight: number;
  purchase_weight: number;
  qualified_weight: number;
  low_intent_drag_score: number;
  qualified_intent_share: number;
  markov_excl_low_intent: number;
};

// ---------------------------------------------------------------------------
// Sprint 14 — Sequential Effects
// ---------------------------------------------------------------------------

export type TransitionRow = {
  from_state: string;
  to_state: string;
  n?: number | null;
  total_revenue?: number | null;
  transition_type?: string | null;
};

// ---------------------------------------------------------------------------
// Sprint 18 — Session Quality
// ---------------------------------------------------------------------------

export type SessionQualityRow = {
  channel: string;
  sessions?: number | null;
  avg_duration_s?: number | null;
  avg_pageviews?: number | null;
  avg_bounce_rate?: number | null;
  avg_events?: number | null;
  conv_sessions?: number | null;
  conv_avg_duration_s?: number | null;
  conv_avg_bounce_rate?: number | null;
  nonconv_avg_duration_s?: number | null;
  nonconv_avg_bounce_rate?: number | null;
};

export type SequentialEffectRow = {
  previous_channel: string;
  current_channel: string;
  pair_count?: number | null;
  conversion_count?: number | null;
  nonconversion_count?: number | null;
  conversion_probability_pair?: number | null;
  conversion_probability_baseline?: number | null;
  lift_vs_baseline?: number | null;
  avg_ticket?: number | null;
  revenue?: number | null;
  support?: number | null;
  confidence?: string | null;
  diagnostic_label?: string | null;
};

// ---------------------------------------------------------------------------
// Sandbox types
// ---------------------------------------------------------------------------

export type Scenario = {
  id: number;
  model_run_id: number;
  name: string;
  description: string | null;
  action_type: ScenarioActionType;
  channel: string | null;
  intensity_pct: number | null;
  period_start: string | null;
  period_end: string | null;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  path_channels: string[];
  created_at: string | null;
  updated_at: string | null;
  analysis: ScenarioAnalysis | null;
};

export type ScenarioAnalysis = {
  scenario_id: number;
  model_run_id: number | null;
  code_version: string | null;
  analyzed_at: string | null;
  path_channels: string[];
  path_probability: number | null;
  conversion_probability_given_last_node: number | null;
  composite_conversion_probability: number | null;
  historical_conversion_rate: number | null;
  lift: number | null;
  expected_revenue: number | null;
  expected_ticket: number | null;
  historical_support: number;
  similar_paths: Array<{
    path: string;
    count: number;
    conversion_rate: number | null;
    revenue: number | null;
  }>;
  warnings: string[];
  confidence_score: number | null;
};

export type ScenarioActionType =
  | "removeChannel"
  | "reducePresence"
  | "redistributeBudget"
  | "compareModels"
  | "path";

export type ScenarioCreatePayload = {
  model_run_id: number;
  name: string;
  description?: string | null;
  action_type: ScenarioActionType;
  channel?: string | null;
  intensity_pct?: number | null;
  period_start?: string | null;
  period_end?: string | null;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  path_channels: string[];
};

export type ScenarioUpdatePayload = {
  name?: string;
  description?: string | null;
  action_type?: ScenarioActionType;
  channel?: string | null;
  intensity_pct?: number | null;
  period_start?: string | null;
  period_end?: string | null;
  nodes?: Record<string, unknown>[];
  edges?: Record<string, unknown>[];
  path_channels?: string[];
};

export type ScenarioCompareItem = {
  source: "scenario" | "baseline" | "top_real_path";
  scenario_id: number | null;
  name: string;
  path_channels: string[];
  path_probability: number | null;
  composite_conversion_probability: number | null;
  historical_conversion_rate: number | null;
  lift: number | null;
  expected_revenue: number | null;
  expected_ticket: number | null;
  historical_support: number;
  confidence_score: number | null;
  warnings: string[];
};

export type ScenarioDelta = {
  composite_conversion_delta: number | null;
  composite_conversion_pct: number | null;
  expected_revenue_delta: number | null;
  expected_revenue_pct: number | null;
  confidence_delta: number | null;
  historical_support_delta: number | null;
};

export type ScenarioCompareResponse = {
  items: ScenarioCompareItem[];
  winner_conversion: string | null;
  winner_revenue: string | null;
  winner_confidence: string | null;
  delta: ScenarioDelta | null;
};

export type ScenarioComparePayload = {
  model_run_id: number;
  scenario_ids: number[];
  include_baseline: boolean;
  include_top_path: boolean;
};

export type DashboardMetric = {
  id: string;
  label: string;
  value: number | null;
  delta?: { value: number | null; pct: number | null } | null;
  tone: string;
};

export type DashboardRecommendation = {
  channel: string;
  recommendation: string;
  recommendation_tone: string;
  priority_rank: number;
  rationale: string[];
  risks: string[];
  best_practices: string[];
  suggested_budget_delta_pct?: number | null;
  suggested_budget_delta_value?: number | null;
  estimated_revenue_delta?: number | null;
  estimated_roas_min?: number | null;
  estimated_roas_max?: number | null;
  saturation_score?: number | null;
  confidence_score: number;
};

export type DashboardSummary = {
  observed_conversion_rate?: number | null;
  model_conversion_rate: number;
  total_revenue: number;
  total_spend: number;
  total_conversions: number;
  total_nonconversions_sampled: number;
  confidence_score: number;
  confidence_label: string;
};

export type OverviewDashboardResponse = {
  meta: { run_id: number; compare_run_id?: number | null; generated_at: string };
  summary: DashboardSummary;
  metric_strip: DashboardMetric[];
  priority_decisions: DashboardRecommendation[];
  model_consensus: {
    axes: { x: string; y: string };
    points: Array<{
      channel: string;
      markov_weight_pct: number;
      shapley_weight_pct: number;
      spend: number;
      revenue: number;
      recommendation_tone?: string | null;
    }>;
  };
  journey_summary: {
    top_entries: Array<{ name: string; value: number }>;
    top_assistants: Array<{ name: string; value: number }>;
    top_closers: Array<{ name: string; value: number }>;
    flow_stages: Array<{ name: string; value: number }>;
  };
  analysis_confidence: {
    score: number;
    label: string;
    calibration_gap_pp?: number | null;
    data_quality_score?: number | null;
  };
  footer_note: string;
};

export type BudgetDashboardResponse = {
  meta: { run_id: number; compare_run_id?: number | null; generated_at: string };
  summary_cards: Array<{
    id: string;
    label: string;
    count: number;
    estimated_revenue_delta: number;
    tone: string;
  }>;
  allocation_matrix: Array<{
    channel: string;
    spend_share_pct: number;
    revenue_share_pct: number;
    revenue: number;
    recommendation: string;
    tone: string;
  }>;
  opportunities_and_risks: {
    opportunities: DashboardRecommendation[];
    risks: DashboardRecommendation[];
  };
  channels_table: Array<{
    channel: string;
    recommendation: string;
    tone: string;
    spend: number;
    revenue: number;
    roas_markov?: number | null;
    roas_shapley?: number | null;
    consensus_score: number;
    role?: string | null;
    presence_score: number;
    suggested_budget_delta_pct?: number | null;
    suggested_budget_delta_value?: number | null;
    estimated_revenue_delta?: number | null;
  }>;
  selected_channel_drawer: {
    channel: string;
    recommendation: string;
    tone: string;
    rationale: string[];
    risks: string[];
    best_practices: string[];
    suggested_budget_delta_pct?: number | null;
    suggested_budget_delta_value?: number | null;
    estimated_revenue_delta?: number | null;
    estimated_roas_min?: number | null;
    estimated_roas_max?: number | null;
  } | null;
};

export type ModelRunCreatePayload = {
  start_date: string;
  end_date: string;
  lookback_days: number | null;  // null = usa LOOKBACK_DAYS do .env
  decay_lambda: number;
  non_conv_sample_pct: number;
  non_conv_scale: number | null;
  shapley_samples: number;
  db_plausible: number;
  db_datamart: number | null;
  batch_mode: "auto" | "always" | "never";
  batch_days: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listRuns: () => request<ModelRun[]>("/model-runs"),
  getOverview: (id: number) => request<ModelRun>(`/model-runs/${id}/overview`),
  getOverviewDashboard: (id: number, compareId?: number) =>
    request<OverviewDashboardResponse>(
      `/model-runs/${id}/dashboard/overview${compareId ? `?compare_run_id=${compareId}` : ""}`,
    ),
  getBudgetDashboard: (id: number, compareId?: number, channel?: string) => {
    const params = new URLSearchParams();
    if (compareId) params.set("compare_run_id", String(compareId));
    if (channel) params.set("channel", channel);
    const qs = params.toString();
    return request<BudgetDashboardResponse>(
      `/model-runs/${id}/dashboard/budget${qs ? `?${qs}` : ""}`,
    );
  },
  getChannels: (id: number) =>
    request<TableResponse<ChannelRow>>(`/model-runs/${id}/channels`),
  getDiagnostics: (id: number) =>
    request<TableResponse<DiagnosticRow>>(`/model-runs/${id}/diagnostics`),
  getInsights: (id: number) =>
    request<TableResponse<InsightRow>>(`/model-runs/${id}/insights`),
  getTouchpoints: (id: number) =>
    request<TableResponse<TouchpointRow>>(`/model-runs/${id}/touchpoints`),
  getGraph: (id: number) => request<GraphResponse>(`/model-runs/${id}/graph`),
  getDataQuality: (id: number) =>
    request<TableResponse<DataQualityRow>>(`/model-runs/${id}/data-quality`),
  getSummary: (id: number) =>
    request<ModelRunSummaryRow>(`/model-runs/${id}/summary`),
  getInputs: (id: number) =>
    request<ModelRunInputRow[]>(`/model-runs/${id}/inputs`),
  getLogs: (id: number) =>
    request<ModelRunLogRow[]>(`/model-runs/${id}/logs`),
  getPaths: (id: number) =>
    request<TableResponse<PathRow>>(`/model-runs/${id}/paths`),
  getLoops: (id: number) =>
    request<TableResponse<PathRow>>(`/model-runs/${id}/loops`),
  getRawChannels: (id: number) =>
    request<TableResponse<ChannelRow>>(`/model-runs/${id}/raw-channels`),
  getLoopDiagnostics: (id: number) =>
    request<TableResponse<LoopDiagnosticRow>>(`/model-runs/${id}/loop-diagnostics`),
  getFunnelAttribution: (id: number) =>
    request<TableResponse<FunnelAttributionRow>>(`/model-runs/${id}/funnel-attribution`),
  getFunnelValidation: (id: number) =>
    request<TableResponse<FunnelValidationRow>>(`/model-runs/${id}/funnel-validation`),
  getSequentialEffects: (id: number, prevChannel?: string) =>
    request<TableResponse<SequentialEffectRow>>(
      `/model-runs/${id}/sequential-effects${prevChannel ? `?previous_channel=${encodeURIComponent(prevChannel)}` : ""}`
    ),
  getTransitions: (id: number) =>
    request<TableResponse<TransitionRow>>(`/model-runs/${id}/transitions`),
  getSessionQuality: (id: number) =>
    request<TableResponse<SessionQualityRow>>(`/model-runs/${id}/session-quality`),
  createRun: (payload: ModelRunCreatePayload) =>
    request<ModelRun>("/model-runs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Sandbox
  listScenarios: (modelRunId: number) =>
    request<Scenario[]>(`/model-runs/${modelRunId}/scenarios`),
  getScenario: (id: number) => request<Scenario>(`/scenarios/${id}`),
  createScenario: (payload: ScenarioCreatePayload) =>
    request<Scenario>(`/model-runs/${payload.model_run_id}/scenarios`, {
      method: "POST",
      body: JSON.stringify({ ...payload, model_run_id: undefined }),
    }),
  updateScenario: (id: number, payload: ScenarioUpdatePayload) =>
    request<Scenario>(`/scenarios/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteScenario: (id: number) =>
    fetch(`${API_BASE}/scenarios/${id}`, { method: "DELETE" }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return undefined;
    }),
  analyzeScenario: (id: number) =>
    request<ScenarioAnalysis>(`/scenarios/${id}/analyze`, {
      method: "POST",
    }),
  compareScenarios: (payload: ScenarioComparePayload) =>
    request<ScenarioCompareResponse>(
      `/model-runs/${payload.model_run_id}/scenarios/compare`,
      {
      method: "POST",
      body: JSON.stringify({ ...payload, model_run_id: undefined }),
      },
    ),
};

// ---------------------------------------------------------------------------
// React Query — convention
// ---------------------------------------------------------------------------
//
// Feature-scoped query hooks live under features/<f>/hooks/use<X>.ts and use
// these keys (all are arrays so they invalidate predictably):
//
//   ["runs"]                          → api.listRuns()
//   ["overview", runId]               → api.getOverview(runId)
//   ["channels", runId]               → api.getChannels(runId)
//   ["channels:raw", runId]           → api.getRawChannels(runId)
//   ["diagnostics", runId]            → api.getDiagnostics(runId)
//   ["insights", runId]               → api.getInsights(runId)
//   ["touchpoints", runId]            → api.getTouchpoints(runId)
//   ["graph", runId]                  → api.getGraph(runId)
//   ["paths", runId]                  → api.getPaths(runId)
//   ["loops", runId]                  → api.getLoops(runId)
//   ["loop-diagnostics", runId]       → api.getLoopDiagnostics(runId)
//   ["funnel-attribution", runId]     → api.getFunnelAttribution(runId)
//   ["funnel-validation", runId]      → api.getFunnelValidation(runId)
//   ["sequential-effects", runId, prevChannel|null]
//                                     → api.getSequentialEffects(runId, prevChannel)
//   ["data-quality", runId]           → api.getDataQuality(runId)
//   ["scenarios", runId]              → api.listScenarios(runId)
//   ["scenario", scenarioId]          → api.getScenario(scenarioId)
//   ["scenario:analysis", scenarioId] → api.analyzeScenario(scenarioId)
//
// All run-scoped queries should set `enabled: runId != null` and pass the
// runId via the queryFn closure (never null inside queryFn).
