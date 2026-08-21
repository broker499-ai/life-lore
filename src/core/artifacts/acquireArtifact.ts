import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';
import { activateArtifactTraits, MAX_ACTIVE_ARTIFACTS } from '@/core/artifacts/artifactLoadout';
import type { GameEvent } from '@/core/commands/CommandResult';
import { getArtifactEffectMultiplier } from '@/core/leaders/LeaderAbility';
import type { ArmyId, FactionId, GameState } from '@/core/state/GameState';
import { ARTIFACT_KNOWLEDGE_GAIN, clampKnowledge } from '@/data/campaign/knowledgeRules';

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
  const knowledgeBefore = Math.max(faction.resources.specimens, faction.specimensCollected);
  const knowledgeAfter = input.factionId === state.playerFactionId
    ? clampKnowledge(knowledgeBefore + ARTIFACT_KNOWLEDGE_GAIN)
    : knowledgeBefore;
  let nextState: GameState = {
    ...state,
    factions: {
      ...state.factions,
      [faction.id]: input.factionId === state.playerFactionId
        ? {
            ...faction,
            resources: { ...faction.resources, specimens: knowledgeAfter },
            specimensCollected: knowledgeAfter,
          }
        : faction,
    },
    campaign: {
      ...state.campaign,
      artifactIds: [...state.campaign.artifactIds, artifact.id],
      activeArtifactIds: autoActivate
        ? [...state.campaign.activeArtifactIds, artifact.id]
        : state.campaign.activeArtifactIds,
    },
  };
  if (input.factionId === state.playerFactionId) nextState = reinforceEnemyCityGarrisons(nextState, artifact.id);
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


function reinforceEnemyCityGarrisons(state: GameState, artifactId: string): GameState {
  const candidates = Object.values(state.cities)
    .filter((city) => city.ownerFactionId && city.ownerFactionId !== state.playerFactionId)
    .filter((city) => !('linhao-singular' in city.garrison.roster))
    .filter((city) => Object.values(city.garrison.roster).some((amount) => (amount ?? 0) > 0))
    .sort((a, b) => stableArtifactCityScore(artifactId, a.id) - stableArtifactCityScore(artifactId, b.id));

  if (candidates.length === 0) return state;
  const reinforceCount = Math.max(1, Math.round(candidates.length * 0.18));
  const selected = new Set(candidates.slice(0, reinforceCount).map((city) => city.id));
  const cities = { ...state.cities };
  for (const cityId of selected) {
    const city = cities[cityId];
    if (!city) continue;
    const rosterEntries = Object.entries(city.garrison.roster)
      .filter(([, amount]) => (amount ?? 0) > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0) || a[0].localeCompare(b[0]));
    const unitTypeId = rosterEntries[0]?.[0];
    if (!unitTypeId) continue;
    cities[cityId] = {
      ...city,
      garrison: {
        ...city.garrison,
        roster: {
          ...city.garrison.roster,
          [unitTypeId]: (city.garrison.roster[unitTypeId] ?? 0) + 1,
        },
      },
    };
  }
  return { ...state, cities };
}

function stableArtifactCityScore(artifactId: string, cityId: string): number {
  const text = `${artifactId}:${cityId}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
