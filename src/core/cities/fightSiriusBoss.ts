import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import { applySpecialUnitVictoryProgress, getSpecialUnitTypePowerMultipliers } from '@/core/armies/specialUnits';
import type { BattlePlan, BattleResult, BattleRules, BattleTacticId } from '@/core/battles/BattleTypes';
import { simulateBattle } from '@/core/battles/simulateBattle';
import { hasUnlimitedStrategicActions, shouldSpendStrategicAction } from '@/core/dev/developerMode';
import { factionIgnoresMorale, getEffectiveMorale } from '@/core/leaders/LeaderAbility';
import type { ArmyId, GameState } from '@/core/state/GameState';
import { addArmyGroup, getArmyFlankRosters, reconcileArmyGroupsToRoster } from '@/core/armies/armyFlanks';

export type FightSiriusBossError = 'army_not_found' | 'wrong_city' | 'already_defeated' | 'army_empty' | 'strategic_action_spent';

export function fightSiriusBoss(
  state: GameState,
  input: { armyId: ArmyId; tactic: BattleTacticId; battlePlan?: Partial<BattlePlan> },
  dependencies: { unitDefinitions: UnitDefinitions; battleRules: BattleRules },
): { ok: true; state: GameState; battle: BattleResult; recruited: boolean } | { ok: false; state: GameState; error: FightSiriusBossError } {
  const army = state.armies[input.armyId];
  if (!army) return { ok: false, state, error: 'army_not_found' };
  if (state.campaign.siriusDefeated) return { ok: false, state, error: 'already_defeated' };
  if (army.nodeId !== state.campaign.siriusBossCityId) return { ok: false, state, error: 'wrong_city' };
  if (getRosterTotalUnits(army.roster) <= 0) return { ok: false, state, error: 'army_empty' };
  const faction = state.factions[army.factionId];
  if (!faction) return { ok: false, state, error: 'army_not_found' };
  if (faction.strategicActionSpent && !hasUnlimitedStrategicActions(state, faction.id)) return { ok: false, state, error: 'strategic_action_spent' };

  const battle = simulateBattle(
    {
      battleId: `sirius-${army.nodeId}-turn-${state.turn}-rng-${state.rng.battles.cursor}`,
      scale: 'battle',
      sideA: {
        factionId: army.factionId,
        roster: army.roster,
        laneRosters: getArmyFlankRosters(army),
        morale: getEffectiveMorale(state, army.factionId, army.morale),
        moraleLockedAt: factionIgnoresMorale(state, army.factionId) ? 100 : undefined,
        tactic: input.tactic,
        plan: input.battlePlan,
        autoRestVictoriousLanes: true,
        unitTypePowerMultipliers: getSpecialUnitTypePowerMultipliers(state, army.factionId, army.roster),
      },
      sideB: {
        factionId: 'sirius-boss',
        roster: { 'sirius-boss': 1 },
        morale: 100,
        tactic: 'balanced',
        plan: { formation: 'strong_center', reservePercent: 0, reserveTarget: 'center', commands: [], retreatMoraleThreshold: null },
        moraleLockedAt: 100,
      },
    },
    state.rng.battles,
    dependencies.unitDefinitions,
    dependencies.battleRules,
  );

  const attacker = battle.sides.A;
  const recruited = battle.winnerSide === 'A';
  const postBattleArmy = reconcileArmyGroupsToRoster(army, attacker.remainingRoster, dependencies.unitDefinitions);
  const recruitedArmy = recruited
    ? addArmyGroup(postBattleArmy, { 'sirius-morpheus-nan': 1 }, dependencies.unitDefinitions, {
        id: `unique-sirius-morpheus-nan-${army.nodeId}-turn-${state.turn}`,
        unique: true,
      })
    : postBattleArmy;
  const roster = recruitedArmy.roster;
  let nextState: GameState = {
    ...state,
    rng: { ...state.rng, battles: battle.rngState },
    factions: {
      ...state.factions,
      [faction.id]: { ...faction, strategicActionSpent: shouldSpendStrategicAction(state, faction.id), lastStrategicAction: 'attack' },
    },
    armies: {
      ...state.armies,
      [army.id]: { ...recruitedArmy, morale: getEffectiveMorale(state, army.factionId, attacker.moraleAfter) },
    },
    campaign: recruited
      ? {
          ...state.campaign,
          siriusDefeated: true,
          recruitedUniqueUnitIds: state.campaign.recruitedUniqueUnitIds.includes('sirius-morpheus-nan')
            ? state.campaign.recruitedUniqueUnitIds
            : [...state.campaign.recruitedUniqueUnitIds, 'sirius-morpheus-nan'],
        }
      : state.campaign,
  };
  nextState = applySpecialUnitVictoryProgress(nextState, army.factionId, battle.winnerFactionId, roster);
  return { ok: true, state: nextState, battle, recruited };
}
