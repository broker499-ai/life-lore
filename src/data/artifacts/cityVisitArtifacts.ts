import type { CityId } from '@/core/state/GameState';

/**
 * Stage 27: city artifacts became meaningfully rarer.
 * Only a subset of cities hides a unique first-visit artifact,
 * so POI choices remain the primary source of strong artifacts.
 */
export const cityVisitArtifactByCityId: Partial<Record<CityId, string>> = {
  'outer-post': 'shared-private-key',
  'moss-market': 'last-word-stone',
  'big-lunch': 'clean-towel',
  'great-canteen-vaults': 'voluntary-slavery-contract',
  phalanstery: 'root-bark-chip',
  'root-limit': 'ceiling-chip',
};
