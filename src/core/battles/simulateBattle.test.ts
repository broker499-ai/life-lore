import { describe, expect, it } from 'vitest';
import { simulateBattle } from '@/core/battles/simulateBattle';
import { createRngState } from '@/core/rng/seededRandom';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeUnits } from '@/data/units/prototypeUnits';

const baseBattle = {
  battleId: 'golden-battle-42',
  scale: 'skirmish' as const,
  sideA: {
    factionId: 'expedition',
    roster: {
      'expedition-infantry': 20,
      'expedition-rangers': 4,
    },
    morale: 80,
    tactic: 'balanced' as const,
  },
  sideB: {
    factionId: 'orssia-neutral',
    roster: {
      'orssian-guard': 14,
      'orssian-slingers': 6,
    },
    morale: 72,
    tactic: 'cautious' as const,
  },
};

describe('simulateBattle', () => {
  it('is deterministic and advances only the supplied battle RNG state', () => {
    const rng = createRngState(42);
    const first = simulateBattle(baseBattle, rng, prototypeUnits, prototypeBattleRules);
    const replay = simulateBattle(baseBattle, rng, prototypeUnits, prototypeBattleRules);

    expect(replay).toEqual(first);
    expect(first.rngState.cursor).toBe(first.roundsFought * 2);
    expect(rng.cursor).toBe(0);
  });

  it('preserves unit accounting for both sides', () => {
    const result = simulateBattle(
      baseBattle,
      createRngState(99),
      prototypeUnits,
      prototypeBattleRules,
    );

    for (const side of [result.sides.A, result.sides.B]) {
      expect(side.remainingUnits + side.totalLosses).toBe(side.initialUnits);
      expect(side.moraleAfter).toBeGreaterThanOrEqual(0);
      expect(side.moraleAfter).toBeLessThanOrEqual(100);
    }
  });

  it('uses one simulator for both battle scales', () => {
    const skirmish = simulateBattle(
      baseBattle,
      createRngState(7),
      prototypeUnits,
      prototypeBattleRules,
    );
    const battle = simulateBattle(
      { ...baseBattle, battleId: 'large-7', scale: 'battle' },
      createRngState(7),
      prototypeUnits,
      prototypeBattleRules,
    );

    expect(skirmish.scale).toBe('skirmish');
    expect(battle.scale).toBe('battle');
    expect(battle.roundsFought).toBeGreaterThanOrEqual(skirmish.roundsFought);
  });

  it('returns a visualization-ready timeline ending with battle_end', () => {
    const result = simulateBattle(
      baseBattle,
      createRngState(123),
      prototypeUnits,
      prototypeBattleRules,
    );

    expect(result.timeline[0]?.type).toBe('battle_start');
    expect(result.timeline.at(-1)?.type).toBe('battle_end');
    expect(result.timeline.some((event) => event.type === 'casualties')).toBe(true);
    expect(result.timeline.some((event) => event.type === 'morale_change')).toBe(true);
  });
  it('matches the fixed golden result for seed 42', () => {
    const result = simulateBattle(
      baseBattle,
      createRngState(42),
      prototypeUnits,
      prototypeBattleRules,
    );

    expect({
      winnerSide: result.winnerSide,
      roundsFought: result.roundsFought,
      sideAOutcome: result.sides.A.outcome,
      sideALosses: result.sides.A.losses,
      sideAMorale: result.sides.A.moraleAfter,
      sideBOutcome: result.sides.B.outcome,
      sideBLosses: result.sides.B.losses,
      sideBMorale: result.sides.B.moraleAfter,
      rngCursor: result.rngState.cursor,
    }).toEqual({
      winnerSide: 'A',
      roundsFought: 4,
      sideAOutcome: 'victory',
      sideALosses: { 'expedition-infantry': 4 },
      sideAMorale: 65,
      sideBOutcome: 'retreat',
      sideBLosses: { 'orssian-guard': 4, 'orssian-slingers': 2 },
      sideBMorale: 44,
      rngCursor: 8,
    });
  });

  it('can produce rout and pyrrhic victory outcomes', () => {
    const rout = simulateBattle(
      {
        ...baseBattle,
        battleId: 'rout-case',
        scale: 'battle',
        sideA: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 35, 'expedition-rangers': 10 },
          morale: 90,
          tactic: 'assault',
        },
        sideB: {
          factionId: 'orssia-neutral',
          roster: { 'orssian-guard': 8, 'orssian-slingers': 2 },
          morale: 55,
          tactic: 'balanced',
        },
      },
      createRngState(1),
      prototypeUnits,
      prototypeBattleRules,
    );
    expect(rout.sides.B.outcome).toBe('rout');

    const pyrrhic = simulateBattle(
      {
        ...baseBattle,
        battleId: 'pyrrhic-case',
        scale: 'battle',
        sideA: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 30, 'expedition-rangers': 10 },
          morale: 35,
          tactic: 'cautious',
        },
        sideB: {
          factionId: 'orssia-neutral',
          roster: { 'orssian-guard': 20, 'orssian-slingers': 6 },
          morale: 70,
          tactic: 'balanced',
        },
      },
      createRngState(1),
      prototypeUnits,
      prototypeBattleRules,
    );
    expect(pyrrhic.sides.A.outcome).toBe('pyrrhic_victory');
  });

});
