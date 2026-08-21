import { getRosterTotalUnits } from '@/core/armies/armyStats';
import { areFactionsAllied } from '@/core/factions/factionRelations';
import { factionIgnoresSupply } from '@/core/leaders/LeaderAbility';
import type { ArmyRoster, GameState } from '@/core/state/GameState';

export type TravelAttritionEvent = {
  type: 'travel_attrition_applied';
  armyId: string;
  factionId: string;
  unitsLost: number;
};

export function applyTravelAttrition(state: GameState): { state: GameState; events: TravelAttritionEvent[] } {
  let nextArmies = state.armies;
  const events: TravelAttritionEvent[] = [];

  for (const army of Object.values(state.armies)) {
    const faction = state.factions[army.factionId];
    if (!faction || factionIgnoresSupply(state, army.factionId)) continue;
    if (faction.resources.supplies > 0) continue;
    const city = state.cities[army.nodeId];
    if (city && areFactionsAllied(state, city.ownerFactionId, army.factionId)) continue;

    const total = getRosterTotalUnits(army.roster);
    if (total <= 0) continue;
    const requestedLosses = Math.max(1, Math.ceil(total * 0.03));
    const roster = removeUnitsDeterministically(army.roster, requestedLosses);
    const unitsLost = total - getRosterTotalUnits(roster);
    if (unitsLost <= 0) continue;
    if (nextArmies === state.armies) nextArmies = { ...state.armies };
    nextArmies[army.id] = { ...army, roster };
    events.push({ type: 'travel_attrition_applied', armyId: army.id, factionId: army.factionId, unitsLost });
  }

  return nextArmies === state.armies ? { state, events } : { state: { ...state, armies: nextArmies }, events };
}

function removeUnitsDeterministically(roster: ArmyRoster, amount: number): ArmyRoster {
  const next = { ...roster };
  let remaining = amount;
  const unitIds = Object.keys(next).sort((a, b) => (next[b] ?? 0) - (next[a] ?? 0) || a.localeCompare(b));
  for (const unitId of unitIds) {
    if (remaining <= 0) break;
    const current = next[unitId] ?? 0;
    const lost = Math.min(current, remaining);
    next[unitId] = current - lost;
    remaining -= lost;
  }
  return next;
}
