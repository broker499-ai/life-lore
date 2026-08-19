import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type {
  BattleCommandId,
  BattleFormationId,
  BattleInput,
  BattleLane,
  BattlePlan,
  BattleResult,
  BattleRules,
  BattleSideId,
  BattleSideInput,
  BattleSideResult,
  BattleSideSectorSnapshot,
  BattleTacticRule,
  BattleTimelineEvent,
} from '@/core/battles/BattleTypes';
import { DEFAULT_BATTLE_PLAN } from '@/core/battles/BattleTypes';
import { randomInt } from '@/core/rng/seededRandom';
import type { RngState } from '@/core/rng/RngState';
import type { ArmyRoster } from '@/core/state/GameState';

const MIN_CASUALTY_RATE = 0.01;
const MAX_CASUALTY_RATE = 0.28;
const LANES: BattleLane[] = ['left', 'center', 'right'];
const COMMAND_ROUNDS = [2, 4] as const;

type MutableSector = {
  roster: ArmyRoster;
  morale: number;
  broken: boolean;
};

type MutableSide = {
  input: BattleSideInput;
  plan: BattlePlan;
  initialRoster: ArmyRoster;
  roster: ArmyRoster;
  initialUnits: number;
  morale: number;
  sectors: Record<BattleLane, MutableSector>;
  reserveRoster: ArmyRoster;
  reserveCommitted: boolean;
  organizedRetreat: boolean;
  encirclementAnnounced: boolean;
};

type RoundPower = {
  attack: number;
  defense: number;
};

