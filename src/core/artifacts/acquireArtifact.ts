import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';
import { activateArtifactTraits, MAX_ACTIVE_ARTIFACTS } from '@/core/artifacts/artifactLoadout';
import type { GameEvent } from '@/core/commands/CommandResult';
import { getArtifactEffectMultiplier } from '@/core/leaders/LeaderAbility';
import type { ArmyId, FactionId, GameState } from '@/core/state/GameState';

export type AcquireArtifactInput = {
  artifactId: string;
  factionId: FactionId;
  armyId: ArmyId;
  supplyCap: number;
  moraleCap: number;
};

export type AcquireArtifactResult = {
  state: GameState;
  event: Extract<GameEvent, { type: 'artifact_acquired' }> | null;
};

export function acquireArtifact(
  state: GameState,
  input: AcquireArtifactInput,
  definitions: ArtifactDefinitions,
): AcquireArtifactResult {
  if (state.campaign.artifactIds.includes(input.artifactId)) return { state, event: null };
  const artifact = definitions[input.artifactId];
  const faction = state.factions[input.factionId];
  const army = state.armies[input.armyId];
  if (!artifact || !faction || !army || army.factionId !== input.factionId) return { state, event: null };

  const autoActivate = state.campaign.activeArtifactIds.length < MAX_ACTIVE_ARTIFACTS;
  let nextState: GameState = {
    ...state,
    campaign: {
      ...state.campaign,
      artifactIds: [...state.campaign.artifactIds, artifact.id],
      activeArtifactIds: autoActivate
        ? [...state.campaign.activeArtifactIds, artifact.id]
        : state.campaign.activeArtifactIds,
    },
  };
  if (autoActivate) nextState = activateArtifactTraits(nextState, input.factionId, artifact);

  return {
    state: nextState,
    event: {
      type: 'artifact_acquired',
      artifactId: artifact.id,
      multiplier: getArtifactEffectMultiplier(state, input.factionId),
      activated: autoActivate,
    },
  };
}
