import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { BattleCommandId, BattleSideId, BattleTacticId } from '@/core/battles/BattleTypes';
import type { GameState } from '@/core/state/GameState';
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
import { RIVAL_FACTION_ID, rivalExpeditionById } from '@/data/factions/rivalExpeditions';
import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';
import { getBattleBackgroundSrc } from '@/data/battles/battleBackgrounds';

const PLAYBACK_SPEEDS: BattlePlaybackSpeed[] = [1, 2, 4];
const MAX_RAF_DELTA_MS = 64;
const LIVE_COMMANDS: Array<{ id: BattleCommandId; label: string; hint: string }> = [
  { id: 'press_left', label: 'Давить слева', hint: '+атака на левом фланге' },
  { id: 'press_center', label: 'Давить центр', hint: '+атака в центре' },
  { id: 'press_right', label: 'Давить справа', hint: '+атака на правом фланге' },
  { id: 'general_assault', label: 'Общий натиск', hint: '+атака, но выше риск' },
  { id: 'hold_line', label: 'Держать строй', hint: '+защита и стойкость' },
  { id: 'none', label: 'Не вмешиваться', hint: 'Сохранить текущий ход боя' },
];
const COMMAND_DECISION_ROUNDS = [2, 4] as const;

export function BattleViewer({
  report,
  cityName,
  state,
  onIssueCommand,
  onClose,
}: {
  report: BattleReport;
  cityName: string;
  state: GameState;
  onIssueCommand?: (command: BattleCommandId) => boolean;
  onClose: () => void;
}) {
  const presentation = useMemo(() => buildBattlePresentation(report.result), [report.result]);
  const battleBackgroundSrc = useMemo(() => getBattleBackgroundSrc(report.cityId), [report.cityId]);
  const track = useMemo(() => buildBattlePlaybackTrack(presentation.frames), [presentation.frames]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speed, setSpeed] = useState<BattlePlaybackSpeed>(1);
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());
  const [pendingCommandRound, setPendingCommandRound] = useState<number | null>(null);
  const [commandSubmitting, setCommandSubmitting] = useState(false);
  const [skipDecisionPrompts, setSkipDecisionPrompts] = useState(false);
  const lastRafTimeRef = useRef<number | null>(null);

  const sample = useMemo(
    () => sampleBattlePlayback(presentation.frames, track, elapsedMs),
    [elapsedMs, presentation.frames, track],
  );

  const commandsUsed = report.result.sides.A.plan.commands.length;
  const nextDecision = useMemo(() => {
    if (skipDecisionPrompts || !onIssueCommand || commandsUsed >= COMMAND_DECISION_ROUNDS.length) return null;
    const round = COMMAND_DECISION_ROUNDS[commandsUsed];
    const frameIndex = presentation.frames.findIndex((frame) => frame.round === round && frame.phase === 'opening');
    if (frameIndex < 0) return null;
    return { round, elapsedMs: getBattleFrameTimeMs(track, frameIndex) };
  }, [commandsUsed, onIssueCommand, presentation.frames, skipDecisionPrompts, track]);

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

  useEffect(() => {
    if (!nextDecision || pendingCommandRound !== null) return;
    if (elapsedMs + 0.5 < nextDecision.elapsedMs) return;
    setElapsedMs(nextDecision.elapsedMs);
    setIsPlaying(false);
    setPendingCommandRound(nextDecision.round);
  }, [elapsedMs, nextDecision, pendingCommandRound]);

  useEffect(() => {
    if (pendingCommandRound === null) return;
    const decisionIndex = COMMAND_DECISION_ROUNDS.indexOf(pendingCommandRound as 2 | 4);
    if (decisionIndex < 0 || commandsUsed < decisionIndex + 1) return;
    setPendingCommandRound(null);
    setCommandSubmitting(false);
    setIsPlaying(true);
  }, [commandsUsed, pendingCommandRound]);

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

  function handleSkipBattle() {
    setSkipDecisionPrompts(true);
    setPendingCommandRound(null);
    setCommandSubmitting(false);
    setIsPlaying(false);
    setElapsedMs(track.durationMs);
  }

  function handleCommand(command: BattleCommandId) {
    if (!onIssueCommand || pendingCommandRound === null || commandSubmitting) return;
    setCommandSubmitting(true);
    setIsPlaying(false);
    const accepted = onIssueCommand(command);
    if (!accepted) setCommandSubmitting(false);
  }

  return (
    <section className="battle-viewer" aria-label={`Бой за ${cityName}`}>
      <header className="battle-viewer-header">
        <div>
          <span className="eyebrow">{presentation.scale === 'battle' ? 'Крупная битва' : 'Стычка'}</span>
          <h2>{cityName}</h2>
        </div>
        <div className="battle-viewer-header-actions">
          {!isLast ? (
            <button type="button" className="battle-skip-header-button" onClick={handleSkipBattle} disabled={commandSubmitting}>
              ⏭ Бой
            </button>
          ) : null}
          <button type="button" className="text-button" onClick={onClose}>
            К карте
          </button>
        </div>
      </header>

      <div className="battle-scoreboard">
        <SideScore state={state} side="A" snapshot={sideA} tactic={report.attackerTactic} />
        <div className="battle-clock">
          <strong>{formatBattleTime(sample.battleTime)}</strong>
          <span>{eventFrame.round > 0 ? `Раунд ${eventFrame.round}` : 'До боя'}</span>
        </div>
        <SideScore state={state} side="B" snapshot={sideB} tactic={report.defenderTactic} />
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
        backgroundSrc={battleBackgroundSrc}
        attackerSnapshot={sideA}
        defenderSnapshot={sideB}
        attackerPlan={report.result.sides.A.plan}
        defenderPlan={report.result.sides.B.plan}
        pendingCommandRound={pendingCommandRound}
        commandSubmitting={commandSubmitting}
        commandsUsed={commandsUsed}
        onCommand={onIssueCommand ? handleCommand : undefined}
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
          disabled={pendingCommandRound !== null}
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
            disabled={elapsedMs <= 0 || pendingCommandRound !== null}
            onClick={handlePrevious}
            aria-label="Предыдущее событие"
          >
            ‹
          </button>
          <button
            type="button"
            className="primary-button battle-play-button"
            onClick={togglePlayback}
            disabled={pendingCommandRound !== null}
            aria-pressed={isPlaying && !isLast}
          >
            {isLast ? '↻ Повторить' : isPlaying ? 'Ⅱ Пауза' : '▶ Продолжить'}
          </button>
          <button
            type="button"
            className="secondary-button battle-step-button"
            disabled={isLast || pendingCommandRound !== null}
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
          {isLast ? (
            <button type="button" className="battle-skip-button is-result" onClick={onClose}>
              К карте
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function BattleSceneSectorHud({
  attacker,
  defender,
  attackerPlan,
  defenderPlan,
}: {
  attacker: BattlePresentationSide;
  defender: BattlePresentationSide;
  attackerPlan: import('@/core/battles/BattleTypes').BattlePlan;
  defenderPlan: import('@/core/battles/BattleTypes').BattlePlan;
}) {
  return (
    <div className="battle-scene-sector-hud" aria-label="Состояние флангов">
      <BattleSceneSectorSide side="A" snapshot={attacker} plan={attackerPlan} />
      <BattleSceneSectorSide side="B" snapshot={defender} plan={defenderPlan} />
    </div>
  );
}

function BattleSceneSectorSide({
  side,
  snapshot,
  plan,
}: {
  side: BattleSideId;
  snapshot: BattlePresentationSide;
  plan: import('@/core/battles/BattleTypes').BattlePlan;
}) {
  return (
    <div className={`battle-scene-sector-side side-${side.toLowerCase()}`}>
      <div className="battle-scene-sector-cards">
        {(['left', 'center', 'right'] as const).map((lane) => {
          const sector = snapshot.sectorState.sectors[lane];
          const condition = sector.broken ? 'БЕЖИТ' : sector.morale < 35 ? 'ДРОЖИТ' : sector.morale < 60 ? 'НАПРЯЖЁН' : 'ДЕРЖИТСЯ';
          return (
            <div key={lane} className={`battle-scene-sector-chip lane-${lane}${sector.broken ? ' is-broken' : ''}`}>
              <span className="battle-scene-sector-lane">{getLaneLabel(lane).toUpperCase()}</span>
              <b>{Math.max(0, Math.round(sector.units))}</b>
              <span className="battle-scene-sector-condition">{condition}</span>
              <i><em style={{ width: `${clamp(Math.round(sector.morale), 0, 100)}%` }} /></i>
            </div>
          );
        })}
      </div>
      <small>
        {snapshot.sectorState.reserveCommitted
          ? `Резерв введён · ${getFormationLabel(plan.formation)}`
          : `Резерв ${Math.max(0, Math.round(snapshot.sectorState.reserveUnits))} → ${getLaneLabel(plan.reserveTarget)}`}
      </small>
    </div>
  );
}

function getFormationLabel(formation: import('@/core/battles/BattleTypes').BattleFormationId): string {
  return formation === 'strong_center' ? 'сильный центр' : formation === 'crescent' ? 'полумесяц' : 'линия';
}

function getLaneLabel(lane: BattleLane): string {
  return lane === 'left' ? 'левый' : lane === 'right' ? 'правый' : 'центр';
}

function SideScore({
  state,
  side,
  snapshot,
  tactic,
}: {
  state: GameState;
  side: BattleSideId;
  snapshot: BattlePresentationSide;
  tactic: BattleTacticId;
}) {
  const units = Math.max(0, Math.round(snapshot.units));
  const morale = clamp(Math.round(snapshot.morale), 0, 100);
  const losses = Math.max(0, Math.round(snapshot.totalLosses));
  const identity = getFactionIdentity(state, snapshot.factionId);

  return (
    <div className={`battle-side-score side-${side.toLowerCase()}`}>
      <div className="battle-side-identity">
        {identity.portraitSrc ? (
          <img className="battle-leader-portrait" src={identity.portraitSrc} alt="" draggable={false} />
        ) : (
          <div className="battle-leader-portrait is-placeholder" aria-label="Временный портрет">
            {identity.placeholderLabel}
          </div>
        )}
        <div>
          <strong>{identity.name}</strong>
          <small>{identity.leaderName ?? 'портрет будет добавлен позже'}</small>
        </div>
      </div>
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
  backgroundSrc,
  attackerSnapshot,
  defenderSnapshot,
  attackerPlan,
  defenderPlan,
  pendingCommandRound,
  commandSubmitting,
  commandsUsed,
  onCommand,
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
  backgroundSrc: string;
  attackerSnapshot: BattlePresentationSide;
  defenderSnapshot: BattlePresentationSide;
  attackerPlan: import('@/core/battles/BattleTypes').BattlePlan;
  defenderPlan: import('@/core/battles/BattleTypes').BattlePlan;
  pendingCommandRound: number | null;
  commandSubmitting: boolean;
  commandsUsed: number;
  onCommand?: (command: BattleCommandId) => void;
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
      className={`battle-pitch continuous-motion phase-${eventFrame.phase}${hasImpact ? ' has-impact' : ''}${pendingCommandRound !== null ? ' is-command-paused' : ''}`}
      style={{ '--battle-impact-opacity': impact.opacity, backgroundImage: `url("${backgroundSrc}")` } as CSSProperties}
    >
      <img className="battle-scene-background" src={backgroundSrc} alt="" aria-hidden="true" draggable={false} />
      <div className="battle-scene-veil" aria-hidden="true" />
      <BattleSceneSectorHud
        attacker={attackerSnapshot}
        defender={defenderSnapshot}
        attackerPlan={attackerPlan}
        defenderPlan={defenderPlan}
      />
      <svg viewBox="0 0 100 100" role="img" aria-label="Поле боя">
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

        <FormationDots side="A" dots={dotsA} phase={eventFrame.phase} />
        <FormationDots side="B" dots={dotsB} phase={eventFrame.phase} />

        {(toFrame.lossesThisFrame.A ?? 0) > 0 && impact.opacity > 0 ? (
          <LossMarker side="A" amount={toFrame.lossesThisFrame.A ?? 0} opacity={impact.opacity} scale={impact.scale} />
        ) : null}
        {(toFrame.lossesThisFrame.B ?? 0) > 0 && impact.opacity > 0 ? (
          <LossMarker side="B" amount={toFrame.lossesThisFrame.B ?? 0} opacity={impact.opacity} scale={impact.scale} />
        ) : null}
      </svg>
      <div className="battle-formation-legend" aria-hidden="true">
        <span><i className="legend-line" /> линия</span>
        <span><i className="legend-ranged" /> стрелки</span>
      </div>
      {pendingCommandRound !== null && onCommand ? (
        <div className="battle-command-overlay" role="group" aria-label={`Приказ перед раундом ${pendingCommandRound}`}>
          <div className="battle-command-overlay-copy">
            <strong>Приказ перед {pendingCommandRound}-м раундом</strong>
            <span>{commandSubmitting ? 'Пересчитываем…' : `Приказов осталось: ${Math.max(0, 2 - commandsUsed)}`}</span>
          </div>
          <div className="battle-command-overlay-grid">
            {LIVE_COMMANDS.map((command) => (
              <button key={command.id} type="button" disabled={commandSubmitting} onClick={() => onCommand(command.id)}>
                <strong>{command.label}</strong>
                <span>{command.hint}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
      <g className="battle-impact-sparks">
        <path d={`M ${x - 8} 50 H ${x - 4.8} M ${x + 4.8} 50 H ${x + 8}`} />
        <path d={`M ${x} 42 V 45.2 M ${x} 54.8 V 58`} />
        <path d={`M ${x - 5.8} 44.2 L ${x - 3.5} 46.5 M ${x + 3.5} 53.5 L ${x + 5.8} 55.8`} />
      </g>
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

function FormationDots({
  side,
  dots,
  phase,
}: {
  side: BattleSideId;
  dots: BattleFormationDot[];
  phase: BattlePresentationPhase;
}) {
  const animated = phase === 'advance' || phase === 'clash' || phase === 'morale';
  return (
    <g className={`battle-dots side-${side.toLowerCase()}${animated ? ' is-animated' : ''}`}>
      {dots.map((dot, index) => (
        <g
          key={`${side}-${dot.id}`}
          className={`battle-unit-slot role-${dot.role} lane-${dot.lane}`}
          transform={`translate(${dot.x} ${dot.y})`}
          opacity={dot.opacity}
        >
          <g
            className="battle-unit-glyph"
            style={{ '--battle-unit-delay': `${(index % 7) * -0.09}s` } as CSSProperties}
          >
            <ellipse className="battle-unit-shadow" cx="0" cy={dot.r * 0.92} rx={dot.r * 1.28} ry={dot.r * 0.46} />
            <circle className="battle-unit-body" cx="0" cy="0" r={dot.r} />
            {dot.role === 'ranged' ? (
              <>
                <path className="battle-unit-weapon" d={`M ${-dot.r * 0.55} ${dot.r * 0.1} L ${dot.r * 0.65} ${-dot.r * 0.72}`} />
                <circle className="battle-unit-role-mark" cx={dot.r * 0.48} cy={-dot.r * 0.52} r={Math.max(0.28, dot.r * 0.2)} />
              </>
            ) : (
              <path className="battle-unit-weapon" d={`M ${-dot.r * 0.58} ${dot.r * 0.58} L ${dot.r * 0.62} ${-dot.r * 0.62}`} />
            )}
          </g>
        </g>
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
        const flight = (battleTime * 0.72 + index * 0.29 + (side === 'A' ? 0 : 0.17)) % 1;
        const oneMinus = 1 - flight;
        const projectileX = oneMinus * oneMinus * dot.x + 2 * oneMinus * flight * controlX + flight * flight * targetX;
        const projectileY = oneMinus * oneMinus * dot.y + 2 * oneMinus * flight * (dot.y + arc) + flight * flight * dot.y;
        return (
          <g key={`${side}-volley-${dot.id}`}>
            <path
              d={`M${dot.x} ${dot.y} Q${controlX} ${dot.y + arc} ${targetX} ${dot.y}`}
              style={{ strokeDashoffset: -(battleTime * 5 + index * 2) }}
            />
            <circle className="battle-projectile" cx={projectileX} cy={projectileY} r="0.72" />
          </g>
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
    sectorState: {
      reserveUnits: lerp(from.sectorState.reserveUnits, to.sectorState.reserveUnits, progress),
      reserveCommitted: progress >= 0.7 ? to.sectorState.reserveCommitted : from.sectorState.reserveCommitted,
      sectors: {
        left: interpolateSector(from.sectorState.sectors.left, to.sectorState.sectors.left, progress),
        center: interpolateSector(from.sectorState.sectors.center, to.sectorState.sectors.center, progress),
        right: interpolateSector(from.sectorState.sectors.right, to.sectorState.sectors.right, progress),
      },
    },
  };
}

function interpolateSector(
  from: import('@/core/battles/BattleTypes').BattleSectorSnapshot,
  to: import('@/core/battles/BattleTypes').BattleSectorSnapshot,
  progress: number,
): import('@/core/battles/BattleTypes').BattleSectorSnapshot {
  return {
    units: lerp(from.units, to.units, progress),
    morale: lerp(from.morale, to.morale, progress),
    broken: progress >= 0.7 ? to.broken : from.broken,
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

type FactionIdentity = {
  name: string;
  leaderName: string | null;
  portraitSrc: string | null;
  placeholderLabel: string;
};

function getFactionIdentity(state: GameState, factionId: string): FactionIdentity {
  if (factionId === state.playerFactionId) {
    const leader = prototypeLeaderById[state.selectedLeaderId];
    return {
      name: 'Экспедиция',
      leaderName: leader?.name ?? null,
      portraitSrc: leader?.portraitSrc ?? null,
      placeholderLabel: 'Э',
    };
  }
  if (factionId === RIVAL_FACTION_ID) {
    const faction = rivalExpeditionById[state.campaign.rivalOrganizationId];
    const leader = prototypeLeaderById[state.campaign.rivalLeaderId];
    return {
      name: faction?.name ?? 'Конкурирующая экспедиция',
      leaderName: leader?.name ?? null,
      portraitSrc: leader?.portraitSrc ?? null,
      placeholderLabel: 'К',
    };
  }
  const orsia = orsiaSubfactionById[factionId];
  if (orsia) {
    return {
      name: orsia.name,
      leaderName: orsia.leaderName,
      portraitSrc: orsia.portraitSrc,
      placeholderLabel: getOrsiaPlaceholderLabel(factionId),
    };
  }
  if (factionId === 'orssia-neutral') {
    return { name: 'Орсия', leaderName: null, portraitSrc: null, placeholderLabel: 'ОР' };
  }
  return { name: factionId, leaderName: null, portraitSrc: null, placeholderLabel: '?' };
}

function getOrsiaPlaceholderLabel(factionId: string): string {
  if (factionId === 'orsia-orcs') return 'ОР';
  if (factionId === 'orsia-goblins') return 'ГО';
  if (factionId === 'orsia-nazbols') return 'НБ';
  if (factionId === 'orsia-tyranids') return 'ТИ';
  if (factionId === 'orsia-lateki') return 'ЛТ';
  return 'ОР';
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
