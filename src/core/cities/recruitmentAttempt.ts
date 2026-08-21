import { getRosterTotalUnits } from '@/core/armies/armyStats';
import { DEFAULT_BATTLE_PLAN, type BattleResult, type BattleRules } from '@/core/battles/BattleTypes';
import { simulateBattle } from '@/core/battles/simulateBattle';
import type { RecruitmentOffer } from '@/core/cities/CityDefinition';
import { hasUnlimitedMoney, hasUnlimitedRecruitment } from '@/core/dev/developerMode';
import { factionIgnoresMorale, getEffectiveMorale } from '@/core/leaders/LeaderAbility';
import { randomInt } from '@/core/rng/seededRandom';
import type { ArmyId, CityId, GameState } from '@/core/state/GameState';
import { getHomeRecruitmentSafeMultiplier, HOME_RECRUITMENT_CITY_ID, HOME_RECRUITMENT_RECOVERY_TURNS, REMOTE_REINFORCEMENT_TRAVEL_TURNS } from '@/core/cities/playerRecruitment';
import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import { addArmyGroup, getArmyFlankRosters, reconcileArmyGroupsToRoster } from '@/core/armies/armyFlanks';

export const RECRUITMENT_SUCCESS_LOCK_TURNS = 3;
export const RECRUITMENT_RIOT_LOCK_TURNS = 5;

export type RecruitmentQuote = {
  unitTypeId: string;
  amount: number;
  safeLimit: number;
  maxAmount: number;
  cost: number;
  risky: boolean;
  successChancePercent: number;
  blockedTurnsRemaining: number;
};

export type RecruitmentAttemptError =
  | 'army_not_found'
  | 'city_not_found'
  | 'army_not_in_city'
  | 'city_not_controlled'
  | 'insufficient_money'
  | 'recruitment_blocked'
  | 'invalid_amount';

export type RecruitmentAttemptResult =
  | {
      ok: true;
      state: GameState;
      quote: RecruitmentQuote;
      recruited: boolean;
      riot: boolean;
      roll: number | null;
      battle: BattleResult | null;
      moraleRestored: number;
    }
  | { ok: false; state: GameState; error: RecruitmentAttemptError; quote?: RecruitmentQuote };

export function getRecruitmentTerms(offer: RecruitmentOffer, amount: number, unlimited = false, safeLimitMultiplier = 1): Omit<RecruitmentQuote, 'blockedTurnsRemaining'> {
  const normalSafeLimit = Math.max(1, Math.round(offer.amount * 1.8 * Math.max(0.5, safeLimitMultiplier)));
  const safeLimit = unlimited ? 250 : normalSafeLimit;
  const maxAmount = unlimited ? 250 : Math.max(safeLimit + 12, Math.ceil(safeLimit * 2.9));
  const safeAmount = Math.max(1, Math.min(maxAmount, Math.round(amount)));
  const unitCost = offer.cost / Math.max(1, offer.amount);
  const cost = unlimited ? 0 : Math.max(1, Math.ceil(unitCost * safeAmount));
  const over = Math.max(0, safeAmount - safeLimit);
  const riskSpan = Math.max(1, maxAmount - safeLimit);
  const successChancePercent = over === 0
    ? 100
    : Math.max(42, Math.round(88 - (over - 1) * (42 / riskSpan)));
  return {
    unitTypeId: offer.unitTypeId,
    amount: safeAmount,
    safeLimit,
    maxAmount,
    cost,
    risky: over > 0,
    successChancePercent,
  };
}

export function getRecruitmentQuote(
  state: GameState,
  cityId: CityId,
  offer: RecruitmentOffer,
  amount: number,
): RecruitmentQuote {
  const ownerFactionId = state.cities[cityId]?.ownerFactionId;
  const unlimited = Boolean(ownerFactionId && hasUnlimitedRecruitment(state, ownerFactionId));
  const safeMultiplier = getHomeRecruitmentSafeMultiplier(state, cityId, offer.unitTypeId);
  const terms = getRecruitmentTerms(offer, amount, unlimited, safeMultiplier);
  const blockedUntil = state.campaign.recruitmentBlockedUntilTurnByCityId[cityId] ?? 0;
  const blockedTurnsRemaining = unlimited ? 0 : Math.max(0, blockedUntil - state.turn);
  return { ...terms, blockedTurnsRemaining };
}

