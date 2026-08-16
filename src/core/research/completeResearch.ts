import type { GameEvent } from '@/core/commands/CommandResult';
import type { MapGraph } from '@/core/map/MapGraph';
import { synchronizePlayerMapKnowledge } from '@/core/map/MapVisibility';
import type { ResearchDefinitions } from '@/core/research/ResearchDefinition';
import type { GameState } from '@/core/state/GameState';

export type CompleteResearchError =
  | 'research_not_found'
  | 'faction_not_found'
  | 'already_completed'
  | 'prerequisite_missing'
  | 'insufficient_specimens';

export function completeResearch(
  state: GameState,
  input: { factionId: string; researchId: string },
  definitions: ResearchDefinitions,
  graph: MapGraph,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; state: GameState; error: CompleteResearchError } {
  const definition = definitions[input.researchId];
  if (!definition) return { ok: false, state, error: 'research_not_found' };
  const faction = state.factions[input.factionId];
  if (!faction) return { ok: false, state, error: 'faction_not_found' };
  if (state.campaign.completedResearchIds.includes(definition.id)) {
    return { ok: false, state, error: 'already_completed' };
  }
  if (definition.prerequisiteIds.some((id) => !state.campaign.completedResearchIds.includes(id))) {
    return { ok: false, state, error: 'prerequisite_missing' };
  }
  if (faction.resources.specimens < definition.cost) {
    return { ok: false, state, error: 'insufficient_specimens' };
  }

  const nextState = synchronizePlayerMapKnowledge(
    {
      ...state,
      factions: {
        ...state.factions,
        [faction.id]: {
          ...faction,
          resources: {
            ...faction.resources,
            specimens: faction.resources.specimens - definition.cost,
          },
          traits: [...faction.traits, ...definition.effects.map((effect) => ({ ...effect }))],
        },
      },
      campaign: {
        ...state.campaign,
        completedResearchIds: [...state.campaign.completedResearchIds, definition.id],
      },
    },
    graph,
  );

  return {
    ok: true,
    state: nextState,
    events: [
      {
        type: 'research_completed',
        factionId: faction.id,
        researchId: definition.id,
        specimensSpent: definition.cost,
      },
    ],
  };
}
