import { describe, expect, it } from 'vitest';
import type { Modifier } from './Modifier';
import { resolveStat } from './resolveStat';

describe('resolveStat', () => {
  it('applies all adds before all multipliers', () => {
    const modifiers: Modifier[] = [
      { target: 'city.income', op: 'mul', value: 1.1, source: 'leader:test' },
      { target: 'city.income', op: 'add', value: 20, source: 'city:test' },
      { target: 'army.upkeep', op: 'mul', value: 5, source: 'irrelevant:test' },
    ];

    expect(resolveStat(100, modifiers, 'city.income')).toBeCloseTo(132);
  });
});
