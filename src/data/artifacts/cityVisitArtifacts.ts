import type { CityId } from '@/core/state/GameState';

/**
 * Stage 23 placeholder distribution. It was randomized once during development
 * and is intentionally fixed in data so saves and replays stay deterministic.
 */
export const cityVisitArtifactByCityId: Partial<Record<CityId, string>> = {
  'outer-post': 'shared-private-key',
  'moss-market': 'last-word-stone',
  'quiet-scream': 'econom-spoon',
  'big-lunch': 'clean-towel',
  impassable: 'club-card',
  'crooked-chambers': 'passage-key',
  'great-canteen-vaults': 'voluntary-slavery-contract',
  underfountain: 'wall-14b-moss',
  'club-club': 'permit-for-permit',
  'rival-post': 'ownerless-gradebook',
  phalanstery: 'root-bark-chip',
  'echo-vault': 'cutlet-seven',
  'last-decent-inn': 'power-plumb',
  'root-limit': 'ceiling-chip',
};
