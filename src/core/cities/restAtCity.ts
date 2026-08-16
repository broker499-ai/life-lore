import type { CommandOutcome } from '@/core/commands/CommandResult';
import type { CityDefinition } from '@/core/cities/CityDefinition';
import { getEffectiveCityRest } from '@/core/cities/cityTraits';
import type { ArmyId, CityId, GameState } from '@/core/state/GameState';

export type RestAtCityError =
  | 'army_not_found'
  | 'city_not_found'
  | 'army_not_in_city'
  | 'city_not_controlled'
  | 'strategic_action_spent'
  | 'nothing_to_restore';

export type RestAtCityAvailability =
  | { canRest: true }
  | { canRest: false; reason: RestAtCityError };

export type RestAtCityInput = {
  armyId: ArmyId;
  cityId: CityId;
  city: CityDefinition;
  supplyCap: number;
  moraleCap: number;
};

export function getRestAtCityAvailability(
  state: GameState,
  input: RestAtCityInput,
): RestAtCityAvailability {
  const army = state.armies[input.armyId];
  if (!army) return { canRest: false, reason: 'army_not_found' };

  const city = state.cities[input.cityId];
  if (!city) return { canRest: false, reason: 'city_not_found' };
  if (army.nodeId !== city.id) return { canRest: false, reason: 'army_not_in_city' };
  if (city.ownerFactionId !== army.factionId) {
    return { canRest: false, reason: 'city_not_controlled' };
  }
  if (!Number.isFinite(input.supplyCap) || input.supplyCap < 0) {
    throw new Error('Supply cap must be a finite non-negative number');
  }
  if (!Number.isFinite(input.moraleCap) || input.moraleCap < 0) {
    throw new Error('Morale cap must be a finite non-negative number');
  }

  const faction = state.factions[army.factionId];
  if (!faction) throw new Error(`Army ${army.id} references missing faction ${army.factionId}`);
  if (faction.strategicActionSpent) {
    return { canRest: false, reason: 'strategic_action_spent' };
  }
  if (input.city.id !== city.id) throw new Error(`City definition mismatch for ${city.id}`);

  const rest = getEffectiveCityRest(input.city);
  const nextSupplies = Math.min(
    input.supplyCap,
    faction.resources.supplies + rest.suppliesRestore,
  );
  const nextMorale = Math.min(input.moraleCap, army.morale + rest.moraleRestore);

  if (nextSupplies === faction.resources.supplies && nextMorale === army.morale) {
    return { canRest: false, reason: 'nothing_to_restore' };
  }

  return { canRest: true };
}

export function restAtCity(
  state: GameState,
  input: RestAtCityInput,
): CommandOutcome<
  GameState,
  RestAtCityError,
  {
    type: 'army_rested';
    armyId: string;
    cityId: string;
    suppliesRestored: number;
    moraleRestored: number;
  }
> {
  const availability = getRestAtCityAvailability(state, input);
  if (!availability.canRest) return failure(state, availability.reason);

  const army = state.armies[input.armyId];
  const city = state.cities[input.cityId];
  if (!army || !city) throw new Error('Rest availability invariant failed');
  const faction = state.factions[army.factionId];
  if (!faction) throw new Error(`Army ${army.id} references missing faction ${army.factionId}`);

  const rest = getEffectiveCityRest(input.city);
  const nextSupplies = Math.min(
    input.supplyCap,
    faction.resources.supplies + rest.suppliesRestore,
  );
  const nextMorale = Math.min(input.moraleCap, army.morale + rest.moraleRestore);
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
          resources: {
            ...faction.resources,
            supplies: nextSupplies,
          },
          strategicActionSpent: true,
          lastStrategicAction: 'rest',
        },
      },
      armies: {
        ...state.armies,
        [army.id]: {
          ...army,
          morale: nextMorale,
        },
      },
    },
    events: [
      {
        type: 'army_rested',
        armyId: army.id,
        cityId: city.id,
        suppliesRestored,
        moraleRestored,
      },
    ],
  };
}

function failure(state: GameState, error: RestAtCityError) {
  return { ok: false as const, state, error };
}
