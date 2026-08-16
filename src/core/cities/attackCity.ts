import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type { CityDefinitions } from '@/core/cities/CityDefinition';
import { getCityDefenderUnitPowerMultiplier } from '@/core/cities/cityTraits';
import { areFactionsAllied, areFactionsHostile } from '@/core/factions/factionRelations';
import {
  getBattleMoraleLossTakenMultiplier,
  getBattleUnitPowerMultiplier,
  getCapturedCityIncomeMultiplier,
  getFactionDefeatReaction,
  getIncomingCasualtyMultiplier,
  getMoraleDamageInflictedMultiplier,
  getRandomBattleMoraleGain,
  getSupplyActionCostMultiplier,
} from '@/core/leaders/LeaderAbility';
import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type {
  BattleResult,
  BattleRules,
  BattleScale,
  BattleTacticId,
} from '@/core/battles/BattleTypes';
import { simulateBattle } from '@/core/battles/simulateBattle';
import {
  areNodesAdjacent,
  getShortestPathDistance,
  type MapGraph,
} from '@/core/map/MapGraph';
import { synchronizePlayerMapKnowledge } from '@/core/map/MapVisibility';
import type { ArmyId, ArmyState, CityId, GameState } from '@/core/state/GameState';
import { getSupplyAdjustedActionCost, getSupplyStatus, type SupplyStatus } from '@/core/supply/Supply';

export type AttackCityError =
  | 'army_not_found'
  | 'city_not_found'
  | 'not_adjacent'
  | 'already_controlled'
  | 'allied_city'
  | 'strategic_action_spent'
  | 'insufficient_supplies'
  | 'army_empty';

export type AttackCityInput = {
  armyId: ArmyId;
  cityId: CityId;
  tactic: BattleTacticId;
  supplyCost: number;
};

export type AttackCityDependencies = {
  unitDefinitions: UnitDefinitions;
  battleRules: BattleRules;
  cityDefinitions: CityDefinitions;
};

export type AttackCityAvailability =
  | { canAttack: true; scale: BattleScale; defenderUnits: number; supplyCost: number; supplyStatus: SupplyStatus }
  | { canAttack: false; reason: AttackCityError };

export type AttackCitySuccess = {
  ok: true;
  state: GameState;
  battle: BattleResult | null;
  captured: boolean;
  events: Array<
    | { type: 'battle_fought'; battleId: string; winnerFactionId: string | null }
    | { type: 'city_captured'; cityId: string; factionId: string }
    | { type: 'army_retreated'; armyId: string; fromNodeId: string; toNodeId: string | null }
    | { type: 'faction_defeat_event_triggered'; eventId: string; factionId: string; beneficiaryFactionId: string }
  >;
};

export type AttackCityOutcome =
  | AttackCitySuccess
  | { ok: false; state: GameState; error: AttackCityError };

const LARGE_BATTLE_THRESHOLD = 60;
const NEUTRAL_DEFENDER_FACTION_ID = 'orssia-neutral';

export function getAttackCityAvailability(
  state: GameState,
  graph: MapGraph,
  input: AttackCityInput,
): AttackCityAvailability {
  const army = state.armies[input.armyId];
  if (!army) return { canAttack: false, reason: 'army_not_found' };

  const city = state.cities[input.cityId];
  if (!city) return { canAttack: false, reason: 'city_not_found' };
  if (!areNodesAdjacent(graph, army.nodeId, city.id)) {
    return { canAttack: false, reason: 'not_adjacent' };
  }
  if (city.ownerFactionId === army.factionId) {
    return { canAttack: false, reason: 'already_controlled' };
  }
  if (areFactionsAllied(state, city.ownerFactionId, army.factionId)) {
    return { canAttack: false, reason: 'allied_city' };
  }
  if (!Number.isFinite(input.supplyCost) || input.supplyCost < 0) {
    throw new Error('Attack supply cost must be a finite non-negative number');
  }

  const faction = state.factions[army.factionId];
  if (!faction) throw new Error(`Army ${army.id} references missing faction ${army.factionId}`);
  if (faction.strategicActionSpent) {
    return { canAttack: false, reason: 'strategic_action_spent' };
  }
  const supplyStatus = getSupplyStatus(state, graph, army.factionId, army.nodeId);
  const supplyCost = Math.max(0, Math.round(
    getSupplyAdjustedActionCost(input.supplyCost, supplyStatus) *
      getSupplyActionCostMultiplier(state, army.factionId),
  ));
  if (faction.resources.supplies < supplyCost) {
    return { canAttack: false, reason: 'insufficient_supplies' };
  }

  const attackerUnits = getRosterTotalUnits(army.roster);
  if (attackerUnits <= 0) return { canAttack: false, reason: 'army_empty' };
  const defendingArmy = findDefendingArmy(state, city.id, army.factionId);
  const defenderUnits = defendingArmy
    ? getRosterTotalUnits(defendingArmy.roster)
    : getRosterTotalUnits(city.garrison.roster);

  return {
    canAttack: true,
    scale: chooseBattleScale(attackerUnits + defenderUnits),
    defenderUnits,
    supplyCost,
    supplyStatus,
  };
}

