import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type {
  BattleInput,
  BattleResult,
  BattleRules,
  BattleSideId,
  BattleSideInput,
  BattleSideResult,
  BattleTacticRule,
  BattleTimelineEvent,
} from '@/core/battles/BattleTypes';
import { randomInt } from '@/core/rng/seededRandom';
import type { RngState } from '@/core/rng/RngState';
import type { ArmyRoster } from '@/core/state/GameState';

const MIN_CASUALTY_RATE = 0.01;
const MAX_CASUALTY_RATE = 0.28;

type MutableSide = {
  input: BattleSideInput;
  initialRoster: ArmyRoster;
  roster: ArmyRoster;
  initialUnits: number;
  morale: number;
};

type RoundPower = {
  attack: number;
  defense: number;
};

export function simulateBattle(
  input: BattleInput,
  rngState: RngState,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
): BattleResult {
  validateBattleInput(input, unitDefinitions, rules);

  const sideA = createMutableSide(input.sideA);
  const sideB = createMutableSide(input.sideB);
  const timeline: BattleTimelineEvent[] = [
    { at: 0, type: 'battle_start', battleId: input.battleId, scale: input.scale },
  ];
  const scaleRule = rules.scale[input.scale];
  let rng = rngState;
  let roundsFought = 0;

  for (let round = 1; round <= scaleRule.maxRounds; round += 1) {
    if (isBroken(sideA, rules) || isBroken(sideB, rules)) break;

    roundsFought = round;
    const at = (round - 1) * scaleRule.timelineStepSeconds + 1;
    timeline.push({ at, type: 'round_start', round });

    const rollAResult = randomInt(rng, 1, 20);
    rng = rollAResult.state;
    const rollBResult = randomInt(rng, 1, 20);
    rng = rollBResult.state;

    timeline.push(
      { at: at + 1, type: 'combat_roll', round, side: 'A', roll: rollAResult.value },
      { at: at + 1, type: 'combat_roll', round, side: 'B', roll: rollBResult.value },
    );

    const powerA = getRoundPower(sideA, rollAResult.value, unitDefinitions, rules);
    const powerB = getRoundPower(sideB, rollBResult.value, unitDefinitions, rules);

    const unitsBeforeA = getRosterTotal(sideA.roster);
    const unitsBeforeB = getRosterTotal(sideB.roster);
    const lossesToA = calculateLossCount(
      unitsBeforeA,
      powerB.attack,
      powerA.defense,
      scaleRule.baseCasualtyRate,
      rules.tactics[sideB.input.tactic].casualtyInflictedMultiplier,
    );
    const lossesToB = calculateLossCount(
      unitsBeforeB,
      powerA.attack,
      powerB.defense,
      scaleRule.baseCasualtyRate,
      rules.tactics[sideA.input.tactic].casualtyInflictedMultiplier,
    );

    const lossesRosterA = distributeLosses(sideA.roster, lossesToA, unitDefinitions);
    const lossesRosterB = distributeLosses(sideB.roster, lossesToB, unitDefinitions);
    sideA.roster = subtractRoster(sideA.roster, lossesRosterA);
    sideB.roster = subtractRoster(sideB.roster, lossesRosterB);

    timeline.push(
      {
        at: at + 2,
        type: 'casualties',
        round,
        side: 'A',
        losses: lossesRosterA,
        totalLosses: lossesToA,
      },
      {
        at: at + 2,
        type: 'casualties',
        round,
        side: 'B',
        losses: lossesRosterB,
        totalLosses: lossesToB,
      },
    );

    const moraleBeforeA = sideA.morale;
    const moraleBeforeB = sideB.morale;
    sideA.morale = applyMoraleLoss(
      sideA,
      lossesToA,
      unitsBeforeA,
      powerB.attack,
      powerA.attack,
      rules.tactics[sideA.input.tactic],
      sideB.input.moraleDamageInflictedMultiplier ?? 1,
    );
    sideB.morale = applyMoraleLoss(
      sideB,
      lossesToB,
      unitsBeforeB,
      powerA.attack,
      powerB.attack,
      rules.tactics[sideB.input.tactic],
      sideA.input.moraleDamageInflictedMultiplier ?? 1,
    );

    timeline.push(
      {
        at: at + 3,
        type: 'morale_change',
        round,
        side: 'A',
        before: moraleBeforeA,
        after: sideA.morale,
      },
      {
        at: at + 3,
        type: 'morale_change',
        round,
        side: 'B',
        before: moraleBeforeB,
        after: sideB.morale,
      },
    );

    if (isBroken(sideA, rules)) {
      timeline.push({ at: at + 3, type: 'line_break', round, side: 'A' });
    }
    if (isBroken(sideB, rules)) {
      timeline.push({ at: at + 3, type: 'line_break', round, side: 'B' });
    }
  }

  const winnerSide = determineWinner(sideA, sideB, unitDefinitions, rules);
  const winnerFactionId = winnerSide === 'A' ? sideA.input.factionId : winnerSide === 'B' ? sideB.input.factionId : null;
  const sideResults: Record<BattleSideId, BattleSideResult> = {
    A: buildSideResult('A', sideA, winnerSide, rules),
    B: buildSideResult('B', sideB, winnerSide, rules),
  };
  const endAt = roundsFought * scaleRule.timelineStepSeconds + 1;
  timeline.push({ at: endAt, type: 'battle_end', winnerSide, winnerFactionId });

  return {
    battleId: input.battleId,
    scale: input.scale,
    winnerSide,
    winnerFactionId,
    roundsFought,
    sides: sideResults,
    timeline,
    rngState: rng,
  };
}

