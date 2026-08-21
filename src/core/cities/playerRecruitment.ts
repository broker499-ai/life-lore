import type { RecruitmentOffer } from '@/core/cities/CityDefinition';
import { applyCityRecruitmentTraits } from '@/core/cities/cityTraits';
import type { CityId, GameState, UnitTypeId } from '@/core/state/GameState';
import { prototypeCities } from '@/data/cities/prototypeCities';
import {
  recruitmentOfferByUnitId,
  UNIQUE_RECRUITMENT_UNIT_IDS,
} from '@/data/units/recruitmentPools';

export const HOME_RECRUITMENT_CITY_ID = 'outer-post';
export const HOME_SAFE_LIMIT_MULTIPLIER = 2;
export const HOME_RECRUITMENT_RECOVERY_TURNS = 6;
export const REMOTE_REINFORCEMENT_TRAVEL_TURNS = 3;

export function getPlayerCityRecruitmentOffers(state: GameState, cityId: CityId): RecruitmentOffer[] {
  const cityDefinition = prototypeCities[cityId];
  if (!cityDefinition) return [];
  const unitIds = state.campaign.cityRecruitmentUnitIds[cityId] ?? [];
  const offers = unitIds
    .map((unitTypeId) => recruitmentOfferByUnitId[unitTypeId])
    .filter((offer): offer is RecruitmentOffer => Boolean(offer));
  return applyCityRecruitmentTraits(cityDefinition, offers);
}

export function getUniqueRecruitmentUnitIdsAtCity(state: GameState, cityId: CityId): UnitTypeId[] {
  return UNIQUE_RECRUITMENT_UNIT_IDS.filter(
    (unitTypeId) =>
      state.campaign.uniqueUnitCityIds[unitTypeId] === cityId &&
      !state.campaign.recruitedUniqueUnitIds.includes(unitTypeId),
  );
}

export function getHomeRecruitmentSafeMultiplier(
  state: GameState,
  cityId: CityId,
  unitTypeId: UnitTypeId,
): number {
  if (cityId !== HOME_RECRUITMENT_CITY_ID) return 1;
  void unitTypeId;
  const recoveryTurn = state.campaign.homeRecruitmentRecoveryTurnByUnitId.__home__ ?? 0;
  return state.turn >= recoveryTurn ? HOME_SAFE_LIMIT_MULTIPLIER : 1;
}

export function getHomeRecruitmentRecoveryTurnsRemaining(
  state: GameState,
  cityId: CityId,
  unitTypeId: UnitTypeId,
): number {
  if (cityId !== HOME_RECRUITMENT_CITY_ID) return 0;
  void unitTypeId;
  return Math.max(0, (state.campaign.homeRecruitmentRecoveryTurnByUnitId.__home__ ?? 0) - state.turn);
}