export function attackCity(
  state: GameState,
  graph: MapGraph,
  input: AttackCityInput,
  dependencies: AttackCityDependencies,
): AttackCityOutcome {
  const availability = getAttackCityAvailability(state, graph, input);
  if (!availability.canAttack) return { ok: false, state, error: availability.reason };

  const army = state.armies[input.armyId];
  const city = state.cities[input.cityId];
  if (!army || !city) throw new Error('Attack target disappeared after availability check');
  const faction = state.factions[army.factionId];
  if (!faction) throw new Error(`Missing faction ${army.factionId}`);
  const defendingArmy = findDefendingArmy(state, city.id, army.factionId);

  const stateWithCost: GameState = {
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
        lastStrategicAction: 'attack',
      },
    },
  };

  if (availability.defenderUnits === 0) {
    return {
      ok: true,
      state: synchronizePlayerMapKnowledge(
        captureCityWithoutBattle(stateWithCost, input.armyId, input.cityId),
        graph,
      ),
      battle: null,
      captured: true,
      events: [{ type: 'city_captured', cityId: city.id, factionId: army.factionId }],
    };
  }

  const battleId = `city-${city.id}-turn-${state.turn}-rng-${state.rng.battles.cursor}`;
  const defenderFactionId =
    defendingArmy?.factionId ?? city.ownerFactionId ?? NEUTRAL_DEFENDER_FACTION_ID;
  const defenderRoster = defendingArmy?.roster ?? city.garrison.roster;
  const defenderMorale = defendingArmy?.morale ?? city.garrison.morale;
  const battle = simulateBattle(
    {
      battleId,
      scale: availability.scale,
      sideA: {
        factionId: army.factionId,
        roster: army.roster,
        morale: army.morale,
        tactic: input.tactic,
        moraleDamageInflictedMultiplier: getMoraleDamageInflictedMultiplier(state, army.factionId),
        moraleLossTakenMultiplier: getBattleMoraleLossTakenMultiplier(state, army.factionId),
        casualtyTakenMultiplier: getIncomingCasualtyMultiplier(state, army.factionId, 'cautious'),
        unitPowerMultiplier: getBattleUnitPowerMultiplier(state, army.factionId),
        randomMoraleGain: getRandomBattleMoraleGain(state, army.factionId) ?? undefined,
      },
      sideB: {
        factionId: defenderFactionId,
        roster: defenderRoster,
        morale: defenderMorale,
        tactic: 'cautious',
        moraleDamageInflictedMultiplier: getMoraleDamageInflictedMultiplier(state, defenderFactionId),
        moraleLossTakenMultiplier: getBattleMoraleLossTakenMultiplier(state, defenderFactionId),
        casualtyTakenMultiplier: getIncomingCasualtyMultiplier(state, defenderFactionId, input.tactic),
        unitPowerMultiplier:
          getBattleUnitPowerMultiplier(state, defenderFactionId) *
          getCityDefenderUnitPowerMultiplier(dependencies.cityDefinitions[city.id]),
        randomMoraleGain: getRandomBattleMoraleGain(state, defenderFactionId) ?? undefined,
      },
    },
    state.rng.battles,
    dependencies.unitDefinitions,
    dependencies.battleRules,
  );

  const attackerResult = battle.sides.A;
  const defenderResult = battle.sides.B;
  const attackerWon = battle.winnerSide === 'A';
  const nextArmies = { ...state.armies };

  nextArmies[army.id] = {
    ...army,
    roster: attackerResult.remainingRoster,
    morale: attackerResult.moraleAfter,
    nodeId: attackerWon ? city.id : army.nodeId,
  };

  let defenderRetreatNodeId: string | null = null;
  if (defendingArmy) {
    if (attackerWon) {
      defenderRetreatNodeId = findNearestControlledCity(
        state,
        graph,
        defendingArmy.factionId,
        city.id,
      );
      if (defenderRetreatNodeId) {
        nextArmies[defendingArmy.id] = {
          ...defendingArmy,
          roster: defenderResult.remainingRoster,
          morale: defenderResult.moraleAfter,
          nodeId: defenderRetreatNodeId,
        };
      } else {
        delete nextArmies[defendingArmy.id];
      }
    } else {
      nextArmies[defendingArmy.id] = {
        ...defendingArmy,
        roster: defenderResult.remainingRoster,
        morale: defenderResult.moraleAfter,
      };
    }
  }

  const nextState: GameState = {
    ...stateWithCost,
    rng: {
      ...state.rng,
      battles: battle.rngState,
    },
    armies: nextArmies,
    cities: {
      ...state.cities,
      [city.id]: attackerWon
        ? {
            ...city,
            ownerFactionId: army.factionId,
            garrison: { roster: {}, morale: 0 },
            incomeMultiplier: Math.min(
              city.incomeMultiplier ?? 1,
              getCapturedCityIncomeMultiplier(state, city.ownerFactionId ?? NEUTRAL_DEFENDER_FACTION_ID),
            ),
          }
        : defendingArmy
          ? city
          : {
              ...city,
              garrison: {
                roster: defenderResult.remainingRoster,
                morale: defenderResult.moraleAfter,
              },
            },
    },
  };

  const events: AttackCitySuccess['events'] = [
    { type: 'battle_fought', battleId, winnerFactionId: battle.winnerFactionId },
  ];
  if (attackerWon && defendingArmy) {
    events.push({
      type: 'army_retreated',
      armyId: defendingArmy.id,
      fromNodeId: city.id,
      toNodeId: defenderRetreatNodeId,
    });
  }
  if (attackerWon) {
    events.push({ type: 'city_captured', cityId: city.id, factionId: army.factionId });
  }

  const reaction = attackerWon
    ? queueFactionDefeatReaction(nextState, defenderFactionId, army.factionId)
    : battle.winnerSide === 'B'
      ? queueFactionDefeatReaction(nextState, army.factionId, defenderFactionId)
      : { state: nextState, event: null };
  if (reaction.event) events.push(reaction.event);

  return {
    ok: true,
    state: synchronizePlayerMapKnowledge(reaction.state, graph),
    battle,
    captured: attackerWon,
    events,
  };
}

