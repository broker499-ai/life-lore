import type { CityDefinition, CityDefinitions, CityTrait, RecruitmentOffer } from '@/core/cities/CityDefinition';
import type { GameState } from '@/core/state/GameState';

type MultiplierTraitType = Extract<CityTrait, { multiplier: number }>['type'];

export function getCityTraitMultiplier(
  city: CityDefinition | undefined,
  type: MultiplierTraitType,
): number {
  if (!city) return 1;
  return city.special.traits.reduce(
    (value, trait) => trait.type === type ? value * trait.multiplier : value,
    1,
  );
}

export function getEffectiveCityTaxIncome(city: CityDefinition): number {
  return roundMoney(city.taxIncome * getCityTraitMultiplier(city, 'tax_income_multiplier'));
}

export function getEffectiveCityRest(city: CityDefinition): CityDefinition['rest'] {
  return {
    suppliesRestore: Math.max(
      0,
      Math.round(city.rest.suppliesRestore * getCityTraitMultiplier(city, 'rest_supplies_multiplier')),
    ),
    moraleRestore: Math.max(
      0,
      Math.round(city.rest.moraleRestore * getCityTraitMultiplier(city, 'rest_morale_multiplier')),
    ),
  };
}

export function getEffectiveCityRecruitmentOffers(city: CityDefinition): RecruitmentOffer[] {
  const costMultiplier = getCityTraitMultiplier(city, 'recruitment_cost_multiplier');
  const amountMultiplier = getCityTraitMultiplier(city, 'recruitment_amount_multiplier');
  return city.recruitment.map((offer) => ({
    ...offer,
    amount: Math.max(1, Math.round(offer.amount * amountMultiplier)),
    cost: Math.max(0, Math.round(offer.cost * costMultiplier)),
  }));
}

export function getCityDefenderUnitPowerMultiplier(city: CityDefinition | undefined): number {
  return getCityTraitMultiplier(city, 'defender_unit_power_multiplier');
}

export function getFactionArmyUpkeepCityMultiplier(
  state: GameState,
  cityDefinitions: CityDefinitions,
  factionId: string,
): number {
  return Object.values(state.cities).reduce((multiplier, cityState) => {
    if (cityState.ownerFactionId !== factionId) return multiplier;
    const city = cityDefinitions[cityState.id];
    return multiplier * getCityTraitMultiplier(city, 'faction_army_upkeep_multiplier');
  }, 1);
}

export function getRootClaimCitySupplyMultiplier(
  state: GameState,
  cityDefinitions: CityDefinitions,
  factionId: string,
  stagingCityId: string,
): number {
  if (state.cities[stagingCityId]?.ownerFactionId !== factionId) return 1;
  return getCityTraitMultiplier(
    cityDefinitions[stagingCityId],
    'root_claim_supply_cost_multiplier',
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
