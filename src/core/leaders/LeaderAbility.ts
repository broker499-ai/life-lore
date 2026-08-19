import type { BattleTacticId } from '@/core/battles/BattleTypes';
import type { FactionId, GameState } from '@/core/state/GameState';

export type FactionTrait = (
  | { type: 'ignore_supply' }
  | { type: 'ignore_morale' }
  | { type: 'artifact_effect_multiplier'; multiplier: number }
  | { type: 'map_revealed' }
  | { type: 'river_double_move'; everyTurns: number }
  | { type: 'morale_damage_inflicted_multiplier'; multiplier: number }
  | { type: 'battle_morale_loss_taken_multiplier'; multiplier: number }
  | { type: 'incoming_casualty_multiplier_by_enemy_tactic'; enemyTactics: BattleTacticId[]; multiplier: number }
  | { type: 'initial_garrison_morale_floor'; value: number }
  | { type: 'defeat_reaction'; eventId: string; triggerOpponent: 'player' | 'any_hostile' }
  | { type: 'supply_action_cost_multiplier'; multiplier: number }
  | { type: 'map_vision_radius_add'; amount: number }
  | { type: 'army_upkeep_multiplier'; multiplier: number }
  | { type: 'city_income_multiplier'; multiplier: number }
  | { type: 'root_specimen_requirement_reduction'; amount: number }
  | { type: 'random_battle_morale_gain'; chancePercent: number; minGain: number; maxGain: number }
  | { type: 'battle_unit_power_multiplier'; multiplier: number }
  | { type: 'initial_garrison_size_multiplier_range'; minMultiplier: number; maxMultiplier: number }
  | { type: 'captured_city_income_multiplier'; multiplier: number }
  | { type: 'root_claim_supply_cost_multiplier'; multiplier: number }
) & { source?: string };

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

export function getFactionTraits<TType extends FactionTrait['type']>(
  state: GameState,
  factionId: FactionId,
  type: TType,
): Array<Extract<FactionTrait, { type: TType }>> {
  const faction = state.factions[factionId];
  if (!faction) return [];
  return faction.traits.filter((trait) => trait.type === type) as Array<Extract<FactionTrait, { type: TType }>>;
}

function multiplyTraits<TType extends FactionTrait['type']>(
  state: GameState,
  factionId: FactionId,
  type: TType,
  getMultiplier: (trait: Extract<FactionTrait, { type: TType }>) => number,
): number {
  return getFactionTraits(state, factionId, type).reduce((product, trait) => product * getMultiplier(trait), 1);
}

export function factionIgnoresSupply(state: GameState, factionId: FactionId): boolean {
  return getFactionTrait(state, factionId, 'ignore_supply') !== null;
}

export function factionIgnoresMorale(state: GameState, factionId: FactionId): boolean {
  return getFactionTrait(state, factionId, 'ignore_morale') !== null;
}

export function getEffectiveMorale(state: GameState, factionId: FactionId, morale: number): number {
  return factionIgnoresMorale(state, factionId) ? 100 : morale;
}

export function getArtifactEffectMultiplier(state: GameState, factionId: FactionId): number {
  return multiplyTraits(state, factionId, 'artifact_effect_multiplier', (trait) => trait.multiplier);
}

export function factionKnowsFullMap(state: GameState, factionId: FactionId): boolean {
  return getFactionTrait(state, factionId, 'map_revealed') !== null;
}

export function getMoraleDamageInflictedMultiplier(
  state: GameState,
  factionId: FactionId,
): number {
  return multiplyTraits(state, factionId, 'morale_damage_inflicted_multiplier', (trait) => trait.multiplier);
}

export function getBattleMoraleLossTakenMultiplier(state: GameState, factionId: FactionId): number {
  if (factionIgnoresMorale(state, factionId)) return 0;
  return multiplyTraits(state, factionId, 'battle_morale_loss_taken_multiplier', (trait) => trait.multiplier);
}

export function getIncomingCasualtyMultiplier(
  state: GameState,
  factionId: FactionId,
  enemyTactic: BattleTacticId,
): number {
  return getFactionTraits(state, factionId, 'incoming_casualty_multiplier_by_enemy_tactic')
    .filter((trait) => trait.enemyTactics.includes(enemyTactic))
    .reduce((product, trait) => product * trait.multiplier, 1);
}

export function getInitialGarrisonMoraleFloor(state: GameState, factionId: FactionId): number | null {
  const floors = getFactionTraits(state, factionId, 'initial_garrison_morale_floor').map((trait) => trait.value);
  return floors.length > 0 ? Math.max(...floors) : null;
}

export function getFactionDefeatReaction(state: GameState, factionId: FactionId) {
  return getFactionTrait(state, factionId, 'defeat_reaction');
}

export function getSupplyActionCostMultiplier(state: GameState, factionId: FactionId): number {
  return multiplyTraits(state, factionId, 'supply_action_cost_multiplier', (trait) => trait.multiplier);
}

export function getMapVisionRadiusBonus(state: GameState, factionId: FactionId): number {
  return getFactionTraits(state, factionId, 'map_vision_radius_add').reduce((sum, trait) => sum + trait.amount, 0);
}

export function getArmyUpkeepMultiplier(state: GameState, factionId: FactionId): number {
  return multiplyTraits(state, factionId, 'army_upkeep_multiplier', (trait) => trait.multiplier);
}

export function getCityIncomeMultiplier(state: GameState, factionId: FactionId): number {
  return multiplyTraits(state, factionId, 'city_income_multiplier', (trait) => trait.multiplier);
}

export function getRootSpecimenRequirementReduction(state: GameState, factionId: FactionId): number {
  return getFactionTraits(state, factionId, 'root_specimen_requirement_reduction').reduce((sum, trait) => sum + trait.amount, 0);
}


export function getRandomBattleMoraleGain(state: GameState, factionId: FactionId): { chancePercent: number; minGain: number; maxGain: number } | null {
  const trait = getFactionTrait(state, factionId, 'random_battle_morale_gain');
  return trait ? { chancePercent: trait.chancePercent, minGain: trait.minGain, maxGain: trait.maxGain } : null;
}

export function getBattleUnitPowerMultiplier(state: GameState, factionId: FactionId): number {
  return multiplyTraits(state, factionId, 'battle_unit_power_multiplier', (trait) => trait.multiplier);
}

export function getInitialGarrisonSizeMultiplierRange(state: GameState, factionId: FactionId): { minMultiplier: number; maxMultiplier: number } | null {
  const trait = getFactionTrait(state, factionId, 'initial_garrison_size_multiplier_range');
  return trait ? { minMultiplier: trait.minMultiplier, maxMultiplier: trait.maxMultiplier } : null;
}

export function getCapturedCityIncomeMultiplier(state: GameState, factionId: FactionId): number {
  return multiplyTraits(state, factionId, 'captured_city_income_multiplier', (trait) => trait.multiplier);
}

export function getRootClaimSupplyCostMultiplier(state: GameState, factionId: FactionId): number {
  return multiplyTraits(state, factionId, 'root_claim_supply_cost_multiplier', (trait) => trait.multiplier);
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
