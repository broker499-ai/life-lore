import { describe, expect, it } from 'vitest';
import { createPrototypeGameState, RIVAL_FACTION_ID } from './createPrototypeGameState';
import { rivalExpeditionById } from '@/data/factions/rivalExpeditions';
import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';

describe('createPrototypeGameState Stage 18 rival identity', () => {
  it('chooses a reproducible rival organization and an unselected leader', () => {
    const a = createPrototypeGameState(12345, 'artemios');
    const b = createPrototypeGameState(12345, 'artemios');

    expect(a.campaign.rivalOrganizationId).toBe(b.campaign.rivalOrganizationId);
    expect(a.campaign.rivalLeaderId).toBe(b.campaign.rivalLeaderId);
    expect(rivalExpeditionById[a.campaign.rivalOrganizationId]).toBeDefined();
    expect(a.campaign.rivalLeaderId).not.toBe('artemios');
    expect(prototypeLeaderById[a.campaign.rivalLeaderId]).toBeDefined();
    expect(a.factions[RIVAL_FACTION_ID].traits).toEqual(
      prototypeLeaderById[a.campaign.rivalLeaderId].traits,
    );
  });

  it('can produce more than one rival organization across different seeds', () => {
    const organizations = new Set(
      Array.from({ length: 30 }, (_, seed) => createPrototypeGameState(seed + 1, 'vlados').campaign.rivalOrganizationId),
    );
    expect(organizations.size).toBeGreaterThan(1);
  });
});


describe('createPrototypeGameState Stage 21 faction traits', () => {
  it('gives every active Nazbol garrison very high starting morale', () => {
    const states = Array.from({ length: 40 }, (_, seed) => createPrototypeGameState(seed + 1));
    const withNazbols = states.find((state) => state.factions['orsia-nazbols']);
    expect(withNazbols).toBeDefined();
    if (!withNazbols) return;

    const nazbolCities = Object.values(withNazbols.cities).filter(
      (city) => city.ownerFactionId === 'orsia-nazbols',
    );
    expect(nazbolCities.length).toBeGreaterThan(0);
    for (const city of nazbolCities) expect(city.garrison.morale).toBeGreaterThanOrEqual(94);
  });

  it('copies the Tyranid post-capture egg-clutch trait from the faction definition', () => {
    const states = Array.from({ length: 40 }, (_, seed) => createPrototypeGameState(seed + 100));
    const withTyranids = states.find((state) => state.factions['orsia-tyranids']);
    expect(withTyranids).toBeDefined();
    if (!withTyranids) return;

    expect(withTyranids.factions['orsia-tyranids'].traits).toEqual(
      orsiaSubfactionById['orsia-tyranids'].traits,
    );
  });
});

describe('createPrototypeGameState Stage 22 remaining Orsia traits', () => {
  const baseUnitsByCity: Record<string, number> = {
    'moss-market': 12,
    'quiet-scream': 12,
    'big-lunch': 14,
    'impassable': 19,
    'crooked-chambers': 20,
    'great-canteen-vaults': 17,
    'underfountain': 20,
    'club-club': 15,
    'phalanstery': 22,
    'echo-vault': 15,
    'last-decent-inn': 22,
    'root-limit': 27,
  };

  it('creates Goblin garrisons at 2x-3x normal headcount while keeping their weakness as a trait', () => {
    const states = Array.from({ length: 80 }, (_, seed) => createPrototypeGameState(seed + 200));
    const withGoblins = states.find((state) => state.factions['orsia-goblins']);
    expect(withGoblins).toBeDefined();
    if (!withGoblins) return;

    const goblinCities = Object.values(withGoblins.cities).filter((city) => city.ownerFactionId === 'orsia-goblins');
    expect(goblinCities.length).toBeGreaterThan(0);
    for (const city of goblinCities) {
      const base = baseUnitsByCity[city.id];
      const actual = Object.values(city.garrison.roster).reduce((sum, amount) => sum + (amount ?? 0), 0);
      expect(base).toBeDefined();
      expect(actual).toBeGreaterThanOrEqual(base * 2 - 1);
      expect(actual).toBeLessThanOrEqual(base * 3 + 1);
    }
    expect(withGoblins.factions['orsia-goblins'].traits).toContainEqual({
      type: 'battle_unit_power_multiplier',
      multiplier: 0.45,
    });
  });

  it('copies Orc center-only formation and Lateki subsidy traits from definitions', () => {
    const states = Array.from({ length: 100 }, (_, seed) => createPrototypeGameState(seed + 400));
    const withOrcs = states.find((state) => state.factions['orsia-orcs']);
    const withLateki = states.find((state) => state.factions['orsia-lateki']);
    expect(withOrcs?.factions['orsia-orcs'].traits).toEqual(orsiaSubfactionById['orsia-orcs'].traits);
    expect(withLateki?.factions['orsia-lateki'].traits).toEqual(orsiaSubfactionById['orsia-lateki'].traits);
  });
});

describe('createPrototypeGameState Stage 28 extension factions', () => {
  it('always reserves extension holdings for Profkom and Linhao', () => {
    const state = createPrototypeGameState(901);
    expect(state.factions['orsia-profkom']).toBeDefined();
    expect(state.factions['orsia-linhao']).toBeDefined();
    expect(Object.values(state.cities).some((city) => city.ownerFactionId === 'orsia-profkom')).toBe(true);
    const linhaoCities = Object.values(state.cities).filter((city) => city.ownerFactionId === 'orsia-linhao');
    expect(linhaoCities.length).toBeGreaterThan(0);
    for (const city of linhaoCities) {
      expect(city.garrison.roster).toEqual({ 'linhao-singular': 1 });
    }
  });

  it('keeps Profkom corruption penalty separate from the Lateki subsidy', () => {
    const state = createPrototypeGameState(902);
    expect(state.factions['orsia-profkom'].traits).toContainEqual({
      type: 'captured_city_income_multiplier',
      multiplier: 0.6,
    });
  });
});
