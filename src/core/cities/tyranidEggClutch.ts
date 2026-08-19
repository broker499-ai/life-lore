import type { GameState, CityId, ArmyId } from '@/core/state/GameState';
import { getPostCaptureEggClutch } from '@/core/leaders/LeaderAbility';

export type TyranidEggClutchStatus = {
  cityId: CityId;
  tyranidFactionId: string;
  deadlineTurn: number;
  turnsRemaining: number;
  canClear: boolean;
  overdue: boolean;
};

export function getTyranidEggClutchStatus(state: GameState, cityId: CityId): TyranidEggClutchStatus | null {
  const clutch = state.campaign.tyranidEggClutches[cityId];
  if (!clutch) return null;
  const overdue = state.turn > clutch.deadlineTurn;
  return {
    cityId,
    tyranidFactionId: clutch.tyranidFactionId,
    deadlineTurn: clutch.deadlineTurn,
    turnsRemaining: overdue
      ? 0
      : state.turn <= clutch.capturedTurn
        ? Math.max(0, clutch.deadlineTurn - clutch.capturedTurn)
        : Math.max(0, clutch.deadlineTurn - state.turn + 1),
    canClear: !overdue,
    overdue,
  };
}

export function applyTyranidReversionAfterArmyDeparture(
  previousState: GameState,
  nextState: GameState,
  armyId: ArmyId,
): GameState {
  const beforeArmy = previousState.armies[armyId];
  const afterArmy = nextState.armies[armyId];
  if (!beforeArmy || !afterArmy || beforeArmy.nodeId === afterArmy.nodeId) return nextState;
  return revertIfOverdueAndUnoccupied(nextState, beforeArmy.nodeId);
}

export function resolveOverdueUnoccupiedTyranidClutches(state: GameState): GameState {
  let next = state;
  for (const cityId of Object.keys(state.campaign.tyranidEggClutches)) {
    next = revertIfOverdueAndUnoccupied(next, cityId);
  }
  return next;
}

export function getTyranidClutchBattleRoster(state: GameState, cityId: CityId): { roster: Record<string, number>; morale: number } | null {
  const clutch = state.campaign.tyranidEggClutches[cityId];
  if (!clutch) return null;
  const trait = getPostCaptureEggClutch(state, clutch.tyranidFactionId);
  if (!trait) return { roster: { 'tyranid-hatchling': 12 }, morale: 64 };
  return { roster: { [trait.hatchlingUnitTypeId]: trait.hatchlingCount }, morale: trait.morale };
}

function revertIfOverdueAndUnoccupied(state: GameState, cityId: CityId): GameState {
  const clutch = state.campaign.tyranidEggClutches[cityId];
  const city = state.cities[cityId];
  if (!clutch || !city) return state;
  if (state.turn <= clutch.deadlineTurn) return state;
  if (city.ownerFactionId !== state.playerFactionId) return removeClutch(state, cityId);
  const occupiedByPlayer = Object.values(state.armies).some(
    (army) => army.factionId === state.playerFactionId && army.nodeId === cityId,
  );
  if (occupiedByPlayer) return state;

  const battleRoster = getTyranidClutchBattleRoster(state, cityId) ?? { roster: { 'tyranid-hatchling': 12 }, morale: 64 };
  const clutches = { ...state.campaign.tyranidEggClutches };
  delete clutches[cityId];
  return {
    ...state,
    cities: {
      ...state.cities,
      [cityId]: {
        ...city,
        ownerFactionId: clutch.tyranidFactionId,
        garrison: { roster: battleRoster.roster, morale: battleRoster.morale },
      },
    },
    campaign: { ...state.campaign, tyranidEggClutches: clutches },
  };
}

function removeClutch(state: GameState, cityId: CityId): GameState {
  const clutches = { ...state.campaign.tyranidEggClutches };
  delete clutches[cityId];
  return { ...state, campaign: { ...state.campaign, tyranidEggClutches: clutches } };
}
