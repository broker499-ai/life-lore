import { describe, expect, it } from 'vitest';
import { acquireArtifact } from '@/core/artifacts/acquireArtifact';
import { MAX_ACTIVE_ARTIFACTS, toggleActiveArtifact } from '@/core/artifacts/artifactLoadout';
import { getCityIncomeMultiplier, getMoraleDamageInflictedMultiplier } from '@/core/leaders/LeaderAbility';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';
import { prototypeCampaignRules } from '@/data/campaign/prototypeRules';

function acquire(state: ReturnType<typeof createPrototypeGameState>, artifactId: string) {
  return acquireArtifact(state, {
    artifactId,
    factionId: state.playerFactionId,
    armyId: 'player-main',
    supplyCap: prototypeCampaignRules.supplyCap,
    moraleCap: prototypeCampaignRules.moraleCap,
  }, prototypeArtifacts).state;
}

describe('artifact loadout', () => {
  it('keeps only three artifacts active and stores later finds in the collection', () => {
    let state = createPrototypeGameState(42);
    for (const id of ['apple-skeleton', 'last-word-stone', 'econom-spoon', 'clean-towel']) state = acquire(state, id);
    expect(state.campaign.artifactIds).toHaveLength(4);
    expect(state.campaign.activeArtifactIds).toHaveLength(MAX_ACTIVE_ARTIFACTS);
    expect(state.campaign.activeArtifactIds).not.toContain('clean-towel');
  });

  it('lets the player change the loadout only in a controlled city without spending the turn action', () => {
    let state = createPrototypeGameState(42);
    for (const id of ['apple-skeleton', 'last-word-stone', 'econom-spoon', 'clean-towel']) state = acquire(state, id);
    state.factions.expedition.strategicActionSpent = false;

    const away = toggleActiveArtifact(state, { factionId: 'expedition', armyId: 'player-main', artifactId: 'apple-skeleton' }, prototypeArtifacts);
    expect(away.ok).toBe(true); // starts in the controlled outer-post
    if (!away.ok) return;
    expect(away.state.factions.expedition.strategicActionSpent).toBe(false);
    expect(getCityIncomeMultiplier(away.state, 'expedition')).toBeCloseTo(1);

    const swapped = toggleActiveArtifact(away.state, { factionId: 'expedition', armyId: 'player-main', artifactId: 'clean-towel' }, prototypeArtifacts);
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    expect(swapped.state.campaign.activeArtifactIds).toContain('clean-towel');
    expect(getMoraleDamageInflictedMultiplier(swapped.state, 'expedition')).toBeCloseTo(1.08);
  });

  it('rejects loadout changes outside a controlled city', () => {
    let state = acquire(createPrototypeGameState(42), 'apple-skeleton');
    state.armies['player-main'].nodeId = 'warehouse-2';
    const result = toggleActiveArtifact(state, { factionId: 'expedition', armyId: 'player-main', artifactId: 'apple-skeleton' }, prototypeArtifacts);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_in_controlled_city');
  });
});
