import { describe, expect, it } from 'vitest';
import { getAttackCityAvailability } from '@/core/cities/attackCity';
import { areFactionsAllied, areFactionsHostile } from '@/core/factions/factionRelations';
import { createPrototypeGameState, distributeOrsiaCities } from '@/core/state/createPrototypeGameState';
import { createRngState } from '@/core/rng/seededRandom';
import { prototypeMap } from '@/data/map/prototypeMap';
import { orsiaSubfactions } from '@/data/factions/orsiaSubfactions';

describe('Orsia super-faction', () => {
  it('uses four or five subfactions and assigns every Orsia city deterministically', () => {
    for (const seed of [1, 2, 3, 4, 42, 99]) {
      const distribution = distributeOrsiaCities(createRngState(seed));
      expect(distribution.activeFactionIds.length).toBeGreaterThanOrEqual(4);
      expect(distribution.activeFactionIds.length).toBeLessThanOrEqual(orsiaSubfactions.length);
      expect(Object.keys(distribution.cityOwners)).toHaveLength(12);
      for (const factionId of distribution.activeFactionIds) {
        expect(Object.values(distribution.cityOwners)).toContain(factionId);
      }
    }
  });

  it('treats different Orsia groups as allies and prevents attacks between them', () => {
    const state = createPrototypeGameState(42, 'vlados');
    const orsiaIds = Object.values(state.factions)
      .filter((faction) => faction.superFactionId === 'orsia')
      .map((faction) => faction.id);
    const [a, b] = orsiaIds;
    if (!a || !b) throw new Error('expected at least two Orsia groups');

    expect(areFactionsAllied(state, a, b)).toBe(true);
    expect(areFactionsHostile(state, a, b)).toBe(false);

    state.cities['outer-post'].ownerFactionId = a;
    state.cities['moss-market'].ownerFactionId = b;
    state.armies['orsia-test'] = {
      id: 'orsia-test',
      factionId: a,
      nodeId: 'outer-post',
      morale: 70,
      roster: { 'orssian-guard': 10 },
    };

    expect(
      getAttackCityAvailability(state, prototypeMap, {
        armyId: 'orsia-test',
        cityId: 'moss-market',
        tactic: 'balanced',
        supplyCost: 8,
      }),
    ).toEqual({ canAttack: false, reason: 'allied_city' });
  });
});
