import { getArmyTotalUnits } from '@/core/armies/armyStats';
import type { GameState } from '@/core/state/GameState';
import { t } from '@/i18n/t';

export function TopStatusBar({ state }: { state: GameState }) {
  const army = state.armies['player-main'];
  const resources = state.factions[state.playerFactionId]?.resources;

  return (
    <header className="top-status" aria-label="Состояние экспедиции">
      <StatusItem label={t('campaign.day')} value={state.turn} />
      <StatusItem label={t('campaign.money')} value={resources?.money ?? 0} />
      <StatusItem label={t('campaign.supplies')} value={resources?.supplies ?? 0} />
      <StatusItem label={t('campaign.army')} value={army ? getArmyTotalUnits(army) : 0} />
      <StatusItem label={t('campaign.specimens')} value={resources?.specimens ?? 0} />
    </header>
  );
}

function StatusItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="status-item">
      <span>{label}</span>
      <strong>{formatValue(value)}</strong>
    </div>
  );
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
