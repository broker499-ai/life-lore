import { getRosterTotalUnits } from '@/core/armies/armyStats';
import { getMapNodeVisibilityById } from '@/core/map/MapVisibility';
import type { GameState } from '@/core/state/GameState';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { getEffectiveCityTaxIncome } from '@/core/cities/cityTraits';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';
import { rivalExpeditionById } from '@/data/factions/rivalExpeditions';
import { prototypeMap } from '@/data/map/prototypeMap';
import { t } from '@/i18n/t';
import type { TranslationKey } from '@/i18n/ru';

export function CitiesOverview({ state, rivalFactionId }: { state: GameState; rivalFactionId: string }) {
  const visibilityById = getMapNodeVisibilityById(state, prototypeMap, state.playerFactionId);
  const rows = prototypeMap.nodes
    .filter((node) => node.kind === 'city' && visibilityById[node.id] !== 'unknown')
    .map((node) => {
      const visibility = visibilityById[node.id];
      const city = state.cities[node.id];
      const definition = prototypeCities[node.id];
      const hasCurrentIntel = visibility === 'visible';
      return {
        id: node.id,
        name: t(node.nameKey as TranslationKey),
        visibility,
        ownerFactionId: hasCurrentIntel ? city?.ownerFactionId ?? null : undefined,
        tax: definition ? getEffectiveCityTaxIncome(definition) * (hasCurrentIntel ? city?.incomeMultiplier ?? 1 : 1) : 0,
        specialName: definition?.special.name ?? '',
        garrison: hasCurrentIntel && city ? getRosterTotalUnits(city.garrison.roster) : null,
      };
    });

  const playerCities = Object.values(state.cities).filter((city) => city.ownerFactionId === state.playerFactionId).length;
  const playerIncome = Object.values(state.cities)
    .filter((city) => city.ownerFactionId === state.playerFactionId)
    .reduce((sum, city) => {
      const definition = prototypeCities[city.id];
      return sum + (definition ? getEffectiveCityTaxIncome(definition) * (city.incomeMultiplier ?? 1) : 0);
    }, 0);

  return (
    <section className="cities-overview" aria-label="Ведомость городов Орсии">
      <header className="ledger-heading">
        <div>
          <span className="eyebrow">Ведомость владений</span>
          <h2>Города Орсии</h2>
        </div>
        <div className="ledger-summary">
          <span>Ваших городов</span>
          <strong>{playerCities}</strong>
          <small>+{formatMoney(playerIncome)}/ход · разведано {rows.length}</small>
        </div>
      </header>

      <div className="city-ledger-head" aria-hidden="true">
        <span>ГОРОД</span>
        <span>НАЛОГ</span>
        <span>ГАРН.</span>
        <span>СТОРОНА</span>
      </div>

      <div className="city-ledger-list">
        {rows.map((row) => {
          const owner = row.visibility === 'explored'
            ? { label: 'Нет свежих данных', className: 'is-fog-memory' }
            : getOwnerLabel(
                row.ownerFactionId ?? null,
                state.playerFactionId,
                rivalFactionId,
                rivalExpeditionById[state.campaign.rivalOrganizationId]?.shortName ?? 'Конкуренты',
              );
          return (
            <article className={`city-ledger-row ${owner.className}`} key={row.id}>
              <div className="city-ledger-name"><strong>{row.name}</strong><small>{row.specialName}</small></div>
              <span className="city-ledger-tax">{formatMoney(row.tax)}</span>
              <span>{row.garrison === null ? '—' : row.garrison}</span>
              <span className="city-ledger-owner">{owner.label}</span>
            </article>
          );
        })}
      </div>

      <p className="ledger-note">Разведанные, но не наблюдаемые сейчас города сохраняются в журнале без актуальных данных о гарнизоне и владельце.</p>
    </section>
  );
}

function getOwnerLabel(
  ownerFactionId: string | null,
  playerFactionId: string,
  rivalFactionId: string,
  rivalName: string,
) {
  if (ownerFactionId === playerFactionId) return { label: 'Экспедиция', className: 'is-player' };
  if (ownerFactionId === rivalFactionId) return { label: rivalName, className: 'is-rival' };
  if (!ownerFactionId) return { label: 'Нейтральный', className: 'is-neutral' };
  const orsiaOwner = orsiaSubfactionById[ownerFactionId];
  if (orsiaOwner) return { label: orsiaOwner.name, className: `is-orsia ${orsiaOwner.mapClass}` };
  return { label: ownerFactionId, className: 'is-neutral' };
}

function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}
