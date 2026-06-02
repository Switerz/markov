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
};

export type TableResponse<T = Record<string, unknown>> = {
  model_run_id: number;
  table: string;
  rows: T[];
};

export type ChannelRow = {
  channel: string;
  markov_weight?: number | null;
  markov_revenue?: number | null;
  removal_effect?: number | null;
  shapley_weight?: number | null;
  shapley_revenue?: number | null;
  shapley_value?: number | null;
  spend?: number | null;
  roas_markov?: number | null;
  roas_shapley?: number | null;
  recommendation?: string | null;
};

export type DiagnosticRow = {
  channel: string;
  channel_role?: string | null;
  presence_converting?: number | null;
  presence_nonconverting?: number | null;
  first_touch_share?: number | null;
  middle_touch_share?: number | null;
  last_touch_share?: number | null;
  markov_shapley_delta_pp?: number | null;
  diagnostic_label?: string | null;
  diagnostic_text?: string | null;
};

export type DataQualityRow = {
  check_name: string;
  status: string;
  severity: string;
  detail?: string | null;
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
// Sandbox types
// ---------------------------------------------------------------------------

export type Scenario = {
  id: number;
  model_run_id: number;
  name: string;
  description: string | null;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  path_channels: string[];
  created_at: string | null;
  updated_at: string | null;
};

export type ScenarioAnalysis = {
  scenario_id: number;
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

export type ScenarioCreatePayload = {
  model_run_id: number;
  name: string;
  description?: string | null;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  path_channels: string[];
};

export type ScenarioUpdatePayload = {
  name?: string;
  description?: string | null;
  nodes?: Record<string, unknown>[];
  edges?: Record<string, unknown>[];
  path_channels?: string[];
};

export type ModelRunCreatePayload = {
  start_date: string;
  end_date: string;
  lookback_days: number;
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
  getPaths: (id: number) =>
    request<TableResponse<PathRow>>(`/model-runs/${id}/paths`),
  getLoops: (id: number) =>
    request<TableResponse<PathRow>>(`/model-runs/${id}/loops`),
  createRun: (payload: ModelRunCreatePayload) =>
    request<ModelRun>("/model-runs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Sandbox
  listScenarios: (modelRunId: number) =>
    request<Scenario[]>(`/sandbox/scenarios?model_run_id=${modelRunId}`),
  getScenario: (id: number) => request<Scenario>(`/sandbox/scenarios/${id}`),
  createScenario: (payload: ScenarioCreatePayload) =>
    request<Scenario>("/sandbox/scenarios", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateScenario: (id: number, payload: ScenarioUpdatePayload) =>
    request<Scenario>(`/sandbox/scenarios/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteScenario: (id: number) =>
    fetch(`${API_BASE}/sandbox/scenarios/${id}`, { method: "DELETE" }).then(
      () => undefined,
    ),
  analyzeScenario: (id: number) =>
    request<ScenarioAnalysis>(`/sandbox/scenarios/${id}/analyze`, {
      method: "POST",
    }),
};
