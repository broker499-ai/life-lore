import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { ArmyGroupState, ArmyRoster, ArmyState, ArmyFlankId } from '@/core/state/GameState';

export const ARMY_FLANKS: ArmyFlankId[] = ['left', 'center', 'right'];

export function createInitialArmyGroups(roster: ArmyRoster, unitDefinitions: UnitDefinitions, prefix = 'initial'): ArmyGroupState[] {
  const groups: ArmyGroupState[] = [];
  const flankPower: Record<ArmyFlankId, number> = { left: 0, center: 0, right: 0 };
  for (const [unitTypeId, rawAmount] of Object.entries(roster).sort(([a], [b]) => a.localeCompare(b))) {
    let remaining = Math.max(0, Math.round(rawAmount ?? 0));
    if (remaining <= 0) continue;
    const isUnique = Boolean(unitDefinitions[unitTypeId]?.isUnique);
    if (isUnique) {
      const army: ArmyState = { id: prefix, factionId: '', nodeId: '', morale: 0, roster: {}, groups: [...groups] };
      const uniqueLane = getUniqueFlank(army) ?? getWeakestFlankFromPowers(flankPower, ARMY_FLANKS);
      if (!getUniqueFlank(army)) moveRegularGroupsOutOfUniqueFlank(groups, uniqueLane, unitDefinitions);
      groups.push({ id: `${prefix}-${unitTypeId}`, flank: uniqueLane, roster: { [unitTypeId]: remaining }, unique: true });
      flankPower[uniqueLane] += getRosterPower({ [unitTypeId]: remaining }, unitDefinitions);
      continue;
    }

    const allocations = allocateInteger(remaining, [1, 1, 1]);
    ARMY_FLANKS.forEach((flank, index) => {
      const amount = allocations[index] ?? 0;
      if (amount <= 0) return;
      groups.push({ id: `${prefix}-${unitTypeId}-${flank}`, flank, roster: { [unitTypeId]: amount }, unique: false });
      flankPower[flank] += getRosterPower({ [unitTypeId]: amount }, unitDefinitions);
      remaining -= amount;
    });
  }
  return groups;
}

export function createFreshmanStartingGroups(unitTypeId: string, amount: number): ArmyGroupState[] {
  const allocations = allocateInteger(Math.max(0, amount), [1, 1, 1]);
  return ARMY_FLANKS.map((flank, index) => ({
    id: `initial-${unitTypeId}-${flank}`,
    flank,
    roster: { [unitTypeId]: allocations[index] ?? 0 },
    unique: false,
  })).filter((group) => getRosterTotal(group.roster) > 0);
}

export function getArmyFlankRosters(army: ArmyState): Record<ArmyFlankId, ArmyRoster> {
  const result: Record<ArmyFlankId, ArmyRoster> = { left: {}, center: {}, right: {} };
  for (const group of army.groups ?? []) {
    for (const [unitTypeId, amount] of Object.entries(group.roster)) {
      if ((amount ?? 0) <= 0) continue;
      result[group.flank][unitTypeId] = (result[group.flank][unitTypeId] ?? 0) + amount;
    }
  }
  return result;
}

export function getArmyFlankPower(army: ArmyState, flank: ArmyFlankId, unitDefinitions: UnitDefinitions): number {
  return getRosterPower(getArmyFlankRosters(army)[flank], unitDefinitions);
}

export function addArmyGroup(
  army: ArmyState,
  roster: ArmyRoster,
  unitDefinitions: UnitDefinitions,
  options: { id: string; unique?: boolean },
): ArmyState {
  const clean = cleanRoster(roster);
  if (getRosterTotal(clean) <= 0) return army;
  const groups = (army.groups ?? []).map(cloneGroup);
  const unique = Boolean(options.unique);
  let targetFlank: ArmyFlankId;

  if (unique) {
    const existingUnique = groups.find((group) => group.unique && getRosterTotal(group.roster) > 0);
    targetFlank = existingUnique?.flank ?? getWeakestFlank({ ...army, groups }, unitDefinitions, ARMY_FLANKS);
    if (!existingUnique) moveRegularGroupsOutOfUniqueFlank(groups, targetFlank, unitDefinitions);
  } else {
    const uniqueFlank = groups.find((group) => group.unique && getRosterTotal(group.roster) > 0)?.flank ?? null;
    const candidates = uniqueFlank ? ARMY_FLANKS.filter((lane) => lane !== uniqueFlank) : ARMY_FLANKS;
    targetFlank = getWeakestFlank({ ...army, groups }, unitDefinitions, candidates.length > 0 ? candidates : ARMY_FLANKS);
  }

  groups.push({ id: options.id, flank: targetFlank, roster: clean, unique });
  return { ...army, roster: addRosters(army.roster, clean), groups };
}

