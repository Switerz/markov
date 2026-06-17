import { useCallback, useState } from "react";
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
import { Plus, Play, Trash2 } from "lucide-react";
import { Button, Card, useToast } from "../../../shared/ui";
import { useScenarioSimulation } from "../../../shared/hooks/useScenarioSimulation";
import { api } from "../../../lib/api";
import { formatCompactBRL } from "../../../shared/format";
import { topologicalOrder } from "../lib/topological";
import type {
  EstimatedMetric,
  JourneyBuilder as JourneyBuilderData,
} from "../types";
import styles from "./JourneyPathBuilder.module.css";

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

export type JourneyPathBuilderProps = {
  builder: JourneyBuilderData;
  /** When provided, "Simular caminho" persists a scenario via the API
   * (createScenario → analyzeScenario) and renders real metrics. Falls back
   * to the local mock simulation when null. */
  runId?: number;
};

type NodeData = { id: string; label: string };

function nodeStyle(isHypothetical: boolean) {
  return {
    background: isHypothetical ? "var(--gg-orange-soft)" : "var(--gg-surface)",
    border: `1.5px ${isHypothetical ? "dashed" : "solid"} ${
      isHypothetical ? "var(--gg-orange)" : "var(--gg-blue)"
    }`,
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--gg-text-primary)",
    cursor: "grab",
  } as const;
}

type LiveMetric = EstimatedMetric;

function formatProb(p: number | null | undefined): string {
  if (p == null) return "—";
  return `${(p * 100).toFixed(2).replace(".", ",")}%`;
}

function formatTicket(t: number | null | undefined): string {
  if (t == null) return "—";
  return formatCompactBRL(t);
}

export function JourneyPathBuilder({ builder, runId }: JourneyPathBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [liveMetrics, setLiveMetrics] = useState<LiveMetric[] | null>(null);
  const [simulating, setSimulating] = useState(false);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges],
  );

  const addNode = useCallback(
    (label: string, isHypothetical = false) => {
      const id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      setNodes((prev) => {
        const x = 80 + (prev.length % 4) * 180;
        const y = 60 + Math.floor(prev.length / 4) * 110;
        const newNode: Node<NodeData> = {
          id,
          position: { x, y },
          data: { id, label },
          style: nodeStyle(isHypothetical),
        };
        return [...prev, newNode];
      });
    },
    [setNodes],
  );

  function addCustom() {
    const v = customLabel.trim();
    if (!v) return;
    addNode(v, !KNOWN_CHANNELS.includes(v));
    setCustomLabel("");
  }

  function clear() {
    setNodes([]);
    setEdges([]);
    setLiveMetrics(null);
  }

  const toast = useToast();

  const onSimulate = useCallback(async () => {
    if (nodes.length < 2) return;
    if (runId == null) {
      // Local fallback simulation (no active run): keep the mock metrics that
      // useScenarioSimulation already produces below.
      setLiveMetrics(null);
      toast.push("Caminho simulado localmente", "blue");
      return;
    }
    setSimulating(true);
    try {
      const orderedIds = topologicalOrder(nodes, edges);
      const labelById = new Map(
        nodes.map((n) => [n.id, String(n.data?.label ?? n.id)]),
      );
      const pathChannels = orderedIds
        .map((id) => labelById.get(id) ?? id)
        .filter((label): label is string => Boolean(label));
      const saved = await api.createScenario({
        model_run_id: runId,
        name: "Caminho ad-hoc",
        action_type: "path",
        nodes: nodes.map((n) => ({
          id: n.id,
          label: String(n.data?.label ?? n.id),
          position: n.position,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
        path_channels: pathChannels,
      });
      const result = await api.analyzeScenario(saved.id);
      const newMetrics: LiveMetric[] = [
        {
          title: "Participação esperada",
          value: formatProb(result.path_probability),
        },
        {
          title: "Frequência média",
          value: `${pathChannels.length} toques`,
        },
        {
          title: "Conversão esperada",
          value: formatProb(result.composite_conversion_probability),
        },
        {
          title: "Receita esperada",
          value: formatTicket(result.expected_revenue),
          subtitle:
            result.expected_ticket != null
              ? `ticket ${formatCompactBRL(result.expected_ticket)}`
              : undefined,
        },
      ];
      setLiveMetrics(newMetrics);
      toast.push(
        `Caminho analisado — receita esperada: ${formatTicket(result.expected_revenue)}`,
        "green",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      toast.push(`Falha ao simular: ${msg}`, "red");
    } finally {
      setSimulating(false);
    }
  }, [edges, nodes, runId, toast]);

  const sim = useScenarioSimulation<EstimatedMetric>(
    nodes.map((n, i) => ({
      id: n.id ?? `n-${i}`,
      label: String(n.data?.label ?? n.id),
    })),
    builder.estimatedInterpretation,
  );

  const displayedMetrics = liveMetrics ?? sim.metrics;
  const displayedDescription =
    liveMetrics != null
      ? `Resultado da execução (run #${runId})`
      : sim.description;

  return (
    <Card className={styles.root}>
      <Card.Header>
        <Card.Title>{builder.title}</Card.Title>
        <Card.Description>{builder.subtitle}</Card.Description>
      </Card.Header>

      <Card.Body>
        <div
          className={styles.palette}
          role="toolbar"
          aria-label="Paleta de canais"
        >
          {KNOWN_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.paletteChip}
              onClick={() => addNode(c)}
            >
              <Plus size={11} aria-hidden /> {c}
            </button>
          ))}
        </div>

        <div className={styles.customRow}>
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Canal personalizado (hipótese)"
            className={styles.customInput}
            aria-label="Canal personalizado"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={addCustom}
          >
            Adicionar
          </Button>
        </div>

        <div className={styles.canvas} data-testid="journey-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--gg-border)" gap={20} />
            <Controls position="bottom-left" />
            <MiniMap pannable zoomable nodeColor={() => "var(--gg-blue)"} />
          </ReactFlow>
        </div>

        <p className={styles.simNote}>{displayedDescription}</p>
        <div className={styles.simGrid}>
          {displayedMetrics.map((m) => (
            <div key={m.title} className={styles.simTile}>
              <span className={styles.simLabel}>{m.title}</span>
              <span className={styles.simValue}>{m.value}</span>
              {m.subtitle && (
                <span className={styles.simSubtitle}>{m.subtitle}</span>
              )}
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Play size={14} aria-hidden />}
            onClick={onSimulate}
            disabled={nodes.length < 2 || simulating}
          >
            {simulating ? "Analisando…" : builder.primaryAction}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Trash2 size={14} aria-hidden />}
            onClick={clear}
          >
            {builder.secondaryAction}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