type CommandEffect = {
  attackMultiplier: number;
  defenseMultiplier: number;
  casualtyTakenMultiplier: number;
  moraleLossMultiplier: number;
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
    { at: 0.2, type: 'formation_set', side: 'A', plan: clonePlan(sideA.plan), snapshot: snapshotSide(sideA) },
    { at: 0.2, type: 'formation_set', side: 'B', plan: clonePlan(sideB.plan), snapshot: snapshotSide(sideB) },
  ];
  const scaleRule = rules.scale[input.scale];
  let rng = rngState;
  let roundsFought = 0;

  for (let round = 1; round <= scaleRule.maxRounds; round += 1) {
    if (isBroken(sideA, rules) || isBroken(sideB, rules)) break;

    roundsFought = round;
    const at = (round - 1) * scaleRule.timelineStepSeconds + 1;
    timeline.push({ at, type: 'round_start', round });

    emitCommandIfAny(sideA, 'A', round, at, timeline);
    emitCommandIfAny(sideB, 'B', round, at, timeline);
    commitReserveIfDue(sideA, 'A', round, at, timeline);
    commitReserveIfDue(sideB, 'B', round, at, timeline);

    const rollAResult = randomInt(rng, 1, 20);
    rng = rollAResult.state;
    const rollBResult = randomInt(rng, 1, 20);
    rng = rollBResult.state;

    timeline.push(
      { at: at + 1, type: 'combat_roll', round, side: 'A', roll: rollAResult.value },
      { at: at + 1, type: 'combat_roll', round, side: 'B', roll: rollBResult.value },
    );

    const brokenBeforeA = getBrokenLanes(sideA);
    const brokenBeforeB = getBrokenLanes(sideB);
    const basePowerA = getLanePowers(sideA, rollAResult.value, round, unitDefinitions, rules, Boolean(sideB.input.centerOnlyFormation));
    const basePowerB = getLanePowers(sideB, rollBResult.value, round, unitDefinitions, rules, Boolean(sideA.input.centerOnlyFormation));
    const powerA = applyFlankSupport(basePowerA, brokenBeforeB, Boolean(sideB.input.centerOnlyFormation));
    const powerB = applyFlankSupport(basePowerB, brokenBeforeA, Boolean(sideA.input.centerOnlyFormation));

    const lossesRosterA: ArmyRoster = {};
    const lossesRosterB: ArmyRoster = {};
    let totalLossesA = 0;
    let totalLossesB = 0;

    for (const lane of LANES) {
      const sectorA = sideA.sectors[lane];
      const sectorB = sideB.sectors[lane];
      const unitsBeforeA = getRosterTotal(sectorA.roster);
      const unitsBeforeB = getRosterTotal(sectorB.roster);
      if (unitsBeforeA <= 0 && unitsBeforeB <= 0) continue;

      const commandEffectA = getCommandEffect(sideA.plan, round, lane, Boolean(sideB.input.centerOnlyFormation));
      const commandEffectB = getCommandEffect(sideB.plan, round, lane, Boolean(sideA.input.centerOnlyFormation));
      const tacticalCasualtyTakenA = getTacticalCasualtyTakenMultiplier(
        sideA.input.tactic,
        getPowerMagnitude(powerA[lane]),
        getPowerMagnitude(powerB[lane]),
        rules,
      );
      const tacticalCasualtyTakenB = getTacticalCasualtyTakenMultiplier(
        sideB.input.tactic,
        getPowerMagnitude(powerB[lane]),
        getPowerMagnitude(powerA[lane]),
        rules,
      );

      const lossesToA = sectorA.broken
        ? 0
        : calculateLossCount(
            unitsBeforeA,
            powerB[lane].attack,
            powerA[lane].defense,
            scaleRule.baseCasualtyRate,
            rules.tactics[sideB.input.tactic].casualtyInflictedMultiplier *
              tacticalCasualtyTakenA *
              commandEffectA.casualtyTakenMultiplier *
              (sideA.input.casualtyTakenMultiplier ?? 1),
            isSingularFormation(sectorA.roster, unitDefinitions) || unitsBeforeA < 8,
          );
      const lossesToB = sectorB.broken
        ? 0
        : calculateLossCount(
            unitsBeforeB,
            powerA[lane].attack,
            powerB[lane].defense,
            scaleRule.baseCasualtyRate,
            rules.tactics[sideA.input.tactic].casualtyInflictedMultiplier *
              tacticalCasualtyTakenB *
              commandEffectB.casualtyTakenMultiplier *
              (sideB.input.casualtyTakenMultiplier ?? 1),
            isSingularFormation(sectorB.roster, unitDefinitions) || unitsBeforeB < 8,
          );

      const laneLossesA = distributeLosses(sectorA.roster, lossesToA, unitDefinitions);
      const laneLossesB = distributeLosses(sectorB.roster, lossesToB, unitDefinitions);
      sectorA.roster = subtractRoster(sectorA.roster, laneLossesA);
      sectorB.roster = subtractRoster(sectorB.roster, laneLossesB);
      mergeRoster(lossesRosterA, laneLossesA);
      mergeRoster(lossesRosterB, laneLossesB);
      totalLossesA += lossesToA;
      totalLossesB += lossesToB;

      sectorA.morale = applySectorMoraleLoss(
        sectorA.morale,
        lossesToA,
        unitsBeforeA,
        powerB[lane].attack,
        powerA[lane].attack,
        rules.tactics[sideA.input.tactic],
        sideB.input.moraleDamageInflictedMultiplier ?? 1,
        sideA.input.moraleLossTakenMultiplier ?? 1,
        commandEffectA.moraleLossMultiplier,
        round,
      );
      sectorB.morale = applySectorMoraleLoss(
        sectorB.morale,
        lossesToB,
        unitsBeforeB,
        powerA[lane].attack,
        powerB[lane].attack,
        rules.tactics[sideB.input.tactic],
        sideA.input.moraleDamageInflictedMultiplier ?? 1,
        sideB.input.moraleLossTakenMultiplier ?? 1,
        commandEffectB.moraleLossMultiplier,
        round,
      );
    }

    timeline.push(
      { at: at + 2, type: 'casualties', round, side: 'A', losses: lossesRosterA, totalLosses: totalLossesA },
      { at: at + 2, type: 'casualties', round, side: 'B', losses: lossesRosterB, totalLosses: totalLossesB },
    );

    applyEncirclementPressure(sideA, brokenBeforeA);
    applyEncirclementPressure(sideB, brokenBeforeB);
    enforceMoraleLock(sideA);
    enforceMoraleLock(sideB);

    const moraleBeforeA = sideA.morale;
    const moraleBeforeB = sideB.morale;
    updateSectorBreaks(sideA, 'A', round, at, timeline, rules);
    updateSectorBreaks(sideB, 'B', round, at, timeline, rules);
    sideA.morale = calculateSideMorale(sideA);
    sideB.morale = calculateSideMorale(sideB);

    const moraleGainA = applyRandomMoraleGain(sideA, rng);
    rng = moraleGainA.rngState;
    applySideMoraleGain(sideA, moraleGainA.morale - sideA.morale);
    sideA.morale = moraleGainA.morale;
    enforceMoraleLock(sideA);
    const moraleGainB = applyRandomMoraleGain(sideB, rng);
    rng = moraleGainB.rngState;
    applySideMoraleGain(sideB, moraleGainB.morale - sideB.morale);
    sideB.morale = moraleGainB.morale;
    enforceMoraleLock(sideB);

    sideA.roster = aggregateSideRoster(sideA);
    sideB.roster = aggregateSideRoster(sideB);

    timeline.push(
      { at: at + 3, type: 'morale_change', round, side: 'A', before: moraleBeforeA, after: sideA.morale },
      { at: at + 3, type: 'morale_change', round, side: 'B', before: moraleBeforeB, after: sideB.morale },
      { at: at + 3.25, type: 'sector_status', round, side: 'A', snapshot: snapshotSide(sideA) },
      { at: at + 3.25, type: 'sector_status', round, side: 'B', snapshot: snapshotSide(sideB) },
    );

    announceEncirclement(sideA, 'A', round, at, timeline);
    announceEncirclement(sideB, 'B', round, at, timeline);

    attemptOrganizedRetreat(sideA, 'A', sideB, round, at, timeline, rules);
    attemptOrganizedRetreat(sideB, 'B', sideA, round, at, timeline, rules);

    if (isBroken(sideA, rules)) timeline.push({ at: at + 3.5, type: 'line_break', round, side: 'A' });
    if (isBroken(sideB, rules)) timeline.push({ at: at + 3.5, type: 'line_break', round, side: 'B' });
  }

  sideA.roster = aggregateSideRoster(sideA);
  sideB.roster = aggregateSideRoster(sideB);
  sideA.morale = calculateSideMorale(sideA);
  sideB.morale = calculateSideMorale(sideB);
  enforceMoraleLock(sideA);
  enforceMoraleLock(sideB);

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
  const plan = normalizeBattlePlan(input.plan);
  const initialRoster = cloneRoster(input.roster);
  const split = splitReserve(initialRoster, plan.reservePercent);
  const startingMorale = input.moraleLockedAt ?? input.morale;
  const sectors = input.centerOnlyFormation
    ? distributeCenterOnlyRoster(split.active, startingMorale)
    : distributeActiveRoster(split.active, plan.formation, startingMorale);
  const side: MutableSide = {
    input,
    plan,
    initialRoster,
    roster: cloneRoster(initialRoster),
    initialUnits: getRosterTotal(initialRoster),
    morale: startingMorale,
    sectors,
    reserveRoster: split.reserve,
    reserveCommitted: plan.reservePercent === 0 || getRosterTotal(split.reserve) === 0,
    organizedRetreat: false,
    encirclementAnnounced: false,
  };
  return side;
}