export function addRosterToGroupContaining(
  army: ArmyState,
  markerUnitTypeId: string,
  additions: ArmyRoster,
  unitDefinitions: UnitDefinitions,
  fallbackId: string,
): ArmyState {
  const clean = cleanRoster(additions);
  if (getRosterTotal(clean) <= 0) return army;
  const groups = (army.groups ?? []).map(cloneGroup);
  const index = groups.findIndex((group) => (group.roster[markerUnitTypeId] ?? 0) > 0);
  if (index >= 0) {
    groups[index] = { ...groups[index], roster: addRosters(groups[index].roster, clean) };
    return { ...army, roster: addRosters(army.roster, clean), groups };
  }
  return addArmyGroup({ ...army, groups }, clean, unitDefinitions, { id: fallbackId, unique: true });
}

export function moveArmyGroup(army: ArmyState, groupId: string, targetFlank: ArmyFlankId): ArmyState {
  const groups = (army.groups ?? []).map(cloneGroup);
  const index = groups.findIndex((group) => group.id === groupId);
  if (index < 0 || groups[index].flank === targetFlank) return army;
  groups[index] = { ...groups[index], flank: targetFlank };
  return { ...army, groups };
}

export function canMergeArmyGroups(army: ArmyState, sourceGroupId: string, targetGroupId: string): boolean {
  if (sourceGroupId === targetGroupId) return false;
  const groups = army.groups ?? [];
  const source = groups.find((group) => group.id === sourceGroupId);
  const target = groups.find((group) => group.id === targetGroupId);
  if (!source || !target || source.unique !== target.unique) return false;
  const sourceTypes = Object.keys(cleanRoster(source.roster)).sort();
  const targetTypes = Object.keys(cleanRoster(target.roster)).sort();
  return sourceTypes.length > 0 && sourceTypes.length === targetTypes.length && sourceTypes.every((type, index) => type === targetTypes[index]);
}

export function mergeArmyGroups(army: ArmyState, sourceGroupId: string, targetGroupId: string): ArmyState {
  if (!canMergeArmyGroups(army, sourceGroupId, targetGroupId)) return army;
  const groups = (army.groups ?? []).map(cloneGroup);
  const sourceIndex = groups.findIndex((group) => group.id === sourceGroupId);
  const targetIndex = groups.findIndex((group) => group.id === targetGroupId);
  if (sourceIndex < 0 || targetIndex < 0) return army;
  const source = groups[sourceIndex];
  const target = groups[targetIndex];
  groups[targetIndex] = { ...target, roster: addRosters(target.roster, source.roster) };
  groups.splice(sourceIndex, 1);
  return { ...army, groups };
}

/**
 * Splits one ordinary persistent recruitment group into 2 or 3 balanced groups.
 * The army roster itself never changes: only the pre-battle grouping does.
 * Unique groups are deliberately indivisible because a named unique fighter may
 * share its group with attached companions (for example Greg and his spiders).
 */
