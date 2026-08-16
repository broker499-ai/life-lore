import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';

export function ArtifactInventory({
  artifactIds,
  definitions,
}: {
  artifactIds: string[];
  definitions: ArtifactDefinitions;
}) {
  return (
    <section className="artifact-inventory" aria-label="Артефакты экспедиции">
      <div className="artifact-inventory-heading">
        <div>
          <span className="eyebrow">Находки экспедиции</span>
          <h3>Артефакты · {artifactIds.length}</h3>
        </div>
      </div>
      {artifactIds.length === 0 ? (
        <p className="artifact-empty">Пока ничего подозрительно ценного. Исследуйте точки интереса Орсии.</p>
      ) : (
        <div className="artifact-list">
          {artifactIds.map((artifactId) => {
            const artifact = definitions[artifactId];
            if (!artifact) return null;
            return (
              <article className="artifact-card" key={artifactId}>
                <span className="artifact-glyph" aria-hidden="true">◆</span>
                <div>
                  <strong>{artifact.name}</strong>
                  <p>{artifact.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
