import { describe, expect, it } from 'vitest';
import { getAttackCityAvailability } from '@/core/cities/attackCity';
import { completeResearch } from '@/core/research/completeResearch';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeCampaignRules } from '@/data/campaign/prototypeRules';
import { prototypeMap } from '@/data/map/prototypeMap';
import { prototypeResearch } from '@/data/research/prototypeResearch';

describe('completeResearch', () => {
  it('spends specimens, adds permanent traits, and does not consume the strategic action', () => {
    const state = createPrototypeGameState(42);
    state.factions.expedition.resources.specimens = 5;
    state.factions.expedition.specimensCollected = 5;

    const before = getAttackCityAvailability(state, prototypeMap, {
      armyId: 'player-main',
      cityId: 'moss-market',
      tactic: 'balanced',
      supplyCost: prototypeCampaignRules.attackSupplyCost,
    });
    const result = completeResearch(
      state,
      { factionId: 'expedition', researchId: 'flora-field-rations' },
      prototypeResearch,
      prototypeMap,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.factions.expedition.resources.specimens).toBe(3);
    expect(result.state.factions.expedition.specimensCollected).toBe(5);
    expect(result.state.factions.expedition.strategicActionSpent).toBe(false);
    expect(result.state.campaign.completedResearchIds).toContain('flora-field-rations');
    expect(result.state.factions.expedition.traits).toContainEqual({
      type: 'supply_action_cost_multiplier',
      multiplier: 0.9,
    });

    const after = getAttackCityAvailability(result.state, prototypeMap, {
      armyId: 'player-main',
      cityId: 'moss-market',
      tactic: 'balanced',
      supplyCost: prototypeCampaignRules.attackSupplyCost,
    });
    expect(before.canAttack).toBe(true);
    expect(after.canAttack).toBe(true);
    if (before.canAttack && after.canAttack) {
      expect(after.supplyCost).toBeLessThan(before.supplyCost);
    }
  });

  it('enforces branch prerequisites and specimen costs', () => {
    const state = createPrototypeGameState(42);
    state.factions.expedition.resources.specimens = 99;

    expect(
      completeResearch(
        state,
        { factionId: 'expedition', researchId: 'flora-root-tonics' },
        prototypeResearch,
        prototypeMap,
      ),
    ).toMatchObject({ ok: false, error: 'prerequisite_missing' });

    state.factions.expedition.resources.specimens = 1;
    expect(
      completeResearch(
        state,
        { factionId: 'expedition', researchId: 'flora-field-rations' },
        prototypeResearch,
        prototypeMap,
      ),
    ).toMatchObject({ ok: false, error: 'insufficient_specimens' });
  });
});
