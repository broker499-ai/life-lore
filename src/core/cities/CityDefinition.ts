import type { CityId, UnitTypeId } from '@/core/state/GameState';

export type RecruitmentOffer = {
  unitTypeId: UnitTypeId;
  amount: number;
  cost: number;
};

export type CityDefinition = {
  id: CityId;
  taxIncome: number;
  rest: {
    suppliesRestore: number;
    moraleRestore: number;
  };
  recruitment: RecruitmentOffer[];
};

export type CityDefinitions = Record<CityId, CityDefinition>;
