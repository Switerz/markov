import { useQuery } from "@tanstack/react-query";
import type { Node, Edge } from "@xyflow/react";
import { api, type GraphResponse } from "../../../lib/api";
import { useActiveRun } from "../../../app/hooks/useActiveRun";
import type { JourneysData } from "../types";

// Builds a ReactFlow node/edge graph from the real /graph endpoint when a run is
// active, falling back to a synthetic layout derived from middleNodes when not.
export function useJourneyGraphMock(data: JourneysData): {
  nodes: Node[];
  edges: Edge[];
} {
  const activeRun = useActiveRun();
  const runId = activeRun?.id;
  const graphQuery = useQuery({
    queryKey: ["graph", runId],
    enabled: runId != null,
    queryFn: () => api.getGraph(runId!),
  });

  if (graphQuery.data) {
    return graphResponseToReactFlow(graphQuery.data);
  }

  // Fallback: synthetic layout from middleNodes (demo data).
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

function graphResponseToReactFlow(graph: GraphResponse): {
  nodes: Node[];
  edges: Edge[];
} {
  // Layout: arrange channel nodes by pagerank in a circular pattern, with
  // (start) on the left and conversion/non-conversion outcomes on the right.
  const channelNodes = graph.nodes
    .filter((n) => n.type === "channel")
    .sort((a, b) => (b.pagerank ?? 0) - (a.pagerank ?? 0))
    .slice(0, 20);

  const nodes: Node[] = [];

  const startNode = graph.nodes.find((n) => n.type === "start");
  if (startNode) {
    nodes.push({
      id: startNode.id,
      position: { x: 40, y: 320 },
      data: { label: startNode.label },
    });
  }

  // Channel nodes in two columns by pagerank rank.
  const COL_X = [320, 560, 800];
  const ROW_HEIGHT = 80;
  channelNodes.forEach((n, idx) => {
    const col = Math.floor(idx / 7);
    const row = idx % 7;
    nodes.push({
      id: n.id,
      position: { x: COL_X[col] ?? 800, y: 40 + row * ROW_HEIGHT },
      data: { label: n.label },
    });
  });

  const conversionNode = graph.nodes.find((n) => n.type === "conversion");
  const nonConversionNode = graph.nodes.find((n) => n.type === "non_conversion");
  if (conversionNode) {
    nodes.push({
      id: conversionNode.id,
      position: { x: 1080, y: 220 },
      data: { label: conversionNode.label },
    });
  }
  if (nonConversionNode) {
    nodes.push({
      id: nonConversionNode.id,
      position: { x: 1080, y: 420 },
      data: { label: nonConversionNode.label },
    });
  }

  // Edges: only include the top 60 by count to keep the graph readable.
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = graph.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .sort((a, b) => b.count - a.count)
    .slice(0, 60)
    .map((e, idx) => ({
      id: `e-${idx}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      animated: e.is_self_loop,
    }));

  return { nodes, edges };
}
