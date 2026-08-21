import { MAX_ACTIVE_ARTIFACTS } from '@/core/artifacts/artifactLoadout';
import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';

export function ArtifactInventory({
  artifactIds,
  activeArtifactIds,
  definitions,
  canManage,
  onToggle,
}: {
  artifactIds: string[];
  activeArtifactIds: string[];
  definitions: ArtifactDefinitions;
  canManage: boolean;
  onToggle: (artifactId: string) => void;
}) {
  const active = new Set(activeArtifactIds);
  const slotsFull = activeArtifactIds.length >= MAX_ACTIVE_ARTIFACTS;

  return (
    <section className="artifact-inventory" aria-label="Артефакты экспедиции">
      <div className="artifact-inventory-heading">
        <div>
          <span className="eyebrow">Находки экспедиции</span>
          <h3>Артефакты · {artifactIds.length}</h3>
          <p className="artifact-loadout-note">
            Активно {activeArtifactIds.length}/{MAX_ACTIVE_ARTIFACTS}. Менять комплект можно бесплатно в своём городе. Каждый новый артефакт слегка усиливает часть вражеских городских гарнизонов.
          </p>
        </div>
      </div>
      {artifactIds.length === 0 ? (
        <p className="artifact-empty">Пока ничего подозрительно ценного. Исследуйте точки интереса Орсии.</p>
      ) : (
        <div className="artifact-list">
          {artifactIds.map((artifactId) => {
            const artifact = definitions[artifactId];
            if (!artifact) return null;
            const isActive = active.has(artifactId);
            return (
              <article className={`artifact-card${isActive ? ' is-active' : ''}`} key={artifactId}>
                <span className="artifact-glyph" aria-hidden="true">◆</span>
                <div className="artifact-card-copy">
                  <div className="artifact-card-title">
                    <strong>{artifact.name}</strong>
                    <span>{artifact.rarity === 'rare' ? 'РЕДКИЙ' : 'СТАРЫЙ ТРОФЕЙ'}</span>
                  </div>
                  <p>{artifact.description}</p>
                  <small className="artifact-effect">{artifact.effectLabel}</small>
                  <button
                    type="button"
                    className={isActive ? 'secondary-button artifact-toggle is-active' : 'secondary-button artifact-toggle'}
                    disabled={!canManage || (!isActive && slotsFull)}
                    onClick={() => onToggle(artifactId)}
                  >
                    {isActive ? 'Снять' : slotsFull ? 'Нет свободного слота' : 'Активировать'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {!canManage && artifactIds.length > 0 ? (
        <p className="artifact-empty">Для смены активных артефактов вернитесь в контролируемый город.</p>
      ) : null}
    </section>
  );
}
