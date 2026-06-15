import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  FlaskConical,
  GitGraph,
  Lightbulb,
  Play,
  RefreshCw,
  TableProperties,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  ChannelRow,
  DataQualityRow,
  DiagnosticRow,
  FunnelAttributionRow,
  FunnelValidationRow,
  GraphResponse,
  InsightRow,
  LoopDiagnosticRow,
  ModelRun,
  ModelRunCreatePayload,
  PathRow,
  SequentialEffectRow,
  TouchpointRow,
} from "./lib/api";
import { SandboxView } from "./SandboxView";

type Tab =
  | "overview"
  | "channels"
  | "graph"
  | "insights"
  | "touchpoints"
  | "diagnostics"
  | "quality"
  | "paths"
  | "model-diagnostics"
  | "sandbox";

const defaultPayload: ModelRunCreatePayload = {
  start_date: "2026-03-01",
  end_date: "2026-03-31",
  lookback_days: null,   // null = usa LOOKBACK_DAYS do .env (atualmente 60)
  decay_lambda: 0.05,
  non_conv_sample_pct: 1,
  non_conv_scale: null,
  shapley_samples: 5000,
  db_plausible: 70,
  db_datamart: 63,
  batch_mode: "auto",
  batch_days: 35,
};

const fmtMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const fmtPct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 2,
});

const fmtNumber = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const COLUMN_LABELS: Record<string, string> = {
  channel: "Canal",
  channel_role: "Papel",
  touchpoint_role: "Papel no funil",
  presence_converting: "Pres. conv.",
  presence_nonconverting: "Pres. n-conv.",
  first_touch_share: "1º toque",
  middle_touch_share: "Meio",
  last_touch_share: "Último toque",
  markov_shapley_delta_pp: "Δ Markov-Shapley",
  diagnostic_label: "Label",
  diagnostic_text: "Diagnóstico",
  title: "Título",
  severity: "Severidade",
  confidence: "Confiança",
  description: "Descrição",
  evidence: "Evidência",
  recommendation: "Recomendação",
  limitation: "Limitação",
  conv_first_touch_share: "1º toque (conv)",
  conv_middle_touch_share: "Meio (conv)",
  conv_last_touch_share: "Último (conv)",
  nonconv_first_touch_share: "1º toque (n-conv)",
  nonconv_middle_touch_share: "Meio (n-conv)",
  nonconv_last_touch_share: "Último (n-conv)",
  starter_count: "Iniciadores",
  assist_count: "Assistências",
  closer_count: "Finalizadores",
  dropoff_after_touch: "Abandonos",
  check_name: "Verificação",
  status: "Status",
  detail: "Detalhe",
  markov_weight: "Markov",
  raw_markov_weight: "Raw Markov",
  shapley_weight: "Shapley",
  spend: "Spend",
  roas_markov: "ROAS Markov",
  roas_shapley: "ROAS Shapley",
  roas_first_click: "ROAS 1º Click",
  roas_last_click: "ROAS Last Click",
};

