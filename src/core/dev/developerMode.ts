import type { FactionId, GameState } from '@/core/state/GameState';
import type { MapGraph } from '@/core/map/MapGraph';

export function hasUnlimitedStrategicActions(state: GameState, factionId: FactionId): boolean {
  return state.campaign.developerMode && factionId === state.playerFactionId;
}

export function hasUnlimitedMoney(state: GameState, factionId: FactionId): boolean {
  return state.campaign.developerMode && factionId === state.playerFactionId;
}

export function hasUnlimitedRecruitment(state: GameState, factionId: FactionId): boolean {
  return state.campaign.developerMode && factionId === state.playerFactionId;
}

export function hasFullDeveloperMapVision(state: GameState, factionId: FactionId): boolean {
  return state.campaign.developerMode && factionId === state.playerFactionId;
}

export function shouldSpendStrategicAction(state: GameState, factionId: FactionId): boolean {
  return !hasUnlimitedStrategicActions(state, factionId);
}

export type DeveloperTeleportError = 'developer_mode_disabled' | 'army_not_found' | 'node_not_found';

export function developerTeleportArmy(
  state: GameState,
  graph: MapGraph,
  input: { armyId: string; toNodeId: string },
): { ok: true; state: GameState } | { ok: false; state: GameState; error: DeveloperTeleportError } {
  if (!state.campaign.developerMode) return { ok: false, state, error: 'developer_mode_disabled' };
  const army = state.armies[input.armyId];
  if (!army || army.factionId !== state.playerFactionId) return { ok: false, state, error: 'army_not_found' };
  if (!graph.nodes.some((node) => node.id === input.toNodeId)) return { ok: false, state, error: 'node_not_found' };

  return {
    ok: true,
    state: {
      ...state,
      armies: {
        ...state.armies,
        [army.id]: { ...army, nodeId: input.toNodeId },
      },
      campaign: {
        ...state.campaign,
        discoveredNodeIds: state.campaign.discoveredNodeIds.includes(input.toNodeId)
          ? state.campaign.discoveredNodeIds
          : [...state.campaign.discoveredNodeIds, input.toNodeId],
      },
    },
  };
}