export function normalizeBattlePlan(plan?: Partial<BattlePlan>): BattlePlan {
  const formation = isFormation(plan?.formation) ? plan.formation : DEFAULT_BATTLE_PLAN.formation;
  const reservePercent = plan?.reservePercent === 0 || plan?.reservePercent === 15 || plan?.reservePercent === 30
    ? plan.reservePercent
    : DEFAULT_BATTLE_PLAN.reservePercent;
  const reserveTarget = plan?.reserveTarget === 'left' || plan?.reserveTarget === 'center' || plan?.reserveTarget === 'right'
    ? plan.reserveTarget
    : DEFAULT_BATTLE_PLAN.reserveTarget;
  const commands = (plan?.commands ?? [])
    .filter(isBattleCommand)
    .slice(0, 2);
  const threshold = plan?.retreatMoraleThreshold;
  const retreatMoraleThreshold = threshold === null || threshold === undefined
    ? null
    : clamp(Math.round(threshold), 10, 60);
  return { formation, reservePercent, reserveTarget, commands, retreatMoraleThreshold };
}

function splitReserve(roster: ArmyRoster, percent: number): { active: ArmyRoster; reserve: ArmyRoster } {
  const active: ArmyRoster = {};
  const reserve: ArmyRoster = {};
  for (const [unitTypeId, amount] of Object.entries(roster)) {
    const reserveAmount = percent <= 0 ? 0 : Math.min(amount, Math.round((amount * percent) / 100));
    reserve[unitTypeId] = reserveAmount;
    active[unitTypeId] = amount - reserveAmount;
  }
  if (getRosterTotal(active) <= 0 && getRosterTotal(reserve) > 0) {
    const donor = Object.entries(reserve).find(([, amount]) => amount > 0);
    if (donor) {
      reserve[donor[0]] = donor[1] - 1;
      active[donor[0]] = (active[donor[0]] ?? 0) + 1;
    }
  }
  return { active: cleanRoster(active), reserve: cleanRoster(reserve) };
}

function distributeActiveRoster(
  roster: ArmyRoster,
  formation: BattleFormationId,
  morale: number,
): Record<BattleLane, MutableSector> {
  const result: Record<BattleLane, ArmyRoster> = { left: {}, center: {}, right: {} };
  const weights = getFormationWeights(formation);
  for (const [unitTypeId, amount] of Object.entries(roster)) {
    const allocation = allocateInteger(amount, [weights.left, weights.center, weights.right]);
    result.left[unitTypeId] = allocation[0] ?? 0;
    result.center[unitTypeId] = allocation[1] ?? 0;
    result.right[unitTypeId] = allocation[2] ?? 0;
  }
  return {
    left: { roster: cleanRoster(result.left), morale, broken: false },
    center: { roster: cleanRoster(result.center), morale, broken: false },
    right: { roster: cleanRoster(result.right), morale, broken: false },
  };
}

