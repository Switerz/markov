import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card } from "../../../shared/ui";
import styles from "./JourneyGraphPanel.module.css";

// Extracted from the legacy SandboxView's xyflow canvas, refactored to use
// shared tokens. The legacy view stays on disk (src/SandboxView.tsx) but is
// no longer imported by the refactored shell.
export type JourneyGraphPanelProps = {
  nodes: Node[];
  edges: Edge[];
  height?: number;
};

export function JourneyGraphPanel({
  nodes,
  edges,
  height = 520,
}: JourneyGraphPanelProps) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Grafo de transições</Card.Title>
      </Card.Header>
      <Card.Body>
        <div className={styles.canvas} style={{ height, width: "100%" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--gg-border)" gap={20} />
            <Controls />
            <MiniMap pannable zoomable nodeColor={() => "var(--gg-blue)"} />
          </ReactFlow>
        </div>
      </Card.Body>
    </Card>
  );
}
