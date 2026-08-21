import { describe, expect, it } from 'vitest';
import { resolveCityVisitArtifact } from '@/core/artifacts/resolveCityVisitArtifact';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { cityVisitArtifactByCityId } from '@/data/artifacts/cityVisitArtifacts';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';
import { prototypeCampaignRules } from '@/data/campaign/prototypeRules';

describe('city visit artifacts Stage 39', () => {
  it('never awards an artifact merely for visiting a city', () => {
    const state = createPrototypeGameState(42, 'vlados');
    state.cities['moss-market'].ownerFactionId = state.playerFactionId;
    state.armies['player-main'].nodeId = 'moss-market';
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
    expect(result.events).toHaveLength(0);
    expect(result.state.campaign.artifactIds).toHaveLength(0);
    expect(result.state.campaign.cityArtifactClaimedIds).toHaveLength(0);
  });
});
