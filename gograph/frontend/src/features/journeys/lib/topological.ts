import type { Edge, Node } from "@xyflow/react";

// Kahn's topological sort over xyflow nodes/edges. Returns ids in a
// deterministic order so a free-form path on the canvas can be flattened
// into a linear `path_channels` list before persisting via the API.
//
// Lifted from the legacy SandboxView so behavior matches the original
// scenario submit flow.
export function topologicalOrder<T extends { id: string }>(
  nodes: Node<T>[],
  edges: Edge[],
): string[] {
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
  const queue = nodes
    .filter((n) => (inDeg.get(n.id) ?? 0) === 0)
    .map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift();
    if (id == null) break;
    order.push(id);
    (adj.get(id) ?? []).forEach((next) => {
      const d = (inDeg.get(next) ?? 1) - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    });
  }
  return order;
}
