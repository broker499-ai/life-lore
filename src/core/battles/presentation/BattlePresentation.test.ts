import { describe, expect, it } from 'vitest';
import { buildBattlePresentation } from '@/core/battles/presentation/BattlePresentation';
import { simulateBattle } from '@/core/battles/simulateBattle';
import { createRngState } from '@/core/rng/seededRandom';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeUnits } from '@/data/units/prototypeUnits';

function makeBattle() {
  return simulateBattle(
    {
      battleId: 'presentation-42',
      scale: 'skirmish',
      sideA: {
        factionId: 'expedition',
        roster: { 'expedition-infantry': 20, 'expedition-rangers': 4 },
        morale: 80,
        tactic: 'balanced',
      },
      sideB: {
        factionId: 'orssia-neutral',
        roster: { 'orssian-guard': 14, 'orssian-slingers': 6 },
        morale: 72,
        tactic: 'cautious',
      },
    },
    createRngState(42),
    prototypeUnits,
    prototypeBattleRules,
  );
}

describe('buildBattlePresentation', () => {
  it('turns the simulation timeline into chronological visualization frames', () => {
    const battle = makeBattle();
    const presentation = buildBattlePresentation(battle);

    expect(presentation.frames.length).toBeGreaterThan(4);
    expect(presentation.frames[0]?.phase).toBe('opening');
    expect(presentation.frames.at(-1)?.phase).toBe('finish');
    expect(presentation.frames.map((frame) => frame.at)).toEqual(
      [...presentation.frames].map((frame) => frame.at).sort((a, b) => a - b),
    );
  });

  it('ends with the exact unit and morale totals returned by the simulator', () => {
    const battle = makeBattle();
    const last = buildBattlePresentation(battle).frames.at(-1);

    expect(last?.sides.A.units).toBe(battle.sides.A.remainingUnits);
    expect(last?.sides.B.units).toBe(battle.sides.B.remainingUnits);
    expect(last?.sides.A.morale).toBe(battle.sides.A.moraleAfter);
    expect(last?.sides.B.morale).toBe(battle.sides.B.moraleAfter);
    expect(last?.sides.A.totalLosses).toBe(battle.sides.A.totalLosses);
    expect(last?.sides.B.totalLosses).toBe(battle.sides.B.totalLosses);
    expect(last?.sides.A.roster).toEqual(battle.sides.A.remainingRoster);
    expect(last?.sides.B.roster).toEqual(battle.sides.B.remainingRoster);
  });

  it('contains clash and morale phases without inventing new simulation results', () => {
    const presentation = buildBattlePresentation(makeBattle());
    expect(presentation.frames.some((frame) => frame.phase === 'clash')).toBe(true);
    expect(presentation.frames.some((frame) => frame.phase === 'morale')).toBe(true);
  });
});
