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
import { BarChart2, FlaskConical, Play, Plus, Save, Trash2, X } from "lucide-react";
import {
  api,
  type Scenario,
  type ScenarioAnalysis,
  type ScenarioCompareItem,
  type ScenarioCompareResponse,
} from "./api";

const CHANNEL_CATEGORIES = [
  {
    label: "Mídia Paga",
    border: "#2563eb",
    bg: "#eff6ff",
    chipClass: "channel-chip-paid",
    channels: [
      "Paid Meta Ads",
      "TikTok Ads",
      "Google Ads / Search",
      "Google Ads / Search / Inst",
      "Google Ads / Shopping",
      "Google Ads / Shopping / Inst",
      "Google Ads / PMax",
      "Google Ads / Other",
      "Display / Retargeting",
    ],
  },
  {
    label: "CRM / Owned",
    border: "#7c3aed",
    bg: "#f5f3ff",
    chipClass: "channel-chip-crm",
    channels: ["Email", "WhatsApp CRM", "SMS"],
  },
  {
    label: "Orgânico",
    border: "#059669",
    bg: "#f0fdf4",
    chipClass: "channel-chip-organic",
    channels: [
      "Organic Social / Instagram",
      "Organic Social / Facebook",
      "Organic Search",
      "Direct",
    ],
  },
  {
    label: "Outros",
    border: "#92400e",
    bg: "#fffbeb",
    chipClass: "channel-chip-other",
    channels: ["Clube GoCase", "Referral", "Other"],
  },
] as const;

const KNOWN_CHANNELS = CHANNEL_CATEGORIES.flatMap((cat) => cat.channels as readonly string[]);

function channelCategory(label: string) {
  return CHANNEL_CATEGORIES.find((cat) =>
    (cat.channels as readonly string[]).includes(label)
  );
}

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

type Mode = "editor" | "compare";

