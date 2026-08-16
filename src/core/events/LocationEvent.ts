import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';
import type { GameEvent } from '@/core/commands/CommandResult';
import { getArtifactEffectMultiplier } from '@/core/leaders/LeaderAbility';
import type { ArmyId, GameState, NodeId } from '@/core/state/GameState';

export type EventEffect =
  | { type: 'money'; amount: number }
  | { type: 'supplies'; amount: number }
  | { type: 'specimens'; amount: number }
  | { type: 'morale'; amount: number }
  | { type: 'artifact'; artifactId: string };

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
  | { canChoose: false; reason: 'insufficient_money' | 'insufficient_supplies' };

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
  if (faction.resources.money + moneyDelta < 0) return { canChoose: false, reason: 'insufficient_money' };
  if (faction.resources.supplies + suppliesDelta < 0) return { canChoose: false, reason: 'insufficient_supplies' };
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

  let money = faction.resources.money;
  let supplies = faction.resources.supplies;
  let specimens = faction.resources.specimens;
  let morale = army.morale;
  const artifactIds = [...state.campaign.artifactIds];
  const emitted: GameEvent[] = [];

  for (const effect of choice.effects) {
    if (effect.type === 'money') money += effect.amount;
    if (effect.type === 'supplies') supplies = clamp(supplies + effect.amount, 0, input.supplyCap);
    if (effect.type === 'specimens') specimens = Math.max(0, specimens + effect.amount);
    if (effect.type === 'morale') morale = clamp(morale + effect.amount, 0, input.moraleCap);
    if (effect.type === 'artifact') {
      if (artifactIds.includes(effect.artifactId)) continue;
      const artifact = artifacts[effect.artifactId];
      if (!artifact) continue;
      artifactIds.push(effect.artifactId);
      const multiplier = getArtifactEffectMultiplier(state, input.factionId);
      for (const artifactEffect of artifact.effects) {
        const amount = scaleArtifactAmount(artifactEffect.amount, multiplier);
        if (artifactEffect.type === 'money') money += amount;
        if (artifactEffect.type === 'supplies') supplies = clamp(supplies + amount, 0, input.supplyCap);
        if (artifactEffect.type === 'specimens') specimens = Math.max(0, specimens + amount);
        if (artifactEffect.type === 'morale') morale = clamp(morale + amount, 0, input.moraleCap);
      }
      emitted.push({ type: 'artifact_acquired', artifactId: artifact.id, multiplier });
    }
  }

  const nextState: GameState = {
    ...state,
    factions: {
      ...state.factions,
      [faction.id]: {
        ...faction,
        resources: { money, supplies, specimens },
      },
    },
    armies: {
      ...state.armies,
      [army.id]: { ...army, morale },
    },
    campaign: {
      ...state.campaign,
      pendingEventId: null,
      resolvedEventIds: [...state.campaign.resolvedEventIds, definition.id],
      artifactIds,
    },
  };

  return {
    ok: true,
    state: nextState,
    events: [
      ...emitted,
      { type: 'location_event_resolved', eventId: definition.id, choiceId: choice.id },
    ],
  };
}

function sumEffects(effects: EventEffect[], type: 'money' | 'supplies'): number {
  return effects.reduce((sum, effect) => sum + (effect.type === type ? effect.amount : 0), 0);
}

function scaleArtifactAmount(amount: number, multiplier: number): number {
  return Math.round(amount * multiplier);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
