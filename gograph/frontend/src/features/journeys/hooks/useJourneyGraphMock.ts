import type { Node, Edge } from "@xyflow/react";
import type { JourneysData } from "../types";

// Synthesizes a small nodes/edges layout from middleNodes for demo purposes.
// TODO(api): replace with api.getGraph(runId) once Phase 4 hooks are wired.
export function useJourneyGraphMock(data: JourneysData): {
  nodes: Node[];
  edges: Edge[];
} {
  const channels = data.journeyFlow.middleNodes;
  const nodes: Node[] = channels.map((c, i) => ({
    id: c.channel,
    position: { x: (i % 4) * 200, y: Math.floor(i / 4) * 140 },
    data: { label: c.channel },
  }));
  nodes.push({
    id: "Conversão",
    position: { x: 800, y: 280 },
    data: { label: "Conversão" },
  });
  const edges: Edge[] = channels.map((c) => ({
    id: `e-${c.channel}`,
    source: c.channel,
    target: "Conversão",
  }));
  return { nodes, edges };
}
