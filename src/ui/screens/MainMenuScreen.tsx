import { t } from '@/i18n/t';

export function MainMenuScreen({ onNewGame }: { onNewGame: () => void }) {
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
        <button type="button" className="secondary-button" disabled>
          {t('menu.continueDisabled')}
        </button>
      </div>
    </main>
  );
}
