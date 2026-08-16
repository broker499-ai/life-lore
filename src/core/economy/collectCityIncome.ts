import type { CommandSuccess } from '@/core/commands/CommandResult';
import type { CityDefinitions } from '@/core/cities/CityDefinition';
import type { GameState } from '@/core/state/GameState';

export function getFactionCityIncome(
  state: GameState,
  cityDefinitions: CityDefinitions,
  factionId: string,
): number {
  return Object.values(state.cities).reduce((total, city) => {
    if (city.ownerFactionId !== factionId) return total;
    const definition = cityDefinitions[city.id];
    if (!definition) throw new Error(`Missing CityDefinition for ${city.id}`);
    return total + definition.taxIncome;
  }, 0);
}

export function collectCityIncome(
  state: GameState,
  cityDefinitions: CityDefinitions,
): CommandSuccess<GameState, { type: 'income_collected'; factionId: string; amount: number }> {
  let nextFactions = state.factions;
  const events: { type: 'income_collected'; factionId: string; amount: number }[] = [];

  for (const faction of Object.values(state.factions)) {
    const amount = getFactionCityIncome(state, cityDefinitions, faction.id);
    if (amount <= 0) continue;

    nextFactions = {
      ...nextFactions,
      [faction.id]: {
        ...faction,
        resources: {
          ...faction.resources,
          money: faction.resources.money + amount,
        },
      },
    };
    events.push({ type: 'income_collected', factionId: faction.id, amount });
  }

  return {
    ok: true,
    state: {
      ...state,
      factions: nextFactions,
    },
    events,
  };
}
