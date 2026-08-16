import { acquireArtifact } from '@/core/artifacts/acquireArtifact';
import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';
import type { GameEvent } from '@/core/commands/CommandResult';
import type { ArmyId, CityId, FactionId, GameState } from '@/core/state/GameState';

export type CityVisitArtifactMap = Partial<Record<CityId, string>>;

export type ResolveCityVisitArtifactInput = {
  cityId: CityId;
  factionId: FactionId;
  armyId: ArmyId;
  supplyCap: number;
  moraleCap: number;
};

export function resolveCityVisitArtifact(
  state: GameState,
  input: ResolveCityVisitArtifactInput,
  cityArtifacts: CityVisitArtifactMap,
  artifacts: ArtifactDefinitions,
): { state: GameState; events: GameEvent[] } {
  const city = state.cities[input.cityId];
  const army = state.armies[input.armyId];
  if (!city || !army || army.factionId !== input.factionId || army.nodeId !== input.cityId) {
    return { state, events: [] };
  }
  if (state.campaign.cityArtifactClaimedIds.includes(input.cityId)) {
    return { state, events: [] };
  }

  const artifactId = cityArtifacts[input.cityId];
  if (!artifactId) return { state, events: [] };

  const markedState: GameState = {
    ...state,
    campaign: {
      ...state.campaign,
      cityArtifactClaimedIds: [...state.campaign.cityArtifactClaimedIds, input.cityId],
    },
  };
  const acquired = acquireArtifact(
    markedState,
    {
      artifactId,
      factionId: input.factionId,
      armyId: input.armyId,
      supplyCap: input.supplyCap,
      moraleCap: input.moraleCap,
    },
    artifacts,
  );

  return {
    state: acquired.state,
    events: acquired.event ? [acquired.event] : [],
  };
}