function distributeCenterOnlyRoster(roster: ArmyRoster, morale: number): Record<BattleLane, MutableSector> {
  return {
    left: { roster: {}, morale, broken: true },
    center: { roster: cloneRoster(roster), morale, broken: false },
    right: { roster: {}, morale, broken: true },
  };
}

function getFormationWeights(formation: BattleFormationId): Record<BattleLane, number> {
  if (formation === 'strong_center') return { left: 0.15, center: 0.7, right: 0.15 };
  if (formation === 'crescent') return { left: 0.35, center: 0.3, right: 0.35 };
  return { left: 0.25, center: 0.5, right: 0.25 };
}

function allocateInteger(total: number, weights: number[]): number[] {
  const exact = weights.map((weight) => total * weight);
  const base = exact.map(Math.floor);
  let remainder = total - base.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - base[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const item of order) {
    if (remainder <= 0) break;
    base[item.index] += 1;
    remainder -= 1;
  }
  return base;
}

function commitReserveIfDue(
  side: MutableSide,
  sideId: BattleSideId,
  round: number,
  at: number,
  timeline: BattleTimelineEvent[],
): void {
  if (round !== 3 || side.reserveCommitted) return;
  const units = getRosterTotal(side.reserveRoster);
  if (units <= 0) {
    side.reserveCommitted = true;
    return;
  }
  const targetLane: BattleLane = side.input.centerOnlyFormation ? 'center' : side.plan.reserveTarget;
  const sector = side.sectors[targetLane];
  sector.roster = addRosters(sector.roster, side.reserveRoster);
  sector.morale = side.input.moraleLockedAt ?? clamp(Math.round((sector.morale + side.input.morale) / 2 + 4), 0, 100);
  sector.broken = false;
  side.reserveRoster = {};
  side.reserveCommitted = true;
  timeline.push({ at: at + 0.35, type: 'reserve_committed', round, side: sideId, lane: targetLane, units });
}

function emitCommandIfAny(
  side: MutableSide,
  sideId: BattleSideId,
  round: number,
  at: number,
  timeline: BattleTimelineEvent[],
): void {
  const index = COMMAND_ROUNDS.indexOf(round as (typeof COMMAND_ROUNDS)[number]);
  if (index < 0) return;
  const command = side.plan.commands[index];
  if (command) timeline.push({ at: at + 0.2, type: 'command_order', round, side: sideId, command });
}

function getLanePowers(
  side: MutableSide,
  roll: number,
  round: number,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
  enemyCenterOnly: boolean,
): Record<BattleLane, RoundPower> {
  return Object.fromEntries(
    LANES.map((lane) => [lane, getLanePower(side, lane, roll, round, unitDefinitions, rules, enemyCenterOnly)]),
  ) as Record<BattleLane, RoundPower>;
}

function getLanePower(
  side: MutableSide,
  lane: BattleLane,
  roll: number,
  round: number,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
  enemyCenterOnly: boolean,
): RoundPower {
  const sector = side.sectors[lane];
  if (sector.broken || getRosterTotal(sector.roster) <= 0) return { attack: 0, defense: 0 };
  const tactic = rules.tactics[side.input.tactic];
  const command = getCommandEffect(side.plan, round, lane, enemyCenterOnly);
  let rawAttack = 0;
  let rawDefense = 0;

  for (const [unitTypeId, amount] of Object.entries(sector.roster)) {
    if (amount <= 0) continue;
    const unit = unitDefinitions[unitTypeId];
    if (!unit) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
    const roleAttackMultiplier = tactic.roleAttackMultipliers?.[unit.role] ?? 1;
    const positionAttackMultiplier = unit.role === 'ranged' && lane !== 'center'
      ? 1.12
      : unit.role === 'line' && lane === 'center'
        ? 1.08
        : 1;
    rawAttack += amount * unit.attack * roleAttackMultiplier * positionAttackMultiplier;
    rawDefense += amount * unit.defense * (unit.role === 'line' && lane === 'center' ? 1.06 : 1);
  }

  const moraleMultiplier = 0.65 + sector.morale * 0.0035;
  const laneRollOffset = lane === 'left' ? -0.5 : lane === 'right' ? 0.5 : 0;
  const rollMultiplier = 0.82 + clamp(roll + laneRollOffset, 1, 20) * 0.018;
  const unitPowerMultiplier = side.input.unitPowerMultiplier ?? 1;
  const flankTacticMultiplier = side.input.tactic === 'flank'
    ? lane === 'center' ? 0.94 : 1.12
    : 1;
  const encircledDefenseMultiplier = lane === 'center' && isEncircled(side) ? 0.82 : 1;

  return {
    attack: rawAttack * tactic.attackMultiplier * moraleMultiplier * rollMultiplier * unitPowerMultiplier * flankTacticMultiplier * command.attackMultiplier,
    defense: rawDefense * tactic.defenseMultiplier * moraleMultiplier * unitPowerMultiplier * encircledDefenseMultiplier * command.defenseMultiplier,
  };
}

