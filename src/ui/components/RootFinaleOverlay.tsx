import { useEffect, useRef, useState } from 'react';
import type { RootClaimAvailability } from '@/core/campaign/rootObjective';

export type RootFinaleChoice = 'merge' | 'deliver';

type FinaleScene = 'tree' | 'hands' | 'cafe';

const TREE_CAPTION_DELAY_MS = 1000;
const HANDS_TRANSITION_DELAY_MS = 3900;
const CHOICE_REVEAL_DELAY_MS = 4750;
const CAFE_CAPTION_DELAY_MS = 2000;
const FINALIZE_FADE_MS = 520;

export function RootFinaleOverlay({
  availability,
  maxKnowledge,
  onChoose,
}: {
  availability: Extract<RootClaimAvailability, { canClaim: true }>;
  maxKnowledge: number;
  onChoose: (choice: RootFinaleChoice) => void;
}) {
  const [scene, setScene] = useState<FinaleScene>('tree');
  const [treeCaptionVisible, setTreeCaptionVisible] = useState(false);
  const [choiceVisible, setChoiceVisible] = useState(false);
  const [cafeCaptionVisible, setCafeCaptionVisible] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const schedule = (callback: () => void, delayMs: number) => {
      const id = window.setTimeout(callback, delayMs);
      timersRef.current.push(id);
    };

    schedule(() => setTreeCaptionVisible(true), TREE_CAPTION_DELAY_MS);
    schedule(() => {
      setScene('hands');
      setTreeCaptionVisible(false);
    }, HANDS_TRANSITION_DELAY_MS);
    schedule(() => setChoiceVisible(true), CHOICE_REVEAL_DELAY_MS);

    return () => {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    };
  }, []);

  const hasMaximumKnowledge = availability.progress.knowledge >= maxKnowledge;

  function finish(choice: RootFinaleChoice) {
    if (finalizing) return;
    setFinalizing(true);
    const id = window.setTimeout(() => onChoose(choice), FINALIZE_FADE_MS);
    timersRef.current.push(id);
  }

  function handleDeliver() {
    if (!hasMaximumKnowledge || finalizing) return;
    setChoiceVisible(false);
    setScene('cafe');
    const id = window.setTimeout(() => setCafeCaptionVisible(true), CAFE_CAPTION_DELAY_MS);
    timersRef.current.push(id);
  }

  return (
    <div
      className={`root-finale-cinematic${finalizing ? ' is-finalizing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Финальная встреча с Корнем Живознания"
    >
      <div className="root-finale-image-stack" aria-hidden="true">
        <img
          src="/assets/finale/root-tree.png"
          className={`root-finale-image${scene === 'tree' ? ' is-active' : ''}`}
          alt=""
          draggable={false}
        />
        <img
          src="/assets/finale/root-in-hands.png"
          className={`root-finale-image${scene === 'hands' ? ' is-active' : ''}`}
          alt=""
          draggable={false}
        />
        <img
          src="/assets/finale/root-cafe.png"
          className={`root-finale-image${scene === 'cafe' ? ' is-active' : ''}`}
          alt=""
          draggable={false}
        />
        <div className="root-finale-vignette" />
      </div>

      <div className={`root-finale-intro-caption${treeCaptionVisible ? ' is-visible' : ''}`} aria-live="polite">
        Наконец-то... Живознание здесь...
      </div>

      <section className={`root-finale-choice-card${choiceVisible ? ' is-visible' : ''}`} aria-hidden={!choiceVisible}>
        <span className="eyebrow">Финальная операция</span>
        <p className="root-finale-monologue">
          Мы прошли весь этот путь... Но ради чего? Отдать его им? Но он взывает ко мне... Он... признает меня... Я чувствую его мощь — этой мощи достаточно, чтобы изменить весь мир.
        </p>
        <div className="event-choice-list root-finale-actions">
          <button type="button" className="event-choice root-final-choice" disabled={finalizing} onClick={() => finish('merge')}>
            <strong>1. Принять Корень</strong>
            <span>Ваш путь как человека подошел к логическому завершению. Вы решаете слиться с силой Корня. Но кто будет лицом, принимающим решения...</span>
          </button>
          <button
            type="button"
            className="event-choice root-final-choice"
            disabled={!hasMaximumKnowledge || finalizing}
            onClick={handleDeliver}
          >
            <strong>2. Положить Корень в судочек и вернуться домой</strong>
            <span>Вы избегаете искушения и честно выполняете задание. «Отлично» за практику в этом семестре Вам гарантировано.</span>
            <em className={hasMaximumKnowledge ? 'is-ready' : ''}>
              {hasMaximumKnowledge
                ? `Максимальное Познание достигнуто: ${availability.progress.knowledge}/${maxKnowledge}`
                : `Требуется максимальное Познание: ${availability.progress.knowledge}/${maxKnowledge}`}
            </em>
          </button>
        </div>
      </section>

      <section className={`root-cafe-ending${scene === 'cafe' && cafeCaptionVisible ? ' is-visible' : ''}`} aria-hidden={scene !== 'cafe' || !cafeCaptionVisible}>
        <p>Корень кафе вновь открывает свои двери и предлагает посетителям новое летнее меню! Обязательно попробуйте!</p>
        <button type="button" className="primary-button" disabled={finalizing} onClick={() => finish('deliver')}>
          Завершить экспедицию
        </button>
      </section>
    </div>
  );
}
