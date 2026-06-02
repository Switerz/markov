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
  GraphResponse,
  InsightRow,
  ModelRun,
  ModelRunCreatePayload,
  PathRow,
  TouchpointRow,
} from "./api";
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
  | "sandbox";

const defaultPayload: ModelRunCreatePayload = {
  start_date: "2026-03-01",
  end_date: "2026-03-31",
  lookback_days: 30,
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
          api.getDiagnostics(id),
          api.getInsights(id),
          api.getTouchpoints(id),
          api.getGraph(id),
          api.getDataQuality(id),
          api.getPaths(id),
        ]);
      setOverview(overviewData);
      setChannels(channelData.rows);
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
            Diagnósticos
          </TabButton>
          <TabButton active={tab === "quality"} onClick={() => setTab("quality")}>
            <AlertTriangle size={16} />
            Qualidade
          </TabButton>
          <TabButton active={tab === "paths"} onClick={() => setTab("paths")}>
            <GitGraph size={16} />
            Caminhos
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
          <Channels rows={channels} chartRows={topChannels} />
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

  return (
    <div className="panel-stack">
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
}: {
  rows: ChannelRow[];
  chartRows: ChannelRow[];
}) {
  const chartData = chartRows.map((row) => ({
    channel: compactLabel(row.channel),
    markov: (row.markov_weight ?? 0) * 100,
    shapley: (row.shapley_weight ?? 0) * 100,
  }));

  return (
    <div className="panel-stack">
      <section className="chart-band">
        <header>
          <h2>Pesos de atribuição</h2>
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
          "shapley_weight",
          "spend",
          "roas_markov",
          "roas_shapley",
          "recommendation",
        ]}
        rows={rows}
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
  return (
    <DataTable
      columns={[
        "channel",
        "title",
        "severity",
        "confidence",
        "description",
        "evidence",
        "recommendation",
        "limitation",
      ]}
      rows={rows}
    />
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
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>Sem dados para esta tabela.</td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>
                  {formatCell((row as Record<string, unknown>)[column])}
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

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "n/d";
  }
  if (typeof value === "number") {
    if (Math.abs(value) <= 1) {
      return fmtPct.format(value);
    }
    return fmtNumber.format(value);
  }
  return String(value);
}

function readError(err: unknown) {
  return err instanceof Error ? err.message : "Erro inesperado.";
}
