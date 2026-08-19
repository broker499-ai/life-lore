import type { CityId, FactionId, GameState } from '@/core/state/GameState';
import { extensionCityIds } from '@/core/map/extensionMap';

const EARLY_CITY_ORDER: CityId[] = [
  'outer-post',
  'moss-market',
  'quiet-scream',
  'big-lunch',
  'impassable',
  'crooked-chambers',
  'great-canteen-vaults',
  'underfountain',
  'club-club',
  'rival-post',
  'phalanstery',
  'echo-vault',
  'last-decent-inn',
  'root-limit',
];

/**
 * Capital locations are campaign knowledge rather than live ownership intel.
 * Once chosen they stay attached to the founding faction even if the city is captured.
 */
export function createFactionCapitalCityIds(
  cities: GameState['cities'],
  extensionOrder: readonly CityId[],
  playerFactionId: FactionId,
): Record<FactionId, CityId> {
  const orderedCityIds = [
    ...EARLY_CITY_ORDER,
    ...extensionOrder.filter((cityId) => extensionCityIds.includes(cityId as (typeof extensionCityIds)[number])),
  ];
  const result: Record<FactionId, CityId> = {};

  for (const cityId of orderedCityIds) {
    const factionId = cities[cityId]?.ownerFactionId;
    if (!factionId || result[factionId]) continue;
    result[factionId] = cityId;
  }

  // These two are deliberately stable even if old/migrated saves have unusual ownership.
  if (cities['outer-post']) result[playerFactionId] = 'outer-post';
  if (cities['rival-post']) result['rival-expedition'] = 'rival-post';

  return result;
}

export function getCapitalFactionIdByCityId(state: GameState): Record<CityId, FactionId> {
  return Object.fromEntries(
    Object.entries(state.campaign.factionCapitalCityIds).map(([factionId, cityId]) => [cityId, factionId]),
  );
}
