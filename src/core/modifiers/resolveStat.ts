import type { Modifier, ModifierTarget } from '@/core/modifiers/Modifier';

export function resolveStat(
  base: number,
  modifiers: readonly Modifier[],
  target: ModifierTarget,
): number {
  const relevant = modifiers.filter((modifier) => modifier.target === target);

  const additive = relevant
    .filter((modifier) => modifier.op === 'add')
    .reduce((sum, modifier) => sum + modifier.value, 0);

  const multiplier = relevant
    .filter((modifier) => modifier.op === 'mul')
    .reduce((product, modifier) => product * modifier.value, 1);

  return (base + additive) * multiplier;
}
