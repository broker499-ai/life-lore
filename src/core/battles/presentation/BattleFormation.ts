import type { UnitDefinitions, UnitRole } from '@/core/armies/UnitDefinition';
import type { BattleSideId, BattleTacticId } from '@/core/battles/BattleTypes';
import type {
  BattlePresentationPhase,
  BattlePresentationSide,
} from '@/core/battles/presentation/BattlePresentation';
import type { ArmyRoster, UnitTypeId } from '@/core/state/GameState';

export type BattleLane = 'left' | 'center' | 'right';

export type BattleFormationDot = {
  id: string;
  unitTypeId: UnitTypeId;
  role: UnitRole;
  lane: BattleLane;
  x: number;
  y: number;
  r: number;
  opacity: number;
};

export type BattleFormationInput = {
  side: BattleSideId;
  from: BattlePresentationSide;
  to: BattlePresentationSide;
  fromPhase: BattlePresentationPhase;
  toPhase: BattlePresentationPhase;
  tactic: BattleTacticId;
  winnerSide: BattleSideId | null;
  overallPressureFrom: number;
  overallPressureTo: number;
  progress: number;
  battleTime: number;
  unitDefinitions: UnitDefinitions;
  maxDots?: number;
};

type FormationTemplateDot = {
  id: string;
  unitTypeId: UnitTypeId;
  role: UnitRole;
  lane: BattleLane;
  roleLaneIndex: number;
  roleLaneCount: number;
  unitDotIndex: number;
  unitDotCount: number;
  initialUnitCount: number;
};

const LANE_Y: Record<BattleLane, number> = {
  left: 24,
  center: 50,
  right: 76,
};

const LINE_LANE_PATTERN: BattleLane[] = ['center', 'left', 'right', 'center', 'left', 'right'];
const RANGED_LANE_PATTERN: BattleLane[] = ['left', 'right', 'center', 'left', 'right', 'center'];

export function getBattleFormationDots(input: BattleFormationInput): BattleFormationDot[] {
  const initialRoster = input.from.initialRoster;
  const template = buildFormationTemplate(
    initialRoster,
    input.unitDefinitions,
    input.maxDots ?? 18,
  );
  const pressure = lerp(input.overallPressureFrom, input.overallPressureTo, input.progress);
  const brokenWeight = lerp(input.from.broken ? 1 : 0, input.to.broken ? 1 : 0, input.progress);
  const forward = input.side === 'A' ? 1 : -1;

  return template.map((dot, index) => {
    const fromWeight = getUnitActivityWeight(dot, input.from.roster);
    const toWeight = getUnitActivityWeight(dot, input.to.roster);
    const activeWeight = lerp(fromWeight, toWeight, input.progress);
    const lanePush = getTacticLanePush(input.tactic, dot.lane, dot.role);
    const centerFrom =
      getFormationCenterX(input.side, input.fromPhase, input.from.broken, input.winnerSide) +
      input.overallPressureFrom +
      lanePush;
    const centerTo =
      getFormationCenterX(input.side, input.toPhase, input.to.broken, input.winnerSide) +
      input.overallPressureTo +
      lanePush;
    const centerX = lerp(centerFrom, centerTo, input.progress);
    const roleDepth = getRoleDepth(dot.role, input.tactic) * forward;
    const laneSpread = (dot.roleLaneIndex - (dot.roleLaneCount - 1) / 2) * 3.6;
    const staggerX = ((dot.roleLaneIndex % 2) - 0.5) * 1.5 * forward;
    const organicX = continuousJitter(index, input.battleTime, 0.28 * activeWeight, 0.83);
    const organicY = continuousJitter(index + 23, input.battleTime, 0.36 * activeWeight, 1.07);
    const collapseBack = (1 - activeWeight) * 2.4 * -forward;
    const brokenScatterX = brokenWeight * ((index % 3) - 1) * 1.25;
    const brokenScatterY = brokenWeight * (((index * 7) % 5) - 2) * 1.1;

    return {
      id: dot.id,
      unitTypeId: dot.unitTypeId,
      role: dot.role,
      lane: dot.lane,
      x:
        centerX +
        roleDepth +
        staggerX +
        organicX +
        collapseBack +
        brokenScatterX +
        pressure * 0.05,
      y: LANE_Y[dot.lane] + laneSpread + organicY + brokenScatterY,
      r: lerp(0.45, dot.role === 'ranged' ? 1.55 : 1.85 - brokenWeight * 0.25, activeWeight),
      opacity: lerp(0.035, dot.role === 'ranged' ? 0.9 : 1, activeWeight),
    };
  });
}

export function getLanePressureShift(
  lane: BattleLane,
  overallPressure: number,
  tacticA: BattleTacticId,
  tacticB: BattleTacticId,
): number {
  const attackerBias = getTacticLanePush(tacticA, lane, 'line');
  const defenderBias = getTacticLanePush(tacticB, lane, 'line');
  return clamp(overallPressure + (attackerBias - defenderBias) * 0.45, -6.5, 6.5);
}

