import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { BattlePlan, BattleResult, BattleRules, BattleTacticId } from '@/core/battles/BattleTypes';
import { simulateBattle } from '@/core/battles/simulateBattle';
import { hasUnlimitedStrategicActions, shouldSpendStrategicAction } from '@/core/dev/developerMode';
import {
  factionIgnoresMorale,
  factionUsesCenterOnlyFormation,
  getBattleMoraleLossTakenMultiplier,
  getBattleUnitPowerMultiplier,
  getEffectiveMorale,
  getIncomingCasualtyMultiplier,
  getMoraleDamageInflictedMultiplier,
  getRandomBattleMoraleGain,
} from '@/core/leaders/LeaderAbility';
import type { ArmyId, CityId, GameState } from '@/core/state/GameState';
import { getTyranidClutchBattleRoster, getTyranidEggClutchStatus } from '@/core/cities/tyranidEggClutch';
import { applySpecialUnitVictoryProgress, getSpecialUnitTypePowerMultipliers } from '@/core/armies/specialUnits';
import { getArmyFlankRosters, reconcileArmyGroupsToRoster } from '@/core/armies/armyFlanks';

export type ClearTyranidEggClutchError =
  | 'army_not_found'
  | 'city_not_found'
  | 'not_in_city'
  | 'city_not_controlled'
  | 'no_egg_clutch'
  | 'deadline_expired'
  | 'strategic_action_spent'
  | 'army_empty';

export type ClearTyranidEggClutchInput = {
  armyId: ArmyId;
  cityId: CityId;
  tactic: BattleTacticId;
  battlePlan?: Partial<BattlePlan>;
};

export type ClearTyranidEggClutchDependencies = {
  unitDefinitions: UnitDefinitions;
  battleRules: BattleRules;
};

export type ClearTyranidEggClutchAvailability =
  | { canClear: true }
  | { canClear: false; reason: ClearTyranidEggClutchError };

export function getClearTyranidEggClutchAvailability(
  state: GameState,
  input: Pick<ClearTyranidEggClutchInput, 'armyId' | 'cityId'>,
): ClearTyranidEggClutchAvailability {
  const army = state.armies[input.armyId];
  if (!army) return { canClear: false, reason: 'army_not_found' };
  const city = state.cities[input.cityId];
  if (!city) return { canClear: false, reason: 'city_not_found' };
  if (army.nodeId !== city.id) return { canClear: false, reason: 'not_in_city' };
  if (city.ownerFactionId !== army.factionId || army.factionId !== state.playerFactionId) return { canClear: false, reason: 'city_not_controlled' };
  const status = getTyranidEggClutchStatus(state, city.id);
  if (!status) return { canClear: false, reason: 'no_egg_clutch' };
  if (!status.canClear) return { canClear: false, reason: 'deadline_expired' };
  const faction = state.factions[army.factionId];
  if (!faction) return { canClear: false, reason: 'army_not_found' };
  if (faction.strategicActionSpent && !hasUnlimitedStrategicActions(state, faction.id)) return { canClear: false, reason: 'strategic_action_spent' };
  if (getRosterTotalUnits(army.roster) <= 0) return { canClear: false, reason: 'army_empty' };
  return { canClear: true };
}

export type ClearTyranidEggClutchOutcome =
  | { ok: true; state: GameState; battle: BattleResult; cleared: boolean }
  | { ok: false; state: GameState; error: ClearTyranidEggClutchError };