function applyFlankSupport(
  own: Record<BattleLane, RoundPower>,
  enemyBroken: Set<BattleLane>,
  enemyCenterOnly: boolean,
): Record<BattleLane, RoundPower> {
  const next = {
    left: { ...own.left },
    center: { ...own.center },
    right: { ...own.right },
  };
  if (enemyCenterOnly) {
    // Orcs expose no side sectors. Flank troops therefore curl around the central mass
    // from the first round instead of wasting attacks against empty lanes.
    next.center.attack += own.left.attack * 0.55 + own.right.attack * 0.55;
    return next;
  }
  if (enemyBroken.has('left')) next.center.attack += own.left.attack * 0.25;
  if (enemyBroken.has('right')) next.center.attack += own.right.attack * 0.25;
  if (enemyBroken.has('left') && enemyBroken.has('right')) next.center.attack *= 1.12;
  return next;
}

function getCommandEffect(
  plan: BattlePlan,
  round: number,
  lane: BattleLane,
  enemyCenterOnly = false,
): CommandEffect {
  const index = COMMAND_ROUNDS.indexOf(round as (typeof COMMAND_ROUNDS)[number]);
  const command = index >= 0 ? plan.commands[index] : undefined;
  const neutral: CommandEffect = { attackMultiplier: 1, defenseMultiplier: 1, casualtyTakenMultiplier: 1, moraleLossMultiplier: 1 };
  if (!command || command === 'none') return neutral;
  if (command === 'general_assault') {
    return { attackMultiplier: 1.18, defenseMultiplier: 0.92, casualtyTakenMultiplier: 1.1, moraleLossMultiplier: 1.08 };
  }
  if (command === 'hold_line') {
    return { attackMultiplier: 0.92, defenseMultiplier: 1.2, casualtyTakenMultiplier: 0.86, moraleLossMultiplier: 0.72 };
  }
  const target = command === 'press_left' ? 'left' : command === 'press_right' ? 'right' : 'center';
  if (lane !== target) return neutral;
  if (enemyCenterOnly) {
    if (target === 'center') {
      // Pushing directly into an orc central mass is actively counterproductive.
      return { attackMultiplier: 0.82, defenseMultiplier: 0.88, casualtyTakenMultiplier: 1.16, moraleLossMultiplier: 1.08 };
    }
    // Side pressure is the intended answer: those troops wrap into the center through applyFlankSupport.
    return { attackMultiplier: 1.46, defenseMultiplier: 0.96, casualtyTakenMultiplier: 1.03, moraleLossMultiplier: 1.01 };
  }
  return { attackMultiplier: 1.28, defenseMultiplier: 0.92, casualtyTakenMultiplier: 1.07, moraleLossMultiplier: 1.04 };
}

function applySectorMoraleLoss(
  morale: number,
  losses: number,
  unitsBefore: number,
  enemyAttack: number,
  ownAttack: number,
  tactic: BattleTacticRule,
  moraleDamageInflictedMultiplier: number,
  moraleLossTakenMultiplier: number,
  commandMoraleLossMultiplier: number,
  round: number,
): number {
  if (unitsBefore <= 0) return 0;
  const lossFraction = losses / unitsBefore;
  const pressurePenalty = Math.max(0, enemyAttack / Math.max(1, ownAttack) - 1) * 4;
  const rawLoss =
    (2 + lossFraction * 35 + pressurePenalty) *
    getTacticalMoraleLossMultiplier(tactic, round) *
    moraleDamageInflictedMultiplier *
    moraleLossTakenMultiplier *
    commandMoraleLossMultiplier;
  return clamp(Math.round(morale - rawLoss), 0, 100);
}

function applyEncirclementPressure(side: MutableSide, brokenBefore: Set<BattleLane>): void {
  if (side.input.centerOnlyFormation) return;
  const brokenFlanks = Number(brokenBefore.has('left')) + Number(brokenBefore.has('right'));
  if (brokenFlanks <= 0 || side.sectors.center.broken) return;
  side.sectors.center.morale = clamp(side.sectors.center.morale - brokenFlanks * 3, 0, 100);
}

