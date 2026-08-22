import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

const INTRO_IMAGE = '/assets/intro/orsia-descent.webp';
const SURFACE_HOLD_MS = 2000;
const UNDERGROUND_REVEAL_MS = 1350;
const FINALE_HOLD_MS = 5200;
const SURFACE_CUT_IMAGE_Y = 352;
const INTRO_SCROLL_SPEED_MULTIPLIER = 1.3;

type IntroPhase = 'surface' | 'reveal' | 'scroll' | 'finale';

export function IntroCutscene({ onComplete }: { onComplete: () => void }) {
  const stageRef = useRef<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const phaseTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const [imageReady, setImageReady] = useState(false);
  const [phase, setPhase] = useState<IntroPhase>('surface');
  const [skipVisible, setSkipVisible] = useState(false);
  const [surfaceCutPx, setSurfaceCutPx] = useState<number | null>(null);

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (phaseTimerRef.current !== null) window.clearTimeout(phaseTimerRef.current);
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
    onComplete();
  };


  useEffect(() => {
    if (!imageReady) return undefined;
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return undefined;

    const updateSurfaceCut = () => {
      const stageRect = stage.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const naturalWidth = Math.max(1, image.naturalWidth || 682);
      const renderedScale = imageRect.width / naturalWidth;
      const nextCut = imageRect.top - stageRect.top + SURFACE_CUT_IMAGE_Y * renderedScale;
      setSurfaceCutPx(Math.max(0, nextCut));
    };

    updateSurfaceCut();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSurfaceCut) : null;
    observer?.observe(stage);
    observer?.observe(image);
    window.addEventListener('resize', updateSurfaceCut);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateSurfaceCut);
    };
  }, [imageReady]);

  useEffect(() => {
    if (!imageReady || phase !== 'surface') return;
    phaseTimerRef.current = window.setTimeout(() => setPhase('reveal'), SURFACE_HOLD_MS);
    return () => {
      if (phaseTimerRef.current !== null) window.clearTimeout(phaseTimerRef.current);
    };
  }, [imageReady, phase]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    phaseTimerRef.current = window.setTimeout(() => setPhase('scroll'), UNDERGROUND_REVEAL_MS);
    return () => {
      if (phaseTimerRef.current !== null) window.clearTimeout(phaseTimerRef.current);
    };
  }, [phase]);

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

    // Stage 38: the descent is deliberately brisker than the original cutscene,
    // while still leaving enough time to read the large environmental image.
    const baseDuration = Math.min(19000, Math.max(14000, 11800 + travel * 4));
    const duration = Math.round(baseDuration / INTRO_SCROLL_SPEED_MULTIPLIER);
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
      className={`intro-cutscene is-${phase}`}
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

      <div
        className="intro-underground-cover"
        aria-hidden="true"
        style={surfaceCutPx === null ? undefined : { top: `${surfaceCutPx}px` }}
      />
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
        onPointerUp={(event: PointerEvent<HTMLButtonElement>) => event.stopPropagation()}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          complete();
        }}
      >
        Пропустить заставку
      </button>
    </main>
  );
}
