import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';
import { acquireArtifact } from '@/core/artifacts/acquireArtifact';
import type { GameEvent } from '@/core/commands/CommandResult';
import type { ArmyId, GameState, NodeId } from '@/core/state/GameState';

export type EventEffect =
  | { type: 'money'; amount: number }
  | { type: 'supplies'; amount: number }
  | { type: 'specimens'; amount: number }
  | { type: 'morale'; amount: number }
  | { type: 'artifact'; artifactId: string }
  | { type: 'discover_nodes'; nodeIds: NodeId[] };

export type EventChoice = {
  id: string;
  label: string;
  description?: string;
  effects: EventEffect[];
};

export type LocationEventDefinition = {
  id: string;
  nodeId: NodeId;
  title: string;
  description: string;
  choices: EventChoice[];
};

export type LocationEventDefinitions = Record<string, LocationEventDefinition>;

export type ResolveLocationEventInput = {
  eventId: string;
  choiceId: string;
  factionId: string;
  armyId: ArmyId;
  supplyCap: number;
  moraleCap: number;
};

export type EventChoiceAvailability =
  | { canChoose: true }
  | { canChoose: false; reason: 'insufficient_money' | 'insufficient_supplies' | 'insufficient_specimens' };

export function triggerLocationEvent(
  state: GameState,
  nodeId: NodeId,
  definitions: LocationEventDefinitions,
): { state: GameState; events: GameEvent[] } {
  if (state.campaign.pendingEventId) return { state, events: [] };
  const definition = Object.values(definitions).find((event) => event.nodeId === nodeId);
  if (!definition || state.campaign.resolvedEventIds.includes(definition.id)) {
    return { state, events: [] };
  }

  return {
    state: {
      ...state,
      campaign: { ...state.campaign, pendingEventId: definition.id },
    },
    events: [{ type: 'location_event_triggered', eventId: definition.id, nodeId }],
  };
}

export function getEventChoiceAvailability(
  state: GameState,
  choice: EventChoice,
  factionId: string,
): EventChoiceAvailability {
  const faction = state.factions[factionId];
  if (!faction) return { canChoose: false, reason: 'insufficient_money' };
  const moneyDelta = sumEffects(choice.effects, 'money');
  const suppliesDelta = sumEffects(choice.effects, 'supplies');
  const specimenDelta = choice.effects.reduce((sum, effect) => sum + (effect.type === 'specimens' ? effect.amount : 0), 0);
  if (faction.resources.money + moneyDelta < 0) return { canChoose: false, reason: 'insufficient_money' };
  if (faction.resources.supplies + suppliesDelta < 0) return { canChoose: false, reason: 'insufficient_supplies' };
  if (faction.resources.specimens + specimenDelta < 0) return { canChoose: false, reason: 'insufficient_specimens' };
  return { canChoose: true };
}

export function resolveLocationEvent(
  state: GameState,
  input: ResolveLocationEventInput,
  definitions: LocationEventDefinitions,
  artifacts: ArtifactDefinitions,
): { ok: true; state: GameState; events: GameEvent[] } | { ok: false; state: GameState; error: string } {
  if (state.campaign.pendingEventId !== input.eventId) {
    return { ok: false, state, error: 'event_not_pending' };
  }
  const definition = definitions[input.eventId];
  if (!definition) return { ok: false, state, error: 'event_not_found' };
  const choice = definition.choices.find((item) => item.id === input.choiceId);
  if (!choice) return { ok: false, state, error: 'choice_not_found' };
  const availability = getEventChoiceAvailability(state, choice, input.factionId);
  if (!availability.canChoose) return { ok: false, state, error: availability.reason };

  const faction = state.factions[input.factionId];
  const army = state.armies[input.armyId];
  if (!faction || !army) return { ok: false, state, error: 'actor_not_found' };

  let nextState = state;
  let money = faction.resources.money;
  let supplies = faction.resources.supplies;
  let specimens = faction.resources.specimens;
  let specimensCollected = faction.specimensCollected;
  let morale = army.morale;
  const discoveredNodes = new Set(state.campaign.discoveredNodeIds);
  const emitted: GameEvent[] = [];

  for (const effect of choice.effects) {
    if (effect.type === 'money') money += effect.amount;
    if (effect.type === 'supplies') supplies = clamp(supplies + effect.amount, 0, input.supplyCap);
    if (effect.type === 'specimens') {
      specimens = Math.max(0, specimens + effect.amount);
      if (effect.amount > 0) specimensCollected += effect.amount;
    }
    if (effect.type === 'morale') morale = clamp(morale + effect.amount, 0, input.moraleCap);
    if (effect.type === 'discover_nodes') {
      for (const nodeId of effect.nodeIds) discoveredNodes.add(nodeId);
    }
  }

  nextState = {
    ...nextState,
    factions: {
      ...nextState.factions,
      [faction.id]: {
        ...faction,
        resources: { money, supplies, specimens },
        specimensCollected,
      },
    },
    armies: { ...nextState.armies, [army.id]: { ...army, morale } },
    campaign: {
      ...nextState.campaign,
      pendingEventId: null,
      resolvedEventIds: [...nextState.campaign.resolvedEventIds, definition.id],
      discoveredNodeIds: [...discoveredNodes],
    },
  };

  for (const effect of choice.effects) {
    if (effect.type !== 'artifact') continue;
    const acquired = acquireArtifact(nextState, {
      artifactId: effect.artifactId,
      factionId: input.factionId,
      armyId: input.armyId,
      supplyCap: input.supplyCap,
      moraleCap: input.moraleCap,
    }, artifacts);
    nextState = acquired.state;
    if (acquired.event) emitted.push(acquired.event);
  }

  return {
    ok: true,
    state: nextState,
    events: [...emitted, { type: 'location_event_resolved', eventId: definition.id, choiceId: choice.id }],
  };
}

function sumEffects(effects: EventEffect[], type: 'money' | 'supplies'): number {
  return effects.reduce((sum, effect) => sum + (effect.type === type ? effect.amount : 0), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
