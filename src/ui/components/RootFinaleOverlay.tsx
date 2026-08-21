import type { RootClaimAvailability } from '@/core/campaign/rootObjective';

export function RootFinaleOverlay({
  availability,
  onConfirm,
  onCancel,
}: {
  availability: Extract<RootClaimAvailability, { canClaim: true }>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="event-overlay root-finale-overlay" role="dialog" aria-modal="true" aria-label="Финальная операция у Корня">
      <section className="event-card root-finale-card">
        <header>
          <span className="eyebrow">Финальная операция</span>
          <h2>Корень Живознания</h2>
        </header>
        <p>
          Последний город маршрута удержан, путь за зрительным корнем пройден, Орсия достаточно изучена. За последним сводом находится то,
          ради чего экспедиция действительно спускалась в Орсию.
        </p>
        <div className="root-finale-summary">
          <span>Города: {availability.progress.controlledCities}</span>
          <span>Познание Орсии: {availability.progress.knowledge}/{availability.progress.requiredKnowledge}</span>
          <span>Расход припасов: {availability.supplyCost}</span>
        </div>
        <p className="root-finale-warning">
          Начало операции завершит кампанию. После входа в святилище обычные действия экспедиции больше недоступны.
        </p>
        <div className="event-choice-list root-finale-actions">
          <button type="button" className="event-choice root-confirm" onClick={onConfirm}>
            <strong>Войти и изъять Корень</strong>
            <span>Завершить экспедицию победой.</span>
          </button>
          <button type="button" className="secondary-button" onClick={onCancel}>
            Вернуться к карте
          </button>
        </div>
      </section>
    </div>
  );
}