export function splitArmyGroup(army: ArmyState, groupId: string, parts: 2 | 3): ArmyState {
  const groups = (army.groups ?? []).map(cloneGroup);
  const sourceIndex = groups.findIndex((group) => group.id === groupId);
  if (sourceIndex < 0) return army;
  const source = groups[sourceIndex];
  if (source.unique || getRosterTotal(source.roster) < parts) return army;

  const rosters: ArmyRoster[] = Array.from({ length: parts }, () => ({}));
  const totals = Array(parts).fill(0) as number[];
  for (const [unitTypeId, rawAmount] of Object.entries(cleanRoster(source.roster)).sort(([a], [b]) => a.localeCompare(b))) {
    let remaining = Math.max(0, Math.round(rawAmount ?? 0));
    while (remaining > 0) {
      let targetIndex = 0;
      for (let index = 1; index < parts; index += 1) {
        if (totals[index] < totals[targetIndex]) targetIndex = index;
      }
      rosters[targetIndex][unitTypeId] = (rosters[targetIndex][unitTypeId] ?? 0) + 1;
      totals[targetIndex] += 1;
      remaining -= 1;
    }
  }
  if (rosters.some((roster) => getRosterTotal(roster) <= 0)) return army;

  groups[sourceIndex] = { ...source, roster: rosters[0] };
  const existingIds = new Set(groups.map((group) => group.id));
  const additions: ArmyGroupState[] = [];
  for (let index = 1; index < parts; index += 1) {
    const base = `${source.id}-split${parts}-${index + 1}`;
    let id = base;
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    existingIds.add(id);
    additions.push({ ...source, id, roster: rosters[index] });
  }
  groups.splice(sourceIndex + 1, 0, ...additions);
  return { ...army, groups };
}

/**
 * Deterministically balances persistent recruitment groups by combat power.
 * Unique groups stay together on one exclusive flank; ordinary groups are then
 * greedily assigned, strongest first, to the currently weakest eligible flank.
 */
export function autoDistributeArmyGroups(army: ArmyState, unitDefinitions: UnitDefinitions): ArmyState {
  const groups = (army.groups ?? []).map(cloneGroup).filter((group) => getRosterTotal(group.roster) > 0);
  if (groups.length === 0) return army;

  const uniqueGroups = groups.filter((group) => group.unique);
  const regularGroups = groups.filter((group) => !group.unique);
  const powers: Record<ArmyFlankId, number> = { left: 0, center: 0, right: 0 };

  let uniqueFlank: ArmyFlankId | null = null;
  if (uniqueGroups.length > 0) {
    uniqueFlank = uniqueGroups[0]?.flank ?? 'center';
    for (const group of uniqueGroups) {
      group.flank = uniqueFlank;
      powers[uniqueFlank] += getRosterPower(group.roster, unitDefinitions);
    }
  }

  const eligible = uniqueFlank ? ARMY_FLANKS.filter((flank) => flank !== uniqueFlank) : ARMY_FLANKS;
  const sortedRegular = [...regularGroups].sort((a, b) => {
    const powerDifference = getRosterPower(b.roster, unitDefinitions) - getRosterPower(a.roster, unitDefinitions);
    return powerDifference || a.id.localeCompare(b.id);
  });
  for (const group of sortedRegular) {
    const target = getWeakestFlankFromPowers(powers, eligible.length > 0 ? eligible : ARMY_FLANKS);
    group.flank = target;
    powers[target] += getRosterPower(group.roster, unitDefinitions);
  }

  const byId = new Map([...uniqueGroups, ...sortedRegular].map((group) => [group.id, group]));
  return { ...army, groups: groups.map((group) => byId.get(group.id) ?? group) };
}

export function swapArmyFlanks(army: ArmyState, first: ArmyFlankId, second: ArmyFlankId): ArmyState {
  if (first === second) return army;
  return {
    ...army,
    groups: (army.groups ?? []).map((group) => ({
      ...cloneGroup(group),
      flank: group.flank === first ? second : group.flank === second ? first : group.flank,
    })),
  };
}

export function reconcileArmyGroupsToRoster(army: ArmyState, roster: ArmyRoster, unitDefinitions: UnitDefinitions): ArmyState {
  const cleanTarget = cleanRoster(roster);
  const sourceGroups = (army.groups ?? []).map(cloneGroup);
  const allUnitTypes = new Set<string>([
    ...Object.keys(cleanTarget),
    ...sourceGroups.flatMap((group) => Object.keys(group.roster)),
  ]);
  let groups = sourceGroups.map((group) => ({ ...group, roster: { ...group.roster } }));

  for (const unitTypeId of allUnitTypes) {
    const target = cleanTarget[unitTypeId] ?? 0;
    const holders = groups
      .map((group, index) => ({ index, amount: group.roster[unitTypeId] ?? 0 }))
      .filter((item) => item.amount > 0);
    const before = holders.reduce((sum, item) => sum + item.amount, 0);
    if (before > 0) {
      const allocations = allocateInteger(target, holders.map((item) => item.amount));
      holders.forEach((holder, holderIndex) => {
        const value = allocations[holderIndex] ?? 0;
        if (value > 0) groups[holder.index].roster[unitTypeId] = value;
        else delete groups[holder.index].roster[unitTypeId];
      });
      continue;
    }
    if (target > 0) {
      const unique = Boolean(unitDefinitions[unitTypeId]?.isUnique);
      const tempArmy = { ...army, roster: cleanTarget, groups };
      const added = addArmyGroup(tempArmy, { [unitTypeId]: target }, unitDefinitions, {
        id: `reconciled-${unitTypeId}`,
        unique,
      });
      groups = added.groups ?? groups;
    }
  }

  groups = groups
    .map((group) => ({ ...group, roster: cleanRoster(group.roster) }))
    .filter((group) => getRosterTotal(group.roster) > 0);
  return { ...army, roster: cleanTarget, groups };
}

