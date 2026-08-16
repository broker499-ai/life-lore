import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { BattleSideId, BattleTacticId } from '@/core/battles/BattleTypes';
import {
  getBattleFormationDots,
  getLanePressureShift,
  type BattleFormationDot,
  type BattleLane,
} from '@/core/battles/presentation/BattleFormation';
import {
  advanceBattleElapsedMs,
  buildBattlePlaybackTrack,
  getBattleFrameTimeMs,
  getPreviousBattleFrameIndex,
  sampleBattlePlayback,
  type BattlePlaybackSpeed,
} from '@/core/battles/presentation/BattlePlayback';
import {
  buildBattlePresentation,
  type BattlePresentationFrame,
  type BattlePresentationPhase,
  type BattlePresentationSide,
} from '@/core/battles/presentation/BattlePresentation';
import { prototypeUnits } from '@/data/units/prototypeUnits';
import type { BattleReport } from '@/ui/battles/BattleReport';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';

const PLAYBACK_SPEEDS: BattlePlaybackSpeed[] = [1, 2, 4];
const MAX_RAF_DELTA_MS = 64;

export function BattleViewer({
  report,
  cityName,
  onClose,
}: {
  report: BattleReport;
  cityName: string;
  onClose: () => void;
}) {
  const presentation = useMemo(() => buildBattlePresentation(report.result), [report.result]);
  const track = useMemo(() => buildBattlePlaybackTrack(presentation.frames), [presentation.frames]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speed, setSpeed] = useState<BattlePlaybackSpeed>(1);
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());
  const lastRafTimeRef = useRef<number | null>(null);

  const sample = useMemo(
    () => sampleBattlePlayback(presentation.frames, track, elapsedMs),
    [elapsedMs, presentation.frames, track],
  );

  const fromFrame = presentation.frames[sample.fromIndex] ?? presentation.frames[0];
  const toFrame = presentation.frames[sample.toIndex] ?? fromFrame;
  const eventFrame = chooseEventFrame(fromFrame, toFrame, sample.progress);
  const isLast = track.durationMs <= 0 || elapsedMs >= track.durationMs - 0.5;
  const displayedFrameIndex = eventFrame?.index ?? 0;

  useEffect(() => {
    if (!isPlaying || isLast) {
      lastRafTimeRef.current = null;
      return undefined;
    }

    let animationFrameId = 0;

    const tick = (timestamp: number) => {
      const previous = lastRafTimeRef.current ?? timestamp;
      const realDeltaMs = Math.min(MAX_RAF_DELTA_MS, Math.max(0, timestamp - previous));
      lastRafTimeRef.current = timestamp;
      setElapsedMs((current) => advanceBattleElapsedMs(current, realDeltaMs, speed, track.durationMs));
      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isLast, isPlaying, speed, track.durationMs]);

  useEffect(() => {
    if (isLast && isPlaying) setIsPlaying(false);
  }, [isLast, isPlaying]);

  if (!fromFrame || !toFrame || !eventFrame) return null;

  const sideA = interpolateSide(fromFrame.sides.A, toFrame.sides.A, sample.easedProgress);
  const sideB = interpolateSide(fromFrame.sides.B, toFrame.sides.B, sample.easedProgress);

  function togglePlayback() {
    if (isLast) {
      setElapsedMs(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((current) => !current);
  }

  function handlePrevious() {
    setIsPlaying(false);
    const baseIndex = sample.progress <= 0.08 ? sample.fromIndex : sample.toIndex;
    const targetIndex = getPreviousBattleFrameIndex(baseIndex, presentation.frames.length);
    setElapsedMs(getBattleFrameTimeMs(track, targetIndex));
  }

  function handleNext() {
    setIsPlaying(false);
    const targetIndex = Math.min(presentation.frames.length - 1, Math.max(sample.fromIndex + 1, sample.toIndex));
    setElapsedMs(getBattleFrameTimeMs(track, targetIndex));
  }

  function handleScrub(event: ChangeEvent<HTMLInputElement>) {
    setIsPlaying(false);
    setElapsedMs(Number(event.target.value));
  }

  function handleSkip() {
    setIsPlaying(false);
    setElapsedMs(track.durationMs);
  }

  return (
    <section className="battle-viewer" aria-label={`Бой за ${cityName}`}>
      <header className="battle-viewer-header">
        <div>
          <span className="eyebrow">{presentation.scale === 'battle' ? 'Крупная битва' : 'Стычка'}</span>
          <h2>{cityName}</h2>
        </div>
        <button type="button" className="text-button" onClick={onClose}>
          К карте
        </button>
      </header>

      <div className="battle-scoreboard">
        <SideScore side="A" snapshot={sideA} tactic={report.attackerTactic} />
        <div className="battle-clock">
          <strong>{formatBattleTime(sample.battleTime)}</strong>
          <span>{eventFrame.round > 0 ? `Раунд ${eventFrame.round}` : 'До боя'}</span>
        </div>
        <SideScore side="B" snapshot={sideB} tactic={report.defenderTactic} />
      </div>

      <BattlePitch
        fromFrame={fromFrame}
        toFrame={toFrame}
        eventFrame={eventFrame}
        progress={sample.progress}
        easedProgress={sample.easedProgress}
        battleTime={sample.battleTime}
        winnerSide={presentation.winnerSide}
        attackerTactic={report.attackerTactic}
        defenderTactic={report.defenderTactic}
      />

      <div className="battle-commentary" aria-live="polite">
        <span className="battle-phase-label">{getPhaseLabel(eventFrame.phase)}</span>
        <strong>{eventFrame.title}</strong>
        <p>{eventFrame.detail}</p>
      </div>

      <div className="battle-scrubber">
        <input
          aria-label="Ход боя"
          type="range"
          min={0}
          max={Math.max(0, track.durationMs)}
          step={1}
          value={Math.min(elapsedMs, track.durationMs)}
          onChange={handleScrub}
        />
        <span>
          {displayedFrameIndex + 1}/{presentation.frames.length}
        </span>
      </div>

      <div className="battle-playback-toolbar">
        <div className="battle-playback-controls">
          <button
            type="button"
            className="secondary-button battle-step-button"
            disabled={elapsedMs <= 0}
            onClick={handlePrevious}
            aria-label="Предыдущее событие"
          >
            ‹
          </button>
          <button
            type="button"
            className="primary-button battle-play-button"
            onClick={togglePlayback}
            aria-pressed={isPlaying && !isLast}
          >
            {isLast ? '↻ Повторить' : isPlaying ? 'Ⅱ Пауза' : '▶ Продолжить'}
          </button>
          <button
            type="button"
            className="secondary-button battle-step-button"
            disabled={isLast}
            onClick={handleNext}
            aria-label="Следующее событие"
          >
            ›
          </button>
        </div>

        <div className="battle-speed-controls" aria-label="Скорость боя">
          <span>Скорость</span>
          {PLAYBACK_SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              className={speed === value ? 'is-active' : ''}
              onClick={() => setSpeed(value)}
              aria-pressed={speed === value}
            >
              ×{value}
            </button>
          ))}
          {!isLast ? (
            <button type="button" className="battle-skip-button" onClick={handleSkip}>
              Пропустить
            </button>
          ) : (
            <button type="button" className="battle-skip-button is-result" onClick={onClose}>
              К карте
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function SideScore({
  side,
  snapshot,
  tactic,
}: {
  side: BattleSideId;
  snapshot: BattlePresentationSide;
  tactic: BattleTacticId;
}) {
  const units = Math.max(0, Math.round(snapshot.units));
  const morale = clamp(Math.round(snapshot.morale), 0, 100);
  const losses = Math.max(0, Math.round(snapshot.totalLosses));

  return (
    <div className={`battle-side-score side-${side.toLowerCase()}`}>
      <strong>{getFactionName(snapshot.factionId)}</strong>
      <span>{getTacticName(tactic)}</span>
      <div className="battle-score-values">
        <b>{units}</b>
        <span>бойцов</span>
      </div>
      <div className="morale-track" aria-label={`Мораль ${morale}`}>
        <i style={{ width: `${morale}%` }} />
      </div>
      <small>Мораль {morale} · потери {losses}</small>
    </div>
  );
}

function BattlePitch({
  fromFrame,
  toFrame,
  eventFrame,
  progress,
  easedProgress,
  battleTime,
  winnerSide,
  attackerTactic,
  defenderTactic,
}: {
  fromFrame: BattlePresentationFrame;
  toFrame: BattlePresentationFrame;
  eventFrame: BattlePresentationFrame;
  progress: number;
  easedProgress: number;
  battleTime: number;
  winnerSide: BattleSideId | null;
  attackerTactic: BattleTacticId;
  defenderTactic: BattleTacticId;
}) {
  const pressureFrom = getPressureShift(fromFrame);
  const pressureTo = getPressureShift(toFrame);
  const pressureShift = lerp(pressureFrom, pressureTo, easedProgress);
  const dotsA = getBattleFormationDots({
    side: 'A',
    from: fromFrame.sides.A,
    to: toFrame.sides.A,
    fromPhase: fromFrame.phase,
    toPhase: toFrame.phase,
    tactic: attackerTactic,
    winnerSide,
    overallPressureFrom: pressureFrom,
    overallPressureTo: pressureTo,
    progress: easedProgress,
    battleTime,
    unitDefinitions: prototypeUnits,
  });
  const dotsB = getBattleFormationDots({
    side: 'B',
    from: fromFrame.sides.B,
    to: toFrame.sides.B,
    fromPhase: fromFrame.phase,
    toPhase: toFrame.phase,
    tactic: defenderTactic,
    winnerSide,
    overallPressureFrom: pressureFrom,
    overallPressureTo: pressureTo,
    progress: easedProgress,
    battleTime,
    unitDefinitions: prototypeUnits,
  });
  const lanePressures = getLanePressures(pressureShift, attackerTactic, defenderTactic);
  const impact = getImpactState(toFrame, progress);
  const hasImpact = impact.opacity > 0.04;

  return (
    <div
      className={`battle-pitch continuous-motion phase-${eventFrame.phase}${hasImpact ? ' has-impact' : ''}`}
      style={{ '--battle-impact-opacity': impact.opacity } as CSSProperties}
    >
      <svg viewBox="0 0 100 100" role="img" aria-label="Схематичное поле боя">
        <defs>
          <marker id="battle-arrow-a" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0L6 3L0 6Z" className="battle-arrowhead side-a" />
          </marker>
          <marker id="battle-arrow-b" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0L6 3L0 6Z" className="battle-arrowhead side-b" />
          </marker>
        </defs>
        <rect className="battle-pitch-bg" x="1" y="1" width="98" height="98" rx="4" />
        <g className="battle-lane-bands">
          <rect x="4" y="10" width="92" height="27" rx="3" />
          <rect x="4" y="38" width="92" height="24" rx="3" />
          <rect x="4" y="63" width="92" height="27" rx="3" />
        </g>
        <path className="battle-pitch-grid" d="M50 5V95M5 37.5H95M5 62.5H95" />
        <g className="battle-lane-labels">
          <text x="6" y="14">ЛЕВЫЙ ФЛАНГ</text>
          <text x="6" y="42">ЦЕНТР</text>
          <text x="6" y="67">ПРАВЫЙ ФЛАНГ</text>
        </g>
        <circle className="battle-center-mark" cx="50" cy="50" r="8" />
        <path className="battle-contact-line" d="M50 8V92" />
        {lanePressures.map((lane) => (
          <line
            key={lane.lane}
            className={`battle-pressure-line lane-${lane.lane}`}
            x1={50 + lane.shift}
            x2={50 + lane.shift}
            y1={lane.y - 8}
            y2={lane.y + 8}
          />
        ))}

        <VolleyPaths side="A" dots={dotsA} phase={eventFrame.phase} battleTime={battleTime} pressureShift={pressureShift} />
        <VolleyPaths side="B" dots={dotsB} phase={eventFrame.phase} battleTime={battleTime} pressureShift={pressureShift} />
        <MeleeVectors side="A" dots={dotsA} phase={eventFrame.phase} battleTime={battleTime} tactic={attackerTactic} />
        <MeleeVectors side="B" dots={dotsB} phase={eventFrame.phase} battleTime={battleTime} tactic={defenderTactic} />

        <FormationDots side="A" dots={dotsA} />
        <FormationDots side="B" dots={dotsB} />

        {(toFrame.lossesThisFrame.A ?? 0) > 0 && impact.opacity > 0 ? (
          <LossMarker side="A" amount={toFrame.lossesThisFrame.A ?? 0} opacity={impact.opacity} scale={impact.scale} />
        ) : null}
        {(toFrame.lossesThisFrame.B ?? 0) > 0 && impact.opacity > 0 ? (
          <LossMarker side="B" amount={toFrame.lossesThisFrame.B ?? 0} opacity={impact.opacity} scale={impact.scale} />
        ) : null}
      </svg>
      <div className="battle-formation-legend" aria-hidden="true">
        <span><i className="legend-line" /> передняя линия</span>
        <span><i className="legend-ranged" /> стрелки</span>
      </div>
    </div>
  );
}

function LossMarker({
  side,
  amount,
  opacity,
  scale,
}: {
  side: BattleSideId;
  amount: number;
  opacity: number;
  scale: number;
}) {
  const x = side === 'A' ? 43 : 57;
  return (
    <g
      className={`battle-loss-marker side-${side.toLowerCase()}`}
      style={{ opacity, transform: `scale(${scale})`, transformOrigin: `${x}px 50px` }}
    >
      <circle cx={x} cy="50" r="5" />
      <circle className="battle-impact-ring" cx={x} cy="50" r={7 + (scale - 1) * 4} />
      <text x={x} y="51.4" textAnchor="middle">
        −{amount}
      </text>
    </g>
  );
}

const BATTLE_LANES: Array<{ lane: BattleLane; y: number }> = [
  { lane: 'left', y: 24 },
  { lane: 'center', y: 50 },
  { lane: 'right', y: 76 },
];

function FormationDots({ side, dots }: { side: BattleSideId; dots: BattleFormationDot[] }) {
  return (
    <g className={`battle-dots side-${side.toLowerCase()}`}>
      {dots.map((dot) => (
        <circle
          key={`${side}-${dot.id}`}
          className={`role-${dot.role} lane-${dot.lane}`}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          opacity={dot.opacity}
        />
      ))}
    </g>
  );
}

function VolleyPaths({
  side,
  dots,
  phase,
  battleTime,
  pressureShift,
}: {
  side: BattleSideId;
  dots: BattleFormationDot[];
  phase: BattlePresentationPhase;
  battleTime: number;
  pressureShift: number;
}) {
  if (phase !== 'advance' && phase !== 'clash' && phase !== 'morale') return null;
  const ranged = dots.filter((dot) => dot.role === 'ranged' && dot.opacity > 0.16).slice(0, 3);
  if (ranged.length === 0) return null;
  const forward = side === 'A' ? 1 : -1;
  const pulse = 0.22 + (Math.sin(battleTime * 2.35 + (side === 'A' ? 0 : 1.7)) + 1) * 0.14;
  return (
    <g className={`battle-volleys side-${side.toLowerCase()}`} opacity={pulse}>
      {ranged.map((dot, index) => {
        const targetX = 50 + pressureShift - forward * (1.5 + index * 0.8);
        const controlX = (dot.x + targetX) / 2;
        const arc = side === 'A' ? -4 - index : 4 + index;
        return (
          <path
            key={`${side}-volley-${dot.id}`}
            d={`M${dot.x} ${dot.y} Q${controlX} ${dot.y + arc} ${targetX} ${dot.y}`}
            style={{ strokeDashoffset: -(battleTime * 5 + index * 2) }}
          />
        );
      })}
    </g>
  );
}

function MeleeVectors({
  side,
  dots,
  phase,
  battleTime,
  tactic,
}: {
  side: BattleSideId;
  dots: BattleFormationDot[];
  phase: BattlePresentationPhase;
  battleTime: number;
  tactic: BattleTacticId;
}) {
  if (phase !== 'clash' && phase !== 'advance') return null;
  const forward = side === 'A' ? 1 : -1;
  const pulseBase = tactic === 'assault' ? 0.62 : tactic === 'cautious' ? 0.28 : 0.44;
  const pulse = pulseBase * (0.68 + (Math.sin(battleTime * 2.8 + (side === 'A' ? 0 : 1.2)) + 1) * 0.16);
  return (
    <g className={`battle-melee-vectors side-${side.toLowerCase()}`} opacity={pulse}>
      {BATTLE_LANES.map(({ lane }) => {
        const candidates = dots.filter((dot) => dot.role === 'line' && dot.lane === lane && dot.opacity > 0.25);
        if (candidates.length === 0) return null;
        const front = candidates.reduce((best, dot) =>
          side === 'A' ? (dot.x > best.x ? dot : best) : dot.x < best.x ? dot : best,
        );
        return (
          <line
            key={`${side}-melee-${lane}`}
            x1={front.x + forward * 0.8}
            y1={front.y}
            x2={front.x + forward * 5.2}
            y2={front.y}
            markerEnd={`url(#battle-arrow-${side.toLowerCase()})`}
          />
        );
      })}
    </g>
  );
}

function getLanePressures(
  overallPressure: number,
  attackerTactic: BattleTacticId,
  defenderTactic: BattleTacticId,
): Array<{ lane: BattleLane; y: number; shift: number }> {
  return BATTLE_LANES.map(({ lane, y }) => ({
    lane,
    y,
    shift: getLanePressureShift(lane, overallPressure, attackerTactic, defenderTactic),
  }));
}

function getImpactState(frame: BattlePresentationFrame, progress: number): { opacity: number; scale: number } {
  const hasLosses = (frame.lossesThisFrame.A ?? 0) > 0 || (frame.lossesThisFrame.B ?? 0) > 0;
  if (!hasLosses || progress < 0.58) return { opacity: 0, scale: 0.72 };

  const local = clamp((progress - 0.58) / 0.42, 0, 1);
  const opacity = Math.sin(local * Math.PI);
  const scale = 0.72 + Math.sin(Math.min(1, local * 1.7) * Math.PI * 0.5) * 0.42;
  return { opacity, scale };
}

function interpolateSide(
  from: BattlePresentationSide,
  to: BattlePresentationSide,
  progress: number,
): BattlePresentationSide {
  return {
    factionId: to.factionId,
    initialUnits: to.initialUnits,
    units: lerp(from.units, to.units, progress),
    morale: lerp(from.morale, to.morale, progress),
    totalLosses: lerp(from.totalLosses, to.totalLosses, progress),
    initialRoster: to.initialRoster,
    roster: progress >= 0.5 ? to.roster : from.roster,
    broken: progress >= 0.7 ? to.broken : from.broken,
    outcome: progress >= 0.96 ? to.outcome : from.outcome,
  };
}

function chooseEventFrame(
  from: BattlePresentationFrame | undefined,
  to: BattlePresentationFrame | undefined,
  progress: number,
): BattlePresentationFrame | undefined {
  if (!from) return to;
  if (!to || from.index === to.index) return from;
  return progress >= 0.7 ? to : from;
}

function getPressureShift(frame: BattlePresentationFrame): number {
  if (frame.phase === 'opening' || frame.phase === 'finish' || frame.phase === 'break') return 0;
  const rollA = frame.rolls.A ?? 10;
  const rollB = frame.rolls.B ?? 10;
  const rollPressure = clamp((rollA - rollB) * 0.18, -2.3, 2.3);
  const lossPressure = clamp(((frame.lossesThisFrame.B ?? 0) - (frame.lossesThisFrame.A ?? 0)) * 0.55, -2.2, 2.2);
  return clamp(rollPressure + lossPressure, -3.4, 3.4);
}

function getFactionName(factionId: string): string {
  if (factionId === 'expedition') return 'Экспедиция';
  if (factionId === 'meridian-company') return 'Меридиан';
  const orsia = orsiaSubfactionById[factionId];
  if (orsia) return orsia.name;
  if (factionId === 'orssia-neutral') return 'Орсия';
  return factionId;
}

function getTacticName(tactic: BattleTacticId): string {
  if (tactic === 'assault') return 'Натиск';
  if (tactic === 'balanced') return 'Стандарт';
  if (tactic === 'cautious') return 'Осторожно';
  return 'Обход';
}

function getPhaseLabel(phase: BattlePresentationPhase): string {
  if (phase === 'opening') return 'Позиции';
  if (phase === 'advance') return 'Давление';
  if (phase === 'clash') return 'Контакт';
  if (phase === 'morale') return 'Стойкость';
  if (phase === 'break') return 'Перелом';
  return 'Итог';
}

function formatBattleTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
