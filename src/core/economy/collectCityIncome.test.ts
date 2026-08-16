import { describe, expect, it } from 'vitest';
import { createPrototypeGameState, RIVAL_FACTION_ID } from '@/core/state/createPrototypeGameState';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { collectCityIncome, getFactionCityIncome } from './collectCityIncome';

describe('city income', () => {
  it('derives income from CityState ownership', () => {
    const state = createPrototypeGameState();
    expect(getFactionCityIncome(state, prototypeCities, 'expedition')).toBe(12);
    expect(getFactionCityIncome(state, prototypeCities, RIVAL_FACTION_ID)).toBe(23.2);

    state.cities['moss-market'].ownerFactionId = 'expedition';
    expect(getFactionCityIncome(state, prototypeCities, 'expedition')).toBe(36.3);
  });

  it('collects income for both active factions without mutating the input', () => {
    const state = createPrototypeGameState();
    const result = collectCityIncome(state, prototypeCities);

    expect(result.state.factions.expedition.resources.money).toBe(132);
    expect(result.state.factions[RIVAL_FACTION_ID].resources.money).toBe(141.2);
    expect(state.factions.expedition.resources.money).toBe(120);
    expect(result.events).toEqual(expect.arrayContaining([
      { type: 'income_collected', factionId: 'expedition', amount: 12 },
      { type: 'income_collected', factionId: RIVAL_FACTION_ID, amount: 23.2 },
    ]));
  });
  it('applies a captured-city income multiplier before faction-wide tax bonuses', () => {
    const state = createPrototypeGameState();
    state.cities['moss-market'].ownerFactionId = 'expedition';
    state.cities['moss-market'].incomeMultiplier = 0.6;

    expect(getFactionCityIncome(state, prototypeCities, 'expedition')).toBe(26.58);
  });

});
