import { describe, expect, it } from 'vitest';
import { attackCity } from '@/core/cities/attackCity';
import { moveArmy } from '@/core/map/moveArmy';
import {
  factionKnowsFullMap,
  getArtifactEffectMultiplier,
  factionIgnoresMorale,
  factionIgnoresSupply,
} from '@/core/leaders/LeaderAbility';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeMap } from '@/data/map/prototypeMap';
import { prototypeUnits } from '@/data/units/prototypeUnits';

const deps = { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules, cityDefinitions: prototypeCities };

describe('leader abilities', () => {
  it('Artemios keeps expedition morale locked at 100', () => {
    const state = createPrototypeGameState(42, 'artemios');
    expect(factionIgnoresMorale(state, 'expedition')).toBe(true);
    expect(factionIgnoresSupply(state, 'expedition')).toBe(false);
    expect(state.armies['player-main'].morale).toBe(100);

    state.cities['moss-market'].ownerFactionId = 'orsia-orcs';
    const battle = attackCity(
      state,
      prototypeMap,
      { armyId: 'player-main', cityId: 'moss-market', tactic: 'balanced', supplyCost: 8 },
      deps,
    );
    if (!battle.ok || !battle.battle) throw new Error('expected deterministic battle');
    expect(battle.battle.sides.A.moraleBefore).toBe(100);
    expect(battle.battle.sides.A.moraleAfter).toBe(100);
    expect(battle.state.armies['player-main'].morale).toBe(100);
  });

  it('Vlados and Iliesh expose future-facing artifact/map traits', () => {
    const vlados = createPrototypeGameState(42, 'vlados');
    const iliesh = createPrototypeGameState(42, 'iliesh');
    expect(getArtifactEffectMultiplier(vlados, 'expedition')).toBe(1.5);
    expect(factionKnowsFullMap(iliesh, 'expedition')).toBe(true);
  });

  it('Layosh gets exactly one second move every third turn', () => {
    const state = createPrototypeGameState(42, 'layosh');
    state.turn = 3;
    state.cities['moss-market'].ownerFactionId = 'expedition';

    const first = moveArmy(state, prototypeMap, {
      armyId: 'player-main',
      toNodeId: 'moss-market',
      supplyCost: 6,
    });
    if (!first.ok) throw new Error('first move should succeed');

    const second = moveArmy(first.state, prototypeMap, {
      armyId: 'player-main',
      toNodeId: 'warehouse-2',
      supplyCost: 6,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.events[0].leaderAbilityId).toBe('river_double_move');

    const third = moveArmy(second.state, prototypeMap, {
      armyId: 'player-main',
      toNodeId: 'moss-market',
      supplyCost: 6,
    });
    expect(third).toMatchObject({ ok: false, error: 'strategic_action_spent' });
  });

  it('Makson Наземный флот ignores the supply system', () => {
    const state = createPrototypeGameState(42, 'makson');
    expect(factionIgnoresSupply(state, 'expedition')).toBe(true);
    expect(factionIgnoresMorale(state, 'expedition')).toBe(false);
    state.cities['moss-market'].ownerFactionId = 'expedition';

    const move = moveArmy(state, prototypeMap, {
      armyId: 'player-main',
      toNodeId: 'moss-market',
      supplyCost: 6,
    });
    expect(move.ok).toBe(true);
    if (!move.ok) return;
    expect(move.state.factions.expedition.resources.supplies).toBe(80);
  });
});
