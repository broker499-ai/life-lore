export type MapNodeKind = 'city' | 'poi' | 'special';

export type MapNode = {
  id: string;
  nameKey: string;
  descriptionKey?: string;
  kind: MapNodeKind;
  x: number;
  y: number;
  isCentral?: boolean;
};

export type MapEdge = {
  from: string;
  to: string;
};

export type MapGraph = {
  nodes: MapNode[];
  edges: MapEdge[];
};

export function hasMapNode(graph: MapGraph, nodeId: string): boolean {
  return graph.nodes.some((node) => node.id === nodeId);
}

export function getNeighborNodeIds(graph: MapGraph, nodeId: string): string[] {
  const neighbors = new Set<string>();

  for (const edge of graph.edges) {
    if (edge.from === nodeId) neighbors.add(edge.to);
    if (edge.to === nodeId) neighbors.add(edge.from);
  }

  return [...neighbors];
}

export function areNodesAdjacent(graph: MapGraph, nodeAId: string, nodeBId: string): boolean {
  return getNeighborNodeIds(graph, nodeAId).includes(nodeBId);
}

export function getShortestPathDistance(
  graph: MapGraph,
  fromNodeId: string,
  toNodeId: string,
): number | null {
  if (!hasMapNode(graph, fromNodeId) || !hasMapNode(graph, toNodeId)) return null;
  if (fromNodeId === toNodeId) return 0;

  const visited = new Set<string>([fromNodeId]);
  let frontier = [fromNodeId];
  let distance = 0;

  while (frontier.length > 0) {
    distance += 1;
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const neighborId of getNeighborNodeIds(graph, nodeId)) {
        if (visited.has(neighborId)) continue;
        if (neighborId === toNodeId) return distance;
        visited.add(neighborId);
        next.push(neighborId);
      }
    }
    frontier = next;
  }

  return null;
}

export function getCentralNodeId(graph: MapGraph): string | null {
  return graph.nodes.find((node) => node.isCentral)?.id ?? null;
}