function updateSectorBreaks(
  side: MutableSide,
  sideId: BattleSideId,
  round: number,
  at: number,
  timeline: BattleTimelineEvent[],
  rules: BattleRules,
): void {
  const sectorThreshold = Math.max(12, rules.breakMoraleThreshold - 4);
  for (const lane of LANES) {
    const sector = side.sectors[lane];
    const shouldBreak = getRosterTotal(sector.roster) <= 0 || sector.morale <= sectorThreshold;
    if (shouldBreak && !sector.broken) {
      sector.broken = true;
      timeline.push({ at: at + 3.1, type: 'sector_break', round, side: sideId, lane });
    }
  }
}

function announceEncirclement(
  side: MutableSide,
  sideId: BattleSideId,
  round: number,
  at: number,
  timeline: BattleTimelineEvent[],
): void {
  if (!side.encirclementAnnounced && isEncircled(side) && !side.sectors.center.broken) {
    side.encirclementAnnounced = true;
    timeline.push({ at: at + 3.35, type: 'encirclement', round, side: sideId });
  }
}

function attemptOrganizedRetreat(
  side: MutableSide,
  sideId: BattleSideId,
  enemy: MutableSide,
  round: number,
  at: number,
  timeline: BattleTimelineEvent[],
  rules: BattleRules,
): void {
  const threshold = side.plan.retreatMoraleThreshold;
  if (threshold === null || side.organizedRetreat || side.morale > threshold || isBroken(enemy, rules)) return;
  side.organizedRetreat = true;
  timeline.push({ at: at + 3.4, type: 'organized_retreat', round, side: sideId });
}

function calculateSideMorale(side: MutableSide): number {
  if (side.input.moraleLockedAt !== undefined && getRosterTotal(aggregateSideRoster(side)) > 0) {
    return clamp(side.input.moraleLockedAt, 0, 100);
  }
  let weightedMorale = 0;
  let totalUnits = 0;
  for (const lane of LANES) {
    const units = getRosterTotal(side.sectors[lane].roster);
    weightedMorale += units * side.sectors[lane].morale;
    totalUnits += units;
  }
  const reserveUnits = getRosterTotal(side.reserveRoster);
  weightedMorale += reserveUnits * side.input.morale;
  totalUnits += reserveUnits;
  return totalUnits <= 0 ? 0 : clamp(Math.round(weightedMorale / totalUnits), 0, 100);
}

function applyRandomMoraleGain(side: MutableSide, rngState: RngState): { morale: number; rngState: RngState } {
  if (side.input.moraleLockedAt !== undefined) return { morale: side.input.moraleLockedAt, rngState };
  const effect = side.input.randomMoraleGain;
  if (!effect || effect.chancePercent <= 0 || side.morale >= 100) return { morale: side.morale, rngState };
  const chanceRoll = randomInt(rngState, 1, 100);
  if (chanceRoll.value > effect.chancePercent) return { morale: side.morale, rngState: chanceRoll.state };
  const minGain = Math.max(0, Math.round(effect.minGain));
  const maxGain = Math.max(minGain, Math.round(effect.maxGain));
  const gainRoll = randomInt(chanceRoll.state, minGain, maxGain);
  return { morale: clamp(side.morale + gainRoll.value, 0, 100), rngState: gainRoll.state };
}

function applySideMoraleGain(side: MutableSide, gain: number): void {
  if (gain <= 0) return;
  for (const lane of LANES) {
    if (!side.sectors[lane].broken) side.sectors[lane].morale = clamp(side.sectors[lane].morale + gain, 0, 100);
  }
}


function enforceMoraleLock(side: MutableSide): void {
  const locked = side.input.moraleLockedAt;
  if (locked === undefined) return;
  const value = clamp(locked, 0, 100);
  for (const lane of LANES) {
    if (getRosterTotal(side.sectors[lane].roster) > 0) side.sectors[lane].morale = value;
  }
  if (getRosterTotal(aggregateSideRoster(side)) > 0) side.morale = value;
}

function isBroken(side: MutableSide, rules: BattleRules): boolean {
  if (side.organizedRetreat) return true;
  if (side.input.centerOnlyFormation) {
    const centerUnits = getRosterTotal(side.sectors.center.roster) + getRosterTotal(side.reserveRoster);
    return centerUnits <= 0 || side.morale <= rules.breakMoraleThreshold || side.sectors.center.broken;
  }
  const remainingUnits = getRosterTotal(aggregateSideRoster(side));
  if (remainingUnits <= 0) return true;
  const remainingRatio = remainingUnits / Math.max(1, side.initialUnits);
  const brokenSectors = LANES.filter((lane) => side.sectors[lane].broken).length;
  return side.morale <= rules.breakMoraleThreshold || remainingRatio <= rules.routRemainingRatio || brokenSectors >= 2;
}

