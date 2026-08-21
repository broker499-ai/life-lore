import { describe, expect, it } from 'vitest';
import { getRosterTotalUnits } from '@/core/armies/armyStats';
import { acquireArtifact } from '@/core/artifacts/acquireArtifact';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';
import { MAX_ORSIA_KNOWLEDGE } from '@/data/campaign/knowledgeRules';

describe('Stage 39 artifact consequences', () => {
  it('adds one knowledge and lightly reinforces a subset of hostile city garrisons', () => {
    const state = createPrototypeGameState(321, 'artemios');
    const before = Object.fromEntries(Object.entries(state.cities).map(([id, city]) => [id, getRosterTotalUnits(city.garrison.roster)]));
    const result = acquireArtifact(state, {
      artifactId: 'apple-skeleton',
      factionId: state.playerFactionId,
      armyId: 'player-main',
      supplyCap: 100,
      moraleCap: 100,
    }, prototypeArtifacts);

    expect(result.state.factions[state.playerFactionId].specimensCollected).toBe(1);
    const strengthened = Object.entries(result.state.cities).filter(([id, city]) => getRosterTotalUnits(city.garrison.roster) > (before[id] ?? 0));
    expect(strengthened.length).toBeGreaterThan(0);
    expect(strengthened.length).toBeLessThan(Object.keys(result.state.cities).length);
    expect(Object.values(result.state.cities).some((city) => city.garrison.roster['linhao-singular'] === 2)).toBe(false);
  });

  it('caps knowledge at the maximum', () => {
    const state = createPrototypeGameState(322, 'artemios');
    state.factions[state.playerFactionId].resources.specimens = MAX_ORSIA_KNOWLEDGE;
    state.factions[state.playerFactionId].specimensCollected = MAX_ORSIA_KNOWLEDGE;
    const result = acquireArtifact(state, {
      artifactId: 'apple-skeleton',
      factionId: state.playerFactionId,
      armyId: 'player-main',
      supplyCap: 100,
      moraleCap: 100,
    }, prototypeArtifacts);
    expect(result.state.factions[state.playerFactionId].specimensCollected).toBe(MAX_ORSIA_KNOWLEDGE);
  });
});
