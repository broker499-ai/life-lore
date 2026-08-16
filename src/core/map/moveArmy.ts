import type { CommandOutcome } from '@/core/commands/CommandResult';
import { areFactionsAllied } from '@/core/factions/factionRelations';
import { canUseRiverDoubleMove, getSupplyActionCostMultiplier } from '@/core/leaders/LeaderAbility';
import { areNodesAdjacent, hasMapNode, type MapGraph } from '@/core/map/MapGraph';
import { synchronizePlayerMapKnowledge } from '@/core/map/MapVisibility';
import type { ArmyId, GameState, NodeId } from '@/core/state/GameState';
import { getProjectedMoveSupplyStatus, getSupplyAdjustedActionCost, type SupplyStatus } from '@/core/supply/Supply';

export type MoveArmyError =
  | 'army_not_found'
  | 'destination_not_found'
  | 'already_there'
  | 'not_adjacent'
  | 'strategic_action_spent'
  | 'insufficient_supplies'
  | 'destination_requires_capture';

export type MoveArmyInput = {
  armyId: ArmyId;
  toNodeId: NodeId;
  supplyCost: number;
};

export type MoveArmyAvailability =
  | { canMove: true; supplyCost: number; supplyStatus: SupplyStatus; usesRiverDoubleMove: boolean }
  | { canMove: false; reason: MoveArmyError };

export function getMoveArmyAvailability(
  state: GameState,
  graph: MapGraph,
  input: MoveArmyInput,
): MoveArmyAvailability {
  const army = state.armies[input.armyId];
  if (!army) return { canMove: false, reason: 'army_not_found' };
  if (!hasMapNode(graph, input.toNodeId)) return { canMove: false, reason: 'destination_not_found' };
  if (army.nodeId === input.toNodeId) return { canMove: false, reason: 'already_there' };
  if (!areNodesAdjacent(graph, army.nodeId, input.toNodeId)) {
    return { canMove: false, reason: 'not_adjacent' };
  }

  const destinationCity = state.cities[input.toNodeId];
  if (
    destinationCity?.ownerFactionId &&
    !areFactionsAllied(state, destinationCity.ownerFactionId, army.factionId)
  ) {
    return { canMove: false, reason: 'destination_requires_capture' };
  }
  if (!Number.isFinite(input.supplyCost) || input.supplyCost < 0) {
    throw new Error('Move supply cost must be a finite non-negative number');
  }

  const faction = state.factions[army.factionId];
  if (!faction) throw new Error(`Army ${army.id} references missing faction ${army.factionId}`);
  const usesRiverDoubleMove = faction.strategicActionSpent && canUseRiverDoubleMove(state, army.factionId);
  if (faction.strategicActionSpent && !usesRiverDoubleMove) {
    return { canMove: false, reason: 'strategic_action_spent' };
  }

  const supplyStatus = getProjectedMoveSupplyStatus(state, graph, army.factionId, input.toNodeId);
  const supplyCost = Math.max(0, Math.round(
    getSupplyAdjustedActionCost(input.supplyCost, supplyStatus) *
      getSupplyActionCostMultiplier(state, army.factionId),
  ));
  if (faction.resources.supplies < supplyCost) {
    return { canMove: false, reason: 'insufficient_supplies' };
  }

  return { canMove: true, supplyCost, supplyStatus, usesRiverDoubleMove };
}

export function moveArmy(
  state: GameState,
  graph: MapGraph,
  input: MoveArmyInput,
): CommandOutcome<
  GameState,
  MoveArmyError,
  {
    type: 'army_moved';
    armyId: string;
    fromNodeId: string;
    toNodeId: string;
    supplyCost: number;
    leaderAbilityId?: 'river_double_move';
  }
> {
  const availability = getMoveArmyAvailability(state, graph, input);
  if (!availability.canMove) return failure(state, availability.reason);

  const army = state.armies[input.armyId];
  if (!army) throw new Error(`Army ${input.armyId} disappeared after availability check`);
  const faction = state.factions[army.factionId];
  if (!faction) throw new Error(`Army ${army.id} references missing faction ${army.factionId}`);

  const fromNodeId = army.nodeId;
  const nextState: GameState = {
    ...state,
    factions: {
      ...state.factions,
      [faction.id]: {
        ...faction,
        resources: {
          ...faction.resources,
          supplies: faction.resources.supplies - availability.supplyCost,
        },
        strategicActionSpent: true,
        lastStrategicAction: 'move',
        leaderAbilityLastUsedTurn: availability.usesRiverDoubleMove
          ? state.turn
          : faction.leaderAbilityLastUsedTurn,
      },
    },
    armies: {
      ...state.armies,
      [army.id]: { ...army, nodeId: input.toNodeId },
    },
  };

  return {
    ok: true,
    state: synchronizePlayerMapKnowledge(nextState, graph),
    events: [
      {
        type: 'army_moved',
        armyId: army.id,
        fromNodeId,
        toNodeId: input.toNodeId,
        supplyCost: availability.supplyCost,
        ...(availability.usesRiverDoubleMove ? { leaderAbilityId: 'river_double_move' as const } : {}),
      },
    ],
  };
}

function failure(state: GameState, error: MoveArmyError) {
  return { ok: false as const, state, error };
}
