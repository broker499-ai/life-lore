import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { BattleRules } from '@/core/battles/BattleTypes';
import type { CityDefinitions } from '@/core/cities/CityDefinition';
import type { GameEvent, CommandSuccess } from '@/core/commands/CommandResult';
import { runAiTurn } from '@/core/factions/ai/runAiTurn';
import type { MapGraph } from '@/core/map/MapGraph';
import type { GameState } from '@/core/state/GameState';
import { endTurn } from '@/core/turns/endTurn';
import { applySupplyPressure } from '@/core/supply/applySupplyPressure';

export type AiTurnConfig = {
  factionId: string;
  armyId: string;
};

export type AdvanceTurnInput = {
  graph: MapGraph;
  cityDefinitions: CityDefinitions;
  unitDefinitions: UnitDefinitions;
  battleRules: BattleRules;
  moveSupplyCost: number;
  attackSupplyCost: number;
  aiTurns: AiTurnConfig[];
};

export function advanceTurn(
  state: GameState,
  input: AdvanceTurnInput,
): CommandSuccess<GameState, GameEvent> {
  let nextState = state;
  const events: GameEvent[] = [];

  for (const ai of input.aiTurns) {
    const aiTurn = runAiTurn(nextState, {
      factionId: ai.factionId,
      armyId: ai.armyId,
      graph: input.graph,
      cityDefinitions: input.cityDefinitions,
      unitDefinitions: input.unitDefinitions,
      battleRules: input.battleRules,
      moveSupplyCost: input.moveSupplyCost,
      attackSupplyCost: input.attackSupplyCost,
    });
    nextState = aiTurn.state;
    events.push(...aiTurn.events);
  }

  const supplyPressure = applySupplyPressure(nextState, input.graph);
  nextState = supplyPressure.state;
  events.push(...supplyPressure.events);

  const ended = endTurn(nextState, {
    cityDefinitions: input.cityDefinitions,
    unitDefinitions: input.unitDefinitions,
  });

  return {
    ok: true,
    state: ended.state,
    events: [...events, ...ended.events],
  };
}