export function getUniqueFlank(army: ArmyState): ArmyFlankId | null {
  return (army.groups ?? []).find((group) => group.unique && getRosterTotal(group.roster) > 0)?.flank ?? null;
}

export function getRosterPower(roster: ArmyRoster, unitDefinitions: UnitDefinitions): number {
  let total = 0;
  for (const [unitTypeId, amount] of Object.entries(roster)) {
    const unit = unitDefinitions[unitTypeId];
    if (!unit || (amount ?? 0) <= 0) continue;
    total += amount * (unit.attack + unit.defense);
  }
  return total;
}

function getWeakestFlank(army: ArmyState, unitDefinitions: UnitDefinitions, candidates: ArmyFlankId[]): ArmyFlankId {
  const powers = Object.fromEntries(ARMY_FLANKS.map((lane) => [lane, getArmyFlankPower(army, lane, unitDefinitions)])) as Record<ArmyFlankId, number>;
  return getWeakestFlankFromPowers(powers, candidates);
}

function getWeakestFlankFromPowers(powers: Record<ArmyFlankId, number>, candidates: ArmyFlankId[]): ArmyFlankId {
  return [...candidates].sort((a, b) => powers[a] - powers[b] || ARMY_FLANKS.indexOf(a) - ARMY_FLANKS.indexOf(b))[0] ?? 'center';
}

function moveRegularGroupsOutOfUniqueFlank(groups: ArmyGroupState[], uniqueFlank: ArmyFlankId, unitDefinitions: UnitDefinitions): void {
  const others = ARMY_FLANKS.filter((lane) => lane !== uniqueFlank);
  for (const group of groups) {
    if (group.flank !== uniqueFlank || group.unique) continue;
    const tempArmy: ArmyState = { id: 'temp', factionId: '', nodeId: '', morale: 0, roster: {}, groups };
    group.flank = getWeakestFlank(tempArmy, unitDefinitions, others);
  }
}

function addRosters(a: ArmyRoster, b: ArmyRoster): ArmyRoster {
  const result = { ...a };
  for (const [unitTypeId, amount] of Object.entries(b)) {
    if ((amount ?? 0) <= 0) continue;
    result[unitTypeId] = (result[unitTypeId] ?? 0) + amount;
  }
  return cleanRoster(result);
}

function cleanRoster(roster: ArmyRoster): ArmyRoster {
  return Object.fromEntries(Object.entries(roster).filter(([, amount]) => (amount ?? 0) > 0));
}

function cloneGroup(group: ArmyGroupState): ArmyGroupState {
  return { ...group, roster: { ...group.roster } };
}

function getRosterTotal(roster: ArmyRoster): number {
  return Object.values(roster).reduce((sum, amount) => sum + Math.max(0, amount ?? 0), 0);
}

function allocateInteger(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const normalized = weights.map((weight) => Math.max(0, weight));
  const sum = normalized.reduce((acc, value) => acc + value, 0) || weights.length;
  const exact = normalized.map((weight) => total * ((sum > 0 ? weight : 1) / sum));
  if (normalized.every((value) => value === 0)) {
    for (let index = 0; index < exact.length; index += 1) exact[index] = total / exact.length;
  }
  const base = exact.map(Math.floor);
  let remainder = Math.max(0, total - base.reduce((acc, value) => acc + value, 0));
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