export function SandboxView({ modelRunId }: { modelRunId: number }) {
  const [mode, setMode] = useState<Mode>("editor");

  // ---- editor state ----
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

  // ---- compare state ----
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());
  const [compareBaseline, setCompareBaseline] = useState(false);
  const [compareTopPath, setCompareTopPath] = useState(false);
  const [comparison, setComparison] = useState<ScenarioCompareResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

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
    const cat = channelCategory(label);
    setNodes((prev) => [
      ...prev,
      {
        id,
        position: { x, y },
        data: { label },
        style: {
          background: cat ? cat.bg : "#fef9c3",
          border: `2px solid ${cat ? cat.border : "#ca8a04"}`,
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
    // Always save first so any canvas changes are persisted before analyzing.
    const id = await saveScenario();
    if (id === null) return;
    setAnalysis(null); // clear previous results immediately
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
      style: (() => {
        const cat = channelCategory(n.label as string);
        return {
          background: cat ? cat.bg : "#fef9c3",
          border: cat ? `2px solid ${cat.border}` : "2px dashed #ca8a04",
          borderRadius: "8px",
          padding: "8px 14px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "grab",
        };
      })(),
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

  function toggleCompareId(id: number) {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runCompare() {
    const totalItems = compareIds.size + (compareBaseline ? 1 : 0) + (compareTopPath ? 1 : 0);
    if (totalItems < 2) {
      setCompareError("Selecione pelo menos 2 itens para comparar.");
      return;
    }
    setComparing(true);
    setCompareError(null);
    try {
      const result = await api.compareScenarios({
        model_run_id: modelRunId,
        scenario_ids: Array.from(compareIds),
        include_baseline: compareBaseline,
        include_top_path: compareTopPath,
      });
      setComparison(result);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Erro na comparação.");
    } finally {
      setComparing(false);
    }
  }

  const orderedPath = topologicalOrder(nodes, edges)
    .map((id) => nodeLabel(nodes.find((n) => n.id === id)!))
    .filter(Boolean);

  return (
    <div className={`sandbox-shell${mode === "compare" ? " sandbox-compare-mode" : ""}`}>
      {/* Left panel: palette + saved scenarios */}
      <aside className="sandbox-sidebar">
        {/* Mode toggle */}
        <div className="sandbox-mode-toggle">
          <button
            className={`mode-tab${mode === "editor" ? " active" : ""}`}
            onClick={() => setMode("editor")}
          >
            <FlaskConical size={13} /> Editor
          </button>
          <button
            className={`mode-tab${mode === "compare" ? " active" : ""}`}
            onClick={() => setMode("compare")}
          >
            <BarChart2 size={13} /> Comparar
          </button>
        </div>

        {mode === "editor" && (
          <div className="sandbox-section">
            <h3>
              <FlaskConical size={15} /> Canais
            </h3>
            <div className="channel-palette">
              {CHANNEL_CATEGORIES.map((cat) => (
                <div key={cat.label} className="channel-category-group">
                  <span
                    className="channel-category-label"
                    style={{ color: cat.border }}
                  >
                    {cat.label}
                  </span>
                  {(cat.channels as readonly string[]).map((ch) => (
                    <button
                      key={ch}
                      className={`channel-chip ${cat.chipClass}`}
                      onClick={() => addChannelNode(ch)}
                      style={{
                        borderColor: cat.border,
                        background: cat.bg,
                        color: cat.border,
                      }}
                    >
                      <Plus size={10} /> {ch}
                    </button>
                  ))}
                </div>
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
        )}

        <div className="sandbox-section">
          <h3>Cenários salvos</h3>
          {scenarios.length === 0 && (
            <p className="muted-small">Nenhum cenário salvo.</p>
          )}
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={`scenario-item ${activeId === s.id && mode === "editor" ? "active" : ""} ${compareIds.has(s.id) && mode === "compare" ? "selected" : ""}`}
            >
              {mode === "compare" && (
                <input
                  type="checkbox"
                  className="compare-checkbox"
                  checked={compareIds.has(s.id)}
                  onChange={() => toggleCompareId(s.id)}
                />
              )}
              <button
                className="scenario-name"
                onClick={() => mode === "editor" ? loadScenario(s) : toggleCompareId(s.id)}
              >
                <strong>#{s.id}</strong> {s.name}
              </button>
              {mode === "editor" && (
                <button
                  className="icon-btn danger"
                  onClick={() => deleteScenario(s.id)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {mode === "compare" && (
          <div className="sandbox-section">
            <h3>Referências</h3>
            <label className="compare-ref-row">
              <input
                type="checkbox"
                checked={compareBaseline}
                onChange={(e) => setCompareBaseline(e.target.checked)}
              />
              <span>Baseline (modelo atual)</span>
            </label>
            <label className="compare-ref-row">
              <input
                type="checkbox"
                checked={compareTopPath}
                onChange={(e) => setCompareTopPath(e.target.checked)}
              />
              <span>Top Caminho Real</span>
            </label>
            <button
              className="icon-button primary compare-run-btn"
              onClick={() => void runCompare()}
              disabled={comparing}
            >
              <BarChart2 size={14} />
              {comparing ? "Comparando…" : "Comparar"}
            </button>
            {compareError && (
              <p className="compare-error">{compareError}</p>
            )}
          </div>
        )}
      </aside>

      {/* Center: React Flow canvas (editor) OR compare table */}
      {mode === "editor" ? (
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
                disabled={analyzing || saving || nodes.length === 0}
              >
                <Play size={15} />
                {saving ? "Salvando…" : analyzing ? "Analisando…" : "Analisar"}
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
      ) : (
        <div className="sandbox-compare-area">
          {!comparison && (
            <div className="compare-empty">
              <BarChart2 size={40} strokeWidth={1} />
              <p>Selecione cenários na barra lateral e clique em <strong>Comparar</strong>.</p>
            </div>
          )}
          {comparison && <CompareTable comparison={comparison} />}
        </div>
      )}

      {/* Right panel: analysis results (editor mode only) */}
      {mode === "editor" && (analyzing || analysis) && (
        <aside className="sandbox-results">
          <div className="results-header">
            <h3>Análise</h3>
            <button
              className="icon-btn"
              onClick={() => setAnalysis(null)}
              title="Fechar painel"
              disabled={analyzing}
            >
              <X size={14} />
            </button>
          </div>

          {analyzing && (
            <div className="results-loading">
              <div className="spinner" />
              <p>Analisando cenário…</p>
            </div>
          )}

          {!analyzing && analysis && (
          <>
          {analysis.warnings.length > 0 && (
            <div className="result-warnings">
              {analysis.warnings.map((w, i) => (
                <p key={i} className="warning-item">⚠ {w}</p>
              ))}
            </div>
          )}

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
          </>
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

// ---------------------------------------------------------------------------
// CompareTable
// ---------------------------------------------------------------------------

const SOURCE_LABEL: Record<string, string> = {
  scenario: "Cenário",
  baseline: "Baseline",
  top_real_path: "Top Caminho",
};

function fmtDelta(val: number | null | undefined, fmt: (v: number) => string): string {
  if (val == null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${fmt(val)}`;
}

function CompareTable({ comparison }: { comparison: ScenarioCompareResponse }) {
  const { items, winner_conversion, winner_revenue, winner_confidence, delta } = comparison;
  const hasDelta = delta != null && items.length === 2;

  function cellClass(itemName: string, winner: string | null) {
    return winner && itemName === winner ? "cmp-cell winner" : "cmp-cell";
  }

  function pathLabel(item: ScenarioCompareItem) {
    if (item.path_channels.length === 0) return "—";
    return item.path_channels.join(" → ");
  }

  return (
    <div className="compare-table-wrap">
      {/* Winner badges */}
      <div className="compare-winners">
        {winner_conversion && (
          <span className="winner-badge conv">🏆 Maior conv.: {winner_conversion}</span>
        )}
        {winner_revenue && (
          <span className="winner-badge rev">💰 Maior receita: {winner_revenue}</span>
        )}
        {winner_confidence && (
          <span className="winner-badge conf">🎯 Maior confiança: {winner_confidence}</span>
        )}
      </div>

      <div className="compare-table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="cmp-header-metric">Métrica</th>
              {items.map((item, i) => (
                <th key={i} className="cmp-header-item">
                  <span className="cmp-source-tag">{SOURCE_LABEL[item.source] ?? item.source}</span>
                  <span className="cmp-item-name">{item.name}</span>
                </th>
              ))}
              {hasDelta && <th className="cmp-header-delta">Δ (B − A)</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="cmp-metric-label">Caminho</td>
              {items.map((item, i) => (
                <td key={i} className="cmp-cell cmp-path">{pathLabel(item)}</td>
              ))}
              {hasDelta && <td className="cmp-cell" />}
            </tr>
            <tr>
              <td className="cmp-metric-label">
                Conv. composta
                <span className="cmp-hint" title="P(chegar ao último canal) × P(eventualmente converter)"> ⓘ</span>
              </td>
              {items.map((item, i) => (
                <td key={i} className={cellClass(item.name, winner_conversion)}>
                  {item.composite_conversion_probability != null
                    ? fmtPct.format(item.composite_conversion_probability)
                    : "n/d"}
                </td>
              ))}
              {hasDelta && (
                <td className={`cmp-cell cmp-delta ${delta.composite_conversion_delta != null ? (delta.composite_conversion_delta > 0 ? "positive" : "negative") : ""}`}>
                  {fmtDelta(delta.composite_conversion_delta, (v) => fmtPct.format(v))}
                  {delta.composite_conversion_pct != null && (
                    <span className="delta-pct"> ({delta.composite_conversion_pct > 0 ? "+" : ""}{delta.composite_conversion_pct.toFixed(1)}%)</span>
                  )}
                </td>
              )}
            </tr>
            <tr>
              <td className="cmp-metric-label">Taxa conv. histórica</td>
              {items.map((item, i) => (
                <td key={i} className="cmp-cell">
                  {item.historical_conversion_rate != null
                    ? fmtPct.format(item.historical_conversion_rate)
                    : "n/d"}
                </td>
              ))}
              {hasDelta && <td className="cmp-cell" />}
            </tr>
            <tr>
              <td className="cmp-metric-label">Lift vs baseline</td>
              {items.map((item, i) => (
                <td key={i} className={`cmp-cell${item.lift != null && item.lift >= 1.5 ? " winner" : item.lift != null && item.lift < 0.8 ? " loser" : ""}`}>
                  {item.lift != null ? `${fmtNum.format(item.lift)}×` : "n/d"}
                </td>
              ))}
              {hasDelta && <td className="cmp-cell" />}
            </tr>
            <tr>
              <td className="cmp-metric-label">Receita esperada</td>
              {items.map((item, i) => (
                <td key={i} className={cellClass(item.name, winner_revenue)}>
                  {item.expected_revenue != null
                    ? fmtMoney.format(item.expected_revenue)
                    : "n/d"}
                </td>
              ))}
              {hasDelta && (
                <td className={`cmp-cell cmp-delta ${delta.expected_revenue_delta != null ? (delta.expected_revenue_delta > 0 ? "positive" : "negative") : ""}`}>
                  {fmtDelta(delta.expected_revenue_delta, (v) => fmtMoney.format(v))}
                  {delta.expected_revenue_pct != null && (
                    <span className="delta-pct"> ({delta.expected_revenue_pct > 0 ? "+" : ""}{delta.expected_revenue_pct.toFixed(1)}%)</span>
                  )}
                </td>
              )}
            </tr>
            <tr>
              <td className="cmp-metric-label">Ticket médio</td>
              {items.map((item, i) => (
                <td key={i} className="cmp-cell">
                  {item.expected_ticket != null
                    ? fmtMoney.format(item.expected_ticket)
                    : "n/d"}
                </td>
              ))}
              {hasDelta && <td className="cmp-cell" />}
            </tr>
            <tr>
              <td className="cmp-metric-label">Suporte histórico</td>
              {items.map((item, i) => (
                <td key={i} className="cmp-cell">
                  {item.historical_support.toLocaleString("pt-BR")}
                </td>
              ))}
              {hasDelta && (
                <td className={`cmp-cell cmp-delta ${delta.historical_support_delta != null ? (delta.historical_support_delta > 0 ? "positive" : "negative") : ""}`}>
                  {fmtDelta(delta.historical_support_delta, (v) => Math.round(v).toLocaleString("pt-BR"))}
                </td>
              )}
            </tr>
            <tr>
              <td className="cmp-metric-label">Confiança</td>
              {items.map((item, i) => (
                <td key={i} className={cellClass(item.name, winner_confidence)}>
                  {item.confidence_score != null
                    ? fmtNum.format(item.confidence_score)
                    : "n/d"}
                </td>
              ))}
              {hasDelta && (
                <td className={`cmp-cell cmp-delta ${delta.confidence_delta != null ? (delta.confidence_delta > 0 ? "positive" : "negative") : ""}`}>
                  {fmtDelta(delta.confidence_delta, (v) => fmtNum.format(v))}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Warnings per item */}
      {items.some((it) => it.warnings.length > 0) && (
        <div className="compare-warnings-section">
          {items.map((item, i) =>
            item.warnings.length > 0 ? (
              <div key={i} className="compare-item-warnings">
                <strong>{item.name}</strong>
                {item.warnings.map((w, j) => (
                  <p key={j} className="warning-item">⚠ {w}</p>
                ))}
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
