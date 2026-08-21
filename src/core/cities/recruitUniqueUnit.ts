import { hasUnlimitedMoney, hasUnlimitedRecruitment } from '@/core/dev/developerMode';
import { REMOTE_REINFORCEMENT_TRAVEL_TURNS } from '@/core/cities/playerRecruitment';
import type { ArmyId, CityId, GameState, UnitTypeId } from '@/core/state/GameState';
import { uniqueRecruitmentCostByUnitId, UNIQUE_RECRUITMENT_UNIT_IDS } from '@/data/units/recruitmentPools';
import { addArmyGroup } from '@/core/armies/armyFlanks';
import { prototypeUnits } from '@/data/units/prototypeUnits';
import { RECRUITMENT_SUCCESS_LOCK_TURNS } from '@/core/cities/recruitmentAttempt';

export type RecruitUniqueUnitError =
  | 'army_not_found'
  | 'city_not_found'
  | 'city_not_controlled'
  | 'wrong_city'
  | 'artifact_required'
  | 'already_recruited'
  | 'insufficient_money'
  | 'recruitment_blocked'
  | 'not_unique';

export function recruitUniqueUnit(
  state: GameState,
  input: { armyId: ArmyId; cityId: CityId; unitTypeId: UnitTypeId },
): { ok: true; state: GameState; immediate: boolean; cost: number } | { ok: false; state: GameState; error: RecruitUniqueUnitError } {
  const army = state.armies[input.armyId];
  if (!army) return { ok: false, state, error: 'army_not_found' };
  const city = state.cities[input.cityId];
  if (!city) return { ok: false, state, error: 'city_not_found' };
  if (city.ownerFactionId !== army.factionId) return { ok: false, state, error: 'city_not_controlled' };
  const blockedUntil = state.campaign.recruitmentBlockedUntilTurnByCityId[city.id] ?? 0;
  if (!hasUnlimitedRecruitment(state, army.factionId) && blockedUntil > state.turn) return { ok: false, state, error: 'recruitment_blocked' };
  if (army.nodeId !== city.id) return { ok: false, state, error: 'wrong_city' };
  if (!UNIQUE_RECRUITMENT_UNIT_IDS.includes(input.unitTypeId)) return { ok: false, state, error: 'not_unique' };
  if (state.campaign.uniqueUnitCityIds[input.unitTypeId] !== city.id) return { ok: false, state, error: 'wrong_city' };
  if (state.campaign.artifactIds.length < 1) return { ok: false, state, error: 'artifact_required' };
  if (state.campaign.recruitedUniqueUnitIds.includes(input.unitTypeId)) return { ok: false, state, error: 'already_recruited' };
  const faction = state.factions[army.factionId];
  if (!faction) return { ok: false, state, error: 'army_not_found' };
  const nominalCost = uniqueRecruitmentCostByUnitId[input.unitTypeId] ?? 100;
  const cost = hasUnlimitedMoney(state, faction.id) ? 0 : nominalCost;
  if (!hasUnlimitedMoney(state, faction.id) && faction.resources.money < cost) return { ok: false, state, error: 'insufficient_money' };

  const immediate = army.nodeId === city.id;
  const batchRoster = input.unitTypeId === 'greg-jenkins'
    ? { [input.unitTypeId]: 1, 'greg-spiders': 10 }
    : { [input.unitTypeId]: 1 };
  const groupId = `unique-${input.unitTypeId}-${city.id}-turn-${state.turn}`;
  const pendingReinforcements = immediate
    ? state.campaign.pendingReinforcements
    : [
        ...state.campaign.pendingReinforcements,
        {
          id: `unique-${input.unitTypeId}-${city.id}-turn-${state.turn}`,
          sourceCityId: city.id,
          armyId: army.id,
          unitTypeId: input.unitTypeId,
          amount: 1,
          roster: batchRoster,
          groupId,
          unique: true,
          arrivalTurn: state.turn + REMOTE_REINFORCEMENT_TRAVEL_TURNS,
        },
      ];

  return {
    ok: true,
    immediate,
    cost,
    state: {
      ...state,
      factions: {
        ...state.factions,
        [faction.id]: {
          ...faction,
          resources: { ...faction.resources, money: faction.resources.money - cost },
          strategicActionSpent: faction.strategicActionSpent,
          lastStrategicAction: faction.lastStrategicAction,
        },
      },
      armies: immediate
        ? {
            ...state.armies,
            [army.id]: addArmyGroup(army, batchRoster, prototypeUnits, { id: groupId, unique: true }),
          }
        : state.armies,
      campaign: {
        ...state.campaign,
        recruitedUniqueUnitIds: [...state.campaign.recruitedUniqueUnitIds, input.unitTypeId],
        pendingReinforcements,
        recruitmentBlockedUntilTurnByCityId: hasUnlimitedRecruitment(state, army.factionId)
          ? state.campaign.recruitmentBlockedUntilTurnByCityId
          : { ...state.campaign.recruitmentBlockedUntilTurnByCityId, [city.id]: state.turn + RECRUITMENT_SUCCESS_LOCK_TURNS },
      },
    },
  };
}