export function attemptRecruitAtCity(
  state: GameState,
  input: {
    armyId: ArmyId;
    cityId: CityId;
    offer: RecruitmentOffer;
    amount: number;
    moraleRestore: number;
    moraleCap: number;
  },
  dependencies: { unitDefinitions: UnitDefinitions; battleRules: BattleRules },
): RecruitmentAttemptResult {
  const quote = getRecruitmentQuote(state, input.cityId, input.offer, input.amount);
  const army = state.armies[input.armyId];
  if (!army) return { ok: false, state, error: 'army_not_found', quote };
  const city = state.cities[input.cityId];
  if (!city) return { ok: false, state, error: 'city_not_found', quote };
  if (city.ownerFactionId !== army.factionId) return { ok: false, state, error: 'city_not_controlled', quote };
  if (army.nodeId !== city.id && city.id !== HOME_RECRUITMENT_CITY_ID) return { ok: false, state, error: 'army_not_in_city', quote };
  const faction = state.factions[army.factionId];
  if (!faction) return { ok: false, state, error: 'army_not_found', quote };
  if (quote.blockedTurnsRemaining > 0) return { ok: false, state, error: 'recruitment_blocked', quote };
  if (!Number.isInteger(input.amount) || input.amount <= 0 || input.amount > quote.maxAmount) {
    return { ok: false, state, error: 'invalid_amount', quote };
  }
  if (!hasUnlimitedMoney(state, faction.id) && faction.resources.money < quote.cost) return { ok: false, state, error: 'insufficient_money', quote };

  let nextEventsRng = state.rng.events;
  let roll: number | null = null;
  if (quote.risky) {
    const rolled = randomInt(nextEventsRng, 1, 100);
    roll = rolled.value;
    nextEventsRng = rolled.state;
  }

  if (!quote.risky || (roll ?? 0) <= quote.successChancePercent) {
    const immediate = army.nodeId === city.id;
    const recruitmentGroupId = `recruit-${city.id}-${quote.unitTypeId}-turn-${state.turn}-rng-${state.rng.events.cursor}`;
    const nextMorale = immediate
      ? (factionIgnoresMorale(state, faction.id)
          ? 100
          : Math.min(input.moraleCap, army.morale + input.moraleRestore))
      : army.morale;
    const pendingReinforcements = immediate
      ? state.campaign.pendingReinforcements
      : [
          ...state.campaign.pendingReinforcements,
          {
            id: `reinforcement-${city.id}-${quote.unitTypeId}-turn-${state.turn}-${state.rng.events.cursor}`,
            sourceCityId: city.id,
            armyId: army.id,
            unitTypeId: quote.unitTypeId,
            amount: quote.amount,
            roster: { [quote.unitTypeId]: quote.amount },
            groupId: recruitmentGroupId,
            unique: false,
            arrivalTurn: state.turn + REMOTE_REINFORCEMENT_TRAVEL_TURNS,
          },
        ];
    const homeRecovery = city.id === HOME_RECRUITMENT_CITY_ID
      ? {
          ...state.campaign.homeRecruitmentRecoveryTurnByUnitId,
          __home__: state.turn + HOME_RECRUITMENT_RECOVERY_TURNS,
        }
      : state.campaign.homeRecruitmentRecoveryTurnByUnitId;
    return {
      ok: true,
      quote,
      recruited: true,
      riot: false,
      roll,
      battle: null,
      moraleRestored: nextMorale - army.morale,
      state: {
        ...state,
        rng: { ...state.rng, events: nextEventsRng },
        factions: {
          ...state.factions,
          [faction.id]: {
            ...faction,
            resources: { ...faction.resources, money: hasUnlimitedMoney(state, faction.id) ? faction.resources.money : faction.resources.money - quote.cost },
            strategicActionSpent: faction.strategicActionSpent,
            lastStrategicAction: faction.lastStrategicAction,
          },
        },
        armies: immediate ? {
          ...state.armies,
          [army.id]: {
            ...addArmyGroup(army, { [quote.unitTypeId]: quote.amount }, dependencies.unitDefinitions, {
              id: recruitmentGroupId,
              unique: false,
            }),
            morale: nextMorale,
          },
        } : state.armies,
        campaign: {
          ...state.campaign,
          pendingReinforcements,
          homeRecruitmentRecoveryTurnByUnitId: homeRecovery,
          recruitmentBlockedUntilTurnByCityId: hasUnlimitedRecruitment(state, army.factionId)
            ? state.campaign.recruitmentBlockedUntilTurnByCityId
            : {
                ...state.campaign.recruitmentBlockedUntilTurnByCityId,
                [city.id]: state.turn + RECRUITMENT_SUCCESS_LOCK_TURNS,
              },
        },
      },
    };
  }

  const crowdCount = Math.max(4, Math.min(14, Math.ceil(quote.safeLimit * 1.25)));
  const battle = simulateBattle(
    {
      battleId: `recruitment-riot-${city.id}-turn-${state.turn}-rng-${state.rng.battles.cursor}`,
      scale: 'skirmish',
      sideA: {
        factionId: army.factionId,
        roster: army.nodeId === city.id ? army.roster : { 'expedition-infantry': Math.max(8, quote.safeLimit) },
        laneRosters: army.nodeId === city.id ? getArmyFlankRosters(army) : undefined,
        morale: getEffectiveMorale(state, army.factionId, army.morale),
        moraleLockedAt: factionIgnoresMorale(state, army.factionId) ? 100 : undefined,
        tactic: 'balanced',
        autoRestVictoriousLanes: true,
        plan: { ...DEFAULT_BATTLE_PLAN, reservePercent: 0, commands: [] },
      },
      sideB: {
        factionId: 'recruitment-crowd',
        randomizeFlanks: true,
        reactiveLanePostures: true,
        roster: { 'angry-townsfolk': crowdCount },
        morale: 58,
        tactic: 'balanced',
        plan: { ...DEFAULT_BATTLE_PLAN, reservePercent: 0, commands: [] },
        unitPowerMultiplier: 0.72,
      },
    },
    state.rng.battles,
    dependencies.unitDefinitions,
    dependencies.battleRules,
  );

  const attacker = battle.sides.A;
  const lockUntilTurn = state.turn + RECRUITMENT_RIOT_LOCK_TURNS;
  return {
    ok: true,
    quote,
    recruited: false,
    riot: true,
    roll,
    battle,
    moraleRestored: 0,
    state: {
      ...state,
      rng: { ...state.rng, events: nextEventsRng, battles: battle.rngState },
      factions: {
        ...state.factions,
        [faction.id]: {
          ...faction,
          strategicActionSpent: faction.strategicActionSpent,
          lastStrategicAction: faction.lastStrategicAction,
        },
      },
      armies: army.nodeId === city.id ? {
        ...state.armies,
        [army.id]: {
          ...reconcileArmyGroupsToRoster(army, attacker.remainingRoster, dependencies.unitDefinitions),
          morale: getEffectiveMorale(state, faction.id, attacker.moraleAfter),
        },
      } : state.armies,
      campaign: {
        ...state.campaign,
        recruitmentBlockedUntilTurnByCityId: {
          ...state.campaign.recruitmentBlockedUntilTurnByCityId,
          [city.id]: lockUntilTurn,
        },
      },
    },
  };
}

export function canArmyRecruitAtCity(state: GameState, armyId: ArmyId, cityId: CityId): boolean {
  const army = state.armies[armyId];
  const city = state.cities[cityId];
  if (!army || !city || city.ownerFactionId !== army.factionId) return false;
  if (army.nodeId !== city.id && city.id !== HOME_RECRUITMENT_CITY_ID) return false;
  const faction = state.factions[army.factionId];
  if (!faction) return false;
  if (hasUnlimitedRecruitment(state, army.factionId)) return true;
  return Math.max(0, (state.campaign.recruitmentBlockedUntilTurnByCityId[cityId] ?? 0) - state.turn) === 0;
}

export function getRecruitmentRiotStrength(result: BattleResult | null): number {
  return result ? getRosterTotalUnits(result.sides.B.initialRoster) : 0;
}
