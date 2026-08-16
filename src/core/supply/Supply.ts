import { areFactionsAllied } from '@/core/factions/factionRelations';
import { factionIgnoresSupply } from '@/core/leaders/LeaderAbility';
import { getNeighborNodeIds, type MapGraph } from '@/core/map/MapGraph';
import type { FactionId, GameState, NodeId } from '@/core/state/GameState';

export type SupplyLevel = 'ignored' | 'secured' | 'connected' | 'stretched' | 'strained' | 'cut_off';

export type SupplyStatus = {
  factionId: FactionId;
  nodeId: NodeId;
  level: SupplyLevel;
  percent: number;
  distance: number | null;
  nearestCityId: string | null;
  path: string[];
  actionCostMultiplier: number;
  moralePressure: number;
};

const SUPPLY_BANDS = [
  { maxDistance: 0, level: 'secured', percent: 100, actionCostMultiplier: 1, moralePressure: 0 },
  { maxDistance: 1, level: 'connected', percent: 85, actionCostMultiplier: 1, moralePressure: 0 },
  { maxDistance: 2, level: 'stretched', percent: 65, actionCostMultiplier: 1.25, moralePressure: 2 },
  { maxDistance: 3, level: 'strained', percent: 40, actionCostMultiplier: 1.5, moralePressure: 5 },
] as const;

export function getSupplyStatus(
  state: GameState,
  graph: MapGraph,
  factionId: FactionId,
  nodeId: NodeId,
): SupplyStatus {
  if (factionIgnoresSupply(state, factionId)) {
    return {
      factionId,
      nodeId,
      level: 'ignored',
      percent: 100,
      distance: null,
      nearestCityId: null,
      path: [],
      actionCostMultiplier: 0,
      moralePressure: 0,
    };
  }

  const route = findNearestSupplyRoute(state, graph, factionId, nodeId);
  if (!route) {
    return {
      factionId,
      nodeId,
      level: 'cut_off',
      percent: 10,
      distance: null,
      nearestCityId: null,
      path: [],
      actionCostMultiplier: 2,
      moralePressure: 8,
    };
  }

  const distance = Math.max(0, route.path.length - 1);
  const band = SUPPLY_BANDS.find((candidate) => distance <= candidate.maxDistance);
  if (band) {
    return {
      factionId,
      nodeId,
      level: band.level,
      percent: band.percent,
      distance,
      nearestCityId: route.cityId,
      path: route.path,
      actionCostMultiplier: band.actionCostMultiplier,
      moralePressure: band.moralePressure,
    };
  }

  return {
    factionId,
    nodeId,
    level: 'cut_off',
    percent: 20,
    distance,
    nearestCityId: route.cityId,
    path: route.path,
    actionCostMultiplier: 1.75,
    moralePressure: 8,
  };
}

export function getSupplyAdjustedActionCost(baseCost: number, status: SupplyStatus): number {
  if (!Number.isFinite(baseCost) || baseCost < 0) {
    throw new Error('Base supply cost must be a finite non-negative number');
  }
  return Math.ceil(baseCost * status.actionCostMultiplier);
}

export function getProjectedMoveSupplyStatus(
  state: GameState,
  graph: MapGraph,
  factionId: FactionId,
  destinationNodeId: NodeId,
): SupplyStatus {
  return getSupplyStatus(state, graph, factionId, destinationNodeId);
}

function findNearestSupplyRoute(
  state: GameState,
  graph: MapGraph,
  factionId: FactionId,
  startNodeId: NodeId,
): { cityId: string; path: string[] } | null {
  const ownedCityIds = new Set(
    Object.values(state.cities)
      .filter((city) => areFactionsAllied(state, city.ownerFactionId, factionId))
      .map((city) => city.id),
  );
  if (ownedCityIds.size === 0) return null;
  if (ownedCityIds.has(startNodeId)) return { cityId: startNodeId, path: [startNodeId] };

  const visited = new Set<string>([startNodeId]);
  const queue: Array<{ nodeId: string; path: string[] }> = [{ nodeId: startNodeId, path: [startNodeId] }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    for (const neighborId of getNeighborNodeIds(graph, current.nodeId).sort()) {
      if (visited.has(neighborId)) continue;
      if (!canSupplyTraverseNode(state, factionId, neighborId)) continue;

      const path = [...current.path, neighborId];
      if (ownedCityIds.has(neighborId)) return { cityId: neighborId, path };
      visited.add(neighborId);
      queue.push({ nodeId: neighborId, path });
    }
  }

  return null;
}

function canSupplyTraverseNode(state: GameState, factionId: FactionId, nodeId: NodeId): boolean {
  const city = state.cities[nodeId];
  if (!city) return true;
  return areFactionsAllied(state, city.ownerFactionId, factionId);
}
