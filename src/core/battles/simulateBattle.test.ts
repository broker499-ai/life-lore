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
      sideAMorale: 71,
      sideBOutcome: 'retreat',
      sideBLosses: { 'orssian-guard': 3, 'orssian-slingers': 1 },
      sideBMorale: 56,
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


  it('runs the three-sector plan, commits reserve and executes up to two command orders', () => {
    const result = simulateBattle(
      {
        battleId: 'sector-plan',
        scale: 'battle',
        sideA: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 30, 'expedition-rangers': 12 },
          morale: 80,
          tactic: 'flank',
          plan: {
            formation: 'crescent',
            reservePercent: 15,
            reserveTarget: 'right',
            commands: ['press_left', 'general_assault'],
            retreatMoraleThreshold: 30,
          },
        },
        sideB: {
          factionId: 'orssia-neutral',
          roster: { 'orssian-guard': 30, 'orssian-slingers': 8 },
          morale: 75,
          tactic: 'cautious',
        },
      },
      createRngState(42),
      prototypeUnits,
      prototypeBattleRules,
    );

    expect(result.timeline.filter((event) => event.type === 'command_order')).toHaveLength(2);
    expect(result.timeline.some((event) => event.type === 'reserve_committed' && event.side === 'A' && event.lane === 'right')).toBe(true);
    expect(result.timeline.some((event) => event.type === 'sector_status')).toBe(true);
    expect(result.sides.A.plan.formation).toBe('crescent');
    expect(result.sides.A.sectorState.reserveCommitted).toBe(true);
  });

  it('lets formation and live orders change the winner instead of only changing presentation', () => {
    const common = {
      battleId: 'command-impact',
      scale: 'battle' as const,
      sideA: {
        factionId: 'expedition',
        roster: { 'expedition-infantry': 18, 'expedition-rangers': 6 },
        morale: 72,
        tactic: 'balanced' as const,
      },
      sideB: {
        factionId: 'orssia-neutral',
        roster: { 'orssian-guard': 21, 'orssian-slingers': 5 },
        morale: 72,
        tactic: 'balanced' as const,
      },
    };
    const passive = simulateBattle(
      { ...common, sideA: { ...common.sideA, plan: { formation: 'line', reservePercent: 15, reserveTarget: 'center', commands: [], retreatMoraleThreshold: null } } },
      createRngState(1),
      prototypeUnits,
      prototypeBattleRules,
    );
    const intervention = simulateBattle(
      { ...common, sideA: { ...common.sideA, plan: { formation: 'crescent', reservePercent: 15, reserveTarget: 'left', commands: ['press_left', 'general_assault'], retreatMoraleThreshold: null } } },
      createRngState(1),
      prototypeUnits,
      prototypeBattleRules,
    );

    expect(passive.winnerSide).toBe('B');
    expect(intervention.winnerSide).toBe('A');
  });

  it('allows the same live order in both intervention slots', () => {
    const result = simulateBattle(
      {
        ...baseBattle,
        battleId: 'repeat-command',
        scale: 'battle',
        sideA: {
          ...baseBattle.sideA,
          roster: { 'expedition-infantry': 34, 'expedition-rangers': 10 },
          plan: { formation: 'line', reservePercent: 15, reserveTarget: 'center', commands: ['hold_line', 'hold_line'], retreatMoraleThreshold: null },
        },
        sideB: {
          ...baseBattle.sideB,
          roster: { 'orssian-guard': 32, 'orssian-slingers': 10 },
        },
      },
      createRngState(81),
      prototypeUnits,
      prototypeBattleRules,
    );

    expect(result.sides.A.plan.commands).toEqual(['hold_line', 'hold_line']);
    expect(result.timeline.filter((event) => event.type === 'command_order' && event.side === 'A')).toHaveLength(2);
  });

  it('turns lost flanks into an encirclement event instead of a cosmetic flank modifier', () => {
    const result = simulateBattle(
      {
        battleId: 'encirclement-case',
        scale: 'battle',
        sideA: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 30, 'expedition-rangers': 12 },
          morale: 80,
          tactic: 'flank',
          plan: { formation: 'crescent', reservePercent: 15, reserveTarget: 'right', commands: ['press_left', 'general_assault'], retreatMoraleThreshold: null },
        },
        sideB: {
          factionId: 'orssia-neutral',
          roster: { 'orssian-guard': 30, 'orssian-slingers': 8 },
          morale: 75,
          tactic: 'cautious',
        },
      },
      createRngState(42),
      prototypeUnits,
      prototypeBattleRules,
    );

    expect(result.timeline.some((event) => event.type === 'encirclement' && event.side === 'B')).toBe(true);
  });

  it('supports an organized retreat threshold that preserves retreat instead of waiting for a rout', () => {
    const result = simulateBattle(
      {
        battleId: 'organized-retreat',
        scale: 'battle',
        sideA: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 12 },
          morale: 50,
          tactic: 'cautious',
          plan: { formation: 'line', reservePercent: 0, reserveTarget: 'center', commands: ['hold_line'], retreatMoraleThreshold: 45 },
        },
        sideB: {
          factionId: 'orssia-neutral',
          roster: { 'orssian-guard': 30 },
          morale: 80,
          tactic: 'assault',
        },
      },
      createRngState(1),
      prototypeUnits,
      prototypeBattleRules,
    );

    expect(result.timeline.some((event) => event.type === 'organized_retreat' && event.side === 'A')).toBe(true);
    expect(result.sides.A.outcome).toBe('retreat');
    expect(result.winnerSide).toBe('B');
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

describe('Stage 36 Orc center-only formation', () => {
  it('places all Orc units in the center and makes flank pressure better than frontal pressure', () => {
    const makeInput = (command: 'press_left' | 'press_center') => ({
      battleId: `orc-center-${command}`,
      scale: 'battle' as const,
      sideA: {
        factionId: 'expedition',
        roster: { 'expedition-infantry': 50, 'expedition-rangers': 30 },
        morale: 80,
        tactic: 'balanced' as const,
        plan: { formation: 'crescent' as const, reservePercent: 0 as const, reserveTarget: 'center' as const, commands: [command], retreatMoraleThreshold: null },
      },
      sideB: {
        factionId: 'orsia-orcs',
        roster: { 'orssian-guard': 70 },
        morale: 80,
        tactic: 'balanced' as const,
        plan: { formation: 'line' as const, reservePercent: 0 as const, reserveTarget: 'center' as const, commands: [], retreatMoraleThreshold: null },
        centerOnlyFormation: true,
      },
    });

    const flank = simulateBattle(makeInput('press_left'), createRngState(1), prototypeUnits, prototypeBattleRules);
    const frontal = simulateBattle(makeInput('press_center'), createRngState(1), prototypeUnits, prototypeBattleRules);

    expect(flank.sides.B.centerOnlyFormation).toBe(true);
    expect(flank.sides.B.sectorState.sectors.left.units).toBe(0);
    expect(flank.sides.B.sectorState.sectors.right.units).toBe(0);
    expect(flank.sides.B.remainingUnits).toBeLessThanOrEqual(frontal.sides.B.remainingUnits);
    expect(flank.sides.B.moraleAfter).toBeLessThanOrEqual(frontal.sides.B.moraleAfter);
  });
});
