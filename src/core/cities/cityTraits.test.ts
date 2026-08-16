import { describe, expect, it } from 'vitest';
import {
  getCityDefenderUnitPowerMultiplier,
  getEffectiveCityRecruitmentOffers,
  getEffectiveCityRest,
  getEffectiveCityTaxIncome,
  getFactionArmyUpkeepCityMultiplier,
  getRootClaimCitySupplyMultiplier,
} from './cityTraits';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeCities } from '@/data/cities/prototypeCities';

describe('city traits', () => {
  it('applies the Moss Market tax premium', () => {
    expect(getEffectiveCityTaxIncome(prototypeCities['moss-market'])).toBe(24.3);
  });

  it('applies city-specific rest profiles', () => {
    expect(getEffectiveCityRest(prototypeCities['big-lunch'])).toEqual({
      suppliesRestore: 49,
      moraleRestore: 25,
    });
    expect(getEffectiveCityRest(prototypeCities['great-canteen-vaults'])).toEqual({
      suppliesRestore: 65,
      moraleRestore: 10,
    });
  });

  it('applies recruitment quantity and price modifiers', () => {
    expect(getEffectiveCityRecruitmentOffers(prototypeCities['quiet-scream'])).toEqual([
      { unitTypeId: 'expedition-infantry', amount: 7, cost: 30 },
      { unitTypeId: 'student-103', amount: 4, cost: 33 },
    ]);
    expect(getEffectiveCityRecruitmentOffers(prototypeCities.underfountain)).toEqual([
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 20 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 19 },
    ]);
  });

  it('exposes defensive and faction-wide strategic modifiers', () => {
    expect(getCityDefenderUnitPowerMultiplier(prototypeCities.impassable)).toBe(1.25);

    const state = createPrototypeGameState();
    expect(getFactionArmyUpkeepCityMultiplier(state, prototypeCities, state.playerFactionId)).toBe(0.9);
    state.cities.phalanstery.ownerFactionId = state.playerFactionId;
    expect(getFactionArmyUpkeepCityMultiplier(state, prototypeCities, state.playerFactionId)).toBeCloseTo(0.792);
  });

  it('reduces the final operation cost only for the faction controlling Root Limit', () => {
    const state = createPrototypeGameState();
    state.cities['root-limit'].ownerFactionId = state.playerFactionId;
    expect(getRootClaimCitySupplyMultiplier(
      state,
      prototypeCities,
      state.playerFactionId,
      'root-limit',
    )).toBe(0.7);
  });
});
