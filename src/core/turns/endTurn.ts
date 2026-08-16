import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { GameEvent, CommandSuccess } from '@/core/commands/CommandResult';
import type { CityDefinitions } from '@/core/cities/CityDefinition';
import { collectCityIncome } from '@/core/economy/collectCityIncome';
import { payArmyUpkeep } from '@/core/economy/payArmyUpkeep';
import type { FactionState, GameState } from '@/core/state/GameState';

export type EndTurnInput = {
  cityDefinitions: CityDefinitions;
  unitDefinitions: UnitDefinitions;
};

export function endTurn(
  state: GameState,
  input: EndTurnInput,
): CommandSuccess<GameState, GameEvent> {
  const income = collectCityIncome(state, input.cityDefinitions);
  const upkeep = payArmyUpkeep(income.state, input.unitDefinitions, input.cityDefinitions);
  const factions = Object.fromEntries(
    Object.entries(upkeep.state.factions).map(([factionId, faction]) => [
      factionId,
      resetFactionAction(faction),
    ]),
  ) as GameState['factions'];

  return {
    ok: true,
    state: {
      ...upkeep.state,
      turn: state.turn + 1,
      factions,
    },
    events: [...income.events, ...upkeep.events, { type: 'turn_ended', turn: state.turn }],
  };
}

function resetFactionAction(faction: FactionState): FactionState {
  if (!faction.strategicActionSpent && faction.lastStrategicAction === null) return faction;
  return { ...faction, strategicActionSpent: false, lastStrategicAction: null };
}
