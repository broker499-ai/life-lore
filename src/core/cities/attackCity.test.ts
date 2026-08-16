import { describe, expect, it } from 'vitest';
import { attackCity, chooseBattleScale, getAttackCityAvailability } from '@/core/cities/attackCity';
import { createPrototypeGameState, RIVAL_FACTION_ID } from '@/core/state/createPrototypeGameState';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeMap } from '@/data/map/prototypeMap';
import { prototypeUnits } from '@/data/units/prototypeUnits';
import { resolveFactionDefeatEvent } from '@/core/factions/resolveFactionDefeatEvent';
import { ORSIA_SUPER_FACTION_ID, orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';

const deps = { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules, cityDefinitions: prototypeCities };

function input(cityId = 'moss-market') {
  return {
    armyId: 'player-main',
    cityId,
    tactic: 'balanced' as const,
    supplyCost: 8,
  };
}



function ensureOrsiaFaction(
  state: ReturnType<typeof createPrototypeGameState>,
  factionId: 'orsia-nazbols' | 'orsia-tyranids' | 'orsia-orcs' | 'orsia-goblins' | 'orsia-fgushniki',
) {
  const definition = orsiaSubfactionById[factionId];
  state.factions[factionId] = {
    id: factionId,
    superFactionId: ORSIA_SUPER_FACTION_ID,
    resources: { money: 100, supplies: 100, specimens: 0 },
    specimensCollected: 0,
    strategicActionSpent: false,
    lastStrategicAction: null,
    leaderAbilityLastUsedTurn: null,
    traits: definition.traits.map((trait) => ({ ...trait })),
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
    expect(result.state.cities['echo-vault'].ownerFactionId).toBe(RIVAL_FACTION_ID);
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

  it('queues the Nazbol first-defeat event and transfers their remaining cities after acknowledgement', () => {
    const state = createPrototypeGameState(42);
    ensureOrsiaFaction(state, 'orsia-nazbols');
    state.cities['moss-market'].ownerFactionId = 'orsia-nazbols';
    state.cities['moss-market'].garrison = { roster: { 'orssian-guard': 1 }, morale: 94 };
    state.cities['quiet-scream'].ownerFactionId = 'orsia-nazbols';
    state.cities['quiet-scream'].garrison = { roster: { 'orssian-guard': 8 }, morale: 94 };
    state.armies['player-main'].roster = { 'expedition-infantry': 40, 'expedition-rangers': 12 };
    state.armies['player-main'].morale = 90;

    const result = attackCity(
      state,
      prototypeMap,
      { ...input(), tactic: 'assault' },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.captured).toBe(true);
    expect(result.state.campaign.pendingFactionEvent).toEqual({
      eventId: 'nazbol-first-defeat',
      factionId: 'orsia-nazbols',
      beneficiaryFactionId: 'expedition',
    });

    const resolved = resolveFactionDefeatEvent(result.state, 'nazbol-first-defeat', prototypeMap);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.factions['orsia-nazbols']).toBeUndefined();
    expect(resolved.state.cities['quiet-scream'].ownerFactionId).toBe('expedition');
    expect(resolved.state.cities['quiet-scream'].garrison).toEqual({ roster: {}, morale: 0 });
    expect(resolved.state.campaign.resolvedFactionEventIds).toContain('nazbol-first-defeat');
  });

  it('also queues the Nazbol event when they attack the player and suffer their first defeat', () => {
    const state = createPrototypeGameState(84);
    ensureOrsiaFaction(state, 'orsia-nazbols');
    state.cities['moss-market'].ownerFactionId = 'orsia-nazbols';
    state.cities['moss-market'].garrison = { roster: {}, morale: 0 };
    state.armies['nazbol-test'] = {
      id: 'nazbol-test',
      factionId: 'orsia-nazbols',
      nodeId: 'moss-market',
      morale: 94,
      roster: { 'orssian-guard': 2 },
    };
    state.armies['player-main'].roster = { 'expedition-infantry': 40, 'expedition-rangers': 12 };
    state.armies['player-main'].morale = 90;

    const result = attackCity(
      state,
      prototypeMap,
      { armyId: 'nazbol-test', cityId: 'outer-post', tactic: 'assault', supplyCost: 0 },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.captured).toBe(false);
    expect(result.state.campaign.pendingFactionEvent).toMatchObject({
      eventId: 'nazbol-first-defeat',
      factionId: 'orsia-nazbols',
      beneficiaryFactionId: 'expedition',
    });
  });

  it('applies Tyranid casualty resistance against assault', () => {
    const makeState = (withResistance: boolean) => {
      const state = createPrototypeGameState(55);
      ensureOrsiaFaction(state, 'orsia-tyranids');
      if (!withResistance) state.factions['orsia-tyranids'].traits = [];
      state.cities['moss-market'].ownerFactionId = 'orsia-tyranids';
      state.cities['moss-market'].garrison = {
        roster: { 'orssian-guard': 20, 'orssian-slingers': 8 },
        morale: 78,
      };
      state.armies['player-main'].roster = { 'expedition-infantry': 30, 'expedition-rangers': 8 };
      state.armies['player-main'].morale = 85;
      return state;
    };

    const resistant = attackCity(
      makeState(true),
      prototypeMap,
      { ...input(), tactic: 'assault' },
      deps,
    );
    const baseline = attackCity(
      makeState(false),
      prototypeMap,
      { ...input(), tactic: 'assault' },
      deps,
    );

    expect(resistant.ok).toBe(true);
    expect(baseline.ok).toBe(true);
    if (!resistant.ok || !baseline.ok || !resistant.battle || !baseline.battle) return;
    expect(resistant.battle.sides.B.totalLosses).toBeLessThan(baseline.battle.sides.B.totalLosses);
  });

  it('marks a captured FGU city with a persistent corruption income penalty', () => {
    const state = createPrototypeGameState(71);
    ensureOrsiaFaction(state, 'orsia-fgushniki');
    state.cities['moss-market'].ownerFactionId = 'orsia-fgushniki';
    state.cities['moss-market'].garrison = { roster: {}, morale: 0 };

    const result = attackCity(state, prototypeMap, input(), deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.captured).toBe(true);
    expect(result.state.cities['moss-market'].incomeMultiplier).toBeCloseTo(0.6);
  });

});
