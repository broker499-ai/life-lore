import type { GameEvent } from '@/core/commands/CommandResult';
import type { MapGraph } from '@/core/map/MapGraph';
import { synchronizePlayerMapKnowledge } from '@/core/map/MapVisibility';
import type { GameState } from '@/core/state/GameState';

export function resolveFactionDefeatEvent(
  state: GameState,
  eventId: string,
  graph: MapGraph,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; state: GameState; error: string } {
  const pending = state.campaign.pendingFactionEvent;
  if (!pending || pending.eventId !== eventId) {
    return { ok: false, state, error: 'faction_event_not_pending' };
  }

  const cities = Object.fromEntries(
    Object.entries(state.cities).map(([cityId, city]) => [
      cityId,
      city.ownerFactionId === pending.factionId
        ? {
            ...city,
            ownerFactionId: pending.beneficiaryFactionId,
            garrison: { roster: {}, morale: 0 },
          }
        : city,
    ]),
  ) as GameState['cities'];

  const armies = Object.fromEntries(
    Object.entries(state.armies).filter(([, army]) => army.factionId !== pending.factionId),
  ) as GameState['armies'];
  const factions = { ...state.factions };
  delete factions[pending.factionId];

  const transferredCityIds = Object.values(state.cities)
    .filter((city) => city.ownerFactionId === pending.factionId)
    .map((city) => city.id);

  const nextState = synchronizePlayerMapKnowledge(
    {
      ...state,
      factions,
      cities,
      armies,
      campaign: {
        ...state.campaign,
        pendingFactionEvent: null,
        resolvedFactionEventIds: [...state.campaign.resolvedFactionEventIds, eventId],
      },
    },
    graph,
  );

  const events: GameEvent[] = [
    {
      type: 'faction_defeat_event_resolved',
      eventId,
      factionId: pending.factionId,
      beneficiaryFactionId: pending.beneficiaryFactionId,
      transferredCityIds,
    },
  ];
  return { ok: true, state: nextState, events };
}
