import { describe, expect, it } from 'vitest';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeUnits } from '@/data/units/prototypeUnits';
import { getArmySummary, getArmyTotalUnits } from './armyStats';

describe('armyStats', () => {
  it('derives total count, combat stats and upkeep from roster data', () => {
    const army = createPrototypeGameState().armies['player-main'];
    const summary = getArmySummary(army, prototypeUnits);

    expect(getArmyTotalUnits(army)).toBe(24);
    expect(summary).toMatchObject({
      totalUnits: 24,
      totalAttack: 152,
      totalDefense: 156,
      upkeep: 7,
    });
  });

  it('rejects invalid roster amounts', () => {
    const army = createPrototypeGameState().armies['player-main'];
    army.roster['expedition-infantry'] = -1;

    expect(() => getArmySummary(army, prototypeUnits)).toThrow(
      'Army roster amounts must be non-negative integers',
    );
  });
});
