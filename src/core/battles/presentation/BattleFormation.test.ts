import { describe, expect, it } from 'vitest';
import { getBattleFormationDots, getLanePressureShift } from '@/core/battles/presentation/BattleFormation';
import type { BattlePresentationSide } from '@/core/battles/presentation/BattlePresentation';
import { prototypeUnits } from '@/data/units/prototypeUnits';

function makeSide(roster: BattlePresentationSide['roster']): BattlePresentationSide {
  return {
    factionId: 'expedition',
    initialUnits: 24,
    units: Object.values(roster).reduce((sum, value) => sum + (value ?? 0), 0),
    morale: 80,
    totalLosses: 0,
    broken: false,
    outcome: null,
    initialRoster: { 'expedition-infantry': 20, 'expedition-rangers': 4 },
    roster,
    initialSectorState: {
      sectors: {
        left: { units: 6, morale: 80, broken: false, posture: 'engage' },
        center: { units: 12, morale: 80, broken: false, posture: 'engage' },
        right: { units: 6, morale: 80, broken: false, posture: 'engage' },
      },
      reserveUnits: 0,
      reserveCommitted: true,
    },
    sectorState: {
      sectors: {
        left: { units: 6, morale: 80, broken: false, posture: 'engage' },
        center: { units: 12, morale: 80, broken: false, posture: 'engage' },
        right: { units: 6, morale: 80, broken: false, posture: 'engage' },
      },
      reserveUnits: 0,
      reserveCommitted: true,
    },
  };
}

describe('BattleFormation', () => {
  it('places ranged dots behind line dots and distributes units across three lanes', () => {
    const side = makeSide({ 'expedition-infantry': 20, 'expedition-rangers': 4 });
    const dots = getBattleFormationDots({
      side: 'A',
      from: side,
      to: side,
      fromPhase: 'advance',
      toPhase: 'advance',
      tactic: 'balanced',
      winnerSide: null,
      overallPressureFrom: 0,
      overallPressureTo: 0,
      progress: 0.5,
      battleTime: 5,
      unitDefinitions: prototypeUnits,
    });

    const line = dots.filter((dot) => dot.role === 'line');
    const ranged = dots.filter((dot) => dot.role === 'ranged');
    expect(line.length).toBeGreaterThan(0);
    expect(ranged.length).toBeGreaterThan(0);
    expect(Math.max(...ranged.map((dot) => dot.x))).toBeLessThan(Math.max(...line.map((dot) => dot.x)));
    expect(new Set(dots.map((dot) => dot.lane))).toEqual(new Set(['left', 'center', 'right']));
  });

  it('fades ranged markers when ranged units are specifically lost', () => {
    const from = makeSide({ 'expedition-infantry': 20, 'expedition-rangers': 4 });
    const to = makeSide({ 'expedition-infantry': 20, 'expedition-rangers': 0 });
    const dots = getBattleFormationDots({
      side: 'A',
      from,
      to,
      fromPhase: 'clash',
      toPhase: 'clash',
      tactic: 'balanced',
      winnerSide: null,
      overallPressureFrom: 0,
      overallPressureTo: 0,
      progress: 1,
      battleTime: 8,
      unitDefinitions: prototypeUnits,
    });

    expect(dots.filter((dot) => dot.role === 'ranged').every((dot) => dot.opacity < 0.1)).toBe(true);
    expect(dots.filter((dot) => dot.role === 'line').some((dot) => dot.opacity > 0.8)).toBe(true);
  });

  it('keeps every visible marker in the center lane for center-only formations', () => {
    const side = makeSide({ 'expedition-infantry': 20, 'expedition-rangers': 4 });
    const dots = getBattleFormationDots({
      side: 'B',
      from: side,
      to: side,
      fromPhase: 'clash',
      toPhase: 'clash',
      tactic: 'balanced',
      winnerSide: null,
      overallPressureFrom: 0,
      overallPressureTo: 0,
      progress: 0.5,
      battleTime: 6,
      unitDefinitions: prototypeUnits,
      centerOnly: true,
    });

    expect(dots.length).toBeGreaterThan(0);
    expect(new Set(dots.map((dot) => dot.lane))).toEqual(new Set(['center']));
    expect(dots.every((dot) => dot.y > 37.5 && dot.y < 62.5)).toBe(true);
  });

  it('makes flank tactic push outer lanes more than the center', () => {
    const left = getLanePressureShift('left', 0, 'flank', 'balanced');
    const center = getLanePressureShift('center', 0, 'flank', 'balanced');
    const right = getLanePressureShift('right', 0, 'flank', 'balanced');
    expect(left).toBeGreaterThan(center);
    expect(right).toBeGreaterThan(center);
  });
});
