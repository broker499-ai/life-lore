import type { CityId } from '@/core/state/GameState';

/**
 * Stage 39: cities no longer award artifacts on visit.
 * Kept as an empty compatibility table so legacy code/save references remain harmless.
 */
export const cityVisitArtifactByCityId: Partial<Record<CityId, string>> = {};
