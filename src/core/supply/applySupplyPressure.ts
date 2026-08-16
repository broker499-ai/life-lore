import type { GameEvent, CommandSuccess } from '@/core/commands/CommandResult';
import type { MapGraph } from '@/core/map/MapGraph';
import type { GameState } from '@/core/state/GameState';
import { getSupplyStatus } from '@/core/supply/Supply';

export function applySupplyPressure(
  state: GameState,
  graph: MapGraph,
): CommandSuccess<GameState, GameEvent> {
  const armies = { ...state.armies };
  const events: GameEvent[] = [];

  for (const army of Object.values(state.armies)) {
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
    state: events.length > 0 ? { ...state, armies } : state,
    events,
  };
}