export function App() {
  const [runs, setRuns] = useState<ModelRun[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [overview, setOverview] = useState<ModelRun | null>(null);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticRow[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [touchpoints, setTouchpoints] = useState<TouchpointRow[]>([]);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [quality, setQuality] = useState<DataQualityRow[]>([]);
  const [paths, setPaths] = useState<PathRow[]>([]);
  const [rawChannels, setRawChannels] = useState<ChannelRow[]>([]);
  const [loopDiagnostics, setLoopDiagnostics] = useState<LoopDiagnosticRow[]>([]);
  const [funnelAttribution, setFunnelAttribution] = useState<FunnelAttributionRow[]>([]);
  const [funnelValidation, setFunnelValidation] = useState<FunnelValidationRow[]>([]);
  const [sequentialEffects, setSequentialEffects] = useState<SequentialEffectRow[]>([]);
  const [diagLoaded, setDiagLoaded] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [payload, setPayload] = useState<ModelRunCreatePayload>(defaultPayload);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadRuns(nextSelectedId?: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listRuns();
      setRuns(data);
      const nextId = nextSelectedId ?? selectedId ?? data[0]?.id ?? null;
      setSelectedId(nextId);
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadRunDetails(id: number) {
    setLoading(true);
    setError(null);
    try {
      const [
        overviewData,
        channelData,
        rawChannelData,
        diagnosticData,
        insightData,
        touchpointData,
        graphData,
        qualityData,
        pathsData,
      ] =
        await Promise.all([
          api.getOverview(id),
          api.getChannels(id),
          api.getRawChannels(id),
          api.getDiagnostics(id),
          api.getInsights(id),
          api.getTouchpoints(id),
          api.getGraph(id),
          api.getDataQuality(id),
          api.getPaths(id),
        ]);
      setOverview(overviewData);
      setChannels(channelData.rows);
      setRawChannels(rawChannelData.rows);
      setDiagnostics(diagnosticData.rows);
      setInsights(insightData.rows);
      setTouchpoints(touchpointData.rows);
      setGraph(graphData);
      setQuality(qualityData.rows);
      setPaths(pathsData.rows);
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function createRun() {
    setCreating(true);
    setError(null);
    try {
      const created = await api.createRun(payload);
      await loadRuns(created.id);
      setSelectedId(created.id);
    } catch (err) {
      setError(readError(err));
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (selectedId !== null) {
      void loadRunDetails(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!overview || !["pending", "running"].includes(overview.status)) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadRuns(overview.id);
      void loadRunDetails(overview.id);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [overview?.id, overview?.status]);

  async function loadModelDiagnostics(id: number) {
    if (diagLoaded === id) return;
    try {
      const [loopData, funnelData, funnelValData, seqData] = await Promise.all([
        api.getLoopDiagnostics(id),
        api.getFunnelAttribution(id),
        api.getFunnelValidation(id),
        api.getSequentialEffects(id),
      ]);
      setLoopDiagnostics(loopData.rows);
      setFunnelAttribution(funnelData.rows);
      setFunnelValidation(funnelValData.rows);
      setSequentialEffects(seqData.rows);
      setDiagLoaded(id);
    } catch {
      // Diagnostics are optional — fail silently
    }
  }

  useEffect(() => {
    if (tab === "model-diagnostics" && selectedId !== null) {
      void loadModelDiagnostics(selectedId);
    }
  }, [tab, selectedId]);

  const topChannels = useMemo(
    () =>
      [...channels]
        .sort((a, b) => (b.markov_weight ?? 0) - (a.markov_weight ?? 0))
        .slice(0, 8),
    [channels],
  );

  const roasChartData = useMemo(
    () =>
      channels
        .filter((row) => (row.spend ?? 0) > 0)
        .slice(0, 8)
        .map((row) => ({
          channel: compactLabel(row.channel),
          markov: row.roas_markov ?? 0,
          shapley: row.roas_shapley ?? 0,
        })),
    [channels],
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Database size={22} />
          <div>
            <strong>GoGraph</strong>
            <span>Analytics MVP</span>
          </div>
        </div>

        <button className="icon-button full" onClick={() => void loadRuns()}>
          <RefreshCw size={16} />
          Atualizar
        </button>

        <section className="run-list">
          <h2>Execuções</h2>
          {runs.length === 0 && <p className="muted">Nenhum model run salvo.</p>}
          {runs.map((run) => (
            <button
              key={run.id}
              className={`run-item ${selectedId === run.id ? "active" : ""}`}
              onClick={() => setSelectedId(run.id)}
            >
              <strong>#{run.id}</strong>
              <span>
                {run.start_date} · {run.end_date}
              </span>
              <em>{run.status}</em>
            </button>
          ))}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Dashboard Geral</h1>
            <p>
              Markov, Shapley, ROAS e qualidade de dados por execução persistida.
            </p>
          </div>
          <RunForm
            payload={payload}
            setPayload={setPayload}
            creating={creating}
            onSubmit={() => void createRun()}
          />
        </header>

        {error && (
          <div className="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <nav className="tabs">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            <Activity size={16} />
            Overview
          </TabButton>
          <TabButton active={tab === "channels"} onClick={() => setTab("channels")}>
            <BarChart3 size={16} />
            Canais
          </TabButton>
          <TabButton active={tab === "graph"} onClick={() => setTab("graph")}>
            <GitGraph size={16} />
            Grafo
          </TabButton>
          <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>
            <Lightbulb size={16} />
            Insights
          </TabButton>
          <TabButton
            active={tab === "touchpoints"}
            onClick={() => setTab("touchpoints")}
          >
            <TableProperties size={16} />
            Pontos
          </TabButton>
          <TabButton
            active={tab === "diagnostics"}
            onClick={() => setTab("diagnostics")}
          >
            <TableProperties size={16} />
            Papel do Canal
          </TabButton>
          <TabButton active={tab === "quality"} onClick={() => setTab("quality")}>
            <AlertTriangle size={16} />
            Qualidade
          </TabButton>
          <TabButton active={tab === "paths"} onClick={() => setTab("paths")}>
            <GitGraph size={16} />
            Caminhos
          </TabButton>
          <TabButton
            active={tab === "model-diagnostics"}
            onClick={() => setTab("model-diagnostics")}
          >
            <Activity size={16} />
            Diagnósticos
          </TabButton>

          <TabButton active={tab === "sandbox"} onClick={() => setTab("sandbox")}>
            <FlaskConical size={16} />
            Sandbox
          </TabButton>
        </nav>

        {loading && <p className="muted">Carregando...</p>}
        {!loading && !overview && (
          <div className="empty-state">
            <h2>Sem execução selecionada</h2>
            <p>Crie uma execução ou selecione um model run salvo.</p>
          </div>
        )}
        {!loading && overview && tab === "overview" && (
          <Overview run={overview} channels={channels} roasData={roasChartData} />
        )}
        {!loading && overview && tab === "channels" && (
          <Channels rows={channels} chartRows={topChannels} rawRows={rawChannels} funnelActive={overview.funnel_model_active ?? false} />
        )}
        {!loading && overview && tab === "graph" && graph && (
          <GraphView graph={graph} />
        )}
        {!loading && overview && tab === "insights" && (
          <Insights rows={insights} />
        )}
        {!loading && overview && tab === "touchpoints" && (
          <Touchpoints rows={touchpoints} />
        )}
        {!loading && overview && tab === "diagnostics" && (
          <Diagnostics rows={diagnostics} />
        )}
        {!loading && overview && tab === "quality" && <Quality rows={quality} />}
        {!loading && overview && tab === "paths" && <Paths rows={paths} />}
        {tab === "model-diagnostics" && selectedId !== null && (
          <ModelDiagnostics
            loopDiagnostics={loopDiagnostics}
            funnelAttribution={funnelAttribution}
            funnelValidation={funnelValidation}
            sequentialEffects={sequentialEffects}
            channels={channels}
            rawChannels={rawChannels}
          />
        )}
        {tab === "sandbox" && selectedId !== null && (
          <SandboxView modelRunId={selectedId} />
        )}
        {tab === "sandbox" && selectedId === null && (
          <div className="empty-state">
            <h2>Selecione um model run</h2>
            <p>O Sandbox usa a matriz de transição de um model run existente.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function RunForm({
  payload,
  setPayload,
  creating,
  onSubmit,
}: {
  payload: ModelRunCreatePayload;
  setPayload: (payload: ModelRunCreatePayload) => void;
  creating: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      className="run-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        Início
        <input
          type="date"
          value={payload.start_date}
          onChange={(event) =>
            setPayload({ ...payload, start_date: event.target.value })
          }
        />
      </label>
      <label>
        Fim
        <input
          type="date"
          value={payload.end_date}
          onChange={(event) =>
            setPayload({ ...payload, end_date: event.target.value })
          }
        />
      </label>
      <label>
        Shapley
        <input
          type="number"
          min={10}
          step={10}
          value={payload.shapley_samples}
          onChange={(event) =>
            setPayload({ ...payload, shapley_samples: Number(event.target.value) })
          }
        />
      </label>
      <label>
        Batching
        <select
          value={payload.batch_mode}
          onChange={(event) =>
            setPayload({
              ...payload,
              batch_mode: event.target.value as ModelRunCreatePayload["batch_mode"],
            })
          }
        >
          <option value="auto">auto</option>
          <option value="always">always</option>
          <option value="never">never</option>
        </select>
      </label>
      <button className="icon-button primary" type="submit" disabled={creating}>
        <Play size={16} />
        {creating ? "Rodando" : "Rodar"}
      </button>
    </form>
  );
}

function Overview({
  run,
  channels,
  roasData,
}: {
  run: ModelRun;
  channels: ChannelRow[];
  roasData: Array<{ channel: string; markov: number; shapley: number }>;
}) {
  const topMarkov = maxBy(channels, (row) => row.markov_weight ?? 0);
  const topShapley = maxBy(channels, (row) => row.shapley_weight ?? 0);
  const topRoas = maxBy(
    channels.filter((row) => Number.isFinite(row.roas_markov ?? NaN)),
    (row) => row.roas_markov ?? 0,
  );
  const funnelActive = run.funnel_model_active ?? false;

  return (
    <div className="panel-stack">
      {funnelActive && (
        <div className="notice" style={{ background: "#eff6ff", borderColor: "#2563eb", color: "#1e40af" }}>
          <strong>Modelo ativo: Funnel Stage Markov</strong> — atribuição por canal + estágio de intenção (Events V2). Raw Channel disponível na aba Canais para comparação.
        </div>
      )}
      <section className="kpi-grid">
        <Kpi label="Status" value={run.status} />
        <Kpi label="Receita total" value={fmtMoney.format(run.total_revenue)} />
        <Kpi label="Spend total" value={fmtMoney.format(run.total_spend)} />
        <Kpi
          label="Taxa modelada"
          value={fmtPct.format(run.model_conversion_rate)}
        />
        <Kpi
          label="Taxa observada"
          value={
            run.observed_conversion_rate === null
              ? "n/d"
              : fmtPct.format(run.observed_conversion_rate)
          }
        />
        <Kpi label="Top Markov" value={topMarkov?.channel ?? "n/d"} />
        <Kpi label="Top Shapley" value={topShapley?.channel ?? "n/d"} />
        <Kpi label="Top ROAS" value={topRoas?.channel ?? "n/d"} />
        <Kpi label="Runtime" value={`${fmtNumber.format(run.runtime_seconds)}s`} />
      </section>
      {["pending", "running"].includes(run.status) && (
        <div className="notice">
          A execução está em andamento. O dashboard atualiza automaticamente.
        </div>
      )}
      {run.status === "failed" && (
        <div className="alert">
          <AlertTriangle size={16} />
          <span>{run.error_message ?? "A execução falhou."}</span>
        </div>
      )}

      <section className="chart-band">
        <header>
          <h2>ROAS Markov vs Shapley</h2>
          <span>{roasData.length} canais com spend</span>
        </header>
        {roasData.length === 0 ? (
          <p className="muted">Nenhum canal com spend persistido.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={roasData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="channel" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="markov" fill="#2563eb" name="ROAS Markov" />
              <Bar dataKey="shapley" fill="#16a34a" name="ROAS Shapley" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}

function Channels({
  rows,
  chartRows,
  rawRows,
  funnelActive,
}: {
  rows: ChannelRow[];
  chartRows: ChannelRow[];
  rawRows: ChannelRow[];
  funnelActive: boolean;
}) {
  const chartData = chartRows.map((row) => ({
    channel: compactLabel(row.channel),
    markov: (row.markov_weight ?? 0) * 100,
    shapley: (row.shapley_weight ?? 0) * 100,
  }));

  // Build comparison map: channel → raw markov weight
  const rawMap = new Map(rawRows.map((r) => [r.channel, r]));

  return (
    <div className="panel-stack">
      {funnelActive && (
        <div className="how-to-read">
          <strong>Modelo ativo: Funnel Stage Markov</strong> — os pesos abaixo são atribuição por canal agregada a partir de estados compostos (canal / estágio de intenção). A coluna <em>Raw Markov</em> mostra o modelo de canal puro para comparação.
        </div>
      )}
      <section className="chart-band">
        <header>
          <h2>Pesos de atribuição{funnelActive ? " — Funnel Stage" : ""}</h2>
          <span>Top canais por Markov</span>
        </header>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="markov" fill="#2563eb" name="Markov %" />
            <Bar dataKey="shapley" fill="#16a34a" name="Shapley %" />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <DataTable
        columns={[
          "channel",
          "markov_weight",
          ...(funnelActive ? ["raw_markov_weight"] : []),
          "shapley_weight",
          "spend",
          "roas_markov",
          "roas_shapley",
          "roas_first_click",
          "roas_last_click",
          "recommendation",
        ]}
        rows={rows.map((r) => ({
          ...r,
          roas_markov: r.roas_markov != null ? `${fmtNumber.format(r.roas_markov)}×` : null,
          roas_shapley: r.roas_shapley != null ? `${fmtNumber.format(r.roas_shapley)}×` : null,
          roas_first_click: r.first_click_roas != null ? `${fmtNumber.format(r.first_click_roas)}×` : null,
          roas_last_click: r.last_click_roas != null ? `${fmtNumber.format(r.last_click_roas)}×` : null,
          raw_markov_weight: rawMap.get(r.channel)?.markov_weight ?? null,
        }))}
      />
    </div>
  );
}

function GraphView({ graph }: { graph: GraphResponse }) {
  const [topN, setTopN] = useState(25);
  const [showSelfLoops, setShowSelfLoops] = useState(false);
  const visibleEdges = useMemo(
    () => {
      const base = showSelfLoops
        ? graph.edges
        : graph.edges.filter((e) => !e.is_self_loop);
      return [...base]
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, topN);
    },
    [graph.edges, topN, showSelfLoops],
  );
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    visibleEdges.forEach((edge) => {
      ids.add(edge.source);
      ids.add(edge.target);
    });
    return ids;
  }, [visibleEdges]);
  const visibleNodes = graph.nodes.filter((node) => visibleNodeIds.has(node.id));
  const positions = layoutGraph(visibleNodes);

  return (
    <div className="panel-stack">
      <div className="how-to-read">
        <strong>Como ler este grafo</strong>
        <ul>
          <li><strong>Nós (círculos):</strong> canais de marketing. Maior = mais central na jornada (PageRank).</li>
          <li><strong>Setas:</strong> fluxo observado entre canais. Mais grossa = mais transições. Passe o cursor para ver contagens, probabilidade e receita.</li>
          <li><strong>Verde</strong> = Conversão · <strong>Vermelho</strong> = Não-conversão · <strong>Borda tracejada</strong> = canal em ciclo (usuário retornou)</li>
          <li>Self-loops (canal → mesmo canal) são ocultados por padrão para não dominar o ranking — ative o toggle para visualizá-los.</li>
        </ul>
      </div>

      <section className="kpi-grid compact">
        <Kpi label="Canais" value={fmtNumber.format(graph.summary?.node_count ?? visibleNodes.length)} />
        <Kpi label="Transições" value={fmtNumber.format(graph.summary?.edge_count ?? graph.edges.length)} />
        <Kpi label="Ciclos" value={fmtNumber.format(graph.summary?.cycle_count ?? 0)} />
        <Kpi label="Self-loops" value={fmtNumber.format(graph.summary?.self_loop_count ?? 0)} />
      </section>

      <section className="chart-band graph-panel">
        <header>
          <h2>Jornada observada</h2>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <label className="inline-control">
              <input
                type="checkbox"
                checked={showSelfLoops}
                onChange={(e) => setShowSelfLoops(e.target.checked)}
                style={{ marginRight: "4px" }}
              />
              Self-loops
            </label>
            <label className="inline-control">
              Top arestas
              <select
                value={topN}
                onChange={(event) => setTopN(Number(event.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
        </header>

        {visibleNodes.length === 0 ? (
          <p className="muted">Nenhum grafo disponível para esta execução.</p>
        ) : (
          <>
            <svg className="journey-graph" viewBox="0 0 960 520" role="img">
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>
              {visibleEdges.map((edge) => {
                const source = positions.get(edge.source);
                const target = positions.get(edge.target);
                if (!source || !target) {
                  return null;
                }
                return (
                  <path
                    key={`${edge.source}-${edge.target}`}
                    className={`graph-edge ${edge.is_self_loop ? "self-loop" : ""}`}
                    d={edgePath(source, target, edge.is_self_loop)}
                    strokeWidth={edgeWidth(edge.count)}
                    markerEnd="url(#arrow)"
                  >
                    <title>{edgeTooltip(edge)}</title>
                  </path>
                );
              })}
              {visibleNodes.map((node) => {
                const position = positions.get(node.id);
                if (!position) {
                  return null;
                }
                return (
                  <g
                    key={node.id}
                    className={`graph-node ${graphNodeClass(node.type)} ${
                      node.in_cycle ? "cycle" : ""
                    }`}
                    transform={`translate(${position.x} ${position.y})`}
                  >
                    <circle r={nodeRadius(node.pagerank)} />
                    <text y={4}>{compactLabel(node.label)}</text>
                    <title>{nodeTooltip(node)}</title>
                  </g>
                );
              })}
            </svg>
            <div className="graph-legend">
              <span className="legend-group">
                <span className="legend-group-label">Nós</span>
                <span className="legend-item">
                  <svg width="18" height="18"><circle cx="9" cy="9" r="8" fill="#eef2ff" stroke="#4f46e5" strokeWidth="2.5" /></svg>
                  Início
                </span>
                <span className="legend-item">
                  <svg width="18" height="18"><circle cx="9" cy="9" r="8" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" /></svg>
                  Canal
                </span>
                <span className="legend-item">
                  <svg width="18" height="18"><circle cx="9" cy="9" r="8" fill="#dcfce7" stroke="#16a34a" strokeWidth="2.5" /></svg>
                  Conversão
                </span>
                <span className="legend-item">
                  <svg width="18" height="18"><circle cx="9" cy="9" r="8" fill="#fee2e2" stroke="#dc2626" strokeWidth="2.5" /></svg>
                  Não-conv.
                </span>
                <span className="legend-item">
                  <svg width="18" height="18"><circle cx="9" cy="9" r="8" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="5 4" /></svg>
                  Em ciclo
                </span>
              </span>
              <span className="legend-group">
                <span className="legend-group-label">Arestas</span>
                <span className="legend-item">
                  <svg width="36" height="10"><line x1="2" y1="5" x2="34" y2="5" stroke="#64748b" strokeWidth="5" /></svg>
                  Alta freq.
                </span>
                <span className="legend-item">
                  <svg width="36" height="10"><line x1="2" y1="5" x2="34" y2="5" stroke="#64748b" strokeWidth="1.5" /></svg>
                  Baixa freq.
                </span>
                <span className="legend-item">
                  <svg width="36" height="10"><line x1="2" y1="5" x2="34" y2="5" stroke="#9333ea" strokeWidth="2" strokeDasharray="7 4" /></svg>
                  Self-loop
                </span>
              </span>
              <span className="legend-item legend-note">
                Tamanho do nó = PageRank (influência na jornada)
              </span>
            </div>
          </>
        )}
      </section>

      <section className="graph-lists">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ciclo detectado</th>
                <th>Ocorrências</th>
                <th>Receita</th>
              </tr>
            </thead>
            <tbody>
              {(graph.cycles?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={3} style={{ fontStyle: "italic", color: "#94a3b8" }}>
                    Sem ciclos detectados.
                  </td>
                </tr>
              )}
              {(graph.cycles || []).slice(0, 8).map((cycle, index) => (
                <tr key={index}>
                  <td className="cycle-path">{cycle.nodes.join(" → ")}</td>
                  <td>{fmtNumber.format(cycle.count)}</td>
                  <td>{fmtMoney.format(cycle.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Origem</th>
                <th>Destino</th>
                <th>Transições</th>
                <th>Prob.</th>
                <th>Receita</th>
                <th>Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {visibleEdges.slice(0, 12).map((edge, i) => (
                <tr key={i}>
                  <td>{edge.source}</td>
                  <td>{edge.target}</td>
                  <td>{fmtNumber.format(edge.count)}</td>
                  <td>{edge.probability != null ? fmtPct.format(edge.probability) : "n/d"}</td>
                  <td>{fmtMoney.format(edge.revenue)}</td>
                  <td>{edge.avg_ticket != null ? fmtMoney.format(edge.avg_ticket) : "n/d"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Diagnostics({ rows }: { rows: DiagnosticRow[] }) {
  return (
    <DataTable
      columns={[
        "channel",
        "channel_role",
        "presence_converting",
        "presence_nonconverting",
        "first_touch_share",
        "middle_touch_share",
        "last_touch_share",
        "markov_shapley_delta_pp",
        "diagnostic_label",
        "diagnostic_text",
      ]}
      rows={rows}
    />
  );
}

function Insights({ rows }: { rows: InsightRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <h2>Sem insights</h2>
        <p>Nenhum insight disponível para esta execução.</p>
      </div>
    );
  }
  return (
    <div className="panel-stack">
      <div className="insights-list">
        {(rows as Array<Record<string, unknown>>).map((row, i) => (
          <div key={i} className="insight-card">
            <div className="insight-card-header">
              {row.channel != null && (
                <span className="insight-channel-tag">{String(row.channel)}</span>
              )}
              {row.title != null && (
                <span className="insight-title">{String(row.title)}</span>
              )}
              {row.severity != null && <SeverityBadge value={String(row.severity)} />}
              {row.confidence != null && <ConfidenceBadge value={String(row.confidence)} />}
            </div>
            {row.description != null && (
              <div className="insight-section">
                <span className="insight-section-label">Descrição</span>
                {String(row.description)}
              </div>
            )}
            {row.evidence != null && (
              <div className="insight-section">
                <span className="insight-section-label">Evidência</span>
                {String(row.evidence)}
              </div>
            )}
            {row.recommendation != null && (
              <div className="insight-recommendation">
                <span className="insight-section-label">Recomendação</span>
                {String(row.recommendation)}
              </div>
            )}
            {row.limitation != null && (
              <p className="insight-limitation">
                <strong>Limitação:</strong> {String(row.limitation)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Touchpoints({ rows }: { rows: TouchpointRow[] }) {
  return (
    <DataTable
      columns={[
        "channel",
        "touchpoint_role",
        "conv_first_touch_share",
        "conv_middle_touch_share",
        "conv_last_touch_share",
        "nonconv_first_touch_share",
        "nonconv_middle_touch_share",
        "nonconv_last_touch_share",
        "starter_count",
        "assist_count",
        "closer_count",
        "dropoff_after_touch",
      ]}
      rows={rows}
    />
  );
}

function Quality({ rows }: { rows: DataQualityRow[] }) {
  return (
    <DataTable
      columns={["check_name", "status", "severity", "detail"]}
      rows={rows}
    />
  );
}

function Paths({ rows }: { rows: PathRow[] }) {
  const [filter, setFilter] = useState<"all" | "converting" | "dropoff">("all");

  const filtered = rows.filter((row) => {
    if (filter === "converting") return (row.conversion_count ?? 0) > 0;
    if (filter === "dropoff") return (row.nonconversion_count ?? 0) > 0 && (row.conversion_count ?? 0) === 0;
    return true;
  });

  return (
    <div className="panel-stack">
      <div className="how-to-read">
        <strong>Como ler esta tabela</strong>
        <ul>
          <li>Cada linha é uma sequência única de canais — ex.: <em>Direct → Google Ads → Email</em>. Passe o cursor sobre o texto truncado para ver a sequência completa.</li>
          <li><strong>Jornadas:</strong> quantas vezes essa sequência ocorreu. <strong>Taxa conv.:</strong> % que resultou em compra. <strong>Ticket médio:</strong> receita ÷ conversões do caminho.</li>
          <li><strong>Prob. caminho:</strong> estimativa do modelo para essa sequência ocorrer. <strong>Confiança</strong> reflete o tamanho da amostra.</li>
          <li>Borda <strong style={{ color: "#16a34a" }}>verde</strong> = caminho que converte · borda <strong style={{ color: "#dc2626" }}>vermelha</strong> = abandono puro.</li>
        </ul>
      </div>
      <section className="kpi-grid compact">
        <Kpi label="Caminhos únicos" value={String(rows.length)} />
        <Kpi
          label="Com conversão"
          value={String(rows.filter((r) => (r.conversion_count ?? 0) > 0).length)}
        />
        <Kpi
          label="Com loop"
          value={String(rows.filter((r) => r.contains_loop).length)}
        />
      </section>
      <section className="chart-band">
        <header>
          <h2>Sequências de jornada</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["all", "converting", "dropoff"] as const).map((f) => (
              <button
                key={f}
                className={`tab${filter === f ? " active" : ""}`}
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "Todos" : f === "converting" ? "Convertidos" : "Abandonos"}
              </button>
            ))}
          </div>
        </header>
        {filtered.length === 0 ? (
          <p className="muted">
            {rows.length === 0
              ? "Nenhum caminho persistido para esta execução."
              : "Nenhum caminho corresponde ao filtro."}
          </p>
        ) : (
          <div className="table-wrap" style={{ marginTop: "10px" }}>
            <PathsTable rows={filtered} />
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sprint 15 — Model Diagnostics (Loops + Funnel Stage + Sequential Effects)
// ---------------------------------------------------------------------------

const STAGE_COLORS: Record<string, string> = {
  "Low Intent": "#94a3b8",
  "Product Interest": "#3b82f6",
  "Cart Intent": "#f59e0b",
  "Checkout": "#f97316",
  "Purchase": "#16a34a",
};

const LABEL_COLORS: Record<string, string> = {
  positive_assist: "#16a34a",
  negative_assist: "#dc2626",
  neutral: "#64748b",
  possible_loop: "#9333ea",
  low_support: "#94a3b8",
};

function ConfidenceBadge({ value }: { value: string | null | undefined }) {
  if (value === "high") return <span className="badge badge-pass">Alto</span>;
  if (value === "medium") return <span className="badge badge-warn">Médio</span>;
  return <span className="badge badge-info">Baixo</span>;
}

function StatusBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  if (v === "pass" || v === "ok") return <span className="badge badge-pass">OK</span>;
  if (v === "warn" || v === "warning") return <span className="badge badge-warn">Atenção</span>;
  if (v === "fail" || v === "error" || v === "failed") return <span className="badge badge-fail">Falha</span>;
  return <span className="badge badge-info">{value}</span>;
}

function SeverityBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  if (v === "critical") return <span className="badge badge-critical">Crítico</span>;
  if (v === "high") return <span className="badge badge-fail">Alto</span>;
  if (v === "medium") return <span className="badge badge-warn">Médio</span>;
  return <span className="badge badge-info">Baixo</span>;
}

function RoleBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  if (v.includes("start") || v.includes("inici")) return <span className="badge badge-starter">Iniciador</span>;
  if (v.includes("clos") || v.includes("final")) return <span className="badge badge-closer">Finalizador</span>;
  if (v.includes("assist")) return <span className="badge badge-assist">Assistência</span>;
  if (v.includes("mix") || v.includes("misto")) return <span className="badge badge-warn">Misto</span>;
  return <span className="badge badge-neutral">{value}</span>;
}

function DiagLabelBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  if (v === "positive_assist") return <span className="badge badge-closer">Assist. +</span>;
  if (v === "negative_assist") return <span className="badge badge-fail">Assist. −</span>;
  if (v === "possible_loop") return <span className="badge badge-loop">Loop</span>;
  if (v === "low_support") return <span className="badge badge-info">Baixo suporte</span>;
  return <span className="badge badge-neutral">{value.replace(/_/g, " ")}</span>;
}

const PCT_COLUMNS = new Set([
  "presence_converting", "presence_nonconverting",
  "first_touch_share", "middle_touch_share", "last_touch_share",
  "conv_first_touch_share", "conv_middle_touch_share", "conv_last_touch_share",
  "nonconv_first_touch_share", "nonconv_middle_touch_share", "nonconv_last_touch_share",
  "markov_weight", "raw_markov_weight", "shapley_weight",
]);

const LONG_TEXT_COLUMNS = new Set([
  "description", "evidence", "limitation", "diagnostic_text", "detail",
]);

const INT_COLUMNS = new Set([
  "starter_count", "assist_count", "closer_count", "dropoff_after_touch",
]);

function renderDataCell(column: string, value: unknown): ReactNode {
  if (value == null || value === "") return <span className="cell-null">—</span>;

  if (column === "status") return <StatusBadge value={String(value)} />;
  if (column === "severity") return <SeverityBadge value={String(value)} />;
  if (column === "confidence") return <ConfidenceBadge value={String(value)} />;
  if (column === "channel_role" || column === "touchpoint_role") return <RoleBadge value={String(value)} />;
  if (column === "diagnostic_label") return <DiagLabelBadge value={String(value)} />;

  if (LONG_TEXT_COLUMNS.has(column)) {
    return <span className="cell-long-text">{String(value)}</span>;
  }

  if (column === "markov_shapley_delta_pp") {
    const n = Number(value);
    if (!Number.isFinite(n)) return <span className="cell-null">—</span>;
    return (
      <span className={n > 0.5 ? "cell-positive" : n < -0.5 ? "cell-negative" : ""}>
        {n > 0 ? "+" : ""}{fmtNumber.format(n)} pp
      </span>
    );
  }

  if (PCT_COLUMNS.has(column)) {
    const n = Number(value);
    return Number.isFinite(n) ? fmtPct.format(n) : <span className="cell-null">—</span>;
  }

  if (column === "spend") {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? fmtMoney.format(n) : <span className="cell-null">—</span>;
  }

  if (INT_COLUMNS.has(column)) {
    const n = Number(value);
    return Number.isFinite(n) ? fmtNumber.format(Math.round(n)) : <span className="cell-null">—</span>;
  }

  if (typeof value === "number") {
    if (Math.abs(value) < 1.5) return fmtPct.format(value);
    return fmtNumber.format(value);
  }

  return String(value);
}

// ---------------------------------------------------------------------------
// Sprint 16 — Funnel Attribution Validation components
// ---------------------------------------------------------------------------

function IntentBar({ row }: { row: FunnelValidationRow }) {
  const total = row.funnel_markov_weight;
  if (total === 0) return <span className="cell-null">—</span>;
  const segments = [
    { pct: row.low_intent_weight / total, color: "#e2e8f0", label: "Low Intent" },
    { pct: row.product_interest_weight / total, color: "#93c5fd", label: "Product Interest" },
    { pct: row.cart_intent_weight / total, color: "#fb923c", label: "Cart Intent" },
    { pct: row.checkout_weight / total, color: "#f97316", label: "Checkout" },
    { pct: row.purchase_weight / total, color: "#22c55e", label: "Purchase" },
  ].filter((s) => s.pct > 0.001);
  const tooltip = segments.map((s) => `${s.label}: ${fmtPct.format(s.pct)}`).join(" | ");
  return (
    <div className="intent-bar" title={tooltip}>
      {segments.map((seg, i) => (
        <div
          key={i}
          className="intent-bar-segment"
          style={{ width: `${seg.pct * 100}%`, background: seg.color }}
        />
      ))}
    </div>
  );
}

function DragBadge({ score }: { score: number }) {
  if (score > 0.7) return <span className="badge badge-fail">Alto</span>;
  if (score > 0.3) return <span className="badge badge-warn">Moderado</span>;
  return <span className="badge badge-closer">Baixo</span>;
}

function FunnelValidation({ rows }: { rows: FunnelValidationRow[] }) {
  const [showExcl, setShowExcl] = useState(false);

  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => b.low_intent_drag_score - a.low_intent_drag_score);
  const totalFunnel = rows.reduce((s, r) => s + r.funnel_markov_weight, 0);
  const totalLI = rows.reduce((s, r) => s + r.low_intent_weight, 0);
  const overallDrag = totalFunnel > 0 ? totalLI / totalFunnel : 0;
  const topDrag = sorted[0];
  const topQual = [...rows].sort((a, b) => b.qualified_intent_share - a.qualified_intent_share)[0];

  return (
    <section className="chart-band">
      <header>
        <h2>Composição de Intenção por Canal</h2>
        <label className="inline-control">
          <input
            type="checkbox"
            checked={showExcl}
            onChange={(e) => setShowExcl(e.target.checked)}
            style={{ marginRight: 4 }}
          />
          Comparar sem Low Intent
        </label>
      </header>

      <div className="how-to-read" style={{ marginBottom: 12 }}>
        <strong>Como interpretar</strong>
        <ul>
          <li><strong>Low Intent (LI)</strong>: sessões sem eventos de produto — tráfego de topo de funil sem sinal de intenção ativa.</li>
          <li><strong>Qualified Intent</strong>: Cart Intent + Checkout + Purchase — sessões com intenção confirmada de compra.</li>
          <li><strong>Drag</strong>: quanto do peso Funnel do canal vem de LI. Alto drag não é erro — é o retrato da composição de audiência. Un canal com alto drag está comprando muito tráfego frio.</li>
          {showExcl && <li><strong>Sem LI</strong>: peso renormalizado excluindo todos os estados Low Intent. Verde = canal ganha posição; vermelho = canal perde posição quando LI é retirado.</li>}
        </ul>
      </div>

      <section className="kpi-grid compact" style={{ marginBottom: 12 }}>
        <Kpi label="LI drag médio" value={fmtPct.format(overallDrag)} />
        <Kpi
          label="Maior drag"
          value={`${topDrag.channel}: ${fmtPct.format(topDrag.low_intent_drag_score)}`}
        />
        <Kpi
          label="Mais qualificado"
          value={`${topQual.channel}: ${fmtPct.format(topQual.qualified_intent_share)}`}
        />
      </section>

      <div className="table-wrap">
        <table className="validation-table">
          <thead>
            <tr>
              <th>Canal</th>
              <th>Funnel Markov</th>
              <th>Raw Markov</th>
              <th>Δ vs Raw</th>
              <th style={{ minWidth: 110 }}>Composição</th>
              <th>Low Intent</th>
              <th>Qualified</th>
              {showExcl && <th>Sem LI</th>}
              {showExcl && <th>Δ sem LI</th>}
              <th>Drag</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const deltaRaw = (row.funnel_markov_weight - row.raw_markov_weight) * 100;
              const deltaExcl = (row.markov_excl_low_intent - row.funnel_markov_weight) * 100;
              return (
                <tr key={i}>
                  <td><strong>{row.channel}</strong></td>
                  <td>{fmtPct.format(row.funnel_markov_weight)}</td>
                  <td>{row.raw_markov_weight > 0 ? fmtPct.format(row.raw_markov_weight) : <span className="cell-null">—</span>}</td>
                  <td>
                    <span className={deltaRaw > 0.5 ? "cell-positive" : deltaRaw < -0.5 ? "cell-negative" : ""}>
                      {deltaRaw > 0 ? "+" : ""}{fmtNumber.format(deltaRaw)} pp
                    </span>
                  </td>
                  <td><IntentBar row={row} /></td>
                  <td>{fmtPct.format(row.low_intent_drag_score)}</td>
                  <td>{fmtPct.format(row.qualified_intent_share)}</td>
                  {showExcl && <td>{fmtPct.format(row.markov_excl_low_intent)}</td>}
                  {showExcl && (
                    <td>
                      <span className={deltaExcl > 0.5 ? "cell-positive" : deltaExcl < -0.5 ? "cell-negative" : ""}>
                        {deltaExcl > 0 ? "+" : ""}{fmtNumber.format(deltaExcl)} pp
                      </span>
                    </td>
                  )}
                  <td><DragBadge score={row.low_intent_drag_score} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ModelDiagnostics({
  loopDiagnostics,
  funnelAttribution,
  funnelValidation,
  sequentialEffects,
  channels,
  rawChannels,
}: {
  loopDiagnostics: LoopDiagnosticRow[];
  funnelAttribution: FunnelAttributionRow[];
  funnelValidation: FunnelValidationRow[];
  sequentialEffects: SequentialEffectRow[];
  channels: ChannelRow[];
  rawChannels: ChannelRow[];
}) {
  const [seqFilter, setSeqFilter] = useState<string>("Paid Meta Ads");
  const metaChannel = "Paid Meta Ads";

  // Funnel attribution aggregated by channel
  const funnelByChannel = useMemo(() => {
    const map: Record<string, FunnelAttributionRow[]> = {};
    funnelAttribution.forEach((row) => {
      if (!map[row.channel]) map[row.channel] = [];
      map[row.channel].push(row);
    });
    return map;
  }, [funnelAttribution]);

  const channelNames = useMemo(
    () => Array.from(new Set(sequentialEffects.map((r) => r.previous_channel))).sort(),
    [sequentialEffects],
  );

  const filteredSeq = useMemo(
    () => sequentialEffects.filter((r) => r.previous_channel === seqFilter),
    [sequentialEffects, seqFilter],
  );

  const hasLoops = loopDiagnostics.length > 0;
  const hasFunnel = funnelAttribution.length > 0;
  const hasValidation = funnelValidation.length > 0;
  const hasSeq = sequentialEffects.length > 0;
  const hasAny = hasLoops || hasFunnel || hasValidation || hasSeq;

  if (!hasAny) {
    return (
      <div className="empty-state">
        <h2>Diagnósticos ainda não disponíveis</h2>
        <p>Execute um novo model run para gerar diagnósticos de loops, estágio de funil e efeitos sequenciais.</p>
        <p className="muted" style={{ marginTop: 8 }}>Os diagnósticos de loop e efeitos sequenciais são gerados automaticamente. O modelo de estágio de funil requer acesso à tabela Events V2.</p>
      </div>
    );
  }

  return (
    <div className="panel-stack">
      {/* ---- SPRINT 16: FUNNEL VALIDATION ---- */}
      {hasValidation && <FunnelValidation rows={funnelValidation} />}

      {/* ---- NOTA METODOLÓGICA ---- */}
      <div className="how-to-read">
        <strong>Camadas diagnósticas — não são atribuição oficial</strong>
        <ul>
          <li><strong>Markov/Shapley Raw</strong> continua sendo o modelo oficial de atribuição.</li>
          <li><strong>Loop Diagnostics</strong>: presença e impacto de auto-loops por canal.</li>
          <li><strong>Funnel Stage</strong>: Markov com estados compostos (canal / estágio de intenção). Requer Events V2.</li>
          <li><strong>Efeitos Sequenciais</strong>: P(Conversão | anterior, atual) vs P(Conversão | atual). Diagnóstico de ordem 2.</li>
        </ul>
      </div>

      {/* ---- LOOP DIAGNOSTICS ---- */}
      {hasLoops && (
        <section className="chart-band">
          <header>
            <h2>Diagnóstico de Loops</h2>
            <span>{loopDiagnostics.length} canais</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Loop rate</th>
                  <th>Repeats (avg)</th>
                  <th>Repeats (max)</th>
                  <th>Conv. c/ loop</th>
                  <th>Conv. sem loop</th>
                  <th>Lift</th>
                  <th>Suporte</th>
                  <th>Confiança</th>
                </tr>
              </thead>
              <tbody>
                {loopDiagnostics.map((row, i) => {
                  const lift = row.loop_conversion_lift;
                  const liftColor = lift == null ? "#64748b" : lift > 1.05 ? "#16a34a" : lift < 0.95 ? "#dc2626" : "#64748b";
                  return (
                    <tr key={i}>
                      <td><strong>{row.channel}</strong></td>
                      <td>{row.self_loop_rate != null ? fmtPct.format(row.self_loop_rate) : "n/d"}</td>
                      <td>{row.avg_consecutive_repeats != null ? fmtNumber.format(row.avg_consecutive_repeats) : "n/d"}</td>
                      <td>{row.max_consecutive_repeats ?? "n/d"}</td>
                      <td>{row.loop_conversion_rate != null ? fmtPct.format(row.loop_conversion_rate) : "n/d"}</td>
                      <td>{row.nonloop_conversion_rate != null ? fmtPct.format(row.nonloop_conversion_rate) : "n/d"}</td>
                      <td style={{ color: liftColor, fontWeight: 600 }}>
                        {lift != null ? fmtNumber.format(lift) + "×" : "n/d"}
                      </td>
                      <td>{row.support ?? "n/d"}</td>
                      <td><ConfidenceBadge value={row.confidence} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- FUNNEL STAGE ATTRIBUTION ---- */}
      {hasFunnel && (
        <section className="chart-band">
          <header>
            <h2>Atribuição por Estágio de Funil</h2>
            <span>{funnelAttribution.length} estados compostos</span>
          </header>

          {/* Meta decomposition */}
          {funnelByChannel[metaChannel] && (
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 8 }}>Decomposição Paid Meta Ads</h3>
              <div className="kpi-grid compact">
                {funnelByChannel[metaChannel].map((row) => (
                  <article className="kpi" key={row.state} style={{ borderLeft: `3px solid ${STAGE_COLORS[row.funnel_stage] ?? "#64748b"}` }}>
                    <span>{row.funnel_stage}</span>
                    <strong>{row.markov_weight != null ? fmtPct.format(row.markov_weight) : "n/d"}</strong>
                    <small style={{ color: "#64748b", fontSize: "0.7rem" }}>Shapley: {row.shapley_weight != null ? fmtPct.format(row.shapley_weight) : "n/d"}</small>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Estágio</th>
                  <th>Markov wt</th>
                  <th>Shapley wt</th>
                  <th>Remoção</th>
                  <th>Presença conv.</th>
                  <th>Presença n-conv.</th>
                  <th>Suporte</th>
                  <th>Conf.</th>
                </tr>
              </thead>
              <tbody>
                {funnelAttribution.map((row, i) => (
                  <tr key={i}>
                    <td>{row.channel}</td>
                    <td>
                      <span style={{ color: STAGE_COLORS[row.funnel_stage] ?? "#64748b", fontWeight: 600 }}>
                        {row.funnel_stage}
                      </span>
                    </td>
                    <td>{row.markov_weight != null ? fmtPct.format(row.markov_weight) : "n/d"}</td>
                    <td>{row.shapley_weight != null ? fmtPct.format(row.shapley_weight) : "n/d"}</td>
                    <td>{row.removal_effect != null ? fmtPct.format(row.removal_effect) : "n/d"}</td>
                    <td>{row.presence_converting != null ? fmtPct.format(row.presence_converting) : "n/d"}</td>
                    <td>{row.presence_nonconverting != null ? fmtPct.format(row.presence_nonconverting) : "n/d"}</td>
                    <td>{row.support ?? "n/d"}</td>
                    <td><ConfidenceBadge value={row.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- SEQUENTIAL EFFECTS ---- */}
      {hasSeq && (
        <section className="chart-band">
          <header>
            <h2>Efeitos Sequenciais — Ordem 2</h2>
            <span>{sequentialEffects.length} pares</span>
          </header>
          <p className="muted" style={{ marginBottom: 8 }}>
            P(Conv | anterior → atual) vs P(Conv | atual). Lift &gt; 1 = o canal anterior ajuda. Este é um diagnóstico — não é atribuição oficial.
          </p>

          {/* Filter by previous channel */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            {channelNames.map((ch) => (
              <button
                key={ch}
                className={`tab${seqFilter === ch ? " active" : ""}`}
                style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem" }}
                onClick={() => setSeqFilter(ch)}
              >
                {ch}
              </button>
            ))}
          </div>

          {filteredSeq.length === 0 ? (
            <p className="muted">Nenhum par encontrado para {seqFilter}.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Anterior</th>
                    <th>Atual</th>
                    <th>Pares</th>
                    <th>Conv.</th>
                    <th>P(Conv | par)</th>
                    <th>P(Conv | atual)</th>
                    <th>Lift</th>
                    <th>Ticket médio</th>
                    <th>Label</th>
                    <th>Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSeq.map((row, i) => {
                    const lift = row.lift_vs_baseline;
                    const label = row.diagnostic_label ?? "";
                    const liftColor = LABEL_COLORS[label] ?? "#64748b";
                    return (
                      <tr key={i}>
                        <td>{row.previous_channel}</td>
                        <td><strong>{row.current_channel}</strong></td>
                        <td>{fmtNumber.format(row.pair_count ?? 0)}</td>
                        <td>{fmtNumber.format(row.conversion_count ?? 0)}</td>
                        <td>{row.conversion_probability_pair != null ? fmtPct.format(row.conversion_probability_pair) : "n/d"}</td>
                        <td>{row.conversion_probability_baseline != null ? fmtPct.format(row.conversion_probability_baseline) : "n/d"}</td>
                        <td style={{ color: liftColor, fontWeight: 600 }}>
                          {lift != null ? fmtNumber.format(lift) + "×" : "n/d"}
                        </td>
                        <td>{row.avg_ticket != null ? fmtMoney.format(row.avg_ticket) : "n/d"}</td>
                        <td>
                          <span style={{ color: liftColor, fontSize: "0.75rem", fontWeight: 600 }}>
                            {label.replace("_", " ")}
                          </span>
                        </td>
                        <td><ConfidenceBadge value={row.confidence} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ---- COMPARISON: Raw vs Funnel ---- */}
      {hasFunnel && (channels.length > 0 || rawChannels.length > 0) && (
        <section className="chart-band">
          <header>
            <h2>Comparação: Raw Channel vs Funnel Stage</h2>
            <span>atribuição oficial vs diagnóstica</span>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th>Raw Markov</th>
                  <th>Raw Shapley</th>
                  <th>Funnel Markov</th>
                  <th>Funnel Shapley</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Use rawChannels as the row source for the comparison table
                  const rawMap = new Map(rawChannels.map((r) => [r.channel, r]));
                  // Merge with funnel data — all channels that appear in either model
                  const allChannels = Array.from(
                    new Set([...rawChannels.map((r) => r.channel), ...channels.map((r) => r.channel)])
                  );
                  return allChannels.map((channelName, i) => {
                    const raw = rawMap.get(channelName);
                    const funnelRows = funnelByChannel[channelName] ?? [];
                    const funnelMarkov = funnelRows.reduce((s, r) => s + (r.markov_weight ?? 0), 0);
                    const funnelShapley = funnelRows.reduce((s, r) => s + (r.shapley_weight ?? 0), 0);
                    // Also check channels (funnel primary) for shapley
                    const funnelCh = channels.find((c) => c.channel === channelName);
                    const funnelShapleyFinal = funnelShapley > 0 ? funnelShapley : (funnelCh?.shapley_weight ?? 0);
                    return (
                      <tr key={i}>
                        <td><strong>{channelName}</strong></td>
                        <td>{raw?.markov_weight != null ? fmtPct.format(raw.markov_weight) : "0%"}</td>
                        <td>{raw?.shapley_weight != null ? fmtPct.format(raw.shapley_weight) : "0%"}</td>
                        <td>{funnelMarkov > 0 ? fmtPct.format(funnelMarkov) : (funnelCh?.markov_weight ? fmtPct.format(funnelCh.markov_weight) : "—")}</td>
                        <td>{funnelShapleyFinal > 0 ? fmtPct.format(funnelShapleyFinal) : "—"}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function fmtInt(v: unknown): string {
  if (v == null) return "n/d";
  const n = Number(v);
  return Number.isFinite(n) ? fmtNumber.format(Math.round(n)) : "n/d";
}

function fmtMoneySafe(v: unknown): string {
  if (v == null) return "n/d";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? fmtMoney.format(n) : "n/d";
}

function fmtPctSafe(v: unknown): string {
  if (v == null) return "n/d";
  const n = Number(v);
  return Number.isFinite(n) ? fmtPct.format(n) : "n/d";
}

function PathsTable({ rows }: { rows: PathRow[] }) {
  return (
    <table className="paths-table">
      <thead>
        <tr>
          <th>Caminho</th>
          <th>Passos</th>
          <th>Jornadas</th>
          <th>Conversões</th>
          <th>Abandonos</th>
          <th>Taxa conv.</th>
          <th>Receita</th>
          <th>Ticket médio</th>
          <th>Prob. caminho</th>
          <th>Loop</th>
          <th>Confiança</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={11}>Sem dados para esta tabela.</td>
          </tr>
        )}
        {rows.map((row, i) => {
          const isConverting = (row.conversion_count ?? 0) > 0;
          const isDropoff =
            (row.nonconversion_count ?? 0) > 0 && (row.conversion_count ?? 0) === 0;
          return (
            <tr
              key={i}
              className={isConverting ? "row-converting" : isDropoff ? "row-dropoff" : ""}
            >
              <td className="path-text-cell" title={String(row.path_text ?? "")}>
                {String(row.path_text ?? "")}
              </td>
              <td>{fmtInt(row.path_length)}</td>
              <td>{fmtInt(row.count)}</td>
              <td>{fmtInt(row.conversion_count)}</td>
              <td>{fmtInt(row.nonconversion_count)}</td>
              <td>{fmtPctSafe(row.conversion_rate)}</td>
              <td>{fmtMoneySafe(row.revenue)}</td>
              <td>{fmtMoneySafe(row.avg_ticket)}</td>
              <td>{fmtPctSafe(row.path_probability)}</td>
              <td>{row.contains_loop ? "Sim" : "Não"}</td>
              <td>{fmtPctSafe(row.confidence_score)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
}: {
  columns: string[];
  rows: T[];
}) {
  return (
    <section className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{COLUMN_LABELS[column] ?? column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ color: "#94a3b8", fontStyle: "italic" }}>
                Sem dados para esta tabela.
              </td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>
                  {renderDataCell(column, (row as Record<string, unknown>)[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={`tab ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function maxBy<T>(rows: T[], getValue: (row: T) => number): T | undefined {
  return rows.reduce<T | undefined>((best, row) => {
    if (!best || getValue(row) > getValue(best)) {
      return row;
    }
    return best;
  }, undefined);
}

function compactLabel(value: string) {
  return value.replace("Paid Social / ", "").replace("Organic Social / ", "");
}

function layoutGraph(nodes: GraphResponse["nodes"]) {
  const positions = new Map<string, { x: number; y: number }>();
  const channels = nodes
    .filter((node) => node.type === "channel")
    .sort((a, b) => b.pagerank - a.pagerank);
  const absorbing = nodes.filter(
    (node) => node.type === "conversion" || node.type === "non_conversion",
  );

  nodes
    .filter((node) => node.type === "start")
    .forEach((node, index) => positions.set(node.id, { x: 80, y: 260 + index * 70 }));

  channels.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / Math.max(channels.length, 1) - Math.PI / 2;
    positions.set(node.id, {
      x: 480 + Math.cos(angle) * 250,
      y: 260 + Math.sin(angle) * 170,
    });
  });

  absorbing.forEach((node, index) => {
    positions.set(node.id, {
      x: 880,
      y: absorbing.length === 1 ? 260 : 180 + index * 160,
    });
  });

  // Fallback para nós sem posição (evita que o SVG quebre ou fique vazio)
  nodes.forEach(node => {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: 480, y: 50 + Math.random() * 400 });
    }
  });

  return positions;
}

function edgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  isSelfLoop: boolean,
) {
  if (isSelfLoop) {
    return `M ${source.x} ${source.y - 24} C ${source.x + 80} ${source.y - 100}, ${
      source.x + 80
    } ${source.y + 100}, ${source.x} ${source.y + 24}`;
  }
  const midX = (source.x + target.x) / 2;
  const curve = Math.min(90, Math.abs(target.x - source.x) / 3);
  return `M ${source.x} ${source.y} C ${midX} ${source.y - curve}, ${midX} ${
    target.y + curve
  }, ${target.x} ${target.y}`;
}

function edgeWidth(count: number) {
  return Math.max(1.5, Math.min(8, Math.sqrt(count || 1)));
}

function nodeRadius(pagerank: number) {
  return Math.max(22, Math.min(42, 22 + pagerank * 140));
}

function graphNodeClass(type: GraphResponse["nodes"][number]["type"]) {
  if (type === "conversion") {
    return "conversion";
  }
  if (type === "non_conversion") {
    return "non-conversion";
  }
  return type;
}

function edgeTooltip(edge: GraphResponse["edges"][number]) {
  const probability =
    edge.probability === null || edge.probability === undefined
      ? "n/d"
      : fmtPct.format(edge.probability);
  return `${edge.source} -> ${edge.target}
Contagem: ${fmtNumber.format(edge.count)}
Probabilidade: ${probability}
Receita: ${fmtMoney.format(edge.revenue)}
Ticket médio: ${edge.avg_ticket ? fmtMoney.format(edge.avg_ticket) : "n/d"}`;
}

function nodeTooltip(node: GraphResponse["nodes"][number]) {
  return `${node.label}
PageRank: ${fmtNumber.format(node.pagerank)}
Entrada: ${fmtNumber.format(node.in_count)}
Saída: ${fmtNumber.format(node.out_count)}
Receita: ${fmtMoney.format(node.revenue)}
Centralidade: ${fmtNumber.format(node.degree_centrality)}`;
}


function readError(err: unknown) {
  return err instanceof Error ? err.message : "Erro inesperado.";
}
