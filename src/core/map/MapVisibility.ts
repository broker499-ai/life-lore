import { factionKnowsFullMap, getMapVisionRadiusBonus } from '@/core/leaders/LeaderAbility';
import { getNeighborNodeIds, type MapGraph } from '@/core/map/MapGraph';
import type { FactionId, GameState, NodeId } from '@/core/state/GameState';

export type MapNodeVisibility = 'unknown' | 'explored' | 'visible';

export function getCurrentVisibleNodeIds(
  state: GameState,
  graph: MapGraph,
  factionId: FactionId,
): NodeId[] {
  if (factionKnowsFullMap(state, factionId)) {
    return graph.nodes.map((node) => node.id);
  }

  const visible = new Set<NodeId>();

  for (const army of Object.values(state.armies)) {
    if (army.factionId !== factionId) continue;
    revealWithinRadius(visible, graph, army.nodeId, 1 + getMapVisionRadiusBonus(state, factionId));
  }

  for (const city of Object.values(state.cities)) {
    if (city.ownerFactionId === factionId) visible.add(city.id);
  }

  return graph.nodes.map((node) => node.id).filter((nodeId) => visible.has(nodeId));
}

export function getDiscoveredNodeIds(
  state: GameState,
  graph: MapGraph,
  factionId: FactionId,
): NodeId[] {
  if (factionKnowsFullMap(state, factionId)) {
    return graph.nodes.map((node) => node.id);
  }

  const discovered = new Set<NodeId>(
    factionId === state.playerFactionId ? state.campaign.discoveredNodeIds : [],
  );
  for (const nodeId of getCurrentVisibleNodeIds(state, graph, factionId)) discovered.add(nodeId);

  return graph.nodes.map((node) => node.id).filter((nodeId) => discovered.has(nodeId));
}

export function getMapNodeVisibilityById(
  state: GameState,
  graph: MapGraph,
  factionId: FactionId,
): Record<NodeId, MapNodeVisibility> {
  const visible = new Set(getCurrentVisibleNodeIds(state, graph, factionId));
  const discovered = new Set(getDiscoveredNodeIds(state, graph, factionId));

  return Object.fromEntries(
    graph.nodes.map((node) => [
      node.id,
      visible.has(node.id) ? 'visible' : discovered.has(node.id) ? 'explored' : 'unknown',
    ]),
  );
}

/**
 * Commits what the player can currently observe into persistent campaign memory.
 * It is deliberately player-scoped: AI knowledge is not part of the UI fog-of-war state.
 */
export function synchronizePlayerMapKnowledge(state: GameState, graph: MapGraph): GameState {
  const currentVisible = getCurrentVisibleNodeIds(state, graph, state.playerFactionId);
  const nextDiscovered = new Set<NodeId>(state.campaign.discoveredNodeIds);
  for (const nodeId of currentVisible) nextDiscovered.add(nodeId);

  const ordered = graph.nodes.map((node) => node.id).filter((nodeId) => nextDiscovered.has(nodeId));
  if (
    ordered.length === state.campaign.discoveredNodeIds.length &&
    ordered.every((nodeId, index) => nodeId === state.campaign.discoveredNodeIds[index])
  ) {
    return state;
  }

  return {
    ...state,
    campaign: {
      ...state.campaign,
      discoveredNodeIds: ordered,
    },
  };
}

function revealWithinRadius(target: Set<NodeId>, graph: MapGraph, nodeId: NodeId, radius: number): void {
  const queue: Array<{ nodeId: NodeId; distance: number }> = [{ nodeId, distance: 0 }];
  const visited = new Set<NodeId>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);
    target.add(current.nodeId);
    if (current.distance >= radius) continue;
    for (const neighborId of getNeighborNodeIds(graph, current.nodeId)) {
      queue.push({ nodeId: neighborId, distance: current.distance + 1 });
    }
  }
}