function createMutableSide(input: BattleSideInput): MutableSide {
  const roster = cloneRoster(input.roster);
  return {
    input,
    initialRoster: cloneRoster(input.roster),
    roster,
    initialUnits: getRosterTotal(roster),
    morale: input.morale,
  };
}

function getRoundPower(
  side: MutableSide,
  roll: number,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
): RoundPower {
  const tactic = rules.tactics[side.input.tactic];
  let rawAttack = 0;
  let rawDefense = 0;

  for (const [unitTypeId, amount] of Object.entries(side.roster)) {
    if (amount <= 0) continue;
    const unit = unitDefinitions[unitTypeId];
    if (!unit) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
    const roleAttackMultiplier = tactic.roleAttackMultipliers?.[unit.role] ?? 1;
    rawAttack += amount * unit.attack * roleAttackMultiplier;
    rawDefense += amount * unit.defense;
  }

  const moraleMultiplier = 0.65 + side.morale * 0.0035;
  const rollMultiplier = 0.82 + roll * 0.018;

  return {
    attack: rawAttack * tactic.attackMultiplier * moraleMultiplier * rollMultiplier,
    defense: rawDefense * tactic.defenseMultiplier * moraleMultiplier,
  };
}

function calculateLossCount(
  defenderUnits: number,
  attackerPower: number,
  defenderPower: number,
  baseCasualtyRate: number,
  casualtyInflictedMultiplier: number,
): number {
  if (defenderUnits <= 0 || attackerPower <= 0) return 0;
  const pressure = attackerPower / Math.max(1, defenderPower);
  const casualtyRate = clamp(
    baseCasualtyRate * Math.pow(pressure, 0.72) * casualtyInflictedMultiplier,
    MIN_CASUALTY_RATE,
    MAX_CASUALTY_RATE,
  );
  return Math.min(defenderUnits, Math.max(1, Math.round(defenderUnits * casualtyRate)));
}

function distributeLosses(
  roster: ArmyRoster,
  totalLosses: number,
  unitDefinitions: UnitDefinitions,
): ArmyRoster {
  if (totalLosses <= 0) return {};

  const rows = Object.entries(roster)
    .filter(([, amount]) => amount > 0)
    .map(([unitTypeId, amount]) => {
      const unit = unitDefinitions[unitTypeId];
      if (!unit) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
      return {
        unitTypeId,
        amount,
        weight: amount / Math.sqrt(Math.max(1, unit.defense)),
      };
    });
  const weightTotal = rows.reduce((sum, row) => sum + row.weight, 0);
  const allocations = rows.map((row) => {
    const exact = weightTotal === 0 ? 0 : (totalLosses * row.weight) / weightTotal;
    const base = Math.min(row.amount, Math.floor(exact));
    return { ...row, exact, allocated: base, remainder: exact - base };
  });

  let remaining = totalLosses - allocations.reduce((sum, row) => sum + row.allocated, 0);
  allocations.sort((a, b) => b.remainder - a.remainder || a.unitTypeId.localeCompare(b.unitTypeId));

  while (remaining > 0) {
    let allocatedThisPass = false;
    for (const row of allocations) {
      if (remaining <= 0) break;
      if (row.allocated >= row.amount) continue;
      row.allocated += 1;
      remaining -= 1;
      allocatedThisPass = true;
    }
    if (!allocatedThisPass) break;
  }

  return Object.fromEntries(
    allocations
      .filter((row) => row.allocated > 0)
      .map((row) => [row.unitTypeId, row.allocated]),
  );
}

function subtractRoster(roster: ArmyRoster, losses: ArmyRoster): ArmyRoster {
  const next: ArmyRoster = {};
  for (const [unitTypeId, amount] of Object.entries(roster)) {
    next[unitTypeId] = Math.max(0, amount - (losses[unitTypeId] ?? 0));
  }
  return next;
}

