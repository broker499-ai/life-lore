import type { FactionId, GameState } from '@/core/state/GameState';

export function areFactionsAllied(
  state: GameState,
  a: FactionId | null | undefined,
  b: FactionId | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const factionA = state.factions[a];
  const factionB = state.factions[b];
  if (!factionA || !factionB) return false;
  return Boolean(
    factionA.superFactionId &&
      factionB.superFactionId &&
      factionA.superFactionId === factionB.superFactionId,
  );
}

export function areFactionsHostile(
  state: GameState,
  a: FactionId | null | undefined,
  b: FactionId | null | undefined,
): boolean {
  if (!a || !b) return true;
  return !areFactionsAllied(state, a, b);
}