function buildFormationTemplate(
  initialRoster: ArmyRoster,
  unitDefinitions: UnitDefinitions,
  maxDots: number,
): FormationTemplateDot[] {
  const entries = Object.entries(initialRoster)
    .map(([unitTypeId, count]) => ({
      unitTypeId: unitTypeId as UnitTypeId,
      count: Math.max(0, count ?? 0),
      role: unitDefinitions[unitTypeId as UnitTypeId]?.role ?? 'line',
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => a.unitTypeId.localeCompare(b.unitTypeId));

  const totalUnits = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (totalUnits <= 0 || entries.length === 0) return [];

  const totalDots = Math.max(1, Math.min(maxDots, totalUnits));
  const selectedTypes: Array<{ unitTypeId: UnitTypeId; role: UnitRole }> = [];
  let cumulative = 0;
  let entryIndex = 0;

  for (let dotIndex = 0; dotIndex < totalDots; dotIndex += 1) {
    const target = ((dotIndex + 0.5) * totalUnits) / totalDots;
    while (entryIndex < entries.length - 1 && target > cumulative + (entries[entryIndex]?.count ?? 0)) {
      cumulative += entries[entryIndex]?.count ?? 0;
      entryIndex += 1;
    }
    const entry = entries[entryIndex] ?? entries[entries.length - 1];
    if (entry) selectedTypes.push({ unitTypeId: entry.unitTypeId, role: entry.role });
  }

  const unitDotCounts = new Map<UnitTypeId, number>();
  for (const item of selectedTypes) {
    unitDotCounts.set(item.unitTypeId, (unitDotCounts.get(item.unitTypeId) ?? 0) + 1);
  }

  const unitSeen = new Map<UnitTypeId, number>();
  const roleSeen: Record<UnitRole, number> = { line: 0, ranged: 0 };
  const raw = selectedTypes.map((item, index) => {
    const unitDotIndex = unitSeen.get(item.unitTypeId) ?? 0;
    unitSeen.set(item.unitTypeId, unitDotIndex + 1);
    const roleIndex = roleSeen[item.role]++;
    const lanePattern = item.role === 'ranged' ? RANGED_LANE_PATTERN : LINE_LANE_PATTERN;
    const lane = lanePattern[roleIndex % lanePattern.length] ?? 'center';
    return {
      id: `${item.unitTypeId}:${unitDotIndex}`,
      unitTypeId: item.unitTypeId,
      role: item.role,
      lane,
      unitDotIndex,
      unitDotCount: unitDotCounts.get(item.unitTypeId) ?? 1,
      initialUnitCount: entries.find((entry) => entry.unitTypeId === item.unitTypeId)?.count ?? 1,
      index,
    };
  });

  const laneRoleCounts = new Map<string, number>();
  for (const dot of raw) {
    const key = `${dot.role}:${dot.lane}`;
    laneRoleCounts.set(key, (laneRoleCounts.get(key) ?? 0) + 1);
  }
  const laneRoleSeen = new Map<string, number>();

  return raw.map((dot) => {
    const key = `${dot.role}:${dot.lane}`;
    const roleLaneIndex = laneRoleSeen.get(key) ?? 0;
    laneRoleSeen.set(key, roleLaneIndex + 1);
    return {
      id: dot.id,
      unitTypeId: dot.unitTypeId,
      role: dot.role,
      lane: dot.lane,
      roleLaneIndex,
      roleLaneCount: laneRoleCounts.get(key) ?? 1,
      unitDotIndex: dot.unitDotIndex,
      unitDotCount: dot.unitDotCount,
      initialUnitCount: dot.initialUnitCount,
    };
  });
}

function getUnitActivityWeight(dot: FormationTemplateDot, roster: ArmyRoster): number {
  const current = Math.max(0, roster[dot.unitTypeId] ?? 0);
  const equivalentDots = dot.unitDotCount * clamp(current / Math.max(1, dot.initialUnitCount), 0, 1);
  return clamp(equivalentDots - dot.unitDotIndex, 0, 1);
}

function getRoleDepth(role: UnitRole, tactic: BattleTacticId): number {
  if (role === 'line') {
    if (tactic === 'assault') return 3.2;
    if (tactic === 'cautious') return -0.8;
    return 1.5;
  }
  if (tactic === 'cautious') return -7.4;
  if (tactic === 'assault') return -4.3;
  return -5.8;
}

function getTacticLanePush(tactic: BattleTacticId, lane: BattleLane, role: UnitRole): number {
  if (tactic === 'assault') return role === 'line' ? (lane === 'center' ? 3.4 : 2.2) : 0.9;
  if (tactic === 'cautious') return role === 'line' ? -1.8 : -3.1;
  if (tactic === 'flank') {
    if (lane === 'center') return role === 'line' ? -1.2 : -2;
    return role === 'line' ? 4.2 : 2.8;
  }
  return lane === 'center' ? 0.8 : 0.3;
}

function getFormationCenterX(
  side: BattleSideId,
  phase: BattlePresentationPhase,
  broken: boolean,
  winnerSide: BattleSideId | null,
): number {
  const home = side === 'A' ? 23 : 77;
  const forward = side === 'A' ? 1 : -1;
  if (broken) return home - forward * 5;

  if (phase === 'opening') return home;
  if (phase === 'advance') return home + forward * 9;
  if (phase === 'clash') return home + forward * 18;
  if (phase === 'morale') return home + forward * 14;
  if (phase === 'break') return winnerSide === side ? home + forward * 23 : home - forward * 5;
  if (phase === 'finish') {
    if (winnerSide === side) return home + forward * 24;
    if (winnerSide === null) return home + forward * 8;
    return home - forward * 7;
  }
  return home;
}

function continuousJitter(index: number, battleTime: number, amplitude: number, frequency: number): number {
  const phase = (index + 1) * 1.61803398875;
  return Math.sin(phase + battleTime * frequency) * amplitude;
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
