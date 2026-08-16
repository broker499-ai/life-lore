import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';
import { t } from '@/i18n/t';
import type { CampaignSaveStatus } from '@/services/saves/CampaignStorage';

export function MainMenuScreen({
  saveStatus,
  onNewGame,
  onContinue,
}: {
  saveStatus: CampaignSaveStatus;
  onNewGame: () => void;
  onContinue: () => void;
}) {
  const canContinue = saveStatus.kind === 'ready';
  const snapshot = saveStatus.kind === 'ready' ? saveStatus.snapshot : null;
  const leader = snapshot ? prototypeLeaderById[snapshot.state.selectedLeaderId] : null;
  const continueLabel = snapshot?.recoveredFromBackup ? 'Продолжить с резервной копии' : t('menu.continue');

  return (
    <main className="screen menu-screen">
      <div className="brand-block">
        <span className="brand-mark">Ж</span>
        <h1>{t('app.title')}</h1>
        <p>{t('menu.subtitle')}</p>
      </div>

      <div className="menu-actions">
        <button type="button" className="primary-button" onClick={onNewGame}>
          {t('menu.newGame')}
        </button>
        <button type="button" className="secondary-button" disabled={!canContinue} onClick={onContinue}>
          {canContinue ? continueLabel : saveStatus.kind === 'corrupt' ? 'Сохранение повреждено' : t('menu.continueEmpty')}
        </button>
        {snapshot ? (
          <div className={`continue-save-note${snapshot.recoveredFromBackup ? ' is-backup' : ''}`}>
            <strong>Ход {snapshot.state.turn} · {leader?.name ?? 'экспедиция'}</strong>
            <span>
              {snapshot.reason === 'manual' ? 'Ручное сохранение' : 'Автосохранение'} · {formatSaveTime(snapshot.savedAt)}
            </span>
            {snapshot.recoveredFromBackup ? <small>Основной autosave повреждён; найден исправный резерв.</small> : null}
          </div>
        ) : saveStatus.kind === 'corrupt' ? (
          <div className="continue-save-note is-error">
            <small>Основное и резервное сохранения не удалось прочитать. Новую экспедицию можно начать без удаления файлов вручную.</small>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function formatSaveTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'время неизвестно';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
