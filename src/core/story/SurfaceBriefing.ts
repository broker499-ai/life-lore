import type { GameState } from '@/core/state/GameState';

export type SurfaceBriefingCondition = {
  minArtifactCount?: number;
  minControlledCities?: number;
  requiredResolvedEventId?: string;
  manualOnly?: boolean;
};

export type SurfaceBriefingDefinition = {
  id: string;
  eyebrow: string;
  title?: string;
  paragraphs: string[];
  acknowledgeLabel: string;
  condition: SurfaceBriefingCondition;
};

export function triggerAvailableSurfaceBriefing(
  state: GameState,
  definitions: readonly SurfaceBriefingDefinition[],
): GameState {
  if (state.campaign.pendingBriefingId) return state;
  const next = definitions.find(
    (definition) => !definition.condition.manualOnly && !state.campaign.resolvedBriefingIds.includes(definition.id),
  );
  if (!next || !briefingConditionMet(state, next.condition)) return state;
  return {
    ...state,
    campaign: { ...state.campaign, pendingBriefingId: next.id },
  };
}

export function triggerSurfaceBriefingById(
  state: GameState,
  briefingId: string,
  definitions: readonly SurfaceBriefingDefinition[],
): GameState {
  if (state.campaign.pendingBriefingId) return state;
  if (state.campaign.resolvedBriefingIds.includes(briefingId)) return state;
  const definition = definitions.find((item) => item.id === briefingId);
  if (!definition) return state;
  return {
    ...state,
    campaign: { ...state.campaign, pendingBriefingId: briefingId },
  };
}

export function acknowledgeSurfaceBriefing(state: GameState, briefingId: string): GameState {
  if (state.campaign.pendingBriefingId !== briefingId) return state;
  return {
    ...state,
    campaign: {
      ...state.campaign,
      pendingBriefingId: null,
      resolvedBriefingIds: state.campaign.resolvedBriefingIds.includes(briefingId)
        ? state.campaign.resolvedBriefingIds
        : [...state.campaign.resolvedBriefingIds, briefingId],
    },
  };
}

function briefingConditionMet(state: GameState, condition: SurfaceBriefingCondition): boolean {
  if (
    condition.minArtifactCount !== undefined &&
    state.campaign.artifactIds.length < condition.minArtifactCount
  ) return false;

  if (condition.minControlledCities !== undefined) {
    const controlledCities = Object.values(state.cities).filter(
      (city) => city.ownerFactionId === state.playerFactionId,
    ).length;
    if (controlledCities < condition.minControlledCities) return false;
  }

  if (
    condition.requiredResolvedEventId &&
    !state.campaign.resolvedEventIds.includes(condition.requiredResolvedEventId)
  ) return false;

  return true;
}