function queueFactionDefeatReaction(
  state: GameState,
  defeatedFactionId: string,
  beneficiaryFactionId: string,
): {
  state: GameState;
  event: { type: 'faction_defeat_event_triggered'; eventId: string; factionId: string; beneficiaryFactionId: string } | null;
} {
  const trait = getFactionDefeatReaction(state, defeatedFactionId);
  if (!trait) return { state, event: null };
  if (trait.triggerOpponent === 'player' && beneficiaryFactionId !== state.playerFactionId) {
    return { state, event: null };
  }
  if (state.campaign.pendingFactionEvent || state.campaign.resolvedFactionEventIds.includes(trait.eventId)) {
    return { state, event: null };
  }

  const pendingFactionEvent = {
    eventId: trait.eventId,
    factionId: defeatedFactionId,
    beneficiaryFactionId,
  };
  return {
    state: {
      ...state,
      campaign: { ...state.campaign, pendingFactionEvent },
    },
    event: { type: 'faction_defeat_event_triggered', ...pendingFactionEvent },
  };
}

export function chooseBattleScale(totalUnits: number): BattleScale {
  return totalUnits < LARGE_BATTLE_THRESHOLD ? 'skirmish' : 'battle';
}

function captureCityWithoutBattle(state: GameState, armyId: ArmyId, cityId: CityId): GameState {
  const army = state.armies[armyId];
  const city = state.cities[cityId];
  if (!army || !city) throw new Error('Cannot capture missing city or army');

  return {
    ...state,
    armies: {
      ...state.armies,
      [armyId]: { ...army, nodeId: cityId },
    },
    cities: {
      ...state.cities,
      [cityId]: {
        ...city,
        ownerFactionId: army.factionId,
        garrison: { roster: {}, morale: 0 },
        incomeMultiplier: Math.min(city.incomeMultiplier ?? 1, getCapturedCityIncomeMultiplier(state, city.ownerFactionId ?? NEUTRAL_DEFENDER_FACTION_ID)),
      },
    },
  };
}

function findDefendingArmy(
  state: GameState,
  cityId: CityId,
  attackerFactionId: string,
): ArmyState | null {
  return (
    Object.values(state.armies).find(
      (candidate) =>
        candidate.nodeId === cityId &&
        areFactionsHostile(state, candidate.factionId, attackerFactionId) &&
        getRosterTotalUnits(candidate.roster) > 0,
    ) ?? null
  );
}

function findNearestControlledCity(
  state: GameState,
  graph: MapGraph,
  factionId: string,
  excludeCityId: string,
): string | null {
  const candidates = Object.values(state.cities)
    .filter((candidate) =>
      areFactionsAllied(state, candidate.ownerFactionId, factionId) && candidate.id !== excludeCityId
    )
    .map((candidate) => ({
      id: candidate.id,
      distance: getShortestPathDistance(graph, excludeCityId, candidate.id),
    }))
    .filter((candidate): candidate is { id: string; distance: number } => candidate.distance !== null)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));

  return candidates[0]?.id ?? null;
}
