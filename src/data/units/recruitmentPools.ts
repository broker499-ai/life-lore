import type { RecruitmentOffer } from '@/core/cities/CityDefinition';
import type { UnitTypeId } from '@/core/state/GameState';

export const FRESHMAN_UNIT_ID: UnitTypeId = 'expedition-infantry';

export const STANDARD_RECRUITMENT_UNIT_IDS: UnitTypeId[] = [
  FRESHMAN_UNIT_ID,
  'mirpolovtsy',
  'economists',
  'olympiadniks',
  'initiative-group',
  'philosophers',
];

export const RANDOM_LOCAL_RECRUITMENT_UNIT_IDS: UnitTypeId[] = STANDARD_RECRUITMENT_UNIT_IDS.filter(
  (unitTypeId) => unitTypeId !== FRESHMAN_UNIT_ID,
);

export const UNIQUE_RECRUITMENT_UNIT_IDS: UnitTypeId[] = [
  'greg-jenkins',
  'xiang',
  'marconi',
  'the-boys',
  'gleb-khleb',
];

export const recruitmentOfferByUnitId: Record<UnitTypeId, RecruitmentOffer> = {
  [FRESHMAN_UNIT_ID]: { unitTypeId: FRESHMAN_UNIT_ID, amount: 10, cost: 40 },
  'mirpolovtsy': { unitTypeId: 'mirpolovtsy', amount: 6, cost: 60 },
  'economists': { unitTypeId: 'economists', amount: 7, cost: 49 },
  'olympiadniks': { unitTypeId: 'olympiadniks', amount: 4, cost: 60 },
  'initiative-group': { unitTypeId: 'initiative-group', amount: 7, cost: 56 },
  'philosophers': { unitTypeId: 'philosophers', amount: 6, cost: 54 },
};

export const uniqueRecruitmentCostByUnitId: Record<UnitTypeId, number> = {
  'greg-jenkins': 90,
  'xiang': 100,
  'marconi': 95,
  'the-boys': 110,
  'gleb-khleb': 120,
};