function determineWinner(
  sideA: MutableSide,
  sideB: MutableSide,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
): BattleSideId | null {
  if (sideA.organizedRetreat && !sideB.organizedRetreat) return 'B';
  if (sideB.organizedRetreat && !sideA.organizedRetreat) return 'A';
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
  for (const [unitTypeId, amount] of Object.entries(aggregateSideRoster(side))) {
    if (amount <= 0) continue;
    const unit = unitDefinitions[unitTypeId];
    if (!unit) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
    raw += amount * (unit.attack + unit.defense);
  }
  const positionalIntegrity = side.input.centerOnlyFormation
    ? 1
    : Math.max(0.55, 1 - LANES.filter((lane) => side.sectors[lane].broken).length * 0.16);
  return raw * (0.55 + side.morale * 0.0045) * (side.input.unitPowerMultiplier ?? 1) * positionalIntegrity;
}

function buildSideResult(
  sideId: BattleSideId,
  side: MutableSide,
  winnerSide: BattleSideId | null,
  rules: BattleRules,
): BattleSideResult {
  const remainingRoster = aggregateSideRoster(side);
  const remainingUnits = getRosterTotal(remainingRoster);
  const totalLosses = side.initialUnits - remainingUnits;
  const lossRatio = totalLosses / Math.max(1, side.initialUnits);
  const remainingRatio = remainingUnits / Math.max(1, side.initialUnits);
  const won = sideId === winnerSide;

  let outcome: BattleSideResult['outcome'];
  if (won) {
    outcome = lossRatio >= rules.pyrrhicLossRatio || side.morale <= rules.pyrrhicMoraleThreshold
      ? 'pyrrhic_victory'
      : 'victory';
  } else if (side.organizedRetreat) {
    outcome = 'retreat';
  } else {
    outcome = remainingRatio <= rules.routRemainingRatio || side.morale <= rules.breakMoraleThreshold
      ? 'rout'
      : 'retreat';
  }

  return {
    factionId: side.input.factionId,
    outcome,
    initialRoster: cloneRoster(side.initialRoster),
    remainingRoster,
    losses: diffRoster(side.initialRoster, remainingRoster),
    initialUnits: side.initialUnits,
    remainingUnits,
    totalLosses,
    moraleBefore: side.input.morale,
    moraleAfter: side.morale,
    plan: clonePlan(side.plan),
    sectorState: snapshotSide(side),
    centerOnlyFormation: Boolean(side.input.centerOnlyFormation),
  };
}

function snapshotSide(side: MutableSide): BattleSideSectorSnapshot {
  return {
    sectors: {
      left: snapshotSector(side.sectors.left),
      center: snapshotSector(side.sectors.center),
      right: snapshotSector(side.sectors.right),
    },
    reserveUnits: getRosterTotal(side.reserveRoster),
    reserveCommitted: side.reserveCommitted,
  };
}

function snapshotSector(sector: MutableSector) {
  return { units: getRosterTotal(sector.roster), morale: Math.round(sector.morale), broken: sector.broken };
}

function getBrokenLanes(side: MutableSide): Set<BattleLane> {
  return new Set(LANES.filter((lane) => side.sectors[lane].broken));
}

function isEncircled(side: MutableSide): boolean {
  if (side.input.centerOnlyFormation) return false;
  return side.sectors.left.broken && side.sectors.right.broken;
}

function aggregateSideRoster(side: MutableSide): ArmyRoster {
  let result: ArmyRoster = cloneRoster(side.reserveRoster);
  for (const lane of LANES) result = addRosters(result, side.sectors[lane].roster);
  return cleanRoster(result);
}

function addRosters(a: ArmyRoster, b: ArmyRoster): ArmyRoster {
  const result = { ...a };
  for (const [unitTypeId, amount] of Object.entries(b)) result[unitTypeId] = (result[unitTypeId] ?? 0) + amount;
  return cleanRoster(result);
}

function mergeRoster(target: ArmyRoster, source: ArmyRoster): void {
  for (const [unitTypeId, amount] of Object.entries(source)) target[unitTypeId] = (target[unitTypeId] ?? 0) + amount;
}

function cleanRoster(roster: ArmyRoster): ArmyRoster {
  return Object.fromEntries(Object.entries(roster).filter(([, amount]) => amount > 0));
}

export function getTacticalCasualtyTakenMultiplier(
  tacticId: BattleSideInput['tactic'],
  ownPower: number,
  enemyPower: number,
  rules: BattleRules,
): number {
  const tactic = rules.tactics[tacticId];
  const ratio = ownPower / Math.max(1, enemyPower);
  const superiorityProgress = clamp((ratio - 1) / Math.max(0.01, rules.superiorityFullEffectRatio - 1), 0, 1);
  return lerp(tactic.casualtyTakenAtParityMultiplier, tactic.casualtyTakenAtSuperiorMultiplier, superiorityProgress);
}

