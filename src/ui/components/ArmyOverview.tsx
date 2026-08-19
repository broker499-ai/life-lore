import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import { getArmySummary } from '@/core/armies/armyStats';
import type { ArmyState } from '@/core/state/GameState';

export function ArmyOverview({
  army,
  unitDefinitions,
}: {
  army: ArmyState;
  unitDefinitions: UnitDefinitions;
}) {
  const summary = getArmySummary(army, unitDefinitions);

  return (
    <section className="army-overview" aria-label="Состав основной армии">
      <div className="army-hero">
        <div>
          <span className="eyebrow">Основная армия</span>
          <h2>Экспедиционный отряд</h2>
          <p>Состав армии теперь влияет на содержание и станет входом для BattleSimulator.</p>
        </div>
        <div className="morale-badge">
          <span>Моральная паника</span>
          <strong>{army.morale}</strong>
        </div>
      </div>

      <div className="army-summary-grid">
        <SummaryStat label="Бойцов" value={summary.totalUnits} />
        <SummaryStat label="Атака" value={summary.totalAttack} />
        <SummaryStat label="Защита" value={summary.totalDefense} />
        <SummaryStat label="Содержание" value={`${formatMoney(summary.upkeep)}/ход`} />
      </div>

      <div className="unit-list">
        {summary.composition.map((row) => {
          const unit = unitDefinitions[row.unitTypeId];
          if (!unit) return null;
          return (
            <article className="unit-card" key={row.unitTypeId}>
              <UnitGlyph role={unit.role} />
              <div className="unit-copy">
                <div className="unit-card-heading">
                  <div>
                    <strong>{unit.name}</strong>
                    <span>{unit.role === 'line' ? 'Линия' : 'Стрелки'}</span>
                  </div>
                  <b>×{row.amount}</b>
                </div>
                <p>{unit.description}</p>
                <div className="unit-stat-row">
                  <span>АТК {unit.attack}</span>
                  <span>ЗАЩ {unit.defense}</span>
                  <span>Сод. {formatMoney(unit.upkeepPerUnit)}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="army-summary-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function UnitGlyph({ role }: { role: 'line' | 'ranged' }) {
  return (
    <div className={`unit-glyph is-${role}`} aria-hidden="true">
      <i className="pixel-head" />
      <i className="pixel-body" />
      <i className="pixel-gear" />
    </div>
  );
}

function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}