export function clearTyranidEggClutch(
  state: GameState,
  input: ClearTyranidEggClutchInput,
  dependencies: ClearTyranidEggClutchDependencies,
): ClearTyranidEggClutchOutcome {
  const army = state.armies[input.armyId];
  if (!army) return fail(state, 'army_not_found');
  const city = state.cities[input.cityId];
  if (!city) return fail(state, 'city_not_found');
  if (army.nodeId !== city.id) return fail(state, 'not_in_city');
  if (city.ownerFactionId !== army.factionId || army.factionId !== state.playerFactionId) return fail(state, 'city_not_controlled');
  const status = getTyranidEggClutchStatus(state, city.id);
  if (!status) return fail(state, 'no_egg_clutch');
  if (!status.canClear) return fail(state, 'deadline_expired');
  const faction = state.factions[army.factionId];
  if (!faction) return fail(state, 'army_not_found');
  if (faction.strategicActionSpent && !hasUnlimitedStrategicActions(state, faction.id)) return fail(state, 'strategic_action_spent');
  if (getRosterTotalUnits(army.roster) <= 0) return fail(state, 'army_empty');
  const clutchBattle = getTyranidClutchBattleRoster(state, city.id);
  if (!clutchBattle) return fail(state, 'no_egg_clutch');

  const battle = simulateBattle(
    {
      battleId: `egg-clutch-${city.id}-turn-${state.turn}-rng-${state.rng.battles.cursor}`,
      scale: 'skirmish',
      sideA: {
        factionId: army.factionId,
        roster: army.roster,
        laneRosters: getArmyFlankRosters(army),
        morale: getEffectiveMorale(state, army.factionId, army.morale),
        moraleLockedAt: factionIgnoresMorale(state, army.factionId) ? 100 : undefined,
        tactic: input.tactic,
        plan: input.battlePlan,
        autoRestVictoriousLanes: true,
        moraleDamageInflictedMultiplier: getMoraleDamageInflictedMultiplier(state, army.factionId),
        moraleLossTakenMultiplier: getBattleMoraleLossTakenMultiplier(state, army.factionId),
        casualtyTakenMultiplier: getIncomingCasualtyMultiplier(state, army.factionId, 'balanced'),
        unitPowerMultiplier: getBattleUnitPowerMultiplier(state, army.factionId),
        randomMoraleGain: getRandomBattleMoraleGain(state, army.factionId) ?? undefined,
        centerOnlyFormation: factionUsesCenterOnlyFormation(state, army.factionId),
        unitTypePowerMultipliers: getSpecialUnitTypePowerMultipliers(state, army.factionId, army.roster),
      },
      sideB: {
        factionId: status.tyranidFactionId,
        roster: clutchBattle.roster,
        morale: clutchBattle.morale,
        tactic: 'balanced',
        randomizeFlanks: true,
        reactiveLanePostures: true,
        plan: { formation: 'crescent', reservePercent: 0, reserveTarget: 'center', commands: [], retreatMoraleThreshold: null },
        moraleDamageInflictedMultiplier: getMoraleDamageInflictedMultiplier(state, status.tyranidFactionId),
        moraleLossTakenMultiplier: getBattleMoraleLossTakenMultiplier(state, status.tyranidFactionId),
        casualtyTakenMultiplier: getIncomingCasualtyMultiplier(state, status.tyranidFactionId, input.tactic),
        unitPowerMultiplier: getBattleUnitPowerMultiplier(state, status.tyranidFactionId),
        centerOnlyFormation: factionUsesCenterOnlyFormation(state, status.tyranidFactionId),
      },
    },
    state.rng.battles,
    dependencies.unitDefinitions,
    dependencies.battleRules,
  );

  const attacker = battle.sides.A;
  const cleared = battle.winnerSide === 'A';
  const clutches = { ...state.campaign.tyranidEggClutches };
  if (cleared) delete clutches[city.id];
  let nextState: GameState = {
    ...state,
    rng: { ...state.rng, battles: battle.rngState },
    factions: {
      ...state.factions,
      [faction.id]: {
        ...faction,
        strategicActionSpent: shouldSpendStrategicAction(state, faction.id),
        lastStrategicAction: 'attack',
      },
    },
    armies: {
      ...state.armies,
      [army.id]: {
        ...reconcileArmyGroupsToRoster(army, attacker.remainingRoster, dependencies.unitDefinitions),
        morale: getEffectiveMorale(state, army.factionId, attacker.moraleAfter),
      },
    },
    campaign: { ...state.campaign, tyranidEggClutches: clutches },
  };
  nextState = applySpecialUnitVictoryProgress(nextState, army.factionId, battle.winnerFactionId, attacker.remainingRoster);
  return { ok: true, state: nextState, battle, cleared };
}

function fail(state: GameState, error: ClearTyranidEggClutchError) {
  return { ok: false as const, state, error };
}
