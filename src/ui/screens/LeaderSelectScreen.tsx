import { useState } from 'react';
import { prototypeLeaders } from '@/data/leaders/prototypeLeader';
import { t } from '@/i18n/t';

export function LeaderSelectScreen({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (leaderId: string) => void;
}) {
  const [selectedLeaderId, setSelectedLeaderId] = useState(prototypeLeaders[0].id);

  return (
    <main className="screen leader-screen">
      <div className="screen-heading">
        <button type="button" className="text-button" onClick={onBack}>
          ← {t('common.back')}
        </button>
        <div>
          <h1>{t('leader.title')}</h1>
          <p>Лидер задаёт постоянную особенность всей экспедиции.</p>
        </div>
      </div>

      <div className="leader-list" role="radiogroup" aria-label="Руководитель экспедиции">
        {prototypeLeaders.map((leader) => {
          const selected = leader.id === selectedLeaderId;
          return (
            <button
              type="button"
              key={leader.id}
              role="radio"
              aria-checked={selected}
              className={`leader-card leader-choice${selected ? ' is-selected' : ''}`}
              onClick={() => setSelectedLeaderId(leader.id)}
            >
              <div className="portrait-placeholder leader-portrait-shell" aria-hidden="true">
                <img
                  className="leader-portrait-image"
                  src={leader.portraitSrc}
                  alt=""
                  draggable={false}
                />
              </div>
              <div className="leader-choice-copy">
                <h2>{leader.name}</h2>
                <strong>{leader.abilityName}</strong>
                <p>{leader.abilityDescription}</p>
              </div>
            </button>
          );
        })}
      </div>

      <button type="button" className="primary-button leader-start-button" onClick={() => onStart(selectedLeaderId)}>
        {t('leader.start')}
      </button>
    </main>
  );
}
