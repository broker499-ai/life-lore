import { useState } from 'react';
import { getArmyTotalUnits } from '@/core/armies/armyStats';
import type { GameState } from '@/core/state/GameState';
import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';
import { t } from '@/i18n/t';
import { MAX_ORSIA_KNOWLEDGE } from '@/data/campaign/knowledgeRules';

export function TopStatusBar({
  state,
  morale = 0,
  supplyLabel = 'Снабжение —',
  leaderStatus = '',
  onSave,
  onExit,
  onToggleDeveloperMode,
  interactionLocked = false,
}: {
  state: GameState;
  morale?: number;
  supplyLabel?: string;
  leaderStatus?: string;
  onSave?: () => void;
  onExit?: () => void;
  onToggleDeveloperMode?: () => void;
  interactionLocked?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const army = state.armies['player-main'];
  const resources = state.factions[state.playerFactionId]?.resources;
  const leader = prototypeLeaderById[state.selectedLeaderId];

  return (
    <header className="top-status campaign-header" aria-label="Состояние экспедиции">
      <div className="campaign-header-main">
        <div className="campaign-header-leader">
          {leader?.portraitSrc ? <img src={leader.portraitSrc} alt="" draggable={false} /> : null}
          <div>
            <strong>{leader?.name ?? 'Экспедиция'}</strong>
            <span>{leaderStatus || `Моральная паника ${morale}`}</span>
          </div>
        </div>
        <div className="campaign-header-actions">
          {state.campaign.developerMode ? <span className="header-dev-chip">DEV ∞</span> : null}
          <span className="header-supply-chip">{supplyLabel}</span>
          {onSave || onExit || onToggleDeveloperMode ? (
            <button
              type="button"
              className={`header-menu-button${menuOpen ? ' is-open' : ''}`}
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-label="Меню кампании"
              disabled={interactionLocked}
            >
              МЕНЮ
            </button>
          ) : null}
        </div>
      </div>

      <div className="campaign-resource-row">
        <StatusItem label={t('campaign.day')} value={state.turn} />
        <StatusItem label={t('campaign.money')} value={state.campaign.developerMode ? '∞' : (resources?.money ?? 0)} tone="money" />
        <StatusItem label={t('campaign.supplies')} value={resources?.supplies ?? 0} />
        <StatusItem label={t('campaign.army')} value={army ? getArmyTotalUnits(army) : 0} tone="army" />
        <StatusItem label={t('campaign.specimens')} value={`${state.factions[state.playerFactionId]?.specimensCollected ?? 0}/${MAX_ORSIA_KNOWLEDGE}`} tone="knowledge" />
      </div>

      {menuOpen ? (
        <div className="campaign-header-menu" role="menu">
          {onToggleDeveloperMode ? (
            <button
              type="button"
              className={state.campaign.developerMode ? 'is-dev-active' : ''}
              onClick={() => { onToggleDeveloperMode(); setMenuOpen(false); }}
              disabled={interactionLocked}
            >
              Режим разработчика: {state.campaign.developerMode ? 'ВКЛ' : 'ВЫКЛ'}
            </button>
          ) : null}
          {onSave ? (
            <button type="button" onClick={() => { onSave(); setMenuOpen(false); }} disabled={interactionLocked}>
              Сохранить
            </button>
          ) : null}
          {onExit ? (
            <button type="button" onClick={onExit} disabled={interactionLocked}>
              {t('campaign.exit')}
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

function StatusItem({ label, value, tone = '' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className={`status-item${tone ? ` is-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{typeof value === 'number' ? formatValue(value) : value}</strong>
    </div>
  );
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
