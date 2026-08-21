import type { UnitDefinitions, UnitRole } from '@/core/armies/UnitDefinition';
import type { BattleLane, BattleSideId, BattleTacticId } from '@/core/battles/BattleTypes';
import type {
  BattlePresentationPhase,
  BattlePresentationSide,
} from '@/core/battles/presentation/BattlePresentation';
import type { ArmyRoster, UnitTypeId } from '@/core/state/GameState';

export type { BattleLane } from '@/core/battles/BattleTypes';

export type BattleFormationDot = {
  id: string;
  unitTypeId: UnitTypeId;
  role: UnitRole;
  lane: BattleLane;
  x: number;
  y: number;
  r: number;
  opacity: number;
  weakened: boolean;
  brokenLane: boolean;
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
  centerOnly?: boolean;
  laneRedirects?: Partial<Record<BattleLane, BattleLane>>;
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
  laneDotIndex: number;
  laneDotCount: number;
};

const LANE_Y: Record<BattleLane, number> = {
  left: 24,
  center: 50,
  right: 76,
};

export function getBattleFormationDots(input: BattleFormationInput): BattleFormationDot[] {
  const initialRoster = input.from.initialRoster;
  const template = buildFormationTemplate(
    initialRoster,
    input.unitDefinitions,
    input.maxDots ?? 18,
    input.centerOnly ?? false,
    input.from.initialSectorState,
    input.from.initialLaneRosters,
  );
  const pressure = lerp(input.overallPressureFrom, input.overallPressureTo, input.progress);
  const brokenWeight = lerp(input.from.broken ? 1 : 0, input.to.broken ? 1 : 0, input.progress);
  const forward = input.side === 'A' ? 1 : -1;
  const sustainedContact = input.toPhase === 'clash' || input.toPhase === 'morale' || input.fromPhase === 'clash' || input.fromPhase === 'morale';

  return template.map((dot, index) => {
    const fromWeight = getLaneActivityWeight(dot, input.from.sectorState.sectors[dot.lane].units, input.from.initialSectorState.sectors[dot.lane].units);
    const toWeight = getLaneActivityWeight(dot, input.to.sectorState.sectors[dot.lane].units, input.to.initialSectorState.sectors[dot.lane].units);
    const lateUnit = (input.from.lateArrivalRoster?.[dot.unitTypeId] ?? input.to.lateArrivalRoster?.[dot.unitTypeId] ?? 0) > 0;
    const lateArrivalWeight = lateUnit
      ? lerp(input.from.lateArrivalCommitted ? 1 : 0, input.to.lateArrivalCommitted ? 1 : 0, input.progress)
      : 1;
    const laneActivityWeight = lerp(fromWeight, toWeight, input.progress);
    const activeWeight = lateUnit ? Math.max(laneActivityWeight, lateArrivalWeight) : laneActivityWeight;
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
    const laneSpread = (dot.roleLaneIndex - (dot.roleLaneCount - 1) / 2) * (input.centerOnly ? 1.15 : 3.6);
    const staggerX = ((dot.roleLaneIndex % 2) - 0.5) * 1.5 * forward;
    const fromSector = input.from.sectorState.sectors[dot.lane];
    const toSector = input.to.sectorState.sectors[dot.lane];
    const laneMorale = lerp(fromSector.morale, toSector.morale, input.progress);
    const brokenLane = input.progress < 0.5 ? fromSector.broken : toSector.broken;
    const posture = input.progress < 0.55 ? fromSector.posture : toSector.posture;
    const restWeight = lerp(fromSector.posture === 'rest' ? 1 : 0, toSector.posture === 'rest' ? 1 : 0, input.progress);
    const interruptedWeight = lerp(fromSector.posture === 'rest_broken' ? 1 : 0, toSector.posture === 'rest_broken' ? 1 : 0, input.progress);
    const motionScale = brokenLane ? 0.04 : posture === 'rest' ? 0.18 : posture === 'rest_broken' ? 1.16 : posture === 'cautious' ? 0.72 : posture === 'assault' ? 1.22 : 1;
    const organicX = continuousJitter(index, input.battleTime, 0.28 * activeWeight * motionScale, 0.83);
    const organicY = continuousJitter(index + 23, input.battleTime, 0.36 * activeWeight * motionScale, 1.07);
    const collapseBack = (1 - activeWeight) * 2.4 * -forward;
    const brokenScatterX = brokenWeight * ((index % 3) - 1) * 1.25;
    const brokenScatterY = brokenWeight * (((index * 7) % 5) - 2) * 1.1;
    const contactPulse = sustainedContact && !brokenLane
      ? Math.sin(input.battleTime * (posture === 'assault' ? 4.1 : 3.25) + index * 0.71) * 1.45 * activeWeight * motionScale
      : 0;
    const postureForward = (posture === 'assault' ? 2.8 * forward : posture === 'cautious' ? -1.1 * forward : 0) - 13.2 * forward * restWeight - 0.6 * forward * interruptedWeight;
    const weakened = !brokenLane && laneMorale < 48;
    const redirectTarget = input.laneRedirects?.[dot.lane] ?? null;
    const redirectStrength = redirectTarget && redirectTarget !== dot.lane ? 0.78 : 0;
    const redirectY = redirectTarget
      ? (LANE_Y[redirectTarget] - LANE_Y[dot.lane]) * redirectStrength
      : 0;
    const redirectForward = redirectTarget ? forward * 3.2 * (redirectTarget === dot.lane ? 0.35 : redirectStrength) : 0;

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
        pressure * 0.05 +
        contactPulse +
        postureForward +
        redirectForward,
      y: LANE_Y[dot.lane] + laneSpread + organicY + brokenScatterY + redirectY,
      r: lerp(0.2, dot.role === 'ranged' ? 1.55 : 1.85 - brokenWeight * 0.25, activeWeight * lateArrivalWeight),
      opacity: lerp(0, dot.role === 'ranged' ? 0.9 : 1, activeWeight) * lateArrivalWeight * (brokenLane ? 0.42 : weakened ? 0.68 : 1),
      weakened,
      brokenLane,
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
  centerOnly: boolean,
  initialSectorState: BattlePresentationSide['initialSectorState'],
  initialLaneRosters?: BattlePresentationSide['initialLaneRosters'],
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

  // Singular and unique units must stay visually legible even inside a very large army.
  for (const entry of entries) {
    const definition = unitDefinitions[entry.unitTypeId];
    if (!definition?.replacesEntireLane && !definition?.isUnique) continue;
    if (selectedTypes.some((item) => item.unitTypeId === entry.unitTypeId)) continue;
    const replacementIndex = selectedTypes.findIndex((item) => {
      const candidate = unitDefinitions[item.unitTypeId];
      return !candidate?.replacesEntireLane && !candidate?.isUnique;
    });
    if (replacementIndex >= 0) selectedTypes[replacementIndex] = { unitTypeId: entry.unitTypeId, role: entry.role };
    else selectedTypes.push({ unitTypeId: entry.unitTypeId, role: entry.role });
  }

  const unitDotCounts = new Map<UnitTypeId, number>();
  for (const item of selectedTypes) {
    unitDotCounts.set(item.unitTypeId, (unitDotCounts.get(item.unitTypeId) ?? 0) + 1);
  }

  const unitSeen = new Map<UnitTypeId, number>();
  const hasLaneReplacement = entries.some((entry) => inputUnitReplacesLane(entry.unitTypeId, unitDefinitions));
  let regularLaneCounter = 0;
  const raw = selectedTypes.map((item, index) => {
    const unitDotIndex = unitSeen.get(item.unitTypeId) ?? 0;
    unitSeen.set(item.unitTypeId, unitDotIndex + 1);
    const replacesLane = inputUnitReplacesLane(item.unitTypeId, unitDefinitions);
    const explicitLane = initialLaneRosters
      ? pickLaneForUnitDot(item.unitTypeId, unitDotIndex, unitDotCounts.get(item.unitTypeId) ?? 1, initialLaneRosters)
      : null;
    const lane = centerOnly
      ? 'center'
      : explicitLane
        ? explicitLane
        : replacesLane
          ? 'center'
          : hasLaneReplacement
            ? ((regularLaneCounter++ % 2 === 0) ? 'left' : 'right')
            : pickLaneForDot(index, totalDots, initialSectorState);
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

  const laneDotCounts = new Map<BattleLane, number>();
  for (const dot of raw) laneDotCounts.set(dot.lane, (laneDotCounts.get(dot.lane) ?? 0) + 1);
  const laneDotSeen = new Map<BattleLane, number>();

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
      laneDotIndex: (() => { const current = laneDotSeen.get(dot.lane) ?? 0; laneDotSeen.set(dot.lane, current + 1); return current; })(),
      laneDotCount: laneDotCounts.get(dot.lane) ?? 1,
    };
  });
}

function getLaneActivityWeight(dot: FormationTemplateDot, currentUnits: number, initialUnits: number): number {
  if (initialUnits <= 0) return 0;
  const equivalentDots = dot.laneDotCount * clamp(currentUnits / Math.max(1, initialUnits), 0, 1);
  return clamp(equivalentDots - dot.laneDotIndex, 0, 1);
}

function inputUnitReplacesLane(unitTypeId: UnitTypeId, unitDefinitions: UnitDefinitions): boolean {
  return Boolean(unitDefinitions[unitTypeId]?.replacesEntireLane);
}

function pickLaneForUnitDot(
  unitTypeId: UnitTypeId,
  unitDotIndex: number,
  unitDotCount: number,
  laneRosters: NonNullable<BattlePresentationSide['initialLaneRosters']>,
): BattleLane | null {
  const counts = {
    left: laneRosters.left[unitTypeId] ?? 0,
    center: laneRosters.center[unitTypeId] ?? 0,
    right: laneRosters.right[unitTypeId] ?? 0,
  };
  const total = counts.left + counts.center + counts.right;
  if (total <= 0) return null;
  const target = (unitDotIndex + 0.5) / Math.max(1, unitDotCount);
  const leftCut = counts.left / total;
  const centerCut = leftCut + counts.center / total;
  if (target < leftCut) return 'left';
  if (target < centerCut) return 'center';
  return 'right';
}

function pickLaneForDot(index: number, totalDots: number, initialSectorState: BattlePresentationSide['initialSectorState']): BattleLane {
  const totalUnits = Math.max(1, initialSectorState.sectors.left.units + initialSectorState.sectors.center.units + initialSectorState.sectors.right.units);
  const target = (index + 0.5) / Math.max(1, totalDots);
  const leftCut = initialSectorState.sectors.left.units / totalUnits;
  const centerCut = leftCut + initialSectorState.sectors.center.units / totalUnits;
  if (target < leftCut) return 'left';
  if (target < centerCut) return 'center';
  return 'right';
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
  if (phase === 'morale') return home + forward * 17.2;
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
