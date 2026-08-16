import type { FactionId, GameState } from '@/core/state/GameState';

export type FactionTrait =
  | { type: 'ignore_supply' }
  | { type: 'artifact_effect_multiplier'; multiplier: number }
  | { type: 'map_revealed' }
  | { type: 'river_double_move'; everyTurns: number }
  | { type: 'morale_damage_inflicted_multiplier'; multiplier: number };

export function getFactionTrait<TType extends FactionTrait['type']>(
  state: GameState,
  factionId: FactionId,
  type: TType,
): Extract<FactionTrait, { type: TType }> | null {
  const faction = state.factions[factionId];
  if (!faction) return null;
  return (faction.traits.find((trait) => trait.type === type) as Extract<
    FactionTrait,
    { type: TType }
  > | undefined) ?? null;
}

export function factionIgnoresSupply(state: GameState, factionId: FactionId): boolean {
  return getFactionTrait(state, factionId, 'ignore_supply') !== null;
}

export function getArtifactEffectMultiplier(state: GameState, factionId: FactionId): number {
  return getFactionTrait(state, factionId, 'artifact_effect_multiplier')?.multiplier ?? 1;
}

export function factionKnowsFullMap(state: GameState, factionId: FactionId): boolean {
  return getFactionTrait(state, factionId, 'map_revealed') !== null;
}

export function getMoraleDamageInflictedMultiplier(
  state: GameState,
  factionId: FactionId,
): number {
  return getFactionTrait(state, factionId, 'morale_damage_inflicted_multiplier')?.multiplier ?? 1;
}

export function canUseRiverDoubleMove(state: GameState, factionId: FactionId): boolean {
  const faction = state.factions[factionId];
  const trait = getFactionTrait(state, factionId, 'river_double_move');
  if (!faction || !trait) return false;
  if (trait.everyTurns <= 0 || state.turn % trait.everyTurns !== 0) return false;
  return (
    faction.strategicActionSpent &&
    faction.lastStrategicAction === 'move' &&
    faction.leaderAbilityLastUsedTurn !== state.turn
  );
}
