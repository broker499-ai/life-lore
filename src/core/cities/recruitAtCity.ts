import type { CommandOutcome } from '@/core/commands/CommandResult';
import { hasUnlimitedStrategicActions, shouldSpendStrategicAction } from '@/core/dev/developerMode';
import type { RecruitmentOffer } from '@/core/cities/CityDefinition';
import type { ArmyId, CityId, GameState } from '@/core/state/GameState';
import { factionIgnoresMorale } from '@/core/leaders/LeaderAbility';

export type RecruitAtCityError =
  | 'army_not_found'
  | 'city_not_found'
  | 'army_not_in_city'
  | 'city_not_controlled'
  | 'strategic_action_spent'
  | 'insufficient_money';

export type RecruitAtCityAvailability =
  | { canRecruit: true }
  | { canRecruit: false; reason: RecruitAtCityError };

export type RecruitAtCityInput = {
  armyId: ArmyId;
  cityId: CityId;
  offer: RecruitmentOffer;
  moraleRestore: number;
  moraleCap: number;
};

export function getRecruitAtCityAvailability(
  state: GameState,
  input: RecruitAtCityInput,
): RecruitAtCityAvailability {
  const army = state.armies[input.armyId];
  if (!army) return { canRecruit: false, reason: 'army_not_found' };

  const city = state.cities[input.cityId];
  if (!city) return { canRecruit: false, reason: 'city_not_found' };
  if (army.nodeId !== city.id) return { canRecruit: false, reason: 'army_not_in_city' };
  if (city.ownerFactionId !== army.factionId) {
    return { canRecruit: false, reason: 'city_not_controlled' };
  }
  if (!Number.isInteger(input.offer.amount) || input.offer.amount <= 0) {
    throw new Error('Recruitment amount must be a positive integer');
  }
  if (!Number.isFinite(input.offer.cost) || input.offer.cost < 0) {
    throw new Error('Recruitment cost must be a finite non-negative number');
  }
  if (!Number.isFinite(input.moraleRestore) || input.moraleRestore < 0) {
    throw new Error('Recruitment morale restore must be a finite non-negative number');
  }
  if (!Number.isFinite(input.moraleCap) || input.moraleCap < 0) {
    throw new Error('Recruitment morale cap must be a finite non-negative number');
  }

  const faction = state.factions[army.factionId];
  if (!faction) throw new Error(`Army ${army.id} references missing faction ${army.factionId}`);
  if (faction.strategicActionSpent && !hasUnlimitedStrategicActions(state, army.factionId)) {
    return { canRecruit: false, reason: 'strategic_action_spent' };
  }
  if (faction.resources.money < input.offer.cost) {
    return { canRecruit: false, reason: 'insufficient_money' };
  }

  return { canRecruit: true };
}

export function recruitAtCity(
  state: GameState,
  input: RecruitAtCityInput,
): CommandOutcome<
  GameState,
  RecruitAtCityError,
  {
    type: 'units_recruited';
    armyId: string;
    cityId: string;
    unitTypeId: string;
    amount: number;
    cost: number;
    moraleRestored: number;
  }
> {
  const availability = getRecruitAtCityAvailability(state, input);
  if (!availability.canRecruit) return failure(state, availability.reason);

  const army = state.armies[input.armyId];
  const city = state.cities[input.cityId];
  if (!army || !city) throw new Error('Recruitment availability invariant failed');
  const faction = state.factions[army.factionId];
  if (!faction) throw new Error(`Army ${army.id} references missing faction ${army.factionId}`);

  const currentAmount = army.roster[input.offer.unitTypeId] ?? 0;
  const nextMorale = factionIgnoresMorale(state, army.factionId) ? 100 : Math.min(input.moraleCap, army.morale + input.moraleRestore);
  const moraleRestored = nextMorale - army.morale;

  return {
    ok: true,
    state: {
      ...state,
      factions: {
        ...state.factions,
        [faction.id]: {
          ...faction,
          resources: {
            ...faction.resources,
            money: faction.resources.money - input.offer.cost,
          },
          strategicActionSpent: shouldSpendStrategicAction(state, faction.id),
          lastStrategicAction: 'recruit',
        },
      },
      armies: {
        ...state.armies,
        [army.id]: {
          ...army,
          roster: {
            ...army.roster,
            [input.offer.unitTypeId]: currentAmount + input.offer.amount,
          },
          morale: nextMorale,
        },
      },
    },
    events: [
      {
        type: 'units_recruited',
        armyId: army.id,
        cityId: city.id,
        unitTypeId: input.offer.unitTypeId,
        amount: input.offer.amount,
        cost: input.offer.cost,
        moraleRestored,
      },
    ],
  };
}

function failure(state: GameState, error: RecruitAtCityError) {
  return { ok: false as const, state, error };
}
