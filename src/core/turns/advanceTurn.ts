import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { BattleRules } from '@/core/battles/BattleTypes';
import { evaluatePlayerDefeat } from '@/core/campaign/campaignOutcome';
import { claimRoot, getRootClaimAvailability } from '@/core/campaign/rootObjective';
import type { CityDefinitions } from '@/core/cities/CityDefinition';
import type { GameEvent, CommandSuccess } from '@/core/commands/CommandResult';
import { runAiTurn } from '@/core/factions/ai/runAiTurn';
import type { MapGraph } from '@/core/map/MapGraph';
import type { GameState } from '@/core/state/GameState';
import { endTurn } from '@/core/turns/endTurn';
import { applySupplyPressure } from '@/core/supply/applySupplyPressure';
import { applyTravelAttrition } from '@/core/supply/applyTravelAttrition';
import type { RootObjectiveRules } from '@/data/campaign/prototypeRules';

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
  recruitMoraleRestore: number;
  moraleCap: number;
  rootObjective: RootObjectiveRules;
  aiTurns: AiTurnConfig[];
};

export function advanceTurn(
  state: GameState,
  input: AdvanceTurnInput,
): CommandSuccess<GameState, GameEvent> {
  let nextState = state;
  const events: GameEvent[] = [];

  for (const ai of input.aiTurns) {
    const rootAvailability = getRootClaimAvailability(nextState, {
      factionId: ai.factionId,
      armyId: ai.armyId,
      rules: input.rootObjective,
      cityDefinitions: input.cityDefinitions,
    });
    if (rootAvailability.canClaim) {
      const rootClaim = claimRoot(nextState, {
        factionId: ai.factionId,
        armyId: ai.armyId,
        rules: input.rootObjective,
        cityDefinitions: input.cityDefinitions,
      });
      if (rootClaim.ok) {
        return { ok: true, state: rootClaim.state, events: [...events, ...rootClaim.events] };
      }
    }

    const aiTurn = runAiTurn(nextState, {
      factionId: ai.factionId,
      armyId: ai.armyId,
      graph: input.graph,
      cityDefinitions: input.cityDefinitions,
      unitDefinitions: input.unitDefinitions,
      battleRules: input.battleRules,
      moveSupplyCost: input.moveSupplyCost,
      attackSupplyCost: input.attackSupplyCost,
      recruitMoraleRestore: input.recruitMoraleRestore,
      moraleCap: input.moraleCap,
    });
    nextState = aiTurn.state;
    events.push(...aiTurn.events);

    const defeat = evaluatePlayerDefeat(nextState);
    nextState = defeat.state;
    events.push(...defeat.events);
    if (nextState.campaign.status !== 'active') {
      return { ok: true, state: nextState, events };
    }
  }

  const supplyPressure = applySupplyPressure(nextState, input.graph);
  nextState = supplyPressure.state;
  events.push(...supplyPressure.events);

  const travelAttrition = applyTravelAttrition(nextState);
  nextState = travelAttrition.state;
  events.push(...travelAttrition.events);

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
