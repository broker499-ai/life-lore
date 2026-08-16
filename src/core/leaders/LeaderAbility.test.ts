import { describe, expect, it } from 'vitest';
import { attackCity } from '@/core/cities/attackCity';
import { moveArmy } from '@/core/map/moveArmy';
import {
  factionKnowsFullMap,
  getArtifactEffectMultiplier,
  getMoraleDamageInflictedMultiplier,
} from '@/core/leaders/LeaderAbility';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeMap } from '@/data/map/prototypeMap';
import { prototypeUnits } from '@/data/units/prototypeUnits';

const deps = { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules };

describe('leader abilities', () => {
  it('Artemios ignores supply costs for movement and attacks', () => {
    const state = createPrototypeGameState(42, 'artemios');
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

  it('Makson exposes a stronger morale-damage multiplier and applies it in battle', () => {
    const normal = createPrototypeGameState(42, 'vlados');
    const makson = createPrototypeGameState(42, 'makson');
    expect(getMoraleDamageInflictedMultiplier(makson, 'expedition')).toBe(1.25);

    const normalBattle = attackCity(
      normal,
      prototypeMap,
      { armyId: 'player-main', cityId: 'moss-market', tactic: 'balanced', supplyCost: 8 },
      deps,
    );
    const maksonBattle = attackCity(
      makson,
      prototypeMap,
      { armyId: 'player-main', cityId: 'moss-market', tactic: 'balanced', supplyCost: 8 },
      deps,
    );
    if (!normalBattle.ok || !maksonBattle.ok || !normalBattle.battle || !maksonBattle.battle) {
      throw new Error('expected deterministic battles');
    }
    const normalFirstMorale = normalBattle.battle.timeline.find(
      (event) => event.type === 'morale_change' && event.side === 'B',
    );
    const maksonFirstMorale = maksonBattle.battle.timeline.find(
      (event) => event.type === 'morale_change' && event.side === 'B',
    );
    if (!normalFirstMorale || normalFirstMorale.type !== 'morale_change' || !maksonFirstMorale || maksonFirstMorale.type !== 'morale_change') {
      throw new Error('expected morale events');
    }
    expect(maksonFirstMorale.after).toBeLessThan(normalFirstMorale.after);
  });
});
