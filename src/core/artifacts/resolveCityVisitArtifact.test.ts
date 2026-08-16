import { describe, expect, it } from 'vitest';
import { resolveCityVisitArtifact } from '@/core/artifacts/resolveCityVisitArtifact';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { getMoraleDamageInflictedMultiplier } from '@/core/leaders/LeaderAbility';
import { cityVisitArtifactByCityId } from '@/data/artifacts/cityVisitArtifacts';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';
import { prototypeCampaignRules } from '@/data/campaign/prototypeRules';

function placePlayerInMossMarket(leaderId = 'artemios') {
  const state = createPrototypeGameState(42, leaderId);
  state.cities['moss-market'].ownerFactionId = state.playerFactionId;
  state.armies['player-main'].nodeId = 'moss-market';
  return state;
}

describe('city visit artifacts', () => {
  it('awards the configured artifact only on the first actual visit', () => {
    const state = placePlayerInMossMarket();
    const first = resolveCityVisitArtifact(
      state,
      {
        cityId: 'moss-market',
        factionId: state.playerFactionId,
        armyId: 'player-main',
        supplyCap: prototypeCampaignRules.supplyCap,
        moraleCap: prototypeCampaignRules.moraleCap,
      },
      cityVisitArtifactByCityId,
      prototypeArtifacts,
    );
    expect(first.state.campaign.artifactIds).toContain('last-word-stone');
    expect(first.state.campaign.cityArtifactClaimedIds).toContain('moss-market');
    expect(first.events).toHaveLength(1);

    const second = resolveCityVisitArtifact(
      first.state,
      {
        cityId: 'moss-market',
        factionId: state.playerFactionId,
        armyId: 'player-main',
        supplyCap: prototypeCampaignRules.supplyCap,
        moraleCap: prototypeCampaignRules.moraleCap,
      },
      cityVisitArtifactByCityId,
      prototypeArtifacts,
    );
    expect(second.events).toHaveLength(0);
    expect(second.state.campaign.artifactIds.filter((id) => id === 'last-word-stone')).toHaveLength(1);
  });

  it('auto-activates a free city artifact slot and uses the Vlad multiplier for its persistent effect', () => {
    const state = placePlayerInMossMarket('vlados');
    const result = resolveCityVisitArtifact(
      state,
      {
        cityId: 'moss-market',
        factionId: state.playerFactionId,
        armyId: 'player-main',
        supplyCap: prototypeCampaignRules.supplyCap,
        moraleCap: prototypeCampaignRules.moraleCap,
      },
      cityVisitArtifactByCityId,
      prototypeArtifacts,
    );
    expect(result.state.campaign.activeArtifactIds).toContain('last-word-stone');
    expect(getMoraleDamageInflictedMultiplier(result.state, state.playerFactionId)).toBeCloseTo(1.12);
  });
});
