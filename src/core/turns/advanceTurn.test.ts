import { describe, expect, it } from 'vitest';
import { advanceTurn } from '@/core/turns/advanceTurn';
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
  graph: prototypeMap,
  cityDefinitions: prototypeCities,
  unitDefinitions: prototypeUnits,
  battleRules: prototypeBattleRules,
  moveSupplyCost: prototypeCampaignRules.moveSupplyCost,
  attackSupplyCost: prototypeCampaignRules.attackSupplyCost,
  recruitMoraleRestore: prototypeCampaignRules.recruitMoraleRestore,
  moraleCap: prototypeCampaignRules.moraleCap,
  rootObjective: prototypeCampaignRules.rootObjective,
  aiTurns: [{ factionId: RIVAL_FACTION_ID, armyId: RIVAL_ARMY_ID }],
};

describe('advanceTurn', () => {
  it('runs the rival before economy, advances the turn and refreshes both action budgets', () => {
    const state = createPrototypeGameState(42);
    state.factions.expedition.strategicActionSpent = true;

    const result = advanceTurn(state, input);

    expect(result.state.turn).toBe(2);
    expect(result.events.some((event) => event.type === 'ai_action_taken')).toBe(true);
    expect(result.state.factions.expedition.strategicActionSpent).toBe(false);
    expect(result.state.factions[RIVAL_FACTION_ID].strategicActionSpent).toBe(false);
  });

  it('lets the prepared rival claim the Root before taking a normal AI action', () => {
    const state = createPrototypeGameState(42, 'vlados');
    state.turn = 8;
    state.armies[RIVAL_ARMY_ID].nodeId = 'root-limit';
    state.cities['root-limit'].ownerFactionId = RIVAL_FACTION_ID;
    state.cities['club-club'].ownerFactionId = RIVAL_FACTION_ID;
    state.cities['underfountain'].ownerFactionId = RIVAL_FACTION_ID;
    state.factions[RIVAL_FACTION_ID].resources.supplies = 50;
    state.factions[RIVAL_FACTION_ID].strategicActionSpent = false;

    const result = advanceTurn(state, input);

    expect(result.state.campaign.status).toBe('defeat');
    expect(result.state.campaign.endingReason).toBe('rival_root_claimed');
    expect(result.state.campaign.rootObtainedByFactionId).toBe(RIVAL_FACTION_ID);
    expect(result.state.turn).toBe(8);
    expect(result.events.some((event) => event.type === 'root_claimed')).toBe(true);
    expect(result.events.some((event) => event.type === 'ai_action_taken')).toBe(false);
  });

});
