import type { CityId, UnitTypeId } from '@/core/state/GameState';

export type RecruitmentOffer = {
  unitTypeId: UnitTypeId;
  amount: number;
  cost: number;
};

export type CityTrait =
  | { type: 'tax_income_multiplier'; multiplier: number }
  | { type: 'rest_supplies_multiplier'; multiplier: number }
  | { type: 'rest_morale_multiplier'; multiplier: number }
  | { type: 'recruitment_cost_multiplier'; multiplier: number }
  | { type: 'recruitment_amount_multiplier'; multiplier: number }
  | { type: 'faction_army_upkeep_multiplier'; multiplier: number }
  | { type: 'defender_unit_power_multiplier'; multiplier: number }
  | { type: 'root_claim_supply_cost_multiplier'; multiplier: number };

export type CitySpecial = {
  name: string;
  description: string;
  traits: CityTrait[];
};

export type CityDefinition = {
  id: CityId;
  taxIncome: number;
  rest: {
    suppliesRestore: number;
    moraleRestore: number;
  };
  recruitment: RecruitmentOffer[];
  special: CitySpecial;
};

export type CityDefinitions = Record<CityId, CityDefinition>;
