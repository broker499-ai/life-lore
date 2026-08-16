import type { CityDefinitions } from '@/core/cities/CityDefinition';

const standardRecruitment = [
  { unitTypeId: 'expedition-infantry', amount: 5, cost: 30 },
  { unitTypeId: 'expedition-rangers', amount: 3, cost: 27 },
] as const;

export const prototypeCities: CityDefinitions = {
  'outer-post': {
    id: 'outer-post',
    taxIncome: 12,
    rest: { suppliesRestore: 20, moraleRestore: 15 },
    recruitment: [...standardRecruitment],
  },
  'moss-market': {
    id: 'moss-market',
    taxIncome: 18,
    rest: { suppliesRestore: 26, moraleRestore: 12 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 28 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 30 },
    ],
  },
  'quiet-scream': {
    id: 'quiet-scream',
    taxIncome: 14,
    rest: { suppliesRestore: 18, moraleRestore: 21 },
    recruitment: [...standardRecruitment],
  },
  'big-lunch': {
    id: 'big-lunch',
    taxIncome: 17,
    rest: { suppliesRestore: 34, moraleRestore: 20 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 31 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 29 },
    ],
  },
  impassable: {
    id: 'impassable',
    taxIncome: 15,
    rest: { suppliesRestore: 22, moraleRestore: 16 },
    recruitment: [...standardRecruitment],
  },
  'crooked-chambers': {
    id: 'crooked-chambers',
    taxIncome: 22,
    rest: { suppliesRestore: 18, moraleRestore: 16 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 32 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 28 },
    ],
  },
  'great-canteen-vaults': {
    id: 'great-canteen-vaults',
    taxIncome: 19,
    rest: { suppliesRestore: 36, moraleRestore: 12 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 29 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 30 },
    ],
  },
  underfountain: {
    id: 'underfountain',
    taxIncome: 21,
    rest: { suppliesRestore: 24, moraleRestore: 12 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 27 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 25 },
    ],
  },
  'club-club': {
    id: 'club-club',
    taxIncome: 20,
    rest: { suppliesRestore: 20, moraleRestore: 24 },
    recruitment: [...standardRecruitment],
  },
  'rival-post': {
    id: 'rival-post',
    taxIncome: 16,
    rest: { suppliesRestore: 20, moraleRestore: 15 },
    recruitment: [...standardRecruitment],
  },
  phalanstery: {
    id: 'phalanstery',
    taxIncome: 18,
    rest: { suppliesRestore: 27, moraleRestore: 18 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 27 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 29 },
    ],
  },
  'echo-vault': {
    id: 'echo-vault',
    taxIncome: 16,
    rest: { suppliesRestore: 18, moraleRestore: 20 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 32 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 25 },
    ],
  },
  'last-decent-inn': {
    id: 'last-decent-inn',
    taxIncome: 14,
    rest: { suppliesRestore: 40, moraleRestore: 30 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 34 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 31 },
    ],
  },
  'root-limit': {
    id: 'root-limit',
    taxIncome: 13,
    rest: { suppliesRestore: 16, moraleRestore: 18 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 36 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 34 },
    ],
  },
};
