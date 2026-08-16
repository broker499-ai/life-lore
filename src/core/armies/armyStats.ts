import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { ArmyRoster, ArmyState } from '@/core/state/GameState';

export type ArmyCompositionRow = {
  unitTypeId: string;
  amount: number;
  attackContribution: number;
  defenseContribution: number;
  upkeep: number;
};

export type ArmySummary = {
  totalUnits: number;
  totalAttack: number;
  totalDefense: number;
  upkeep: number;
  composition: ArmyCompositionRow[];
};

export function getRosterTotalUnits(roster: ArmyRoster): number {
  return Object.values(roster).reduce((total, amount) => total + validateAmount(amount), 0);
}

export function getArmyTotalUnits(army: ArmyState): number {
  return getRosterTotalUnits(army.roster);
}

export function getArmySummary(army: ArmyState, unitDefinitions: UnitDefinitions): ArmySummary {
  let totalUnits = 0;
  let totalAttack = 0;
  let totalDefense = 0;
  let upkeep = 0;
  const composition: ArmyCompositionRow[] = [];

  for (const [unitTypeId, rawAmount] of Object.entries(army.roster)) {
    const amount = validateAmount(rawAmount);
    if (amount === 0) continue;
    const unit = unitDefinitions[unitTypeId];
    if (!unit) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);

    const attackContribution = amount * unit.attack;
    const defenseContribution = amount * unit.defense;
    const rowUpkeep = amount * unit.upkeepPerUnit;

    totalUnits += amount;
    totalAttack += attackContribution;
    totalDefense += defenseContribution;
    upkeep += rowUpkeep;
    composition.push({
      unitTypeId,
      amount,
      attackContribution,
      defenseContribution,
      upkeep: roundMoney(rowUpkeep),
    });
  }

  return {
    totalUnits,
    totalAttack,
    totalDefense,
    upkeep: roundMoney(upkeep),
    composition,
  };
}

function validateAmount(amount: number): number {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('Army roster amounts must be non-negative integers');
  }
  return amount;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
