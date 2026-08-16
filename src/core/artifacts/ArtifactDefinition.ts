import type { FactionTrait } from '@/core/leaders/LeaderAbility';

export type ArtifactRarity = 'city' | 'rare';

export type ArtifactEffect = Extract<
  FactionTrait,
  | { type: 'city_income_multiplier' }
  | { type: 'army_upkeep_multiplier' }
  | { type: 'supply_action_cost_multiplier' }
  | { type: 'morale_damage_inflicted_multiplier' }
  | { type: 'battle_morale_loss_taken_multiplier' }
  | { type: 'battle_unit_power_multiplier' }
  | { type: 'root_claim_supply_cost_multiplier' }
>;

export type ArtifactDefinition = {
  id: string;
  name: string;
  description: string;
  rarity: ArtifactRarity;
  effects: ArtifactEffect[];
  effectLabel: string;
};

export type ArtifactDefinitions = Record<string, ArtifactDefinition>;
