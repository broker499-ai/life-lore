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
    expect(first.rngState.cursor).toBeGreaterThanOrEqual(first.roundsFought * 2);
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
      sideBMorale: 59,
      rngCursor: 10,
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

describe('Stage 45 reactive flank battle', () => {
  const reactiveInput = {
    battleId: 'reactive-flanks',
    scale: 'battle' as const,
    sideA: {
      factionId: 'expedition',
      roster: { 'expedition-infantry': 36, 'expedition-rangers': 12 },
      morale: 78,
      tactic: 'balanced' as const,
      autoRestVictoriousLanes: true,
      plan: {
        formation: 'line' as const,
        reservePercent: 0 as const,
        reserveTarget: 'center' as const,
        commands: [
          'flank_left_to_center' as const,
          'defend_center' as const,
          'flank_right_to_center' as const,
          'defend_left' as const,
          'flank_center_to_right' as const,
        ],
        commandRounds: [1, 1, 2, 3, 4],
        retreatMoraleThreshold: null,
      },
    },
    sideB: {
      factionId: 'orssia-neutral',
      roster: { 'orssian-guard': 38, 'orssian-slingers': 10 },
      morale: 74,
      tactic: 'balanced' as const,
      randomizeFlanks: true,
      reactiveLanePostures: true,
    },
  };

  it('keeps total enemy force while seeded-randomizing its flank allocation and morale', () => {
    const result = simulateBattle(reactiveInput, createRngState(145), prototypeUnits, prototypeBattleRules);
    const initial = result.timeline.find((event) => event.type === 'formation_set' && event.side === 'B');
    expect(initial?.type).toBe('formation_set');
    if (!initial || initial.type !== 'formation_set') return;
    const sectors = initial.snapshot.sectors;
    expect(sectors.left.units + sectors.center.units + sectors.right.units + initial.snapshot.reserveUnits).toBe(48);
    expect(new Set([sectors.left.units, sectors.center.units, sectors.right.units]).size).toBeGreaterThan(1);
    expect(Math.min(sectors.left.morale, sectors.center.morale, sectors.right.morale)).toBeLessThan(
      Math.max(sectors.left.morale, sectors.center.morale, sectors.right.morale),
    );
  });

  it('telegraphs a posture for every living enemy lane and remains deterministic', () => {
    const first = simulateBattle(reactiveInput, createRngState(246), prototypeUnits, prototypeBattleRules);
    const replay = simulateBattle(reactiveInput, createRngState(246), prototypeUnits, prototypeBattleRules);
    expect(replay).toEqual(first);
    const firstRoundPostures = first.timeline.filter(
      (event) => event.type === 'lane_posture' && event.side === 'B' && event.round === 1 && event.at < 1.15,
    );
    expect(firstRoundPostures).toHaveLength(3);
    expect(firstRoundPostures.every((event) => event.type === 'lane_posture' && ['assault', 'rest', 'cautious'].includes(event.posture))).toBe(true);
  });


  it('rewards deep defense against a telegraphed assault and pressure against a resting lane', () => {
    const makeReactionInput = (command?: 'defend_center' | 'flank_center_to_center') => ({
      battleId: 'reaction-counter',
      scale: 'battle' as const,
      sideA: {
        factionId: 'expedition',
        roster: { 'expedition-infantry': 54 },
        morale: 78,
        tactic: 'balanced' as const,
        autoRestVictoriousLanes: true,
        plan: {
          formation: 'line' as const,
          reservePercent: 0 as const,
          reserveTarget: 'center' as const,
          commands: command ? [command] : [],
          commandRounds: command ? [1] : [],
          retreatMoraleThreshold: null,
        },
      },
      sideB: {
        factionId: 'orssia-neutral',
        roster: { 'orssian-guard': 45 },
        morale: 72,
        tactic: 'balanced' as const,
        randomizeFlanks: true,
        reactiveLanePostures: true,
        plan: { formation: 'line' as const, reservePercent: 0 as const, reserveTarget: 'center' as const, commands: [], retreatMoraleThreshold: null },
      },
    });

    const assaultBase = simulateBattle(makeReactionInput(), createRngState(2), prototypeUnits, prototypeBattleRules);
    const defended = simulateBattle(makeReactionInput('defend_center'), createRngState(2), prototypeUnits, prototypeBattleRules);
    const assaultTelegraph = assaultBase.timeline.find((event) => event.type === 'lane_posture' && event.side === 'B' && event.round === 1 && event.lane === 'center');
    expect(assaultTelegraph?.type === 'lane_posture' ? assaultTelegraph.posture : null).toBe('assault');
    expect(defended.sides.A.moraleAfter).toBeGreaterThan(assaultBase.sides.A.moraleAfter);

    const restBase = simulateBattle(makeReactionInput(), createRngState(3), prototypeUnits, prototypeBattleRules);
    const pressured = simulateBattle(makeReactionInput('flank_center_to_center'), createRngState(3), prototypeUnits, prototypeBattleRules);
    const restTelegraph = restBase.timeline.find((event) => event.type === 'lane_posture' && event.side === 'B' && event.round === 1 && event.lane === 'center');
    expect(restTelegraph?.type === 'lane_posture' ? restTelegraph.posture : null).toBe('rest');
    expect(pressured.sides.B.totalLosses).toBeGreaterThanOrEqual(restBase.sides.B.totalLosses);
    expect(pressured.sides.B.moraleAfter).toBeLessThanOrEqual(restBase.sides.B.moraleAfter);
  });


  it('interrupts a resting enemy lane when that lane is pressured', () => {
    const makeInput = (command?: 'flank_center_to_center') => ({
      battleId: 'rest-interruption',
      scale: 'battle' as const,
      sideA: {
        factionId: 'expedition',
        roster: { 'expedition-infantry': 54 },
        morale: 80,
        tactic: 'balanced' as const,
        plan: { formation: 'line' as const, reservePercent: 0 as const, reserveTarget: 'center' as const, commands: command ? [command] : [], commandRounds: command ? [1] : [], retreatMoraleThreshold: null },
      },
      sideB: {
        factionId: 'orssia-neutral',
        roster: { 'orssian-guard': 45 },
        morale: 72,
        tactic: 'balanced' as const,
        randomizeFlanks: true,
        reactiveLanePostures: true,
        plan: { formation: 'line' as const, reservePercent: 0 as const, reserveTarget: 'center' as const, commands: [], retreatMoraleThreshold: null },
      },
    });
    const base = simulateBattle(makeInput(), createRngState(3), prototypeUnits, prototypeBattleRules);
    const rest = base.timeline.find((event) => event.type === 'lane_posture' && event.side === 'B' && event.round === 1 && event.lane === 'center');
    expect(rest?.type === 'lane_posture' ? rest.posture : null).toBe('rest');
    const pressured = simulateBattle(makeInput('flank_center_to_center'), createRngState(3), prototypeUnits, prototypeBattleRules);
    expect(pressured.timeline.some((event) => event.type === 'lane_posture' && event.side === 'B' && event.round === 1 && event.lane === 'center' && event.posture === 'rest_broken')).toBe(true);
  });

  it('lets Gleb Khleb occupy the center alone with morale locked at 100', () => {
    const result = simulateBattle({
      battleId: 'gleb-khleb-lane',
      scale: 'battle',
      sideA: {
        factionId: 'expedition',
        roster: { 'gleb-khleb': 1, 'expedition-infantry': 30 },
        morale: 46,
        tactic: 'balanced',
        plan: { formation: 'line', reservePercent: 0, reserveTarget: 'center', commands: [], retreatMoraleThreshold: null },
      },
      sideB: {
        factionId: 'orssia-neutral',
        roster: { 'orssian-guard': 40 },
        morale: 74,
        tactic: 'balanced',
        randomizeFlanks: true,
        reactiveLanePostures: true,
      },
    }, createRngState(991), prototypeUnits, prototypeBattleRules);
    const initial = result.timeline.find((event) => event.type === 'formation_set' && event.side === 'A');
    expect(initial?.type).toBe('formation_set');
    if (!initial || initial.type !== 'formation_set') return;
    expect(initial.snapshot.sectors.center.units).toBe(1);
    const finalCenter = result.sides.A.sectorState.sectors.center;
    if (finalCenter.units > 0) expect(finalCenter.morale).toBe(100);
  });

  it('keeps more than two live orders instead of truncating the battle plan', () => {
    const result = simulateBattle(reactiveInput, createRngState(347), prototypeUnits, prototypeBattleRules);
    expect(result.sides.A.plan.commands).toHaveLength(5);
    expect(result.timeline.filter((event) => event.type === 'command_order' && event.side === 'A')).toHaveLength(5);
  });

  it('resets only the selected lane to cautious fighting with a scoped clear command', () => {
    const input = {
      ...reactiveInput,
      battleId: 'scoped-cautious-clear',
      sideA: {
        ...reactiveInput.sideA,
        plan: {
          ...reactiveInput.sideA.plan,
          commands: ['flank_center_to_center' as const, 'defend_left' as const, 'clear_center' as const],
          commandRounds: [1, 1, 2],
        },
      },
    };
    const result = simulateBattle(input, createRngState(448), prototypeUnits, prototypeBattleRules);
    expect(result.sides.A.plan.commands).toEqual(['flank_center_to_center', 'defend_left', 'clear_center']);
    expect(result.timeline.some((event) => event.type === 'command_order' && event.side === 'A' && event.round === 2 && event.command === 'clear_center')).toBe(true);
    expect(result.timeline.some((event) => event.type === 'command_order' && event.side === 'A' && event.command === 'defend_left')).toBe(true);
  });
  it('splits a full battle into four stage boundaries and resets surviving lanes there', () => {
    const result = simulateBattle(
      {
        battleId: 'four-stage-boundaries',
        scale: 'battle',
        sideA: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 60 },
          morale: 100,
          tactic: 'balanced',
          plan: { formation: 'line', reservePercent: 0, reserveTarget: 'center', commands: ['defend_left'], commandRounds: [1], retreatMoraleThreshold: null },
        },
        sideB: {
          factionId: 'orssia-neutral',
          roster: { 'orssian-guard': 72 },
          morale: 100,
          tactic: 'balanced',
          reactiveLanePostures: true,
        },
      },
      createRngState(4801),
      prototypeUnits,
      prototypeBattleRules,
    );

    const stages = result.timeline.filter((event) => event.type === 'stage_transition');
    expect(stages.map((event) => event.stage)).toEqual([1, 2, 3, 4]);
    for (const boundary of stages.slice(1)) {
      expect(result.timeline.some((event) => event.type === 'lane_posture' && event.side === 'A' && event.round === boundary.round && event.posture === 'engage')).toBe(true);
    }
  });

  it('lets Morpheus keep two enemy lanes asleep across all four stages', () => {
    const result = simulateBattle(
      {
        battleId: 'morpheus-forced-rest',
        scale: 'battle',
        sideA: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 45, 'sirius-morpheus-nan': 1 },
          laneRosters: {
            left: { 'expedition-infantry': 22 },
            center: { 'sirius-morpheus-nan': 1 },
            right: { 'expedition-infantry': 23 },
          },
          morale: 100,
          tactic: 'balanced',
        },
        sideB: {
          factionId: 'orssia-neutral',
          roster: { 'orssian-guard': 96 },
          morale: 100,
          tactic: 'balanced',
          reactiveLanePostures: true,
        },
      },
      createRngState(4802),
      prototypeUnits,
      prototypeBattleRules,
    );

    const forced = ['left', 'right'] as const;
    for (const lane of forced) {
      expect(result.timeline.some((event) => event.type === 'lane_posture' && event.side === 'B' && event.lane === lane && event.posture === 'rest')).toBe(true);
      expect(result.timeline.some((event) => event.type === 'lane_posture' && event.side === 'B' && event.lane === lane && event.posture === 'rest_broken')).toBe(false);
    }
  });

  it('fires Xiang on the boundary after stage three', () => {
    const result = simulateBattle(
      {
        battleId: 'xiang-stage-three-boundary',
        scale: 'battle',
        sideA: {
          factionId: 'expedition',
          roster: { 'expedition-infantry': 50, xiang: 1 },
          laneRosters: { left: { 'expedition-infantry': 25 }, center: { xiang: 1 }, right: { 'expedition-infantry': 25 } },
          morale: 100,
          tactic: 'balanced',
        },
        sideB: { factionId: 'orssia-neutral', roster: { 'orssian-guard': 120 }, morale: 100, tactic: 'balanced' },
      },
      createRngState(4803),
      prototypeUnits,
      prototypeBattleRules,
    );
    const stageFour = result.timeline.find((event) => event.type === 'stage_transition' && event.stage === 4);
    const xiang = result.timeline.find((event) => event.type === 'late_flank_strike' && event.unitTypeId === 'xiang');
    expect(stageFour).toBeTruthy();
    expect(xiang).toBeTruthy();
    if (stageFour?.type === 'stage_transition' && xiang?.type === 'late_flank_strike') {
      expect(xiang.round).toBe(stageFour.round);
    }
  });

});
