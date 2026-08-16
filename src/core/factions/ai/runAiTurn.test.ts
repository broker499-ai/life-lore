import { describe, expect, it } from 'vitest';
import { chooseBestAiAction } from '@/core/factions/ai/evaluateTargets';
import { runAiTurn } from '@/core/factions/ai/runAiTurn';
import {
  createPrototypeGameState,
  RIVAL_ARMY_ID,
  RIVAL_FACTION_ID,
} from '@/core/state/createPrototypeGameState';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeCampaignRules } from '@/data/campaign/prototypeRules';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeMap } from '@/data/map/prototypeMap';
import { prototypeUnits } from '@/data/units/prototypeUnits';

const input = {
  factionId: RIVAL_FACTION_ID,
  armyId: RIVAL_ARMY_ID,
  graph: prototypeMap,
  cityDefinitions: prototypeCities,
  unitDefinitions: prototypeUnits,
  battleRules: prototypeBattleRules,
  moveSupplyCost: prototypeCampaignRules.moveSupplyCost,
  attackSupplyCost: prototypeCampaignRules.attackSupplyCost,
  recruitMoraleRestore: prototypeCampaignRules.recruitMoraleRestore,
  moraleCap: prototypeCampaignRules.moraleCap,
};

describe('AI turn', () => {
  it('chooses Club Club as its first expansion target', () => {
    const state = createPrototypeGameState(42);
    const action = chooseBestAiAction(state, input);

    expect(action).toMatchObject({ type: 'attack', cityId: 'club-club' });
  });

  it('is deterministic for the same state and seed', () => {
    const a = runAiTurn(createPrototypeGameState(42), input);
    const b = runAiTurn(createPrototypeGameState(42), input);

    expect(a).toEqual(b);
    expect(a.events[0]).toMatchObject({
      type: 'ai_action_taken',
      factionId: RIVAL_FACTION_ID,
      action: 'attack',
      targetId: 'club-club',
    });
  });

  it('uses the rival faction action budget without consuming the player action', () => {
    const result = runAiTurn(createPrototypeGameState(42), input);

    expect(result.state.factions[RIVAL_FACTION_ID].strategicActionSpent).toBe(true);
    expect(result.state.factions.expedition.strategicActionSpent).toBe(false);
  });
});
