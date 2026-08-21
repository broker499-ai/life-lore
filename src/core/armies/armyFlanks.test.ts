import { describe, expect, it } from 'vitest';
import {
  autoDistributeArmyGroups,
  canMergeArmyGroups,
  mergeArmyGroups,
  splitArmyGroup,
  moveArmyGroup,
  swapArmyFlanks,
} from '@/core/armies/armyFlanks';
import type { ArmyState } from '@/core/state/GameState';
import { prototypeUnits } from '@/data/units/prototypeUnits';

function army(): ArmyState {
  return {
    id: 'player-main', factionId: 'player', nodeId: 'outer-post', morale: 80,
    roster: { 'expedition-infantry': 16, philosophers: 4, economists: 3 },
    groups: [
      { id: 'fresh-a', flank: 'left', roster: { 'expedition-infantry': 8 }, unique: false },
      { id: 'fresh-b', flank: 'left', roster: { 'expedition-infantry': 8 }, unique: false },
      { id: 'philos', flank: 'center', roster: { philosophers: 4 }, unique: false },
      { id: 'econ', flank: 'right', roster: { economists: 3 }, unique: false },
    ],
  };
}

describe('persistent flank manipulation', () => {
  it('moves one recruitment group without changing the army roster', () => {
    const before = army();
    const next = moveArmyGroup(before, 'philos', 'right');
    expect(next.groups?.find((group) => group.id === 'philos')?.flank).toBe('right');
    expect(next.roster).toEqual(before.roster);
  });

  it('merges compatible groups and preserves their total roster', () => {
    const before = army();
    expect(canMergeArmyGroups(before, 'fresh-a', 'fresh-b')).toBe(true);
    const next = mergeArmyGroups(before, 'fresh-a', 'fresh-b');
    expect(next.groups?.find((group) => group.id === 'fresh-a')).toBeUndefined();
    expect(next.groups?.find((group) => group.id === 'fresh-b')?.roster['expedition-infantry']).toBe(16);
    expect(next.roster).toEqual(before.roster);
  });

  it('does not merge unlike units', () => {
    const before = army();
    expect(canMergeArmyGroups(before, 'philos', 'econ')).toBe(false);
    expect(mergeArmyGroups(before, 'philos', 'econ')).toEqual(before);
  });


  it('splits an ordinary group into two without changing the total roster', () => {
    const before = army();
    const next = splitArmyGroup(before, 'fresh-a', 2);
    const freshGroups = next.groups?.filter((group) => (group.roster['expedition-infantry'] ?? 0) > 0) ?? [];
    expect(freshGroups).toHaveLength(3);
    expect(freshGroups.reduce((sum, group) => sum + (group.roster['expedition-infantry'] ?? 0), 0)).toBe(16);
    expect(next.roster).toEqual(before.roster);
  });

  it('splits a group into three balanced non-empty parts', () => {
    const before = army();
    const next = splitArmyGroup(before, 'fresh-a', 3);
    const split = next.groups?.filter((group) => group.id === 'fresh-a' || group.id.startsWith('fresh-a-split3-')) ?? [];
    expect(split).toHaveLength(3);
    expect(split.map((group) => group.roster['expedition-infantry']).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([2, 3, 3]);
    expect(next.roster).toEqual(before.roster);
  });

  it('does not split unique groups', () => {
    const before = army();
    const unique: ArmyState = {
      ...before,
      roster: { ...before.roster, xiang: 1 },
      groups: [...(before.groups ?? []), { id: 'hero', flank: 'center', roster: { xiang: 1 }, unique: true }],
    };
    expect(splitArmyGroup(unique, 'hero', 2)).toEqual(unique);
  });

  it('auto-balances regular groups deterministically', () => {
    const next = autoDistributeArmyGroups(army(), prototypeUnits);
    const repeat = autoDistributeArmyGroups(army(), prototypeUnits);
    expect(next.groups).toEqual(repeat.groups);
    expect(new Set(next.groups?.map((group) => group.flank))).toEqual(new Set(['left', 'center', 'right']));
  });

  it('keeps unique groups together and ordinary groups out of their flank', () => {
    const before = army();
    before.roster['sirius-morpheus-nan'] = 1;
    before.roster.xiang = 1;
    before.groups?.push(
      { id: 'morpheus', flank: 'center', roster: { 'sirius-morpheus-nan': 1 }, unique: true },
      { id: 'xiang', flank: 'right', roster: { xiang: 1 }, unique: true },
    );
    const next = autoDistributeArmyGroups(before, prototypeUnits);
    const uniqueFlanks = new Set(next.groups?.filter((group) => group.unique).map((group) => group.flank));
    expect(uniqueFlanks.size).toBe(1);
    const uniqueFlank = [...uniqueFlanks][0];
    expect(next.groups?.filter((group) => !group.unique).every((group) => group.flank !== uniqueFlank)).toBe(true);
  });

  it('swaps whole flanks', () => {
    const next = swapArmyFlanks(army(), 'left', 'right');
    expect(next.groups?.find((group) => group.id === 'fresh-a')?.flank).toBe('right');
    expect(next.groups?.find((group) => group.id === 'econ')?.flank).toBe('left');
  });
});
