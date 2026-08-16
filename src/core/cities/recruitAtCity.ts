import type { CommandOutcome } from '@/core/commands/CommandResult';
import type { RecruitmentOffer } from '@/core/cities/CityDefinition';
import type { ArmyId, CityId, GameState } from '@/core/state/GameState';

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

  const faction = state.factions[army.factionId];
  if (!faction) throw new Error(`Army ${army.id} references missing faction ${army.factionId}`);
  if (faction.strategicActionSpent) {
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
          strategicActionSpent: true,
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
      },
    ],
  };
}

function failure(state: GameState, error: RecruitAtCityError) {
  return { ok: false as const, state, error };
}
