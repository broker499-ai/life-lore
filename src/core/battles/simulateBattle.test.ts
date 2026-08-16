import { describe, expect, it } from 'vitest';
import { getTacticalCasualtyTakenMultiplier, getTacticalMoraleLossMultiplier, simulateBattle } from '@/core/battles/simulateBattle';
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

  it('reverses own-casualty risk by tactic as superiority grows', () => {
    const parity = { own: 100, enemy: 100 };
    const superiority = { own: 180, enemy: 100 };

    const parityAssault = getTacticalCasualtyTakenMultiplier('assault', parity.own, parity.enemy, prototypeBattleRules);
    const parityBalanced = getTacticalCasualtyTakenMultiplier('balanced', parity.own, parity.enemy, prototypeBattleRules);
    const parityCautious = getTacticalCasualtyTakenMultiplier('cautious', parity.own, parity.enemy, prototypeBattleRules);
    expect(parityAssault).toBeGreaterThan(parityBalanced);
    expect(parityBalanced).toBeGreaterThan(parityCautious);

    const superiorAssault = getTacticalCasualtyTakenMultiplier('assault', superiority.own, superiority.enemy, prototypeBattleRules);
    const superiorBalanced = getTacticalCasualtyTakenMultiplier('balanced', superiority.own, superiority.enemy, prototypeBattleRules);
    const superiorCautious = getTacticalCasualtyTakenMultiplier('cautious', superiority.own, superiority.enemy, prototypeBattleRules);
    expect(superiorAssault).toBeLessThan(superiorBalanced);
    expect(superiorBalanced).toBeLessThan(superiorCautious);
  });

  it('increases assault morale loss from round three when the battle drags on', () => {
    const assault = prototypeBattleRules.tactics.assault;
    expect(getTacticalMoraleLossMultiplier(assault, 2)).toBeCloseTo(1.04, 6);
    expect(getTacticalMoraleLossMultiplier(assault, 3)).toBeCloseTo(1.04 * 1.38, 6);
    expect(getTacticalMoraleLossMultiplier(prototypeBattleRules.tactics.balanced, 4)).toBeCloseTo(1, 6);
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
      sideBLosses: { 'orssian-guard': 4 },
      sideBMorale: 51,
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
          roster: { 'expedition-infantry': 16 },
          morale: 40,
          tactic: 'assault',
        },
        sideB: {
          factionId: 'orssia-neutral',
          roster: { 'orssian-guard': 12 },
          morale: 45,
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

describe('Stage 22 faction battle effects', () => {
  it('can raise morale during battle through a seeded random morale gain effect', () => {
    const result = simulateBattle(
      {
        battleId: 'orc-morale-surge',
        scale: 'battle',
        sideA: {
          factionId: 'orsia-orcs',
          roster: { 'orssian-guard': 20 },
          morale: 55,
          tactic: 'balanced',
          randomMoraleGain: { chancePercent: 100, minGain: 10, maxGain: 10 },
        },
        sideB: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 20 },
          morale: 55,
          tactic: 'balanced',
        },
      },
      { seed: 123, cursor: 0 },
      prototypeUnits,
      prototypeBattleRules,
    );

    const moraleEvents = result.timeline.filter(
      (event) => event.type === 'morale_change' && event.side === 'A',
    );
    expect(moraleEvents.some((event) => event.type === 'morale_change' && event.after > event.before)).toBe(true);
  });

  it('applies a unit power multiplier to both combat and final-strength resolution', () => {
    const result = simulateBattle(
      {
        battleId: 'weak-goblins',
        scale: 'battle',
        sideA: {
          factionId: 'orsia-goblins',
          roster: { 'orssian-guard': 40 },
          morale: 75,
          tactic: 'balanced',
          unitPowerMultiplier: 0.45,
        },
        sideB: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 20 },
          morale: 75,
          tactic: 'balanced',
        },
      },
      { seed: 456, cursor: 0 },
      prototypeUnits,
      prototypeBattleRules,
    );

    expect(result.sides.A.totalLosses).toBeGreaterThan(0);
    expect(result.winnerFactionId).toBe('expedition');
  });
});
