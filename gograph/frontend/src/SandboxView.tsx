import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlaskConical, Play, Plus, Save, Trash2, X } from "lucide-react";
import { api, type Scenario, type ScenarioAnalysis } from "./api";

const KNOWN_CHANNELS = [
  "Paid Meta Ads",
  "Google Ads",
  "Display / Retargeting",
  "Email",
  "WhatsApp CRM",
  "SMS",
  "Organic Social / Instagram",
  "Organic Social / Facebook",
  "Organic Search",
  "Direct",
  "Influencers",
  "Clube GoCase",
  "Referral",
  "Other",
];

const fmtMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const fmtPct = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 3,
});
const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function topologicalOrder(
  nodes: Node[],
  edges: Edge[],
): string[] {
  // Build adjacency list and in-degree
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  });
  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  });
  const queue = nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    (adj.get(id) ?? []).forEach((next) => {
      const d = (inDeg.get(next) ?? 1) - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    });
  }
  return order;
}

function nodeLabel(node: Node): string {
  return (node.data?.label as string) ?? node.id;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SandboxView({ modelRunId }: { modelRunId: number }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [scenarioName, setScenarioName] = useState("Novo cenário");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [customChannel, setCustomChannel] = useState("");
  const [analysis, setAnalysis] = useState<ScenarioAnalysis | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load scenarios for this model run
  useEffect(() => {
    api.listScenarios(modelRunId).then(setScenarios).catch(() => {});
  }, [modelRunId]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  function addChannelNode(label: string) {
    const id = `node_${Date.now()}`;
    const x = 120 + (nodes.length % 4) * 200;
    const y = 80 + Math.floor(nodes.length / 4) * 120;
    setNodes((prev) => [
      ...prev,
      {
        id,
        position: { x, y },
        data: { label },
        style: {
          background: "#fff",
          border: "2px solid #2563eb",
          borderRadius: "8px",
          padding: "8px 14px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "grab",
        },
      },
    ]);
  }

  function addCustom() {
    if (!customChannel.trim()) return;
    addChannelNode(customChannel.trim());
    setCustomChannel("");
  }

  function clearCanvas() {
    setNodes([]);
    setEdges([]);
    setAnalysis(null);
    setActiveId(null);
    setScenarioName("Novo cenário");
  }

  // Returns the saved scenario id, or null on failure.
  async function saveScenario(): Promise<number | null> {
    setSaving(true);
    setError(null);
    try {
      const orderedIds = topologicalOrder(nodes, edges);
      const pathChannels = orderedIds
        .map((id) => nodeLabel(nodes.find((n) => n.id === id)!))
        .filter(Boolean);
      const nodePayload = nodes.map((n) => ({
        id: n.id,
        label: nodeLabel(n),
        is_hypothetical: !KNOWN_CHANNELS.includes(nodeLabel(n)),
        position: n.position,
      }));
      const edgePayload = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }));

      let saved: Scenario;
      if (activeId !== null) {
        saved = await api.updateScenario(activeId, {
          name: scenarioName,
          nodes: nodePayload,
          edges: edgePayload,
          path_channels: pathChannels,
        });
      } else {
        saved = await api.createScenario({
          model_run_id: modelRunId,
          name: scenarioName,
          nodes: nodePayload,
          edges: edgePayload,
          path_channels: pathChannels,
        });
      }
      setActiveId(saved.id);
      const updated = await api.listScenarios(modelRunId);
      setScenarios(updated);
      return saved.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function runAnalysis() {
    // React state updates are async — get the id from saveScenario's return value
    // directly rather than reading the stale activeId closure after save.
    let id = activeId;
    if (id === null) {
      id = await saveScenario();
    }
    if (id === null) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await api.analyzeScenario(id);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na análise.");
    } finally {
      setAnalyzing(false);
    }
  }

  function loadScenario(s: Scenario) {
    setActiveId(s.id);
    setScenarioName(s.name);
    const rfNodes: Node[] = s.nodes.map((n: Record<string, unknown>) => ({
      id: n.id as string,
      position: (n.position as { x: number; y: number }) ?? { x: 100, y: 100 },
      data: { label: n.label as string },
      style: {
        background: KNOWN_CHANNELS.includes(n.label as string) ? "#fff" : "#fef9c3",
        border: KNOWN_CHANNELS.includes(n.label as string)
          ? "2px solid #2563eb"
          : "2px dashed #ca8a04",
        borderRadius: "8px",
        padding: "8px 14px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "grab",
      },
    }));
    const rfEdges: Edge[] = s.edges.map((e: Record<string, unknown>) => ({
      id: e.id as string,
      source: e.source as string,
      target: e.target as string,
    }));
    setNodes(rfNodes);
    setEdges(rfEdges);
    setAnalysis(null);
  }

  async function deleteScenario(id: number) {
    try {
      await api.deleteScenario(id);
      const updated = await api.listScenarios(modelRunId);
      setScenarios(updated);
      if (activeId === id) clearCanvas();
    } catch {
      setError("Erro ao deletar cenário.");
    }
  }

  const orderedPath = topologicalOrder(nodes, edges)
    .map((id) => nodeLabel(nodes.find((n) => n.id === id)!))
    .filter(Boolean);

  return (
    <div className="sandbox-shell">
      {/* Left panel: palette + saved scenarios */}
      <aside className="sandbox-sidebar">
        <div className="sandbox-section">
          <h3>
            <FlaskConical size={15} /> Canais
          </h3>
          <div className="channel-palette">
            {KNOWN_CHANNELS.map((ch) => (
              <button
                key={ch}
                className="channel-chip"
                onClick={() => addChannelNode(ch)}
              >
                <Plus size={11} /> {ch}
              </button>
            ))}
          </div>
          <div className="custom-channel-row">
            <input
              placeholder="Canal hipotético..."
              value={customChannel}
              onChange={(e) => setCustomChannel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <button className="icon-btn" onClick={addCustom}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="sandbox-section">
          <h3>Cenários salvos</h3>
          {scenarios.length === 0 && (
            <p className="muted-small">Nenhum cenário salvo.</p>
          )}
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={`scenario-item ${activeId === s.id ? "active" : ""}`}
            >
              <button
                className="scenario-name"
                onClick={() => loadScenario(s)}
              >
                <strong>#{s.id}</strong> {s.name}
              </button>
              <button
                className="icon-btn danger"
                onClick={() => deleteScenario(s.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Center: React Flow canvas */}
      <div className="sandbox-canvas-area">
        <div className="sandbox-toolbar">
          <input
            className="scenario-name-input"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Nome do cenário"
          />
          <div className="toolbar-actions">
            <button className="icon-button" onClick={clearCanvas}>
              <X size={15} /> Limpar
            </button>
            <button
              className="icon-button"
              onClick={() => void saveScenario()}
              disabled={saving}
            >
              <Save size={15} /> {saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              className="icon-button primary"
              onClick={() => void runAnalysis()}
              disabled={analyzing || nodes.length === 0}
            >
              <Play size={15} /> {analyzing ? "Analisando…" : "Analisar"}
            </button>
          </div>
        </div>

        <div className="path-preview-wrap">
          {orderedPath.length === 0 ? (
            <p className="canvas-hint" style={{ margin: 0 }}>
              Adicione canais da paleta e conecte-os em sequência. <strong>(start)</strong> e <strong>Conversion</strong> são adicionados automaticamente pela análise — não é necessário desenhá-los no canvas.
            </p>
          ) : (
            <div className="path-preview">
              <span className="path-step start">(start)</span>
              {orderedPath.map((ch, i) => (
                <span key={i} className="path-step">
                  <span className="path-arrow">→</span>
                  {ch}
                </span>
              ))}
              <span className="path-arrow">→</span>
              <span className="path-step conversion">Conversion</span>
            </div>
          )}
        </div>

        {error && (
          <div className="alert" style={{ margin: "0 0 8px" }}>
            {error}
          </div>
        )}

        <div className="rf-wrapper">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        <p className="canvas-hint">
          Arraste os canais acima para o canvas · conecte-os em sequência arrastando de um ponto de saída para outro nó · clique em <strong>Analisar</strong>.
        </p>
      </div>

      {/* Right panel: analysis results */}
      {analysis && (
        <aside className="sandbox-results">
          <h3>Análise</h3>

          {analysis.warnings.length > 0 && (
            <div className="result-warnings">
              {analysis.warnings.map((w, i) => (
                <p key={i} className="warning-item">⚠ {w}</p>
              ))}
            </div>
          )}

          {/* Hero metrics: historical evidence */}
          <div className="metrics-section">
            <span className="metrics-section-label">Evidência histórica</span>
            <MetricRow
              label="Suporte histórico"
              value={`${analysis.historical_support.toLocaleString("pt-BR")} jornadas`}
              hint="Jornadas reais que contêm esta sequência como subsequência"
            />
            <MetricRow
              label="Taxa de conversão histórica"
              value={
                analysis.historical_conversion_rate != null
                  ? fmtPct.format(analysis.historical_conversion_rate)
                  : "n/d"
              }
              hint="Média ponderada da taxa de conversão dos caminhos similares"
            />
            <MetricRow
              label="Lift vs baseline"
              value={
                analysis.lift != null
                  ? `${fmtNum.format(analysis.lift)}×`
                  : "n/d"
              }
              hint="Taxa de conversão deste padrão ÷ taxa de conversão média do modelo. >1 = acima da média."
              highlight={analysis.lift != null ? (analysis.lift >= 1.5 ? "good" : analysis.lift < 0.8 ? "bad" : undefined) : undefined}
            />
          </div>

          {/* Business metrics */}
          <div className="metrics-section">
            <span className="metrics-section-label">Negócio</span>
            <MetricRow
              label="Receita esperada"
              value={
                analysis.expected_revenue != null
                  ? fmtMoney.format(analysis.expected_revenue)
                  : "n/d"
              }
              hint="Suporte histórico × taxa conv. histórica × ticket médio real"
            />
            <MetricRow
              label="Ticket médio real"
              value={
                analysis.expected_ticket != null
                  ? fmtMoney.format(analysis.expected_ticket)
                  : "n/d"
              }
              hint="Receita total ÷ total de conversões do model run"
            />
          </div>

          {/* Matrix metrics (less actionable, for reference) */}
          <div className="metrics-section">
            <span className="metrics-section-label">Matriz de transição</span>
            <MetricRow
              label="P(Conversão | último canal)"
              value={
                analysis.conversion_probability_given_last_node != null
                  ? fmtPct.format(analysis.conversion_probability_given_last_node)
                  : "n/d"
              }
              hint="P(último canal → Conversão) — um passo direto na matriz"
            />
            <MetricRow
              label="Prob. composta de conversão"
              value={
                analysis.composite_conversion_probability != null
                  ? fmtPct.format(analysis.composite_conversion_probability)
                  : "n/d"
              }
              hint="P(chegar ao último canal via este path) × P(eventualmente converter a partir dele)"
            />
            <MetricRow
              label="Prob. do caminho exato"
              value={
                analysis.path_probability != null
                  ? fmtPct.format(analysis.path_probability)
                  : "n/d"
              }
              hint="Produto de todas as transições (start→ch1→…→chN→Conversão). Tende a ser pequeno — use evidência histórica para decisões."
            />
          </div>

          <MetricRow
            label="Confiança"
            value={
              analysis.confidence_score != null
                ? fmtNum.format(analysis.confidence_score)
                : "n/d"
            }
          />

          {analysis.similar_paths.length > 0 && (
            <div className="similar-paths">
              <h4>Caminhos similares</h4>
              {analysis.similar_paths.map((p, i) => (
                <div key={i} className="similar-path-item">
                  <span className="similar-path-text">{p.path}</span>
                  <span className="similar-path-meta">
                    {p.count} jornadas ·{" "}
                    {p.conversion_rate != null
                      ? fmtPct.format(p.conversion_rate)
                      : "n/d"}{" "}
                    conv.
                    {p.revenue ? ` · ${fmtMoney.format(p.revenue)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function MetricRow({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: "good" | "bad";
}) {
  return (
    <div className="metric-row" title={hint}>
      <span className="metric-label">{label}{hint && <span className="metric-hint-icon" title={hint}> ⓘ</span>}</span>
      <strong className={`metric-value${highlight === "good" ? " metric-good" : highlight === "bad" ? " metric-bad" : ""}`}>
        {value}
      </strong>
    </div>
  );
}
