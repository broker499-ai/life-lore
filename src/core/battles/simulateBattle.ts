import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type {
  BattleCommandId,
  BattleFormationId,
  BattleInput,
  BattleLane,
  BattleLanePosture,
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
  posture: BattleLanePosture;
};

type MutableSide = {
  input: BattleSideInput;
  plan: BattlePlan;
  initialRoster: ArmyRoster;
  initialLaneRosters: Record<BattleLane, ArmyRoster>;
  roster: ArmyRoster;
  initialUnits: number;
  morale: number;
  sectors: Record<BattleLane, MutableSector>;
  reserveRoster: ArmyRoster;
  reserveCommitted: boolean;
  lateReserveRoster: ArmyRoster;
  initialLateReserveRoster: ArmyRoster;
  lateStrikeCommitted: boolean;
  organizedRetreat: boolean;
  encirclementAnnounced: boolean;
  forcedRestLanes: Set<BattleLane>;
  directiveResetRound: number;
  lateArrivalLane: BattleLane;
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

type FlankSetup = {
  weights: Record<BattleLane, number>;
  morale: Record<BattleLane, number>;
};

type LaneDirective =
  | { mode: 'attack'; source: BattleLane; target: BattleLane }
  | { mode: 'defend'; source: BattleLane }
  | { mode: 'cautious'; source: BattleLane }
  | null;

export function simulateBattle(
  input: BattleInput,
  rngState: RngState,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
): BattleResult {
  validateBattleInput(input, unitDefinitions, rules);

  let rng = rngState;
  const setupA = input.sideA.randomizeFlanks && !input.sideA.centerOnlyFormation
    ? createRandomFlankSetup(input.sideA, rng)
    : null;
  if (setupA) rng = setupA.rngState;
  const setupB = input.sideB.randomizeFlanks && !input.sideB.centerOnlyFormation
    ? createRandomFlankSetup(input.sideB, rng)
    : null;
  if (setupB) rng = setupB.rngState;
  const sideA = createMutableSide(input.sideA, setupA?.setup ?? null, unitDefinitions);
  const sideB = createMutableSide(input.sideB, setupB?.setup ?? null, unitDefinitions);
  forceEnemyRestFromSpecialUnits(sideA, sideB, unitDefinitions);
  forceEnemyRestFromSpecialUnits(sideB, sideA, unitDefinitions);
  const timeline: BattleTimelineEvent[] = [
    { at: 0, type: 'battle_start', battleId: input.battleId, scale: input.scale },
    { at: 0.2, type: 'formation_set', side: 'A', plan: clonePlan(sideA.plan), snapshot: snapshotSide(sideA) },
    { at: 0.2, type: 'formation_set', side: 'B', plan: clonePlan(sideB.plan), snapshot: snapshotSide(sideB) },
  ];
  const scaleRule = rules.scale[input.scale];
  let roundsFought = 0;

  let previousStage = 0;
  for (let round = 1; round <= scaleRule.maxRounds; round += 1) {
    if (isBroken(sideA, rules) || isBroken(sideB, rules)) break;

    roundsFought = round;
    const at = (round - 1) * scaleRule.timelineStepSeconds + 1;
    const stage = getBattleStage(round, scaleRule.maxRounds);
    const stageStarted = stage !== previousStage;
    if (stageStarted) {
      timeline.push({ at: Math.max(0.3, at - 0.34), type: 'stage_transition', round, stage });
      resetStagePostures(sideA, 'A', round, at, timeline);
      resetStagePostures(sideB, 'B', round, at, timeline);
      previousStage = stage;
    }
    timeline.push({ at, type: 'round_start', round });

    emitCommandIfAny(sideA, 'A', round, at, timeline);
    emitCommandIfAny(sideB, 'B', round, at, timeline);
    commitReserveIfDue(sideA, 'A', round, at, timeline);
    commitReserveIfDue(sideB, 'B', round, at, timeline);
    if (stageStarted && stage === 4) {
      commitLateFlankStrikeIfDue(sideA, 'A', sideB, 'B', round, at, timeline);
      commitLateFlankStrikeIfDue(sideB, 'B', sideA, 'A', round, at, timeline);
    }

    if (stageStarted) {
      const postureA = chooseReactiveLanePostures(sideA, 'A', round, at, timeline, rng);
      rng = postureA;
      const postureB = chooseReactiveLanePostures(sideB, 'B', round, at, timeline, rng);
      rng = postureB;
    }
    applyVictoriousLaneRest(sideA, sideB, round, 'A', at, timeline);
    applyVictoriousLaneRest(sideB, sideA, round, 'B', at, timeline);
    interruptRestByPressure(sideA, sideB, round, 'B', at, timeline);
    interruptRestByPressure(sideB, sideA, round, 'A', at, timeline);
    applyRestMoraleRecovery(sideA);
    applyRestMoraleRecovery(sideB);
    enforceSectorMoraleLocks(sideA, unitDefinitions);
    enforceSectorMoraleLocks(sideB, unitDefinitions);
    enforceMoraleLock(sideA);
    enforceMoraleLock(sideB);

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
    const basePowerA = getLanePowers(sideA, sideB, rollAResult.value, round, unitDefinitions, rules, Boolean(sideB.input.centerOnlyFormation));
    const basePowerB = getLanePowers(sideB, sideA, rollBResult.value, round, unitDefinitions, rules, Boolean(sideA.input.centerOnlyFormation));
    const powerA = applyFlankSupport(basePowerA, sideA, sideB, brokenBeforeB, Boolean(sideB.input.centerOnlyFormation), round);
    const powerB = applyFlankSupport(basePowerB, sideB, sideA, brokenBeforeA, Boolean(sideA.input.centerOnlyFormation), round);

    const lossesRosterA: ArmyRoster = {};
    const lossesRosterB: ArmyRoster = {};
    let totalLossesA = 0;
    let totalLossesB = 0;
    const laneLossCountsA: Record<BattleLane, number> = { left: 0, center: 0, right: 0 };
    const laneLossCountsB: Record<BattleLane, number> = { left: 0, center: 0, right: 0 };

    for (const lane of LANES) {
      const sectorA = sideA.sectors[lane];
      const sectorB = sideB.sectors[lane];
      const unitsBeforeA = getRosterTotal(sectorA.roster);
      const unitsBeforeB = getRosterTotal(sectorB.roster);
      if (unitsBeforeA <= 0 && unitsBeforeB <= 0) continue;

      const commandEffectA = getCommandEffect(sideA, sideB, round, lane, Boolean(sideB.input.centerOnlyFormation));
      const commandEffectB = getCommandEffect(sideB, sideA, round, lane, Boolean(sideA.input.centerOnlyFormation));
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

      let laneLossesA = distributeLosses(sectorA.roster, lossesToA, unitDefinitions);
      let laneLossesB = distributeLosses(sectorB.roster, lossesToB, unitDefinitions);
      const afterBaseA = subtractRoster(sectorA.roster, laneLossesA);
      const afterBaseB = subtractRoster(sectorB.roster, laneLossesB);
      const retaliationToB = getDeathRetaliationLosses(laneLossesA, unitDefinitions);
      const retaliationToA = getDeathRetaliationLosses(laneLossesB, unitDefinitions);
      const extraLossesA = distributeLosses(afterBaseA, Math.min(getRosterTotal(afterBaseA), retaliationToA), unitDefinitions);
      const extraLossesB = distributeLosses(afterBaseB, Math.min(getRosterTotal(afterBaseB), retaliationToB), unitDefinitions);
      laneLossesA = addRosters(laneLossesA, extraLossesA);
      laneLossesB = addRosters(laneLossesB, extraLossesB);
      const actualLossesA = getRosterTotal(laneLossesA);
      const actualLossesB = getRosterTotal(laneLossesB);
      sectorA.roster = subtractRoster(sectorA.roster, laneLossesA);
      sectorB.roster = subtractRoster(sectorB.roster, laneLossesB);
      mergeRoster(lossesRosterA, laneLossesA);
      mergeRoster(lossesRosterB, laneLossesB);
      totalLossesA += actualLossesA;
      totalLossesB += actualLossesB;
      laneLossCountsA[lane] = actualLossesA;
      laneLossCountsB[lane] = actualLossesB;

      sectorA.morale = applySectorMoraleLoss(
        sectorA.morale,
        laneLossCountsA[lane],
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
        laneLossCountsB[lane],
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

    enforceSectorMoraleLocks(sideA, unitDefinitions);
    enforceSectorMoraleLocks(sideB, unitDefinitions);

    timeline.push(
      { at: at + 2, type: 'casualties', round, side: 'A', losses: lossesRosterA, totalLosses: totalLossesA },
      { at: at + 2, type: 'casualties', round, side: 'B', losses: lossesRosterB, totalLosses: totalLossesB },
    );

    applyEncirclementPressure(sideA, brokenBeforeA);
    applyEncirclementPressure(sideB, brokenBeforeB);
    enforceSectorMoraleLocks(sideA, unitDefinitions);
    enforceSectorMoraleLocks(sideB, unitDefinitions);
    enforceMoraleLock(sideA);
    enforceMoraleLock(sideB);

    const moraleBeforeA = sideA.morale;
    const moraleBeforeB = sideB.morale;
    const panicA = applyRandomSectorBreaks(sideA, 'A', round, at, timeline, laneLossCountsA, rng);
    rng = panicA;
    const panicB = applyRandomSectorBreaks(sideB, 'B', round, at, timeline, laneLossCountsB, rng);
    rng = panicB;
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
    A: buildSideResult('A', sideA, winnerSide, rules, unitDefinitions),
    B: buildSideResult('B', sideB, winnerSide, rules, unitDefinitions),
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


export function getBattleStage(round: number, maxRounds: number): 1 | 2 | 3 | 4 {
  const safeRound = Math.max(1, Math.min(maxRounds, Math.round(round)));
  return Math.min(4, Math.floor(((safeRound - 1) * 4) / Math.max(1, maxRounds)) + 1) as 1 | 2 | 3 | 4;
}

function resetStagePostures(
  side: MutableSide,
  sideId: BattleSideId,
  round: number,
  at: number,
  timeline: BattleTimelineEvent[],
): void {
  side.directiveResetRound = round;
  for (const lane of LANES) {
    const sector = side.sectors[lane];
    if (sector.broken || getRosterTotal(sector.roster) <= 0) continue;
    const posture: BattleLanePosture = side.forcedRestLanes.has(lane) ? 'rest' : 'engage';
    sector.posture = posture;
    // The reset is a real stage-boundary state change, not only an internal bookkeeping step.
    // Emitting it lets BattleViewer visibly clear the previous stage's assault/defence markers.
    timeline.push({ at: Math.max(0.31, at - 0.28), type: 'lane_posture', round, side: sideId, lane, posture });
  }
}

function forceEnemyRestFromSpecialUnits(source: MutableSide, enemy: MutableSide, unitDefinitions: UnitDefinitions): void {
  let count = 0;
  for (const [unitTypeId, amount] of Object.entries(source.initialRoster)) {
    if (amount <= 0) continue;
    count = Math.max(count, unitDefinitions[unitTypeId]?.enemyForcedRestLanes ?? 0);
  }
  if (count <= 0) return;
  const candidates = (['left', 'right', 'center'] as BattleLane[]).filter(
    (lane) => !enemy.sectors[lane].broken && getRosterTotal(enemy.sectors[lane].roster) > 0,
  );
  for (const lane of candidates.slice(0, count)) {
    enemy.forcedRestLanes.add(lane);
    enemy.sectors[lane].posture = 'rest';
  }
}

function distributeExplicitLaneRosters(
  laneRosters: Partial<Record<BattleLane, ArmyRoster>>,
  activeRoster: ArmyRoster,
  morale: number,
): Record<BattleLane, MutableSector> {
  const remaining = cloneRoster(activeRoster);
  const result: Record<BattleLane, ArmyRoster> = { left: {}, center: {}, right: {} };
  for (const lane of LANES) {
    for (const [unitTypeId, requested] of Object.entries(laneRosters[lane] ?? {})) {
      const amount = Math.min(Math.max(0, requested ?? 0), remaining[unitTypeId] ?? 0);
      if (amount <= 0) continue;
      result[lane][unitTypeId] = amount;
      remaining[unitTypeId] = Math.max(0, (remaining[unitTypeId] ?? 0) - amount);
    }
  }
  // Compatibility fallback for roster entries missing from a malformed/legacy deployment.
  for (const [unitTypeId, amount] of Object.entries(remaining)) {
    if (amount <= 0) continue;
    const weakest = [...LANES].sort((a, b) => getRosterTotal(result[a]) - getRosterTotal(result[b]) || LANES.indexOf(a) - LANES.indexOf(b))[0];
    result[weakest][unitTypeId] = (result[weakest][unitTypeId] ?? 0) + amount;
  }
  return {
    left: { roster: cleanRoster(result.left), morale, broken: getRosterTotal(result.left) <= 0, posture: 'engage' },
    center: { roster: cleanRoster(result.center), morale, broken: getRosterTotal(result.center) <= 0, posture: 'engage' },
    right: { roster: cleanRoster(result.right), morale, broken: getRosterTotal(result.right) <= 0, posture: 'engage' },
  };
}

function createMutableSide(input: BattleSideInput, randomSetup: FlankSetup | null, unitDefinitions: UnitDefinitions): MutableSide {
  const plan = normalizeBattlePlan(input.plan);
  const initialRoster = cloneRoster(input.roster);
  const lateSplit = splitLateArrivalRoster(initialRoster);
  const split = input.laneRosters
    ? { active: lateSplit.active, reserve: {} as ArmyRoster }
    : splitReserve(lateSplit.active, plan.reservePercent);
  const startingMorale = input.moraleLockedAt ?? input.morale;
  const sectors = input.laneRosters
    ? distributeExplicitLaneRosters(input.laneRosters, lateSplit.active, startingMorale)
    : input.centerOnlyFormation
      ? distributeCenterOnlyRoster(split.active, startingMorale)
      : hasEntireLaneUnit(split.active, unitDefinitions)
        ? distributeRosterWithEntireLaneUnit(split.active, startingMorale, unitDefinitions)
        : randomSetup
          ? distributeActiveRosterWithWeights(split.active, randomSetup.weights, randomSetup.morale)
          : distributeActiveRoster(split.active, plan.formation, startingMorale);
  const lateArrivalLane = getLateArrivalLane(input);
  const deploymentLaneRosters = { left: cloneRoster(sectors.left.roster), center: cloneRoster(sectors.center.roster), right: cloneRoster(sectors.right.roster) };
  if (getRosterTotal(lateSplit.late) > 0) {
    deploymentLaneRosters[lateArrivalLane] = addRosters(deploymentLaneRosters[lateArrivalLane], lateSplit.late);
  }
  const side: MutableSide = {
    input,
    plan,
    initialRoster,
    initialLaneRosters: deploymentLaneRosters,
    roster: cloneRoster(initialRoster),
    initialUnits: getRosterTotal(initialRoster),
    morale: startingMorale,
    sectors,
    reserveRoster: split.reserve,
    reserveCommitted: plan.reservePercent === 0 || getRosterTotal(split.reserve) === 0,
    lateReserveRoster: lateSplit.late,
    initialLateReserveRoster: cloneRoster(lateSplit.late),
    lateStrikeCommitted: getRosterTotal(lateSplit.late) === 0,
    organizedRetreat: false,
    encirclementAnnounced: false,
    forcedRestLanes: new Set<BattleLane>(),
    directiveResetRound: 1,
    lateArrivalLane,
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
  const commands = (plan?.commands ?? []).filter(isBattleCommand);
  const commandRounds = (plan?.commandRounds ?? [])
    .filter((value) => Number.isInteger(value) && value >= 1)
    .slice(0, commands.length);
  const threshold = plan?.retreatMoraleThreshold;
  const retreatMoraleThreshold = threshold === null || threshold === undefined
    ? null
    : clamp(Math.round(threshold), 10, 60);
  return { formation, reservePercent, reserveTarget, commands, commandRounds, retreatMoraleThreshold };
}

function getLateArrivalLane(input: BattleSideInput): BattleLane {
  if (!input.laneRosters) return 'center';
  return LANES.find((lane) => (input.laneRosters?.[lane]?.xiang ?? 0) > 0) ?? 'center';
}

function splitLateArrivalRoster(roster: ArmyRoster): { active: ArmyRoster; late: ArmyRoster } {
  const active: ArmyRoster = {};
  const late: ArmyRoster = {};
  for (const [unitTypeId, amount] of Object.entries(roster)) {
    if (amount <= 0) continue;
    if (unitTypeId === 'xiang') late[unitTypeId] = amount;
    else active[unitTypeId] = amount;
  }
  return { active: cleanRoster(active), late: cleanRoster(late) };
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
    left: { roster: cleanRoster(result.left), morale, broken: false, posture: 'engage' },
    center: { roster: cleanRoster(result.center), morale, broken: false, posture: 'engage' },
    right: { roster: cleanRoster(result.right), morale, broken: false, posture: 'engage' },
  };
}

function distributeCenterOnlyRoster(roster: ArmyRoster, morale: number): Record<BattleLane, MutableSector> {
  return {
    left: { roster: {}, morale, broken: true, posture: 'engage' },
    center: { roster: cloneRoster(roster), morale, broken: false, posture: 'engage' },
    right: { roster: {}, morale, broken: true, posture: 'engage' },
  };
}


function hasEntireLaneUnit(roster: ArmyRoster, unitDefinitions: UnitDefinitions): boolean {
  return Object.entries(roster).some(([unitTypeId, amount]) => amount > 0 && unitDefinitions[unitTypeId]?.replacesEntireLane);
}

function distributeRosterWithEntireLaneUnit(
  roster: ArmyRoster,
  morale: number,
  unitDefinitions: UnitDefinitions,
): Record<BattleLane, MutableSector> {
  const exclusiveEntry = Object.entries(roster).find(([unitTypeId, amount]) => amount > 0 && unitDefinitions[unitTypeId]?.replacesEntireLane);
  if (!exclusiveEntry) return distributeActiveRoster(roster, 'line', morale);
  const [exclusiveTypeId, exclusiveAmount] = exclusiveEntry;
  const remaining = cloneRoster(roster);
  delete remaining[exclusiveTypeId];
  const left: ArmyRoster = {};
  const right: ArmyRoster = {};
  for (const [unitTypeId, amount] of Object.entries(remaining)) {
    if (amount <= 0) continue;
    const allocation = allocateInteger(amount, [0.5, 0.5]);
    left[unitTypeId] = allocation[0] ?? 0;
    right[unitTypeId] = allocation[1] ?? 0;
  }
  const lockedMorale = unitDefinitions[exclusiveTypeId]?.laneMoraleLockedAt ?? morale;
  return {
    left: { roster: cleanRoster(left), morale, broken: getRosterTotal(cleanRoster(left)) <= 0, posture: 'engage' },
    center: { roster: { [exclusiveTypeId]: exclusiveAmount }, morale: lockedMorale, broken: false, posture: 'engage' },
    right: { roster: cleanRoster(right), morale, broken: getRosterTotal(cleanRoster(right)) <= 0, posture: 'engage' },
  };
}

function distributeActiveRosterWithWeights(
  roster: ArmyRoster,
  weights: Record<BattleLane, number>,
  moraleByLane: Record<BattleLane, number>,
): Record<BattleLane, MutableSector> {
  const result: Record<BattleLane, ArmyRoster> = { left: {}, center: {}, right: {} };
  for (const [unitTypeId, amount] of Object.entries(roster)) {
    const allocation = allocateInteger(amount, [weights.left, weights.center, weights.right]);
    result.left[unitTypeId] = allocation[0] ?? 0;
    result.center[unitTypeId] = allocation[1] ?? 0;
    result.right[unitTypeId] = allocation[2] ?? 0;
  }
  return {
    left: { roster: cleanRoster(result.left), morale: moraleByLane.left, broken: false, posture: 'engage' },
    center: { roster: cleanRoster(result.center), morale: moraleByLane.center, broken: false, posture: 'engage' },
    right: { roster: cleanRoster(result.right), morale: moraleByLane.right, broken: false, posture: 'engage' },
  };
}

function createRandomFlankSetup(
  input: BattleSideInput,
  initialRng: RngState,
): { setup: FlankSetup; rngState: RngState } {
  let rng = initialRng;
  const leftRoll = randomInt(rng, 20, 35);
  rng = leftRoll.state;
  const rightRoll = randomInt(rng, 20, 35);
  rng = rightRoll.state;
  const left = leftRoll.value / 100;
  const right = rightRoll.value / 100;
  const center = Math.max(0.3, 1 - left - right);
  const total = left + center + right;
  const weights = { left: left / total, center: center / total, right: right / total };

  const locked = input.moraleLockedAt;
  if (locked !== undefined) {
    return { setup: { weights, morale: { left: locked, center: locked, right: locked } }, rngState: rng };
  }

  const leftMoraleRoll = randomInt(rng, -10, 10);
  rng = leftMoraleRoll.state;
  const centerMoraleRoll = randomInt(rng, -10, 10);
  rng = centerMoraleRoll.state;
  const rightMoraleRoll = randomInt(rng, -10, 10);
  rng = rightMoraleRoll.state;
  const raw = {
    left: input.morale + leftMoraleRoll.value,
    center: input.morale + centerMoraleRoll.value,
    right: input.morale + rightMoraleRoll.value,
  };
  const weightedAverage = raw.left * weights.left + raw.center * weights.center + raw.right * weights.right;
  const correction = input.morale - weightedAverage;
  const morale = {
    left: clamp(Math.round(raw.left + correction), 0, 100),
    center: clamp(Math.round(raw.center + correction), 0, 100),
    right: clamp(Math.round(raw.right + correction), 0, 100),
  };
  return { setup: { weights, morale }, rngState: rng };
}


function chooseReactiveLanePostures(
  side: MutableSide,
  sideId: BattleSideId,
  round: number,
  at: number,
  timeline: BattleTimelineEvent[],
  initialRng: RngState,
): RngState {
  let rng = initialRng;
  if (!side.input.reactiveLanePostures) {
    for (const lane of LANES) {
      const sector = side.sectors[lane];
      if (!sector.broken && getRosterTotal(sector.roster) > 0 && sector.posture !== 'rest') sector.posture = 'engage';
    }
    return rng;
  }

  for (const lane of LANES) {
    const sector = side.sectors[lane];
    if (sector.broken || getRosterTotal(sector.roster) <= 0) continue;
    if (side.input.centerOnlyFormation && lane !== 'center') continue;
    if (side.forcedRestLanes.has(lane)) {
      sector.posture = 'rest';
      timeline.push({ at: at + 0.08, type: 'lane_posture', round, side: sideId, lane, posture: 'rest' });
      continue;
    }
    const roll = randomInt(rng, 1, 100);
    rng = roll.state;
    const posture: BattleLanePosture = roll.value <= 34
      ? 'assault'
      : roll.value <= 58
        ? 'rest'
        : 'cautious';
    sector.posture = posture;
    timeline.push({ at: at + 0.08, type: 'lane_posture', round, side: sideId, lane, posture });
  }
  return rng;
}

function interruptRestByPressure(
  attacker: MutableSide,
  defender: MutableSide,
  round: number,
  defenderSideId: BattleSideId,
  at: number,
  timeline: BattleTimelineEvent[],
): void {
  for (const source of LANES) {
    const directive = getLatestLaneDirective(attacker.plan, round, source, attacker.directiveResetRound);
    if (!directive || directive.mode !== 'attack') continue;
    const target = defender.input.centerOnlyFormation ? 'center' : directive.target;
    const sector = defender.sectors[target];
    if (sector.broken || getRosterTotal(sector.roster) <= 0 || sector.posture !== 'rest' || defender.forcedRestLanes.has(target)) continue;
    sector.posture = 'rest_broken';
    timeline.push({ at: at + 0.16, type: 'lane_posture', round, side: defenderSideId, lane: target, posture: 'rest_broken' });
  }
}

function enforceSectorMoraleLocks(side: MutableSide, unitDefinitions: UnitDefinitions): void {
  for (const lane of LANES) {
    const sector = side.sectors[lane];
    let lockedAt: number | null = null;
    for (const [unitTypeId, amount] of Object.entries(sector.roster)) {
      if (amount <= 0) continue;
      const lock = unitDefinitions[unitTypeId]?.laneMoraleLockedAt;
      if (lock === undefined) continue;
      lockedAt = lockedAt === null ? lock : Math.max(lockedAt, lock);
    }
    if (lockedAt !== null) sector.morale = clamp(lockedAt, 0, 100);
  }
}

function applyVictoriousLaneRest(
  side: MutableSide,
  enemy: MutableSide,
  round: number,
  sideId: BattleSideId,
  at: number,
  timeline: BattleTimelineEvent[],
): void {
  if (!side.input.autoRestVictoriousLanes || side.input.reactiveLanePostures) return;
  for (const lane of LANES) {
    const sector = side.sectors[lane];
    if (sector.broken || getRosterTotal(sector.roster) <= 0) continue;
    const enemySector = enemy.sectors[lane];
    if (!enemySector.broken && getRosterTotal(enemySector.roster) > 0) continue;
    const directive = getLatestLaneDirective(side.plan, round, lane, side.directiveResetRound);
    const redirectedToLivingEnemy = directive?.mode === 'attack'
      && directive.target !== lane
      && !enemy.sectors[directive.target].broken
      && getRosterTotal(enemy.sectors[directive.target].roster) > 0;
    if (redirectedToLivingEnemy) {
      sector.posture = 'engage';
      continue;
    }
    if (sector.posture !== 'rest') {
      sector.posture = 'rest';
      timeline.push({ at: at + 0.12, type: 'lane_posture', round, side: sideId, lane, posture: 'rest' });
    }
  }
}

function applyRestMoraleRecovery(side: MutableSide): void {
  if (side.input.moraleLockedAt !== undefined) return;
  for (const lane of LANES) {
    const sector = side.sectors[lane];
    if (sector.broken || getRosterTotal(sector.roster) <= 0 || sector.posture !== 'rest') continue;
    sector.morale = clamp(sector.morale + 5, 0, 100);
  }
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
  const commands = getCommandSchedule(side.plan).filter((entry) => entry.round === round);
  commands.forEach((entry, index) => {
    timeline.push({ at: at + 0.18 + index * 0.012, type: 'command_order', round, side: sideId, command: entry.command });
  });
}

function getCommandSchedule(plan: BattlePlan): Array<{ round: number; command: BattleCommandId }> {
  return plan.commands.map((command, index) => ({
    command,
    round: Math.max(1, Math.round(plan.commandRounds?.[index] ?? COMMAND_ROUNDS[index] ?? (index + 1) * 2)),
  }));
}

function commandToDirective(command: BattleCommandId, lane: BattleLane): LaneDirective | 'irrelevant' | 'clear' {
  if (command === 'none') return 'clear';
  if (command === 'clear_left') return lane === 'left' ? { mode: 'cautious', source: 'left' } : 'irrelevant';
  if (command === 'clear_center') return lane === 'center' ? { mode: 'cautious', source: 'center' } : 'irrelevant';
  if (command === 'clear_right') return lane === 'right' ? { mode: 'cautious', source: 'right' } : 'irrelevant';
  if (command === 'hold_line') return { mode: 'defend', source: lane };
  if (command === 'general_assault') return { mode: 'attack', source: lane, target: lane };
  if (command === 'defend_left') return lane === 'left' ? { mode: 'defend', source: 'left' } : 'irrelevant';
  if (command === 'defend_center') return lane === 'center' ? { mode: 'defend', source: 'center' } : 'irrelevant';
  if (command === 'defend_right') return lane === 'right' ? { mode: 'defend', source: 'right' } : 'irrelevant';
  if (command === 'press_left') return lane === 'left' ? { mode: 'attack', source: 'left', target: 'left' } : 'irrelevant';
  if (command === 'press_center') return lane === 'center' ? { mode: 'attack', source: 'center', target: 'center' } : 'irrelevant';
  if (command === 'press_right') return lane === 'right' ? { mode: 'attack', source: 'right', target: 'right' } : 'irrelevant';
  if (command === 'flank_left_to_left') return lane === 'left' ? { mode: 'attack', source: 'left', target: 'left' } : 'irrelevant';
  if (command === 'flank_left_to_center') return lane === 'left' ? { mode: 'attack', source: 'left', target: 'center' } : 'irrelevant';
  if (command === 'flank_center_to_left') return lane === 'center' ? { mode: 'attack', source: 'center', target: 'left' } : 'irrelevant';
  if (command === 'flank_center_to_center') return lane === 'center' ? { mode: 'attack', source: 'center', target: 'center' } : 'irrelevant';
  if (command === 'flank_center_to_right') return lane === 'center' ? { mode: 'attack', source: 'center', target: 'right' } : 'irrelevant';
  if (command === 'flank_right_to_center') return lane === 'right' ? { mode: 'attack', source: 'right', target: 'center' } : 'irrelevant';
  if (command === 'flank_right_to_right') return lane === 'right' ? { mode: 'attack', source: 'right', target: 'right' } : 'irrelevant';
  return 'irrelevant';
}

function getLatestLaneDirective(plan: BattlePlan, round: number, lane: BattleLane, resetRound = 1): LaneDirective {
  const schedule = getCommandSchedule(plan).filter((entry) => entry.round >= resetRound && entry.round <= round);
  for (let index = schedule.length - 1; index >= 0; index -= 1) {
    const parsed = commandToDirective(schedule[index].command, lane);
    if (parsed === 'clear') return null;
    if (parsed !== 'irrelevant') return parsed;
  }
  return null;
}

function getLanePowers(
  side: MutableSide,
  enemy: MutableSide,
  roll: number,
  round: number,
  unitDefinitions: UnitDefinitions,
  rules: BattleRules,
  enemyCenterOnly: boolean,
): Record<BattleLane, RoundPower> {
  return Object.fromEntries(
    LANES.map((lane) => [lane, getLanePower(side, enemy, lane, roll, round, unitDefinitions, rules, enemyCenterOnly)]),
  ) as Record<BattleLane, RoundPower>;
}

function getLanePower(
  side: MutableSide,
  enemy: MutableSide,
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
  const command = getCommandEffect(side, enemy, round, lane, enemyCenterOnly);
  let rawAttack = 0;
  let rawDefense = 0;

  for (const [unitTypeId, amount] of Object.entries(sector.roster)) {
    if (amount <= 0) continue;
    const unit = unitDefinitions[unitTypeId];
    if (!unit) throw new Error(`Missing UnitDefinition for ${unitTypeId}`);
    const roleAttackMultiplier = tactic.roleAttackMultipliers?.[unit.role] ?? 1;
    // Randomized enemy deployment should redistribute the same total strength,
    // not accidentally gain power simply because more line troops rolled center.
    const positionAttackMultiplier = side.input.randomizeFlanks
      ? 1
      : unit.role === 'ranged' && lane !== 'center'
        ? 1.12
        : unit.role === 'line' && lane === 'center'
          ? 1.08
          : 1;
    const positionDefenseMultiplier = side.input.randomizeFlanks
      ? 1
      : unit.role === 'line' && lane === 'center'
        ? 1.06
        : 1;
    const typePowerMultiplier = side.input.unitTypePowerMultipliers?.[unitTypeId] ?? 1;
    rawAttack += amount * unit.attack * roleAttackMultiplier * positionAttackMultiplier * typePowerMultiplier;
    rawDefense += amount * unit.defense * positionDefenseMultiplier * typePowerMultiplier;
  }

  const moraleMultiplier = 0.65 + sector.morale * 0.0035;
  const laneRollOffset = lane === 'left' ? -0.5 : lane === 'right' ? 0.5 : 0;
  const rollMultiplier = 0.82 + clamp(roll + laneRollOffset, 1, 20) * 0.018;
  const unitPowerMultiplier = side.input.unitPowerMultiplier ?? 1;
  const flankTacticMultiplier = side.input.tactic === 'flank'
    ? lane === 'center' ? 0.94 : 1.12
    : 1;
  const encircledDefenseMultiplier = lane === 'center' && isEncircled(side) ? 0.82 : 1;
  const posture = getPosturePowerMultipliers(sector.posture);

  return {
    attack: rawAttack * tactic.attackMultiplier * moraleMultiplier * rollMultiplier * unitPowerMultiplier * flankTacticMultiplier * command.attackMultiplier * posture.attack,
    defense: rawDefense * tactic.defenseMultiplier * moraleMultiplier * unitPowerMultiplier * encircledDefenseMultiplier * command.defenseMultiplier * posture.defense,
  };
}

function getPosturePowerMultipliers(posture: BattleLanePosture): { attack: number; defense: number } {
  if (posture === 'assault') return { attack: 1.2, defense: 0.9 };
  if (posture === 'rest') return { attack: 0.42, defense: 0.72 };
  if (posture === 'rest_broken') return { attack: 0.92, defense: 0.82 };
  if (posture === 'cautious') return { attack: 0.84, defense: 1.16 };
  return { attack: 1, defense: 1 };
}

function applyFlankSupport(
  own: Record<BattleLane, RoundPower>,
  side: MutableSide,
  enemy: MutableSide,
  enemyBroken: Set<BattleLane>,
  enemyCenterOnly: boolean,
  round: number,
): Record<BattleLane, RoundPower> {
  const next = {
    left: { ...own.left },
    center: { ...own.center },
    right: { ...own.right },
  };

  if (enemyCenterOnly) {
    next.center.attack += own.left.attack * 0.55 + own.right.attack * 0.55;
  } else {
    if (enemyBroken.has('left')) next.center.attack += own.left.attack * 0.25;
    if (enemyBroken.has('right')) next.center.attack += own.right.attack * 0.25;
    if (enemyBroken.has('left') && enemyBroken.has('right')) next.center.attack *= 1.12;
  }

  for (const source of LANES) {
    const directive = getLatestLaneDirective(side.plan, round, source);
    if (!directive || directive.mode !== 'attack') continue;
    const target = enemyCenterOnly ? 'center' : directive.target;
    if (target === source) {
      next[source].attack *= getAttackOpportunityMultiplier(enemy.sectors[target]);
      continue;
    }
    const sourcePower = next[source];
    const redirectedAttack = sourcePower.attack * 0.7;
    sourcePower.attack *= 0.3;
    sourcePower.defense *= 0.86;
    next[target].attack += redirectedAttack * 1.15 * getAttackOpportunityMultiplier(enemy.sectors[target]);
  }

  return next;
}

function getAttackOpportunityMultiplier(enemySector: MutableSector): number {
  let multiplier = 1;
  if (enemySector.posture === 'rest') multiplier *= 1.34;
  if (enemySector.posture === 'rest_broken') multiplier *= 1.2;
  if (enemySector.morale < 40) multiplier *= 1.18;
  return Math.min(1.42, multiplier);
}

function getCommandEffect(
  side: MutableSide,
  enemy: MutableSide,
  round: number,
  lane: BattleLane,
  enemyCenterOnly = false,
): CommandEffect {
  const neutral: CommandEffect = { attackMultiplier: 1, defenseMultiplier: 1, casualtyTakenMultiplier: 1, moraleLossMultiplier: 1 };
  const directive = getLatestLaneDirective(side.plan, round, lane, side.directiveResetRound);
  if (!directive) return neutral;

  if (directive.mode === 'cautious') {
    return { attackMultiplier: 0.88, defenseMultiplier: 1.16, casualtyTakenMultiplier: 0.82, moraleLossMultiplier: 0.84 };
  }

  if (directive.mode === 'defend') {
    const enemyLane = enemyCenterOnly ? 'center' : lane;
    const countersAssault = enemy.sectors[enemyLane].posture === 'assault';
    return countersAssault
      ? { attackMultiplier: 0.76, defenseMultiplier: 1.48, casualtyTakenMultiplier: 0.66, moraleLossMultiplier: 0.6 }
      : { attackMultiplier: 0.8, defenseMultiplier: 1.3, casualtyTakenMultiplier: 0.8, moraleLossMultiplier: 0.7 };
  }

  if (enemyCenterOnly && directive.target === 'center' && directive.source === 'center') {
    return { attackMultiplier: 0.84, defenseMultiplier: 0.9, casualtyTakenMultiplier: 1.14, moraleLossMultiplier: 1.07 };
  }
  if (enemyCenterOnly && directive.source !== 'center') {
    return { attackMultiplier: 1.2, defenseMultiplier: 0.96, casualtyTakenMultiplier: 1.02, moraleLossMultiplier: 1.01 };
  }
  return { attackMultiplier: 1.1, defenseMultiplier: 0.9, casualtyTakenMultiplier: 1.06, moraleLossMultiplier: 1.03 };
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
      timeline.push({ at: at + 3.1, type: 'sector_break', round, side: sideId, lane, cause: getRosterTotal(sector.roster) <= 0 ? 'destroyed' : 'morale' });
    }
  }
}

function applyRandomSectorBreaks(
  side: MutableSide,
  sideId: BattleSideId,
  round: number,
  at: number,
  timeline: BattleTimelineEvent[],
  laneLosses: Record<BattleLane, number>,
  initialRng: RngState,
): RngState {
  let rng = initialRng;
  for (const lane of LANES) {
    const sector = side.sectors[lane];
    const units = getRosterTotal(sector.roster);
    if (sector.broken || units <= 0) continue;
    if (side.input.centerOnlyFormation && lane !== 'center') continue;
    const losses = laneLosses[lane] ?? 0;
    const lossRatio = losses / Math.max(1, units + losses);
    const moralePressure = Math.max(0, 68 - sector.morale);
    const chance = clamp(Math.round(moralePressure * 0.28 + lossRatio * 34 - (lane === 'center' ? 2 : 0)), 0, 34);
    if (chance < 4) continue;
    const roll = randomInt(rng, 1, 100);
    rng = roll.state;
    if (roll.value <= chance) {
      sector.broken = true;
      sector.morale = Math.min(sector.morale, 18);
      timeline.push({ at: at + 3.02, type: 'sector_break', round, side: sideId, lane, cause: 'panic_roll', roll: roll.value, chance });
    }
  }
  return rng;
}

function getDeathRetaliationLosses(losses: ArmyRoster, unitDefinitions: UnitDefinitions): number {
  let retaliation = 0;
  for (const [unitTypeId, amount] of Object.entries(losses)) {
    const factor = unitDefinitions[unitTypeId]?.deathRetaliationFactor ?? 0;
    retaliation += amount * factor;
  }
  return Math.max(0, Math.round(retaliation));
}

function commitLateFlankStrikeIfDue(
  side: MutableSide,
  sideId: BattleSideId,
  enemy: MutableSide,
  enemySideId: BattleSideId,
  round: number,
  at: number,
  timeline: BattleTimelineEvent[],
): void {
  if (side.lateStrikeCommitted || getRosterTotal(side.lateReserveRoster) <= 0) return;
  const unitTypeId = Object.keys(side.lateReserveRoster).find((id) => id === 'xiang');
  if (!unitTypeId) return;
  const aliveFlanks = (['left', 'right'] as BattleLane[]).filter((lane) => !enemy.sectors[lane].broken);
  const candidateLanes = aliveFlanks.length > 0 ? aliveFlanks : (['center'] as BattleLane[]).filter((lane) => !enemy.sectors[lane].broken);
  const targetLane = candidateLanes
    .sort((a, b) => getRosterTotal(enemy.sectors[b].roster) - getRosterTotal(enemy.sectors[a].roster))[0];
  if (!targetLane) return;
  const target = enemy.sectors[targetLane];
  const destroyedRoster = cloneRoster(target.roster);
  const destroyedUnits = getRosterTotal(destroyedRoster);
  target.roster = {};
  target.broken = true;
  target.morale = 0;
  const arrivalLane = side.lateArrivalLane;
  side.sectors[arrivalLane].roster = addRosters(side.sectors[arrivalLane].roster, side.lateReserveRoster);
  side.sectors[arrivalLane].broken = false;
  side.lateReserveRoster = {};
  side.lateStrikeCommitted = true;
  timeline.push(
    { at: at + 0.42, type: 'late_flank_strike', round, side: sideId, targetSide: enemySideId, lane: targetLane, unitTypeId, destroyedUnits },
    { at: at + 0.43, type: 'casualties', round, side: enemySideId, losses: destroyedRoster, totalLosses: destroyedUnits },
    { at: at + 0.44, type: 'sector_break', round, side: enemySideId, lane: targetLane, cause: 'special' },
    { at: at + 0.45, type: 'sector_status', round, side: sideId, snapshot: snapshotSide(side) },
    { at: at + 0.45, type: 'sector_status', round, side: enemySideId, snapshot: snapshotSide(enemy) },
  );
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
  unitDefinitions: UnitDefinitions,
): BattleSideResult {
  let remainingRoster = aggregateSideRoster(side);
  const preRecoveryLosses = diffRoster(side.initialRoster, remainingRoster);
  const recoveryFraction = getPostBattleRecoveryFraction(remainingRoster, unitDefinitions);
  if (recoveryFraction > 0) remainingRoster = restoreCasualties(remainingRoster, preRecoveryLosses, recoveryFraction, unitDefinitions);
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
    initialLaneRosters: {
      left: cloneRoster(side.initialLaneRosters.left),
      center: cloneRoster(side.initialLaneRosters.center),
      right: cloneRoster(side.initialLaneRosters.right),
    },
    lateArrivalRoster: getRosterTotal(side.initialLateReserveRoster) > 0 ? cloneRoster(side.initialLateReserveRoster) : undefined,
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

function getPostBattleRecoveryFraction(roster: ArmyRoster, unitDefinitions: UnitDefinitions): number {
  let fraction = 0;
  for (const [unitTypeId, amount] of Object.entries(roster)) {
    if (amount <= 0) continue;
    fraction = Math.max(fraction, unitDefinitions[unitTypeId]?.casualtyRecoveryFraction ?? 0);
  }
  return clamp(fraction, 0, 0.9);
}

function restoreCasualties(
  remaining: ArmyRoster,
  losses: ArmyRoster,
  fraction: number,
  unitDefinitions: UnitDefinitions,
): ArmyRoster {
  const next = { ...remaining };
  for (const [unitTypeId, lost] of Object.entries(losses)) {
    if (lost <= 0 || unitDefinitions[unitTypeId]?.singularFormation) continue;
    const restored = Math.round(lost * fraction);
    if (restored > 0) next[unitTypeId] = (next[unitTypeId] ?? 0) + restored;
  }
  return cleanRoster(next);
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
  return { units: getRosterTotal(sector.roster), morale: Math.round(sector.morale), broken: sector.broken, posture: sector.posture };
}

function getBrokenLanes(side: MutableSide): Set<BattleLane> {
  return new Set(LANES.filter((lane) => side.sectors[lane].broken));
}

function isEncircled(side: MutableSide): boolean {
  if (side.input.centerOnlyFormation) return false;
  return side.sectors.left.broken && side.sectors.right.broken;
}

function aggregateSideRoster(side: MutableSide): ArmyRoster {
  let result: ArmyRoster = addRosters(side.reserveRoster, side.lateReserveRoster);
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
  return { ...plan, commands: [...plan.commands], commandRounds: [...(plan.commandRounds ?? [])] };
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
  return value === 'press_left' || value === 'press_center' || value === 'press_right' || value === 'general_assault' || value === 'hold_line' || value === 'flank_left_to_left' || value === 'flank_left_to_center' || value === 'flank_center_to_left' || value === 'flank_center_to_center' || value === 'flank_center_to_right' || value === 'flank_right_to_center' || value === 'flank_right_to_right' || value === 'defend_left' || value === 'defend_center' || value === 'defend_right' || value === 'clear_left' || value === 'clear_center' || value === 'clear_right' || value === 'none';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
