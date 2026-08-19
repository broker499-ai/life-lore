import { useEffect, useRef, useState } from 'react';

const INTRO_IMAGE = '/assets/intro/orsia-descent.webp';
const FINALE_HOLD_MS = 5200;

export function IntroCutscene({ onComplete }: { onComplete: () => void }) {
  const stageRef = useRef<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const [imageReady, setImageReady] = useState(false);
  const [phase, setPhase] = useState<'scroll' | 'finale'>('scroll');
  const [skipVisible, setSkipVisible] = useState(false);

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
    onComplete();
  };

  useEffect(() => {
    if (!imageReady || phase !== 'scroll') return;
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const stageHeight = stage.getBoundingClientRect().height;
    const imageHeight = image.getBoundingClientRect().height;
    const travel = Math.max(0, imageHeight - stageHeight);

    if (reduceMotion) {
      image.style.transform = `translate3d(0, -${travel}px, 0)`;
      setPhase('finale');
      return;
    }

    const duration = Math.min(24000, Math.max(17000, 15000 + travel * 5));
    const animation = image.animate(
      [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: `translate3d(0, -${travel}px, 0)` },
      ],
      {
        duration,
        easing: 'linear',
        fill: 'forwards',
      },
    );

    animation.onfinish = () => {
      image.style.transform = `translate3d(0, -${travel}px, 0)`;
      setPhase('finale');
    };
    return () => animation.cancel();
  }, [imageReady, phase]);

  useEffect(() => {
    if (phase !== 'finale') return;
    finishTimerRef.current = window.setTimeout(complete, FINALE_HOLD_MS);
    return () => {
      if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
    };
  }, [phase]);

  const revealSkip = () => {
    if (!skipVisible) setSkipVisible(true);
  };

  return (
    <main
      ref={stageRef}
      className={`intro-cutscene${phase === 'finale' ? ' is-finale' : ''}`}
      aria-label="Вступительная заставка"
      onPointerUp={revealSkip}
    >
      <div className="intro-cutscene-backdrop" aria-hidden="true" />
      <div className="intro-cutscene-visual" aria-hidden="true">
        <img
          ref={imageRef}
          className={`intro-cutscene-image${imageReady ? ' is-ready' : ''}`}
          src={INTRO_IMAGE}
          alt=""
          draggable={false}
          onLoad={() => setImageReady(true)}
          onError={() => setPhase('finale')}
        />
      </div>

      <div className="intro-cutscene-dimmer" aria-hidden="true" />

      <div className="intro-cutscene-copy" aria-live="polite">
        <span className="intro-cutscene-line intro-cutscene-line-one">Корень...</span>
        <span className="intro-cutscene-line intro-cutscene-line-two">Нам нужен Корень Живознания...</span>
      </div>

      <button
        type="button"
        className={`intro-skip-button${skipVisible ? ' is-visible' : ''}`}
        aria-hidden={!skipVisible}
        tabIndex={skipVisible ? 0 : -1}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          complete();
        }}
      >
        Пропустить заставку
      </button>
    </main>
  );
}
