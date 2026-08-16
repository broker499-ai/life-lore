import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';
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
  if (!artifact || !faction || !army) return { state, event: null };

  const multiplier = getArtifactEffectMultiplier(state, input.factionId);
  let money = faction.resources.money;
  let supplies = faction.resources.supplies;
  let specimens = faction.resources.specimens;
  let morale = army.morale;

  for (const effect of artifact.effects) {
    const amount = Math.round(effect.amount * multiplier);
    if (effect.type === 'money') money += amount;
    if (effect.type === 'supplies') supplies = clamp(supplies + amount, 0, input.supplyCap);
    if (effect.type === 'specimens') specimens = Math.max(0, specimens + amount);
    if (effect.type === 'morale') morale = clamp(morale + amount, 0, input.moraleCap);
  }

  return {
    state: {
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
        artifactIds: [...state.campaign.artifactIds, artifact.id],
      },
    },
    event: { type: 'artifact_acquired', artifactId: artifact.id, multiplier },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