export function getTacticalMoraleLossMultiplier(tactic: BattleTacticRule, round: number): number {
  const prolongedMultiplier =
    tactic.prolongedMoraleLossStartRound !== undefined && round >= tactic.prolongedMoraleLossStartRound
      ? tactic.prolongedMoraleLossMultiplier ?? 1
      : 1;
  return tactic.moraleLossMultiplier * prolongedMultiplier;
}

function getPowerMagnitude(power: RoundPower): number {
  return power.attack + power.defense;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function calculateLossCount(
  defenderUnits: number,
  attackerPower: number,
  defenderPower: number,
  baseCasualtyRate: number,
  casualtyInflictedMultiplier: number,
  allowZeroCasualties: boolean,
): number {
  if (defenderUnits <= 0 || attackerPower <= 0) return 0;
  const pressure = attackerPower / Math.max(1, defenderPower);
  const casualtyRate = clamp(baseCasualtyRate * Math.pow(pressure, 0.72) * casualtyInflictedMultiplier, MIN_CASUALTY_RATE, MAX_CASUALTY_RATE);
  const rounded = Math.round(defenderUnits * casualtyRate);
  return Math.min(defenderUnits, Math.max(allowZeroCasualties ? 0 : 1, rounded));
}

function isSingularFormation(roster: ArmyRoster, unitDefinitions: UnitDefinitions): boolean {
  const entries = Object.entries(roster).filter(([, amount]) => amount > 0);
  if (entries.length !== 1) return false;
  const [unitTypeId, amount] = entries[0];
  return amount === 1 && unitDefinitions[unitTypeId]?.singularFormation === true;
}

function distributeLosses(roster: ArmyRoster, totalLosses: number, unitDefinitions: UnitDefinitions): ArmyRoster {
  if (totalLosses <= 0) return {};
  const rows = Object.entries(roster)
    .filter(([, amount]) => amount > 0)
    .map(([unitTypeId, amount]) => {
      const unit = unitDefinitions[unitTypeId];
      if (!unit) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
      return { unitTypeId, amount, weight: amount / Math.sqrt(Math.max(1, unit.defense)) };
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
  return Object.fromEntries(allocations.filter((row) => row.allocated > 0).map((row) => [row.unitTypeId, row.allocated]));
}

function subtractRoster(roster: ArmyRoster, losses: ArmyRoster): ArmyRoster {
  const next: ArmyRoster = {};
  for (const [unitTypeId, amount] of Object.entries(roster)) next[unitTypeId] = Math.max(0, amount - (losses[unitTypeId] ?? 0));
  return cleanRoster(next);
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

function clonePlan(plan: BattlePlan): BattlePlan {
  return { ...plan, commands: [...plan.commands] };
}

function getRosterTotal(roster: ArmyRoster): number {
  return getRosterTotalUnits(roster);
}

function validateBattleInput(input: BattleInput, unitDefinitions: UnitDefinitions, rules: BattleRules): void {
  if (!input.battleId) throw new Error('Battle id is required');
  if (!rules.scale[input.scale]) throw new Error(`Missing battle scale rule: ${input.scale}`);
  validateSide(input.sideA, unitDefinitions, rules);
  validateSide(input.sideB, unitDefinitions, rules);
}

function validateSide(side: BattleSideInput, unitDefinitions: UnitDefinitions, rules: BattleRules): void {
  if (side.morale < 0 || side.morale > 100 || !Number.isFinite(side.morale)) throw new Error('Battle morale must be between 0 and 100');
  if (!rules.tactics[side.tactic]) throw new Error(`Missing tactic rule: ${side.tactic}`);
  if (side.unitPowerMultiplier !== undefined && (!Number.isFinite(side.unitPowerMultiplier) || side.unitPowerMultiplier <= 0)) {
    throw new Error('Battle unit power multiplier must be a finite positive number');
  }
  if (side.randomMoraleGain) {
    const { chancePercent, minGain, maxGain } = side.randomMoraleGain;
    if (!Number.isFinite(chancePercent) || chancePercent < 0 || chancePercent > 100) throw new Error('Random morale gain chance must be between 0 and 100');
    if (![minGain, maxGain].every(Number.isFinite) || minGain < 0 || maxGain < minGain) throw new Error('Random morale gain range is invalid');
  }
  if (getRosterTotal(side.roster) <= 0) throw new Error('Battle side must contain at least one unit');
  for (const unitTypeId of Object.keys(side.roster)) if (!unitDefinitions[unitTypeId]) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
  normalizeBattlePlan(side.plan);
}

function isFormation(value: unknown): value is BattleFormationId {
  return value === 'line' || value === 'strong_center' || value === 'crescent';
}

function isBattleCommand(value: unknown): value is BattleCommandId {
  return value === 'press_left' || value === 'press_center' || value === 'press_right' || value === 'general_assault' || value === 'hold_line' || value === 'none';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
