import { getArmySummary, getRosterTotalUnits } from '@/core/armies/armyStats';
import { areFactionsAllied, areFactionsHostile } from '@/core/factions/factionRelations';
import { getCapturedCityIncomeMultiplier } from '@/core/leaders/LeaderAbility';
import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { CityDefinitions } from '@/core/cities/CityDefinition';
import {
  getCityDefenderUnitPowerMultiplier,
  getEffectiveCityRecruitmentOffers,
  getEffectiveCityTaxIncome,
} from '@/core/cities/cityTraits';
import { getAttackCityAvailability } from '@/core/cities/attackCity';
import { getMoveArmyAvailability } from '@/core/map/moveArmy';
import {
  getNeighborNodeIds,
  getShortestPathDistance,
  type MapGraph,
} from '@/core/map/MapGraph';
import type { ArmyRoster, ArmyState, GameState } from '@/core/state/GameState';
import type { AiAction, AiAttackAction, AiMoveAction, AiRecruitAction } from '@/core/factions/ai/AiTypes';

export type AiEvaluationInput = {
  factionId: string;
  armyId: string;
  graph: MapGraph;
  cityDefinitions: CityDefinitions;
  unitDefinitions: UnitDefinitions;
  moveSupplyCost: number;
  attackSupplyCost: number;
};

const MIN_ATTACK_STRENGTH_RATIO = 0.72;
const RECRUIT_TARGET_SIZE = 20;

export function evaluateAiActions(state: GameState, input: AiEvaluationInput): AiAction[] {
  const army = state.armies[input.armyId];
  const faction = state.factions[input.factionId];
  if (!army || army.factionId !== input.factionId) {
    return [{ type: 'hold', score: Number.NEGATIVE_INFINITY, reason: 'no_army' }];
  }
  if (!faction || faction.strategicActionSpent) {
    return [{ type: 'hold', score: Number.NEGATIVE_INFINITY, reason: 'action_spent' }];
  }

  const actions: AiAction[] = [];
  const centralNodes = input.graph.nodes.filter((node) => node.isCentral);
  const objectiveNodeId = centralNodes.at(-1)?.id ?? input.graph.nodes.find((node) => node.kind === 'special')?.id ?? null;
  const finalObjectiveNodeId = centralNodes.length > 1 ? objectiveNodeId : null;
  const currentDistance = objectiveNodeId
    ? getShortestPathDistance(input.graph, army.nodeId, objectiveNodeId)
    : null;

  for (const neighborId of getNeighborNodeIds(input.graph, army.nodeId)) {
    // Only the true final Root is resolved by the campaign objective layer.
    // A non-final special node (the false Root) must remain enterable by AI.
    if (finalObjectiveNodeId && neighborId === finalObjectiveNodeId) continue;
    const distanceAfter = objectiveNodeId
      ? getShortestPathDistance(input.graph, neighborId, objectiveNodeId)
      : null;
    const progress =
      currentDistance !== null && distanceAfter !== null ? currentDistance - distanceAfter : 0;
    const city = state.cities[neighborId];

    if (!city || areFactionsAllied(state, city.ownerFactionId, input.factionId)) {
      const moveAvailability = getMoveArmyAvailability(state, input.graph, {
        armyId: input.armyId,
        toNodeId: neighborId,
        supplyCost: input.moveSupplyCost,
      });
      if (moveAvailability.canMove) {
        const supplyPenalty = (100 - moveAvailability.supplyStatus.percent) * 0.12;
        actions.push({
          type: 'move',
          toNodeId: neighborId,
          score: roundScore(8 + progress * 26 + (city ? 4 : 0) - supplyPenalty),
        } satisfies AiMoveAction);
      }
      continue;
    }

    const attackAvailability = getAttackCityAvailability(state, input.graph, {
      armyId: input.armyId,
      cityId: city.id,
      tactic: 'balanced',
      supplyCost: input.attackSupplyCost,
    });
    if (!attackAvailability.canAttack) continue;
    const defendingArmy = Object.values(state.armies).find(
      (candidate) => candidate.nodeId === city.id && areFactionsHostile(state, candidate.factionId, input.factionId),
    );
    const cityDefinition = input.cityDefinitions[city.id];
    const cityDefenseMultiplier = getCityDefenderUnitPowerMultiplier(cityDefinition);
    const defenderPower = (defendingArmy
      ? estimateArmyPower(defendingArmy, input.unitDefinitions)
      : estimateRosterPower(city.garrison.roster, city.garrison.morale, input.unitDefinitions)) * cityDefenseMultiplier;
    const attackerPower = estimateArmyPower(army, input.unitDefinitions);
    const strengthRatio = defenderPower <= 0 ? 99 : attackerPower / defenderPower;
    if (strengthRatio < MIN_ATTACK_STRENGTH_RATIO) continue;

    const captureIncomeMultiplier = city.ownerFactionId
      ? getCapturedCityIncomeMultiplier(state, city.ownerFactionId)
      : 1;
    const expectedIncomeMultiplier = Math.min(city.incomeMultiplier ?? 1, captureIncomeMultiplier);
    const taxValue = cityDefinition
      ? getEffectiveCityTaxIncome(cityDefinition) * expectedIncomeMultiplier
      : 0;
    const riskPenalty = strengthRatio >= 1 ? 0 : (1 - strengthRatio) * 55;
    const supplyPenalty = (100 - attackAvailability.supplyStatus.percent) * 0.14;
    const enemyBonus = city.ownerFactionId === null ? 0 : 10;
    actions.push({
      type: 'attack',
      cityId: city.id,
      tactic: chooseTactic(strengthRatio),
      strengthRatio: roundScore(strengthRatio),
      score: roundScore(34 + taxValue + progress * 28 + enemyBonus - riskPenalty - supplyPenalty),
    } satisfies AiAttackAction);
  }

  const currentCity = state.cities[army.nodeId];
  const currentDefinition = input.cityDefinitions[army.nodeId];
  const totalUnits = getRosterTotalUnits(army.roster);
  if (
    currentCity?.ownerFactionId === input.factionId &&
    currentDefinition &&
    totalUnits < RECRUIT_TARGET_SIZE
  ) {
    for (const offer of getEffectiveCityRecruitmentOffers(currentDefinition)) {
      if (faction.resources.money < offer.cost) continue;
      const score = 96 + Math.max(0, RECRUIT_TARGET_SIZE - totalUnits) * 2 + offer.amount;
      actions.push({
        type: 'recruit',
        cityId: currentCity.id,
        offer,
        score: roundScore(score),
      } satisfies AiRecruitAction);
    }
  }

  if (actions.length === 0) {
    actions.push({ type: 'hold', score: 0, reason: 'no_viable_action' });
  }

  return actions.sort(compareAiActions);
}

