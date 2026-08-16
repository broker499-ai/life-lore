import { describe, expect, it } from 'vitest';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { collectCityIncome, getFactionCityIncome } from './collectCityIncome';

describe('city income', () => {
  it('derives income from CityState ownership', () => {
    const state = createPrototypeGameState();
    expect(getFactionCityIncome(state, prototypeCities, 'expedition')).toBe(12);
    expect(getFactionCityIncome(state, prototypeCities, 'meridian-company')).toBe(16);

    state.cities['moss-market'].ownerFactionId = 'expedition';
    expect(getFactionCityIncome(state, prototypeCities, 'expedition')).toBe(30);
  });

  it('collects income for both active factions without mutating the input', () => {
    const state = createPrototypeGameState();
    const result = collectCityIncome(state, prototypeCities);

    expect(result.state.factions.expedition.resources.money).toBe(132);
    expect(result.state.factions['meridian-company'].resources.money).toBe(134);
    expect(state.factions.expedition.resources.money).toBe(120);
    expect(result.events).toEqual(expect.arrayContaining([
      { type: 'income_collected', factionId: 'expedition', amount: 12 },
      { type: 'income_collected', factionId: 'meridian-company', amount: 16 },
    ]));
  });
});
