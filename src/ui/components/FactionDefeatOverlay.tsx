import type { FactionDefeatEventDefinition } from '@/data/factions/factionDefeatEvents';
import type { OrsiaSubfactionDefinition } from '@/data/factions/orsiaSubfactions';

export function FactionDefeatOverlay({
  event,
  faction,
  onAcknowledge,
}: {
  event: FactionDefeatEventDefinition;
  faction: OrsiaSubfactionDefinition;
  onAcknowledge: () => void;
}) {
  return (
    <div className="event-overlay faction-defeat-overlay" role="dialog" aria-modal="true" aria-labelledby="faction-defeat-title">
      <section className="event-card faction-defeat-card">
        <div className="faction-defeat-heading">
          <div className="faction-defeat-portrait">
            <img src={faction.portraitSrc} alt="" />
          </div>
          <div>
            <span className="eyebrow">Первое поражение · {faction.name}</span>
            <h2 id="faction-defeat-title">{event.title}</h2>
            <strong>{faction.leaderName}</strong>
          </div>
        </div>
        <p>{event.description}</p>
        <div className="faction-defeat-consequence">
          Фракция прекращает существование. Все оставшиеся города переходят под контроль экспедиции; гарнизоны распускаются.
        </div>
        <button type="button" className="primary-button faction-defeat-button" onClick={onAcknowledge}>
          {event.acknowledgeLabel}
        </button>
      </section>
    </div>
  );
}
