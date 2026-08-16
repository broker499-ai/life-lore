import type { ResearchCategory, ResearchDefinitions } from '@/core/research/ResearchDefinition';
import type { GameState } from '@/core/state/GameState';

const CATEGORIES: Array<{ id: ResearchCategory; label: string; glyph: string }> = [
  { id: 'flora', label: 'Флора', glyph: '✣' },
  { id: 'fauna', label: 'Фауна', glyph: '◈' },
  { id: 'anomalies', label: 'Аномалии', glyph: '⌁' },
];

export function ResearchOverview({
  state,
  definitions,
  onResearch,
}: {
  state: GameState;
  definitions: ResearchDefinitions;
  onResearch: (researchId: string) => void;
}) {
  const faction = state.factions[state.playerFactionId];
  const specimens = faction?.resources.specimens ?? 0;
  const completed = new Set(state.campaign.completedResearchIds);

  return (
    <section className="research-sheet">
      <header className="research-header">
        <div>
          <span className="eyebrow">Лаборатория экспедиции</span>
          <h2>Исследования образцов</h2>
          <p>Образцы расходуются на постоянные улучшения экспедиции. Исследование не тратит стратегическое действие.</p>
        </div>
        <div className="specimen-counter">
          <span>ОБРАЗЦЫ</span>
          <strong>{specimens}</strong>
        </div>
      </header>

      <div className="research-columns">
        {CATEGORIES.map((category) => {
          const items = Object.values(definitions).filter((item) => item.category === category.id);
          return (
            <section key={category.id} className={`research-category is-${category.id}`}>
              <h3><span>{category.glyph}</span>{category.label}</h3>
              <div className="research-card-list">
                {items.map((research) => {
                  const isCompleted = completed.has(research.id);
                  const missingPrerequisite = research.prerequisiteIds.find((id) => !completed.has(id));
                  const canAfford = specimens >= research.cost;
                  const prerequisiteName = missingPrerequisite ? definitions[missingPrerequisite]?.name ?? missingPrerequisite : null;
                  return (
                    <article key={research.id} className={`research-card${isCompleted ? ' is-completed' : ''}`}>
                      <div className="research-card-title">
                        <strong>{research.name}</strong>
                        <span>{isCompleted ? 'ГОТОВО' : `${research.cost} обр.`}</span>
                      </div>
                      <p>{research.description}</p>
                      <small>{research.effectLabel}</small>
                      {!isCompleted && prerequisiteName ? (
                        <em>Сначала: {prerequisiteName}</em>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-button research-button"
                        disabled={isCompleted || Boolean(missingPrerequisite) || !canAfford}
                        onClick={() => onResearch(research.id)}
                      >
                        {isCompleted ? 'Исследовано' : !canAfford ? `Нужно ${research.cost} образца` : 'Исследовать'}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
