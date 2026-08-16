import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';
import {
  getEventChoiceAvailability,
  type EventChoice,
  type LocationEventDefinition,
} from '@/core/events/LocationEvent';
import { getArtifactEffectMultiplier } from '@/core/leaders/LeaderAbility';
import type { GameState } from '@/core/state/GameState';

export function LocationEventOverlay({
  state,
  event,
  artifacts,
  locationName = null,
  locationDescription = null,
  onChoose,
}: {
  state: GameState;
  event: LocationEventDefinition;
  artifacts: ArtifactDefinitions;
  locationName?: string | null;
  locationDescription?: string | null;
  onChoose: (choiceId: string) => void;
}) {
  const factionId = state.playerFactionId;
  const artifactMultiplier = getArtifactEffectMultiplier(state, factionId);

  return (
    <div className="event-overlay" role="dialog" aria-modal="true" aria-labelledby="event-title">
      <article className="event-card">
        <span className="eyebrow">Событие Орсии</span>
        {locationName || locationDescription ? (
          <section className="event-location-summary" aria-label="Описание места">
            {locationName ? <strong>{locationName}</strong> : null}
            {locationDescription ? <p>{locationDescription}</p> : null}
          </section>
        ) : null}
        <h2 id="event-title">{event.title}</h2>
        <p>{event.description}</p>
        {artifactMultiplier > 1 ? (
          <div className="event-leader-bonus">Владос: эффекты найденных артефактов ×{formatMultiplier(artifactMultiplier)}</div>
        ) : null}
        <div className="event-choice-list">
          {event.choices.map((choice) => {
            const availability = getEventChoiceAvailability(state, choice, factionId);
            return (
              <button
                key={choice.id}
                type="button"
                className="event-choice"
                disabled={!availability.canChoose}
                title={!availability.canChoose ? getUnavailableReason(availability.reason) : ''}
                onClick={() => onChoose(choice.id)}
              >
                <strong>{choice.label}</strong>
                {choice.description ? <span>{choice.description}</span> : null}
                <small>{describeEffects(choice, artifacts)}</small>
              </button>
            );
          })}
        </div>
      </article>
    </div>
  );
}

function describeEffects(choice: EventChoice, artifacts: ArtifactDefinitions): string {
  const parts: string[] = [];
  for (const effect of choice.effects) {
    if (effect.type === 'discover_nodes') {
      parts.push('Открывается продолжение карты');
      continue;
    }
    if (effect.type === 'artifact') {
      const artifact = artifacts[effect.artifactId];
      if (artifact) {
        parts.push(`Артефакт: ${artifact.name} — ${artifact.effectLabel}`);
      }
      continue;
    }
    parts.push(formatEffect(effect.type, effect.amount));
  }
  return parts.join(' · ') || 'Без немедленного эффекта';
}

function formatEffect(type: 'money' | 'supplies' | 'specimens' | 'morale', amount: number): string {
  const sign = amount > 0 ? '+' : '';
  const label = type === 'money' ? 'деньги' : type === 'supplies' ? 'припасы' : type === 'specimens' ? 'образцы' : 'мораль';
  return `${sign}${amount} ${label}`;
}

function getUnavailableReason(reason: 'insufficient_money' | 'insufficient_supplies' | 'insufficient_specimens'): string {
  if (reason === 'insufficient_money') return 'Недостаточно денег.';
  if (reason === 'insufficient_supplies') return 'Недостаточно припасов.';
  return 'Недостаточно образцов.';
}


function formatMultiplier(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}
