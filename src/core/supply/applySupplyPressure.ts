import type { GameEvent, CommandSuccess } from '@/core/commands/CommandResult';
import type { MapGraph } from '@/core/map/MapGraph';
import type { GameState } from '@/core/state/GameState';
import { factionIgnoresMorale } from '@/core/leaders/LeaderAbility';
import { getSupplyStatus } from '@/core/supply/Supply';

export function applySupplyPressure(
  state: GameState,
  graph: MapGraph,
): CommandSuccess<GameState, GameEvent> {
  const armies = { ...state.armies };
  const events: GameEvent[] = [];

  for (const army of Object.values(state.armies)) {
    if (factionIgnoresMorale(state, army.factionId)) {
      if (army.morale !== 100) armies[army.id] = { ...army, morale: 100 };
      continue;
    }
    const status = getSupplyStatus(state, graph, army.factionId, army.nodeId);
    if (status.moralePressure <= 0 || army.morale <= 0) continue;

    const moraleLost = Math.min(army.morale, status.moralePressure);
    armies[army.id] = {
      ...army,
      morale: army.morale - moraleLost,
    };
    events.push({
      type: 'supply_pressure_applied',
      armyId: army.id,
      factionId: army.factionId,
      supplyPercent: status.percent,
      moraleLost,
    });
  }

  return {
    ok: true,
    state: Object.keys(armies).some((armyId) => armies[armyId] !== state.armies[armyId]) ? { ...state, armies } : state,
    events,
  };
}