export function chooseBestAiAction(state: GameState, input: AiEvaluationInput): AiAction {
  return evaluateAiActions(state, input)[0];
}

function estimateArmyPower(army: ArmyState, unitDefinitions: UnitDefinitions): number {
  const summary = getArmySummary(army, unitDefinitions);
  const base = summary.totalAttack + summary.totalDefense * 0.82;
  return base * moraleFactor(army.morale);
}

function estimateRosterPower(
  roster: ArmyRoster,
  morale: number,
  unitDefinitions: UnitDefinitions,
): number {
  let attack = 0;
  let defense = 0;
  for (const [unitTypeId, amount] of Object.entries(roster)) {
    if (!Number.isInteger(amount) || amount < 0) throw new Error(`Invalid roster amount for ${unitTypeId}`);
    const unit = unitDefinitions[unitTypeId];
    if (!unit) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
    attack += unit.attack * amount;
    defense += unit.defense * amount;
  }
  return (attack + defense * 0.82) * moraleFactor(morale);
}

function moraleFactor(morale: number): number {
  return 0.55 + Math.max(0, Math.min(100, morale)) / 220;
}

function chooseTactic(strengthRatio: number): AiAttackAction['tactic'] {
  if (strengthRatio >= 1.45) return 'assault';
  if (strengthRatio >= 1) return 'balanced';
  if (strengthRatio >= 0.82) return 'flank';
  return 'cautious';
}

function compareAiActions(a: AiAction, b: AiAction): number {
  if (a.score !== b.score) return b.score - a.score;
  return actionKey(a).localeCompare(actionKey(b));
}

function actionKey(action: AiAction): string {
  if (action.type === 'attack') return `0:${action.cityId}`;
  if (action.type === 'move') return `1:${action.toNodeId}`;
  if (action.type === 'recruit') return `2:${action.cityId}:${action.offer.unitTypeId}`;
  return `9:${action.reason}`;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
