import type { ArmyRoster, FactionId, GameState } from '@/core/state/GameState';
import { addRosterToGroupContaining } from '@/core/armies/armyFlanks';
import { prototypeUnits } from '@/data/units/prototypeUnits';

export function getSpecialUnitTypePowerMultipliers(
  _state: GameState,
  _factionId: FactionId,
  _roster: ArmyRoster,
): Record<string, number> | undefined {
  // Stage 42: Greg's growing strength is represented by actual spider units in
  // the roster rather than by a hidden multiplier. Keep the hook because the
  // battle entry points already use it for future unique-unit effects.
  return undefined;
}

export function applySpecialUnitVictoryProgress(
  state: GameState,
  factionId: FactionId,
  winnerFactionId: FactionId | null,
  remainingRoster: ArmyRoster,
): GameState {
  if (factionId !== state.playerFactionId || winnerFactionId !== factionId) return state;
  if ((remainingRoster['greg-jenkins'] ?? 0) <= 0) return state;

  const armyEntry = Object.entries(state.armies).find(
    ([, army]) => army.factionId === factionId && (army.roster['greg-jenkins'] ?? 0) > 0,
  );
  if (!armyEntry) return state;
  const [armyId, army] = armyEntry;
  return {
    ...state,
    armies: {
      ...state.armies,
      [armyId]: addRosterToGroupContaining(
        army,
        'greg-jenkins',
        { 'greg-spiders': 2 },
        prototypeUnits,
        `greg-spiders-victory-${state.turn}`,
      ),
    },
    campaign: {
      ...state.campaign,
      gregJenkinsVictories: state.campaign.gregJenkinsVictories + 1,
    },
  };
}

export function getGregSpiderCount(state: GameState): number {
  const playerArmy = Object.values(state.armies).find((army) => army.factionId === state.playerFactionId);
  return playerArmy?.roster['greg-spiders'] ?? (state.campaign.recruitedUniqueUnitIds.includes('greg-jenkins') ? 10 + state.campaign.gregJenkinsVictories * 2 : 0);
}
