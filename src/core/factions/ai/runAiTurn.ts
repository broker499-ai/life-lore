import type { BattleRules } from '@/core/battles/BattleTypes';
import { attackCity } from '@/core/cities/attackCity';
import type { CityDefinitions } from '@/core/cities/CityDefinition';
import { recruitAtCity } from '@/core/cities/recruitAtCity';
import type { GameEvent, CommandSuccess } from '@/core/commands/CommandResult';
import { chooseBestAiAction } from '@/core/factions/ai/evaluateTargets';
import { moveArmy } from '@/core/map/moveArmy';
import type { MapGraph } from '@/core/map/MapGraph';
import type { GameState } from '@/core/state/GameState';
import type { UnitDefinitions } from '@/core/armies/UnitDefinition';

export type RunAiTurnInput = {
  factionId: string;
  armyId: string;
  graph: MapGraph;
  cityDefinitions: CityDefinitions;
  unitDefinitions: UnitDefinitions;
  battleRules: BattleRules;
  moveSupplyCost: number;
  attackSupplyCost: number;
  recruitMoraleRestore: number;
  moraleCap: number;
};

export function runAiTurn(
  state: GameState,
  input: RunAiTurnInput,
): CommandSuccess<GameState, GameEvent> {
  const action = chooseBestAiAction(state, input);

  if (action.type === 'attack') {
    const result = attackCity(
      state,
      input.graph,
      {
        armyId: input.armyId,
        cityId: action.cityId,
        tactic: action.tactic,
        supplyCost: input.attackSupplyCost,
      },
      { unitDefinitions: input.unitDefinitions, battleRules: input.battleRules, cityDefinitions: input.cityDefinitions },
    );
    if (result.ok) {
      return {
        ok: true,
        state: result.state,
        events: [
          {
            type: 'ai_action_taken',
            factionId: input.factionId,
            action: 'attack',
            targetId: action.cityId,
            score: action.score,
          },
          ...result.events,
        ],
      };
    }
  }

  if (action.type === 'move') {
    const result = moveArmy(state, input.graph, {
      armyId: input.armyId,
      toNodeId: action.toNodeId,
      supplyCost: input.moveSupplyCost,
    });
    if (result.ok) {
      return {
        ok: true,
        state: result.state,
        events: [
          {
            type: 'ai_action_taken',
            factionId: input.factionId,
            action: 'move',
            targetId: action.toNodeId,
            score: action.score,
          },
          ...result.events,
        ],
      };
    }
  }

  if (action.type === 'recruit') {
    const result = recruitAtCity(state, {
      armyId: input.armyId,
      cityId: action.cityId,
      offer: action.offer,
      moraleRestore: input.recruitMoraleRestore,
      moraleCap: input.moraleCap,
    });
    if (result.ok) {
      return {
        ok: true,
        state: result.state,
        events: [
          {
            type: 'ai_action_taken',
            factionId: input.factionId,
            action: 'recruit',
            targetId: action.cityId,
            score: action.score,
          },
          ...result.events,
        ],
      };
    }
  }

  return {
    ok: true,
    state,
    events: [
      {
        type: 'ai_action_taken',
        factionId: input.factionId,
        action: 'hold',
        score: action.score,
      },
    ],
  };
}
