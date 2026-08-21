import { factionIgnoresMorale } from '@/core/leaders/LeaderAbility';
import type { MapGraph } from '@/core/map/MapGraph';
import type { ArmyId, GameState, NodeId } from '@/core/state/GameState';

export const POI_SHORT_REST_SUPPLIES = 8;
export const POI_SHORT_REST_MORALE = 4;

export type ShortRestAtPoiError =
  | 'army_not_found'
  | 'node_not_found'
  | 'not_at_node'
  | 'not_poi'
  | 'already_used';

export type ShortRestAtPoiAvailability =
  | { canRest: true; suppliesRestore: number; moraleRestore: number }
  | { canRest: false; reason: ShortRestAtPoiError };

export function getShortRestAtPoiAvailability(
  state: GameState,
  graph: MapGraph,
  input: { armyId: ArmyId; nodeId: NodeId },
): ShortRestAtPoiAvailability {
  const army = state.armies[input.armyId];
  if (!army) return { canRest: false, reason: 'army_not_found' };
  const node = graph.nodes.find((candidate) => candidate.id === input.nodeId);
  if (!node) return { canRest: false, reason: 'node_not_found' };
  if (army.nodeId !== node.id) return { canRest: false, reason: 'not_at_node' };
  if (node.kind !== 'poi') return { canRest: false, reason: 'not_poi' };
  if (state.campaign.shortRestUsedNodeIds.includes(node.id)) {
    return { canRest: false, reason: 'already_used' };
  }
  return { canRest: true, suppliesRestore: POI_SHORT_REST_SUPPLIES, moraleRestore: POI_SHORT_REST_MORALE };
}

export function shortRestAtPoi(
  state: GameState,
  graph: MapGraph,
  input: { armyId: ArmyId; nodeId: NodeId; supplyCap: number; moraleCap: number },
): { ok: true; state: GameState; suppliesRestored: number; moraleRestored: number } | { ok: false; state: GameState; error: ShortRestAtPoiError } {
  const availability = getShortRestAtPoiAvailability(state, graph, input);
  if (!availability.canRest) return { ok: false, state, error: availability.reason };
  const army = state.armies[input.armyId];
  if (!army) return { ok: false, state, error: 'army_not_found' };
  const faction = state.factions[army.factionId];
  if (!faction) return { ok: false, state, error: 'army_not_found' };

  const nextSupplies = Math.min(input.supplyCap, faction.resources.supplies + availability.suppliesRestore);
  const nextMorale = factionIgnoresMorale(state, faction.id)
    ? 100
    : Math.min(input.moraleCap, army.morale + availability.moraleRestore);
  const suppliesRestored = nextSupplies - faction.resources.supplies;
  const moraleRestored = nextMorale - army.morale;

  return {
    ok: true,
    state: {
      ...state,
      factions: {
        ...state.factions,
        [faction.id]: {
          ...faction,
          resources: { ...faction.resources, supplies: nextSupplies },
        },
      },
      armies: {
        ...state.armies,
        [army.id]: { ...army, morale: nextMorale },
      },
      campaign: {
        ...state.campaign,
        shortRestUsedNodeIds: [...state.campaign.shortRestUsedNodeIds, input.nodeId],
      },
    },
    suppliesRestored,
    moraleRestored,
  };
}
