import type { ReactNode } from 'react';
import type { SurfaceBriefingDefinition } from '@/core/story/SurfaceBriefing';

export function SurfaceBriefingOverlay({
  briefing,
  onAcknowledge,
}: {
  briefing: SurfaceBriefingDefinition;
  onAcknowledge: () => void;
}) {
  return (
    <div
      className="event-overlay surface-briefing-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={briefing.title ?? briefing.eyebrow}
    >
      <section className="event-card surface-briefing-card">
        <span className="eyebrow">{briefing.eyebrow}</span>
        {briefing.title ? <h2>{briefing.title}</h2> : null}
        <div className="surface-briefing-copy">
          {briefing.paragraphs.map((paragraph) => (
            <p key={paragraph}>{renderStrongMarkup(paragraph)}</p>
          ))}
        </div>
        <button type="button" className="primary-button surface-briefing-button" onClick={onAcknowledge}>
          {briefing.acknowledgeLabel}
        </button>
      </section>
    </div>
  );
}

function renderStrongMarkup(text: string): ReactNode[] {
  const chunks = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return chunks.map((chunk, index) =>
    chunk.startsWith('**') && chunk.endsWith('**')
      ? <strong key={`${chunk}-${index}`}>{chunk.slice(2, -2)}</strong>
      : <span key={`${chunk}-${index}`}>{chunk}</span>,
  );
}
