import type { ArtifactDefinition, ArtifactDefinitions, ArtifactEffect } from '@/core/artifacts/ArtifactDefinition';
import type { GameEvent } from '@/core/commands/CommandResult';
import { getArtifactEffectMultiplier } from '@/core/leaders/LeaderAbility';
import type { FactionId, GameState } from '@/core/state/GameState';

export const MAX_ACTIVE_ARTIFACTS = 3;
const ARTIFACT_SOURCE_PREFIX = 'artifact:';

export type ToggleArtifactError =
  | 'artifact_not_owned'
  | 'artifact_not_found'
  | 'faction_not_found'
  | 'army_not_found'
  | 'not_in_controlled_city'
  | 'slots_full';

export function getArtifactTraitSource(artifactId: string): string {
  return `${ARTIFACT_SOURCE_PREFIX}${artifactId}`;
}

export function isArtifactTraitSource(source: string | undefined): boolean {
  return Boolean(source?.startsWith(ARTIFACT_SOURCE_PREFIX));
}

export function scaleArtifactEffect(effect: ArtifactEffect, multiplier: number, artifactId: string): ArtifactEffect {
  const scaled = 1 + (effect.multiplier - 1) * multiplier;
  return { ...effect, multiplier: roundMultiplier(scaled), source: getArtifactTraitSource(artifactId) };
}

export function activateArtifactTraits(
  state: GameState,
  factionId: FactionId,
  artifact: ArtifactDefinition,
): GameState {
  const faction = state.factions[factionId];
  if (!faction) return state;
  const source = getArtifactTraitSource(artifact.id);
  const baseTraits = faction.traits.filter((trait) => trait.source !== source);
  const multiplier = getArtifactEffectMultiplier({
    ...state,
    factions: { ...state.factions, [factionId]: { ...faction, traits: baseTraits } },
  }, factionId);
  return {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: {
        ...faction,
        traits: [...baseTraits, ...artifact.effects.map((effect) => scaleArtifactEffect(effect, multiplier, artifact.id))],
      },
    },
  };
}

export function deactivateArtifactTraits(state: GameState, factionId: FactionId, artifactId: string): GameState {
  const faction = state.factions[factionId];
  if (!faction) return state;
  const source = getArtifactTraitSource(artifactId);
  return {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: { ...faction, traits: faction.traits.filter((trait) => trait.source !== source) },
    },
  };
}

export function rebuildActiveArtifactTraits(
  state: GameState,
  factionId: FactionId,
  definitions: ArtifactDefinitions,
): GameState {
  const faction = state.factions[factionId];
  if (!faction) return state;
  let nextState: GameState = {
    ...state,
    factions: {
      ...state.factions,
      [factionId]: {
        ...faction,
        traits: faction.traits.filter((trait) => !isArtifactTraitSource(trait.source)),
      },
    },
  };
  for (const artifactId of nextState.campaign.activeArtifactIds.slice(0, MAX_ACTIVE_ARTIFACTS)) {
    const artifact = definitions[artifactId];
    if (artifact) nextState = activateArtifactTraits(nextState, factionId, artifact);
  }
  return nextState;
}

export function toggleActiveArtifact(
  state: GameState,
  input: { factionId: FactionId; armyId: string; artifactId: string },
  definitions: ArtifactDefinitions,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; state: GameState; error: ToggleArtifactError } {
  const artifact = definitions[input.artifactId];
  if (!artifact) return { ok: false, state, error: 'artifact_not_found' };
  if (!state.campaign.artifactIds.includes(input.artifactId)) return { ok: false, state, error: 'artifact_not_owned' };
  const faction = state.factions[input.factionId];
  if (!faction) return { ok: false, state, error: 'faction_not_found' };
  const army = state.armies[input.armyId];
  if (!army || army.factionId !== input.factionId) return { ok: false, state, error: 'army_not_found' };
  const city = state.cities[army.nodeId];
  if (!city || city.ownerFactionId !== input.factionId) return { ok: false, state, error: 'not_in_controlled_city' };

  const isActive = state.campaign.activeArtifactIds.includes(input.artifactId);
  if (isActive) {
    const withoutTraits = deactivateArtifactTraits(state, input.factionId, input.artifactId);
    return {
      ok: true,
      state: {
        ...withoutTraits,
        campaign: {
          ...withoutTraits.campaign,
          activeArtifactIds: withoutTraits.campaign.activeArtifactIds.filter((id) => id !== input.artifactId),
        },
      },
      events: [{ type: 'artifact_loadout_changed', artifactId: input.artifactId, active: false }],
    };
  }

  if (state.campaign.activeArtifactIds.length >= MAX_ACTIVE_ARTIFACTS) {
    return { ok: false, state, error: 'slots_full' };
  }
  const withId: GameState = {
    ...state,
    campaign: { ...state.campaign, activeArtifactIds: [...state.campaign.activeArtifactIds, input.artifactId] },
  };
  return {
    ok: true,
    state: activateArtifactTraits(withId, input.factionId, artifact),
    events: [{ type: 'artifact_loadout_changed', artifactId: input.artifactId, active: true }],
  };
}

function roundMultiplier(value: number): number {
  return Math.round(value * 10000) / 10000;
}