function applyMoraleLoss(
  side: MutableSide,
  losses: number,
  unitsBefore: number,
  enemyAttack: number,
  ownAttack: number,
  tactic: BattleTacticRule,
  moraleDamageInflictedMultiplier: number,
): number {
  const lossFraction = unitsBefore <= 0 ? 1 : losses / unitsBefore;
  const pressurePenalty = Math.max(0, enemyAttack / Math.max(1, ownAttack) - 1) * 4;
  const rawLoss =
    (2 + lossFraction * 35 + pressurePenalty) *
    tactic.moraleLossMultiplier *
    moraleDamageInflictedMultiplier;
  return clamp(Math.round(side.morale - rawLoss), 0, 100);
}

function isBroken(side: MutableSide, rules: BattleRules): boolean {
  const remainingUnits = getRosterTotal(side.roster);
  if (remainingUnits <= 0) return true;
  const remainingRatio = remainingUnits / Math.max(1, side.initialUnits);
  return side.morale <= rules.breakMoraleThreshold || remainingRatio <= rules.routRemainingRatio;
}

function determineWinner(
  sideA: MutableSide,
  sideB: MutableSide,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
): BattleSideId | null {
  const brokenA = isBroken(sideA, rules);
  const brokenB = isBroken(sideB, rules);
  if (brokenA && !brokenB) return 'B';
  if (brokenB && !brokenA) return 'A';
  if (brokenA && brokenB) return null;

  const scoreA = getFinalStrength(sideA, unitDefinitions);
  const scoreB = getFinalStrength(sideB, unitDefinitions);
  if (scoreA <= 0 && scoreB <= 0) return null;
  if (scoreA === scoreB) {
    if (sideA.morale === sideB.morale) return null;
    return sideA.morale > sideB.morale ? 'A' : 'B';
  }
  return scoreA > scoreB ? 'A' : 'B';
}

function getFinalStrength(side: MutableSide, unitDefinitions: UnitDefinitions): number {
  let raw = 0;
  for (const [unitTypeId, amount] of Object.entries(side.roster)) {
    if (amount <= 0) continue;
    const unit = unitDefinitions[unitTypeId];
    if (!unit) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
    raw += amount * (unit.attack + unit.defense);
  }
  return raw * (0.55 + side.morale * 0.0045);
}

function buildSideResult(
  sideId: BattleSideId,
  side: MutableSide,
  winnerSide: BattleSideId | null,
  rules: BattleRules,
): BattleSideResult {
  const remainingUnits = getRosterTotal(side.roster);
  const totalLosses = side.initialUnits - remainingUnits;
  const lossRatio = totalLosses / Math.max(1, side.initialUnits);
  const remainingRatio = remainingUnits / Math.max(1, side.initialUnits);
  const won = sideId === winnerSide;

  let outcome: BattleSideResult['outcome'];
  if (won) {
    outcome =
      lossRatio >= rules.pyrrhicLossRatio || side.morale <= rules.pyrrhicMoraleThreshold
        ? 'pyrrhic_victory'
        : 'victory';
  } else {
    outcome =
      remainingRatio <= rules.routRemainingRatio || side.morale <= rules.breakMoraleThreshold
        ? 'rout'
        : 'retreat';
  }

  return {
    factionId: side.input.factionId,
    outcome,
    initialRoster: cloneRoster(side.initialRoster),
    remainingRoster: cloneRoster(side.roster),
    losses: diffRoster(side.initialRoster, side.roster),
    initialUnits: side.initialUnits,
    remainingUnits,
    totalLosses,
    moraleBefore: side.input.morale,
    moraleAfter: side.morale,
  };
}

function diffRoster(initial: ArmyRoster, remaining: ArmyRoster): ArmyRoster {
  const losses: ArmyRoster = {};
  for (const [unitTypeId, initialAmount] of Object.entries(initial)) {
    const loss = initialAmount - (remaining[unitTypeId] ?? 0);
    if (loss > 0) losses[unitTypeId] = loss;
  }
  return losses;
}

function cloneRoster(roster: ArmyRoster): ArmyRoster {
  return { ...roster };
}

function getRosterTotal(roster: ArmyRoster): number {
  return getRosterTotalUnits(roster);
}

function validateBattleInput(
  input: BattleInput,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
): void {
  if (!input.battleId) throw new Error('Battle id is required');
  if (!rules.scale[input.scale]) throw new Error(`Missing battle scale rule: ${input.scale}`);
  validateSide(input.sideA, unitDefinitions, rules);
  validateSide(input.sideB, unitDefinitions, rules);
}

function validateSide(
  side: BattleSideInput,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
): void {
  if (side.morale < 0 || side.morale > 100 || !Number.isFinite(side.morale)) {
    throw new Error('Battle morale must be between 0 and 100');
  }
  if (!rules.tactics[side.tactic]) throw new Error(`Missing tactic rule: ${side.tactic}`);
  const total = getRosterTotal(side.roster);
  if (total <= 0) throw new Error('Battle side must contain at least one unit');
  for (const unitTypeId of Object.keys(side.roster)) {
    if (!unitDefinitions[unitTypeId]) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
