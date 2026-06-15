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
import { Button, Card } from "../../../shared/ui";
import { useScenarioSimulation } from "../../../shared/hooks/useScenarioSimulation";
import type { EstimatedMetric, JourneyBuilder as JourneyBuilderData } from "../types";
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

export type JourneyPathBuilderProps = { builder: JourneyBuilderData };

type NodeData = { label: string };

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

export function JourneyPathBuilder({ builder }: JourneyPathBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [customLabel, setCustomLabel] = useState("");

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
          data: { label },
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
  }

  const sim = useScenarioSimulation<EstimatedMetric>(
    nodes.map((n, i) => ({
      id: n.id ?? `n-${i}`,
      label: String(n.data?.label ?? n.id),
    })),
    builder.estimatedInterpretation,
  );

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

        <p className={styles.simNote}>{sim.description}</p>
        <div className={styles.simGrid}>
          {sim.metrics.map((m) => (
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
          >
            {builder.primaryAction}
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
