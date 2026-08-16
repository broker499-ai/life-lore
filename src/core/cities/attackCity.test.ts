import { describe, expect, it } from 'vitest';
import { attackCity, chooseBattleScale, getAttackCityAvailability } from '@/core/cities/attackCity';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeMap } from '@/data/map/prototypeMap';
import { prototypeUnits } from '@/data/units/prototypeUnits';

const deps = { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules };

function input(cityId = 'moss-market') {
  return {
    armyId: 'player-main',
    cityId,
    tactic: 'balanced' as const,
    supplyCost: 8,
  };
}

describe('attackCity', () => {
  it('captures an adjacent neutral city after a deterministic victory and moves survivors in', () => {
    const state = createPrototypeGameState(42);
    const result = attackCity(state, prototypeMap, input(), deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.battle).not.toBeNull();
    expect(result.captured).toBe(true);
    expect(result.state.cities['moss-market'].ownerFactionId).toBe('expedition');
    expect(result.state.armies['player-main'].nodeId).toBe('moss-market');
    expect(result.state.factions.expedition.resources.supplies).toBe(72);
    expect(result.state.factions[result.state.playerFactionId].strategicActionSpent).toBe(true);
    expect(result.state.rng.battles.cursor).toBeGreaterThan(0);
    expect(result.events.some((event) => event.type === 'city_captured')).toBe(true);
  });

  it('applies losses but keeps the attacker at the origin after defeat', () => {
    const state = createPrototypeGameState(9);
    state.armies['player-main'].roster = { 'expedition-infantry': 6 };
    state.armies['player-main'].morale = 45;
    state.cities['moss-market'].garrison = {
      roster: { 'orssian-guard': 22, 'orssian-slingers': 8 },
      morale: 85,
    };

    const originalOwner = state.cities['moss-market'].ownerFactionId;
    const result = attackCity(state, prototypeMap, input(), deps);

    expect(result.ok).toBe(true);
    if (!result.ok || !result.battle) return;
    expect(result.captured).toBe(false);
    expect(result.state.cities['moss-market'].ownerFactionId).toBe(originalOwner);
    expect(result.state.armies['player-main'].nodeId).toBe('outer-post');
    expect(result.state.armies['player-main'].roster).toEqual(result.battle.sides.A.remainingRoster);
    expect(result.state.cities['moss-market'].garrison.roster).toEqual(
      result.battle.sides.B.remainingRoster,
    );
  });

  it('blocks attacks that are not adjacent or when the action is spent', () => {
    const state = createPrototypeGameState();
    expect(getAttackCityAvailability(state, prototypeMap, input('big-lunch'))).toEqual({
      canAttack: false,
      reason: 'not_adjacent',
    });

    state.factions[state.playerFactionId].strategicActionSpent = true;
    expect(getAttackCityAvailability(state, prototypeMap, input())).toEqual({
      canAttack: false,
      reason: 'strategic_action_spent',
    });
  });

  it('fights a field army stationed in the target city and retreats it after defeat', () => {
    const state = createPrototypeGameState(17);
    state.cities['echo-vault'].ownerFactionId = 'expedition';
    state.cities['echo-vault'].garrison = { roster: {}, morale: 0 };
    state.armies['player-main'].nodeId = 'echo-vault';
    state.armies['player-main'].roster = { 'expedition-infantry': 4 };
    state.armies['player-main'].morale = 40;
    state.armies['rival-main'].roster = { 'expedition-infantry': 30 };
    state.armies['rival-main'].morale = 90;
    state.armies['rival-main'].nodeId = 'temporary-outpost';

    const result = attackCity(
      state,
      prototypeMap,
      { armyId: 'rival-main', cityId: 'echo-vault', tactic: 'assault', supplyCost: 8 },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.battle).not.toBeNull();
    expect(result.captured).toBe(true);
    expect(result.state.cities['echo-vault'].ownerFactionId).toBe('meridian-company');
    expect(result.state.armies['player-main'].nodeId).toBe('outer-post');
    expect(result.events.some((event) => event.type === 'army_retreated')).toBe(true);
  });

  it('uses the common skirmish/battle threshold', () => {
    expect(chooseBattleScale(59)).toBe('skirmish');
    expect(chooseBattleScale(60)).toBe('battle');
  });

  it('occupies an empty neutral city without invoking battle RNG', () => {
    const state = createPrototypeGameState(42);
    state.cities['moss-market'].garrison = { roster: {}, morale: 0 };
    const cursor = state.rng.battles.cursor;

    const result = attackCity(state, prototypeMap, input(), deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.battle).toBeNull();
    expect(result.captured).toBe(true);
    expect(result.state.rng.battles.cursor).toBe(cursor);
  });
});
