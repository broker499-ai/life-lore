import { describe, expect, it } from 'vitest';
import { claimRoot, getRootClaimAvailability } from './rootObjective';
import { createPrototypeGameState, RIVAL_ARMY_ID, RIVAL_FACTION_ID } from '@/core/state/createPrototypeGameState';
import { prototypeCampaignRules } from '@/data/campaign/prototypeRules';
import { prototypeCities } from '@/data/cities/prototypeCities';

function preparePlayerForRoot() {
  const state = createPrototypeGameState(44, 'vlados');
  state.armies['player-main'].nodeId = 'root-limit';
  state.cities['root-limit'].ownerFactionId = state.playerFactionId;
  state.cities['moss-market'].ownerFactionId = state.playerFactionId;
  state.cities['big-lunch'].ownerFactionId = state.playerFactionId;
  state.factions[state.playerFactionId].resources.specimens = 5;
  state.factions[state.playerFactionId].resources.supplies = 40;
  state.campaign.resolvedEventIds.push('almost-root-shop');
  return state;
}

describe('root objective', () => {
  it('reports campaign requirements before the final operation', () => {
    const state = createPrototypeGameState(44, 'vlados');
    state.armies['player-main'].nodeId = 'root-limit';
    state.cities['root-limit'].ownerFactionId = state.playerFactionId;

    const availability = getRootClaimAvailability(state, {
      factionId: state.playerFactionId,
      armyId: 'player-main',
      rules: prototypeCampaignRules.rootObjective,
      cityDefinitions: prototypeCities,
    });

    expect(availability.canClaim).toBe(false);
    if (availability.canClaim) return;
    expect(availability.reason).toBe('requirements_not_met');
    expect(availability.progress.requiredCities).toBe(4);
    expect(availability.progress.requiredSpecimens).toBe(5);
  });

  it('lets the player claim the Root and ends the campaign with victory', () => {
    const state = preparePlayerForRoot();
    const result = claimRoot(state, {
      factionId: state.playerFactionId,
      armyId: 'player-main',
      rules: prototypeCampaignRules.rootObjective,
      cityDefinitions: prototypeCities,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.campaign.rootObtainedByFactionId).toBe(state.playerFactionId);
    expect(result.state.campaign.status).toBe('victory');
    expect(result.state.campaign.endingReason).toBe('root_claimed');
    expect(result.state.factions[state.playerFactionId].strategicActionSpent).toBe(true);
    expect(result.state.factions[state.playerFactionId].resources.supplies).toBe(32);
  });

  it('lets a prepared rival claim the Root and records player defeat', () => {
    const state = createPrototypeGameState(71, 'artemios');
    state.turn = 8;
    state.armies[RIVAL_ARMY_ID].nodeId = 'root-limit';
    state.cities['root-limit'].ownerFactionId = RIVAL_FACTION_ID;
    state.cities['club-club'].ownerFactionId = RIVAL_FACTION_ID;
    state.cities['underfountain'].ownerFactionId = RIVAL_FACTION_ID;
    state.factions[RIVAL_FACTION_ID].resources.supplies = 50;

    const result = claimRoot(state, {
      factionId: RIVAL_FACTION_ID,
      armyId: RIVAL_ARMY_ID,
      rules: prototypeCampaignRules.rootObjective,
      cityDefinitions: prototypeCities,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.campaign.status).toBe('defeat');
    expect(result.state.campaign.endingReason).toBe('rival_root_claimed');
  });
});
