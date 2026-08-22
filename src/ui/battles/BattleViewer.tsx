import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
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
const DRAMATIC_EVENT_MIN_REAL_MS = 1300;
const RESULT_STAMP_EXIT_MS = 520;

type ActiveLaneOrder = { mode: 'attack'; target: BattleLane } | { mode: 'defend' } | { mode: 'cautious' } | null;
type ActiveLaneOrders = Record<BattleLane, ActiveLaneOrder>;
type DramaticOverlayEvent = DramaticBattleMoment & { key: string };
type ResultStampPhase = 'hidden' | 'visible' | 'dismissing' | 'done';

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
  onIssueCommand?: (command: BattleCommandId, round: number) => boolean;
  onClose: () => void;
}) {
  const presentation = useMemo(() => buildBattlePresentation(report.result), [report.result]);
  const battleBackgroundSrc = useMemo(() => getBattleBackgroundSrc(report.cityId), [report.cityId]);
  const track = useMemo(() => buildBattlePlaybackTrack(presentation.frames), [presentation.frames]);
  const guaranteedBloodFrameIndex = useMemo(() => {
    const casualty = presentation.frames.find((frame) => (frame.lossesThisFrame.A ?? 0) + (frame.lossesThisFrame.B ?? 0) > 0);
    return casualty?.index ?? presentation.frames.find((frame) => frame.phase === 'clash')?.index ?? -1;
  }, [presentation.frames]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speed, setSpeed] = useState<BattlePlaybackSpeed>(1);
  const [isPlaying, setIsPlaying] = useState(() => !prefersReducedMotion());
  const [commandSubmitting, setCommandSubmitting] = useState(false);
  const [commandCoolingDown, setCommandCoolingDown] = useState(false);
  const [flankSourceLane, setFlankSourceLane] = useState<BattleLane | null>(null);
  const flankSourceLaneRef = useRef<BattleLane | null>(null);
  const [dramaticOverlay, setDramaticOverlay] = useState<DramaticOverlayEvent | null>(null);
  const [resultStampPhase, setResultStampPhase] = useState<ResultStampPhase>('hidden');
  const lastRafTimeRef = useRef<number | null>(null);
  const dramaticQueueRef = useRef<DramaticOverlayEvent[]>([]);
  const seenDramaticKeysRef = useRef<Set<string>>(new Set());
  const lastDramaticScanIndexRef = useRef(0);

  const sample = useMemo(
    () => sampleBattlePlayback(presentation.frames, track, elapsedMs),
    [elapsedMs, presentation.frames, track],
  );

  const fromFrame = presentation.frames[sample.fromIndex] ?? presentation.frames[0];
  const toFrame = presentation.frames[sample.toIndex] ?? fromFrame;
  const eventFrame = chooseEventFrame(fromFrame, toFrame, sample.progress);
  const currentRound = eventFrame?.round ?? 0;
  const liveCommandRound = onIssueCommand ? Math.max(1, currentRound || 1) : null;
  const isLast = track.durationMs <= 0 || elapsedMs >= track.durationMs - 0.5;
  const displayedFrameIndex = eventFrame?.index ?? 0;
  const currentStageStartRound = useMemo(() => {
    const latest = report.result.timeline
      .filter((event) => event.type === 'stage_transition' && event.round <= currentRound)
      .at(-1);
    return latest?.type === 'stage_transition' ? latest.round : 1;
  }, [currentRound, report.result.timeline]);
  const activeLaneOrders = useMemo(
    () => getActiveLaneOrders(report.result.sides.A.plan.commands, report.result.sides.A.plan.commandRounds ?? [], currentRound, currentStageStartRound),
    [currentRound, currentStageStartRound, report.result.sides.A.plan.commandRounds, report.result.sides.A.plan.commands],
  );
  const activeFlankRedirects = useMemo(() => {
    const redirects: Partial<Record<BattleLane, BattleLane>> = {};
    for (const lane of ['left', 'center', 'right'] as BattleLane[]) {
      const order = activeLaneOrders[lane];
      if (order?.mode === 'attack') redirects[lane] = order.target;
    }
    return redirects;
  }, [activeLaneOrders]);
  const commentaryTone = getBattleFrameOutcomeTone(eventFrame);
  const globalBlood = getGlobalBloodState(toFrame, sample.progress, guaranteedBloodFrameIndex, report.result.sides.A.factionId, report.result.sides.B.factionId);

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
    const scanThroughIndex = sample.progress >= 0.18 ? sample.toIndex : sample.fromIndex;
    const previousScanIndex = lastDramaticScanIndexRef.current;
    if (scanThroughIndex < previousScanIndex) {
      lastDramaticScanIndexRef.current = scanThroughIndex;
      return;
    }

    const discovered: DramaticOverlayEvent[] = [];
    for (let index = Math.max(1, previousScanIndex + 1); index <= scanThroughIndex; index += 1) {
      const scanFrom = presentation.frames[index - 1];
      const scanTo = presentation.frames[index];
      const moment = getDramaticBattleMoment(scanFrom, scanTo, 0.5);
      if (!moment || !scanTo) continue;
      const key = `${scanTo.index}:${moment.title}`;
      if (seenDramaticKeysRef.current.has(key)) continue;
      seenDramaticKeysRef.current.add(key);
      discovered.push({ ...moment, key });
    }
    lastDramaticScanIndexRef.current = Math.max(previousScanIndex, scanThroughIndex);
    if (discovered.length === 0) return;

    if (dramaticOverlay) {
      dramaticQueueRef.current.push(...discovered);
      return;
    }
    const [first, ...rest] = discovered;
    if (rest.length > 0) dramaticQueueRef.current.push(...rest);
    setDramaticOverlay(first);
  }, [dramaticOverlay, presentation.frames, sample.fromIndex, sample.progress, sample.toIndex]);

  useEffect(() => {
    if (!dramaticOverlay) {
      const next = dramaticQueueRef.current.shift();
      if (next) setDramaticOverlay(next);
      return undefined;
    }
    const timer = window.setTimeout(() => setDramaticOverlay(null), DRAMATIC_EVENT_MIN_REAL_MS);
    return () => window.clearTimeout(timer);
  }, [dramaticOverlay]);

  useEffect(() => {
    if (!isLast || dramaticOverlay || dramaticQueueRef.current.length > 0 || resultStampPhase !== 'hidden') return;
    setResultStampPhase('visible');
  }, [dramaticOverlay, isLast, resultStampPhase]);


  if (!fromFrame || !toFrame || !eventFrame) return null;

  const sideA = interpolateSide(fromFrame.sides.A, toFrame.sides.A, sample.easedProgress);
  const sideB = interpolateSide(fromFrame.sides.B, toFrame.sides.B, sample.easedProgress);

  function togglePlayback() {
    if (isLast) {
      if (resultStampPhase !== 'done') return;
      resetBattleOverlays();
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
    dramaticQueueRef.current = [];
    lastDramaticScanIndexRef.current = Math.max(0, presentation.frames.length - 1);
    setDramaticOverlay(null);
    flankSourceLaneRef.current = null;
    setFlankSourceLane(null);
    setCommandSubmitting(false);
    setIsPlaying(false);
    setElapsedMs(track.durationMs);
  }

  function resetBattleOverlays() {
    dramaticQueueRef.current = [];
    seenDramaticKeysRef.current.clear();
    lastDramaticScanIndexRef.current = 0;
    setDramaticOverlay(null);
    setResultStampPhase('hidden');
  }

  function handleCommand(command: BattleCommandId) {
    if (!onIssueCommand || liveCommandRound === null || commandSubmitting || commandCoolingDown) return;
    setCommandSubmitting(true);
    const accepted = onIssueCommand(command, liveCommandRound);
    if (!accepted) {
      setCommandSubmitting(false);
      return;
    }
    setCommandCoolingDown(true);
    window.setTimeout(() => setCommandCoolingDown(false), 1000);
    window.setTimeout(() => setCommandSubmitting(false), 100);
    flankSourceLaneRef.current = null;
    setFlankSourceLane(null);
  }

  function handleFlankSource(lane: BattleLane) {
    // Do not allow a lane to look selected while the explicit 1s post-order
    // cooldown is still running. That was perceived as input latency because
    // the lane highlighted immediately but every target stayed disabled.
    if (liveCommandRound === null || commandSubmitting || commandCoolingDown || isLast) return;
    const sector = sideA.sectorState.sectors[lane];
    if (sector.units <= 0 || sector.broken) return;
    const currentSourceLane = flankSourceLaneRef.current ?? flankSourceLane;
    if (currentSourceLane === lane) {
      const defendCommand: BattleCommandId = lane === 'left' ? 'defend_left' : lane === 'right' ? 'defend_right' : 'defend_center';
      handleCommand(defendCommand);
      return;
    }
    flankSourceLaneRef.current = lane;
    setFlankSourceLane(lane);
  }

  function handleFlankTarget(lane: BattleLane) {
    const sourceLane = flankSourceLaneRef.current ?? flankSourceLane;
    if (!sourceLane || commandCoolingDown) return;
    const targetSector = sideB.sectorState.sectors[lane];
    if (targetSector.units <= 0 || targetSector.broken || (report.result.sides.B.centerOnlyFormation && lane !== 'center')) return;
    const command = getFlankCommand(sourceLane, lane);
    if (!command) return;
    handleCommand(command);
  }

  function handleFlankClear() {
    const sourceLane = flankSourceLaneRef.current ?? flankSourceLane;
    if (!sourceLane || commandCoolingDown) return;
    const command: BattleCommandId = sourceLane === 'left'
      ? 'clear_left'
      : sourceLane === 'right'
        ? 'clear_right'
        : 'clear_center';
    handleCommand(command);
  }

  function handleResultStampDismiss() {
    if (resultStampPhase !== 'visible') return;
    setResultStampPhase('dismissing');
    window.setTimeout(() => setResultStampPhase('done'), RESULT_STAMP_EXIT_MS);
  }


  return (
    <section className={`battle-viewer${globalBlood.show ? ' has-global-blood-impact' : ''}`} aria-label={`Бой за ${cityName}`}>
      {globalBlood.show ? <GlobalBloodSplatter tone={globalBlood.tone} phase={toFrame.index} /> : null}
      <header className="battle-viewer-header">
        <div>
          <span className="eyebrow">{presentation.scale === 'battle' ? 'Крупная битва' : 'Стычка'}</span>
          <h2>{cityName}</h2>
        </div>
      </header>

      <div className="battle-scoreboard">
        <SideScore state={state} side="A" snapshot={sideA} tactic={report.attackerTactic} identityOverride={report.identityOverrides?.A} />
        <div className="battle-clock">
          <strong>{formatBattleTime(sample.battleTime)}</strong>
          <span>{eventFrame.round > 0 ? `Этап ${eventFrame.stage ?? 1}/4 · Раунд ${eventFrame.round}` : 'До боя'}</span>
        </div>
        <SideScore state={state} side="B" snapshot={sideB} tactic={report.defenderTactic} identityOverride={report.identityOverrides?.B} />
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
        attackerCenterOnly={Boolean(report.result.sides.A.centerOnlyFormation)}
        defenderCenterOnly={Boolean(report.result.sides.B.centerOnlyFormation)}
        guaranteedBloodFrameIndex={guaranteedBloodFrameIndex}
        attackerFactionId={report.result.sides.A.factionId}
        defenderFactionId={report.result.sides.B.factionId}
        flankSourceLane={flankSourceLane}
        onFlankSource={onIssueCommand && liveCommandRound !== null ? handleFlankSource : undefined}
        onFlankTarget={onIssueCommand && liveCommandRound !== null ? handleFlankTarget : undefined}
        onFlankClear={onIssueCommand && liveCommandRound !== null ? handleFlankClear : undefined}
        activeFlankRedirects={activeFlankRedirects}
        activeLaneOrders={activeLaneOrders}
        commandCoolingDown={commandCoolingDown}
        dramaticMoment={dramaticOverlay}
        resultStampPhase={resultStampPhase}
        onResultStampDismiss={handleResultStampDismiss}
        onClose={onClose}
      />

      <div className="battle-side-rail">
        <div className="battle-speed-controls battle-speed-under-right-flank" aria-label="Скорость боя">
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
            <button type="button" className="battle-skip-button" onClick={handleSkipBattle}>⏭ Пропустить</button>
          ) : null}
        </div>

        <div className={`battle-commentary${commentaryTone ? ` is-${commentaryTone}` : ''}`} aria-live="polite">
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
              disabled={isLast && resultStampPhase !== 'done'}
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
        </div>
      </div>
    </section>
  );
}

function getLaneLabel(lane: BattleLane): string {
  return lane === 'left' ? 'левый' : lane === 'right' ? 'правый' : 'центр';
}

function SideScore({
  state,
  side,
  snapshot,
  tactic,
  identityOverride,
}: {
  state: GameState;
  side: BattleSideId;
  snapshot: BattlePresentationSide;
  tactic: BattleTacticId;
  identityOverride?: import('@/ui/battles/BattleReport').BattleIdentityOverride;
}) {
  const units = Math.max(0, Math.round(snapshot.units));
  const morale = clamp(Math.round(snapshot.morale), 0, 100);
  const losses = Math.max(0, Math.round(snapshot.totalLosses));
  const identity = identityOverride ? {
    name: identityOverride.name,
    leaderName: identityOverride.leaderName ?? null,
    portraitSrc: identityOverride.portraitSrc ?? null,
    placeholderLabel: '',
  } : getFactionIdentity(state, snapshot.factionId);

  return (
    <div className={`battle-side-score side-${side.toLowerCase()}`}>
      <div className="battle-side-identity">
        {identityOverride?.hidePortrait ? null : identity.portraitSrc ? (
          <img className="battle-leader-portrait" src={identity.portraitSrc} alt="" draggable={false} />
        ) : (
          <div className="battle-leader-portrait is-placeholder" aria-label="Временный портрет">
            {identity.placeholderLabel}
          </div>
        )}
        <div>
          <strong>{identity.name}</strong>
          {identityOverride?.hidePortrait ? <small>местные жители</small> : <small>{identity.leaderName ?? 'портрет будет добавлен позже'}</small>}
        </div>
      </div>
      <span>{getTacticName(tactic)}</span>
      <div className="battle-score-values">
        <b>{units}</b>
        <span>бойцов</span>
      </div>
      <div className="morale-track" aria-label={`Моральная паника ${morale}`}>
        <i style={{ width: `${morale}%` }} />
      </div>
      <small>Моральная паника {morale} · потери {losses}</small>
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
  attackerCenterOnly,
  defenderCenterOnly,
  guaranteedBloodFrameIndex,
  attackerFactionId,
  defenderFactionId,
  flankSourceLane,
  onFlankSource,
  onFlankTarget,
  onFlankClear,
  activeFlankRedirects,
  activeLaneOrders,
  commandCoolingDown,
  dramaticMoment,
  resultStampPhase,
  onResultStampDismiss,
  onClose,
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
  attackerCenterOnly: boolean;
  defenderCenterOnly: boolean;
  guaranteedBloodFrameIndex: number;
  attackerFactionId: string;
  defenderFactionId: string;
  flankSourceLane?: BattleLane | null;
  onFlankSource?: (lane: BattleLane) => void;
  onFlankTarget?: (lane: BattleLane) => void;
  onFlankClear?: () => void;
  activeFlankRedirects: Partial<Record<BattleLane, BattleLane>>;
  activeLaneOrders: ActiveLaneOrders;
  commandCoolingDown: boolean;
  dramaticMoment: DramaticOverlayEvent | null;
  resultStampPhase: ResultStampPhase;
  onResultStampDismiss: () => void;
  onClose: () => void;
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
    centerOnly: attackerCenterOnly,
    laneRedirects: activeFlankRedirects,
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
    centerOnly: defenderCenterOnly,
    laneRedirects: {},
  });
  const lanePressures = getLanePressures(pressureShift, attackerTactic, defenderTactic);
  const impact = getImpactState(toFrame, progress);
  const hasImpact = impact.opacity > 0.04;
  const resultStampVisible = resultStampPhase === 'visible' || resultStampPhase === 'dismissing';

  return (
    <div
      className={`battle-pitch continuous-motion phase-${eventFrame.phase}${hasImpact ? ' has-impact' : ''}${dramaticMoment ? ` has-dramatic is-${dramaticMoment.tone}` : ''}${flankSourceLane ? ' is-flank-targeting' : ''}${commandCoolingDown ? ' is-command-cooldown' : ''}`}
      style={{ '--battle-impact-opacity': impact.opacity, backgroundImage: `url("${backgroundSrc}")` } as CSSProperties}
    >
      <img className="battle-scene-background" src={backgroundSrc} alt="" aria-hidden="true" draggable={false} />
      <div className="battle-scene-veil" aria-hidden="true" />
      {dramaticMoment ? <div key={dramaticMoment.key} className={`battle-dramatic-banner is-${dramaticMoment.tone}`} aria-live="polite"><strong>{dramaticMoment.title}</strong><span>{dramaticMoment.detail}</span></div> : null}
      {dramaticMoment ? <div key={`${dramaticMoment.key}-shock`} className="battle-impact-shockwave" aria-hidden="true" /> : null}

      <BattleLaneMoraleOverlay
        attacker={attackerSnapshot}
        defender={defenderSnapshot}
        attackerCenterOnly={attackerCenterOnly}
        defenderCenterOnly={defenderCenterOnly}
        activeLaneOrders={activeLaneOrders}
        selectedLane={flankSourceLane ?? null}
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

        {defenderCenterOnly ? <OrcFlankAttackArrows side="A" battleTime={battleTime} /> : null}
        {attackerCenterOnly ? <OrcFlankAttackArrows side="B" battleTime={battleTime} /> : null}

        <VolleyPaths side="A" dots={dotsA} phase={eventFrame.phase} battleTime={battleTime} pressureShift={pressureShift} />
        <VolleyPaths side="B" dots={dotsB} phase={eventFrame.phase} battleTime={battleTime} pressureShift={pressureShift} />
        <MeleeVectors side="A" dots={dotsA} phase={eventFrame.phase} battleTime={battleTime} tactic={attackerTactic} />
        <MeleeVectors side="B" dots={dotsB} phase={eventFrame.phase} battleTime={battleTime} tactic={defenderTactic} />
        <FlankRedirectPaths redirects={activeFlankRedirects} battleTime={battleTime} />
        <BattlePostureTacticalOverlay
          attacker={attackerSnapshot}
          defender={defenderSnapshot}
          activeLaneOrders={activeLaneOrders}
          attackerCenterOnly={attackerCenterOnly}
          defenderCenterOnly={defenderCenterOnly}
        />

        <FormationDots side="A" dots={dotsA} phase={eventFrame.phase} />
        <FormationDots side="B" dots={dotsB} phase={eventFrame.phase} />

        {(toFrame.lossesThisFrame.A ?? 0) > 0 && impact.opacity > 0 ? (
          <LossMarker side="A" amount={toFrame.lossesThisFrame.A ?? 0} opacity={impact.opacity} scale={impact.scale} />
        ) : null}
        {(toFrame.lossesThisFrame.B ?? 0) > 0 && impact.opacity > 0 ? (
          <LossMarker side="B" amount={toFrame.lossesThisFrame.B ?? 0} opacity={impact.opacity} scale={impact.scale} />
        ) : null}
        {shouldShowBloodSpray(toFrame, 'A', progress, guaranteedBloodFrameIndex) ? <BloodSpray side="A" frameIndex={toFrame.index} opacity={impact.opacity} tone={getBloodTone(attackerFactionId)} guaranteed={toFrame.index === guaranteedBloodFrameIndex} /> : null}
        {shouldShowBloodSpray(toFrame, 'B', progress, guaranteedBloodFrameIndex) ? <BloodSpray side="B" frameIndex={toFrame.index} opacity={impact.opacity} tone={getBloodTone(defenderFactionId)} guaranteed={toFrame.index === guaranteedBloodFrameIndex} /> : null}
      </svg>

      {onFlankSource && resultStampPhase === 'hidden' ? (
        <BattleFlankTapOverlay
          sourceLane={flankSourceLane ?? null}
          onSource={onFlankSource}
          onTarget={onFlankTarget}
          onClear={onFlankClear}
          attacker={attackerSnapshot}
          defender={defenderSnapshot}
          defenderCenterOnly={defenderCenterOnly}
          coolingDown={commandCoolingDown}
        />
      ) : null}

      {resultStampPhase === 'hidden' ? (
        <div className={`battle-reactive-hint${flankSourceLane ? ' is-targeting' : ''}${commandCoolingDown ? ' is-cooldown' : ''}`} aria-live="polite">
          {commandCoolingDown
            ? 'ПРИКАЗ ПЕРЕДАЁТСЯ…'
            : flankSourceLane
              ? 'ТАП ПО ЭТОМУ ФЛАНГУ ЕЩЁ РАЗ → ГЛУБОКАЯ ОБОРОНА · ПО ВРАГУ → НАТИСК · В ЦЕНТРАЛЬНУЮ ЗОНУ → ОСТОРОЖНО'
              : 'РЕАГИРУЙТЕ НА ВРАГА · ВЫБЕРИТЕ СВОЙ ФЛАНГ'}
        </div>
      ) : null}

      {resultStampVisible ? (
        <button
          type="button"
          className={`battle-result-stamp is-${winnerSide === 'A' ? 'victory' : 'defeat'}${resultStampPhase === 'dismissing' ? ' is-dismissing' : ''}`}
          onClick={onResultStampDismiss}
          aria-label={`${winnerSide === 'A' ? 'Победа' : 'Поражение'}. Нажмите, чтобы убрать печать.`}
        >
          <span className="battle-result-stamp-ring" aria-hidden="true" />
          <strong>{winnerSide === 'A' ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}</strong>
          <small>НАЖМИТЕ, ЧТОБЫ ПРОДОЛЖИТЬ</small>
        </button>
      ) : null}
      {resultStampPhase === 'done' ? (
        <button type="button" className="battle-return-map-button" onClick={onClose}>
          <span>К КАРТЕ</span>
          <small>Вернуться к экспедиции</small>
        </button>
      ) : null}
    </div>
  );
}

function BattleLaneMoraleOverlay({
  attacker,
  defender,
  attackerCenterOnly,
  defenderCenterOnly,
  activeLaneOrders,
  selectedLane,
}: {
  attacker: BattlePresentationSide;
  defender: BattlePresentationSide;
  attackerCenterOnly: boolean;
  defenderCenterOnly: boolean;
  activeLaneOrders: ActiveLaneOrders;
  selectedLane: BattleLane | null;
}) {
  const lanes: BattleLane[] = ['left', 'center', 'right'];
  return (
    <div className="battle-lane-status-overlay" aria-label="Моральная паника и поведение флангов">
      <div className="battle-lane-status-side side-a">
        {lanes.map((lane) => {
          if (attackerCenterOnly && lane !== 'center') return null;
          const sector = attacker.sectorState.sectors[lane];
          const order = activeLaneOrders[lane];
          const label = sector.broken
            ? 'СЛОМЛЕН'
            : sector.posture === 'rest'
              ? 'ОТДЫХ'
              : sector.posture === 'rest_broken'
                ? 'ОТДЫХ НАРУШЕН'
                : order?.mode === 'defend'
                ? 'ОБОРОНА'
                : order?.mode === 'attack'
                  ? `АТАКА → ${getLaneLabel(order.target).toUpperCase()}`
                  : order?.mode === 'cautious'
                    ? 'ОСТОРОЖНО'
                  : '';
          return <LaneMoraleRail key={lane} lane={lane} side="A" morale={sector.morale} broken={sector.broken} label={label} selected={selectedLane === lane} />;
        })}
      </div>
      <div className="battle-lane-status-side side-b">
        {lanes.map((lane) => {
          if (defenderCenterOnly && lane !== 'center') return null;
          const sector = defender.sectorState.sectors[lane];
          return <LaneMoraleRail key={lane} lane={lane} side="B" morale={sector.morale} broken={sector.broken} label={getPostureLabel(sector.posture, sector.broken)} selected={false} />;
        })}
      </div>
    </div>
  );
}

function LaneMoraleRail({ lane, side, morale, broken, label, selected }: { lane: BattleLane; side: BattleSideId; morale: number; broken: boolean; label: string; selected: boolean }) {
  return (
    <div className={`battle-lane-rail lane-${lane}${broken ? ' is-broken' : ''}${selected ? ' is-selected' : ''}`}>
      <div className="battle-lane-rail-bar" aria-label={`${getLaneLabel(lane)}: моральная паника ${Math.round(morale)}`}>
        <i style={{ height: `${clamp(Math.round(morale), 0, 100)}%` }} />
      </div>
      {label ? <span className={`battle-lane-rail-label side-${side.toLowerCase()}`}>{label}</span> : null}
    </div>
  );
}

function getPostureLabel(posture: import('@/core/battles/BattleTypes').BattleLanePosture, broken: boolean): string {
  if (broken) return 'СЛОМЛЕН';
  if (posture === 'assault') return 'НАТИСК';
  if (posture === 'rest') return 'ОТДЫХ';
  if (posture === 'rest_broken') return 'ОТДЫХ НАРУШЕН';
  if (posture === 'cautious') return 'ОСТОРОЖНО';
  return 'БОЙ';
}

function BattlePostureTacticalOverlay({
  attacker,
  defender,
  activeLaneOrders,
  attackerCenterOnly,
  defenderCenterOnly,
}: {
  attacker: BattlePresentationSide;
  defender: BattlePresentationSide;
  activeLaneOrders: ActiveLaneOrders;
  attackerCenterOnly: boolean;
  defenderCenterOnly: boolean;
}) {
  const laneY: Record<BattleLane, number> = { left: 24, center: 50, right: 76 };
  const lanes: BattleLane[] = ['left', 'center', 'right'];
  const marks: ReactNode[] = [];

  for (const lane of lanes) {
    if (!attackerCenterOnly || lane === 'center') {
      const sector = attacker.sectorState.sectors[lane];
      const order = activeLaneOrders[lane];
      if (!sector.broken && sector.units > 0) {
        if (order?.mode === 'defend') {
          marks.push(<TacticalModeGlyph key={`a-${lane}-def`} side="A" lane={lane} mode="defend" x={29} y={laneY[lane]} />);
        } else if (order?.mode === 'attack') {
          marks.push(<TacticalModeGlyph key={`a-${lane}-atk`} side="A" lane={lane} mode="assault" x={31} y={laneY[lane]} />);
          marks.push(<TacticalDirectionArrow key={`a-${lane}-arrow`} side="A" fromLane={lane} toLane={order.target} />);
        } else if (order?.mode === 'cautious') {
          marks.push(<TacticalModeGlyph key={`a-${lane}-cautious`} side="A" lane={lane} mode="cautious" x={31} y={laneY[lane]} />);
        } else if (sector.posture === 'rest') {
          marks.push(<TacticalModeGlyph key={`a-${lane}-rest`} side="A" lane={lane} mode="rest" x={25} y={laneY[lane]} />);
        } else if (sector.posture === 'rest_broken') {
          marks.push(<TacticalModeGlyph key={`a-${lane}-break`} side="A" lane={lane} mode="rest_broken" x={31} y={laneY[lane]} />);
        }
      }
    }

    if (!defenderCenterOnly || lane === 'center') {
      const sector = defender.sectorState.sectors[lane];
      if (!sector.broken && sector.units > 0) {
        if (sector.posture === 'assault') {
          marks.push(<TacticalModeGlyph key={`b-${lane}-atk`} side="B" lane={lane} mode="assault" x={69} y={laneY[lane]} />);
          marks.push(<TacticalDirectionArrow key={`b-${lane}-arrow`} side="B" fromLane={lane} toLane={lane} />);
        } else if (sector.posture === 'cautious') {
          marks.push(<TacticalModeGlyph key={`b-${lane}-cautious`} side="B" lane={lane} mode="cautious" x={69} y={laneY[lane]} />);
          marks.push(<TacticalDirectionArrow key={`b-${lane}-arrow`} side="B" fromLane={lane} toLane={lane} cautious />);
        } else if (sector.posture === 'rest') {
          marks.push(<TacticalModeGlyph key={`b-${lane}-rest`} side="B" lane={lane} mode="rest" x={75} y={laneY[lane]} />);
        } else if (sector.posture === 'rest_broken') {
          marks.push(<TacticalModeGlyph key={`b-${lane}-break`} side="B" lane={lane} mode="rest_broken" x={69} y={laneY[lane]} />);
        }
      }
    }
  }

  return <g className="battle-tactical-modes" aria-hidden="true">{marks}</g>;
}

function TacticalModeGlyph({ side, lane, mode, x, y }: { side: BattleSideId; lane: BattleLane; mode: 'assault' | 'cautious' | 'defend' | 'rest' | 'rest_broken'; x: number; y: number }) {
  const className = `battle-tactical-glyph side-${side.toLowerCase()} lane-${lane} is-${mode}`;
  if (mode === 'rest') {
    return (
      <g className={className} transform={`translate(${x} ${y})`}>
        <circle r="6.2" />
        <text x="0" y="1.8" textAnchor="middle">Zz</text>
      </g>
    );
  }
  if (mode === 'rest_broken') {
    return (
      <g className={className} transform={`translate(${x} ${y})`}>
        <circle r="6.2" />
        <text className="battle-rest-broken-zzz" x="0" y="1.7" textAnchor="middle">Z Z Z</text>
        <path className="battle-rest-broken-crack" d="M1.1 -5.1 L-1 -1.9 L1.2 -.2 L-1.5 2.1 L.2 3.1 L-1.2 5.2" />
      </g>
    );
  }
  if (mode === 'defend') {
    return (
      <g className={className} transform={`translate(${x} ${y})`}>
        <circle r="6.4" />
        <path d="M0 -4.8 L4.5 -2.6 L3.7 2.2 Q0 5.8 -3.7 2.2 L-4.5 -2.6 Z" />
      </g>
    );
  }
  if (mode === 'cautious') {
    return (
      <g className={className} transform={`translate(${x} ${y})`}>
        <circle r="6.4" />
        <path d="M-4.8 0 Q0 -4.2 4.8 0 Q0 4.2 -4.8 0 Z" />
        <circle className="battle-tactical-pupil" r="1.35" />
      </g>
    );
  }
  return (
    <g className={className} transform={`translate(${x} ${y})`}>
      <circle r="6.4" />
      <image
        className="battle-assault-icon-image"
        href={side === 'A' ? '/assets/battle-ui/assault-player.png' : '/assets/battle-ui/assault-enemy.png'}
        x="-5.3"
        y="-4.2"
        width="10.6"
        height="8.4"
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
}

function TacticalDirectionArrow({ side, fromLane, toLane, cautious = false }: { side: BattleSideId; fromLane: BattleLane; toLane: BattleLane; cautious?: boolean }) {
  const laneY: Record<BattleLane, number> = { left: 24, center: 50, right: 76 };
  const fromX = side === 'A' ? 36 : 64;
  const toX = side === 'A' ? 49 : 51;
  const fromY = laneY[fromLane];
  const toY = laneY[toLane];
  return (
    <path
      className={`battle-tactical-direction side-${side.toLowerCase()}${cautious ? ' is-cautious' : ''}`}
      d={`M${fromX} ${fromY} C${side === 'A' ? 42 : 58} ${fromY}, ${side === 'A' ? 44 : 56} ${toY}, ${toX} ${toY}`}
      markerEnd={side === 'A' ? 'url(#battle-arrow-a)' : 'url(#battle-arrow-b)'}
    />
  );
}

function BattleFlankTapOverlay({
  sourceLane,
  onSource,
  onTarget,
  onClear,
  attacker,
  defender,
  defenderCenterOnly,
  coolingDown,
}: {
  sourceLane: BattleLane | null;
  onSource: (lane: BattleLane) => void;
  onTarget?: (lane: BattleLane) => void;
  onClear?: () => void;
  attacker: BattlePresentationSide;
  defender: BattlePresentationSide;
  defenderCenterOnly: boolean;
  coolingDown: boolean;
}) {
  const lanes: BattleLane[] = ['left', 'center', 'right'];
  return (
    <div className={`battle-flank-tap-grid${sourceLane ? ' is-targeting' : ''}`} aria-label="Прямое управление флангами">
      <div className="battle-flank-tap-side is-own">
        {lanes.map((lane) => {
          const sector = attacker.sectorState.sectors[lane];
          const enabled = sector.units > 0 && !sector.broken;
          return (
            <button
              key={lane}
              type="button"
              className={`battle-flank-tap-zone lane-${lane}${sourceLane === lane ? ' is-selected' : ''}`}
              disabled={!enabled}
              aria-label={`Выбрать свой ${getLaneLabel(lane)} сектор`}
              onPointerUp={() => onSource(lane)}
            />
          );
        })}
      </div>
      <div className="battle-flank-tap-side is-enemy">
        {lanes.map((lane) => {
          const sector = defender.sectorState.sectors[lane];
          const valid = Boolean(!coolingDown && sourceLane && onTarget && isAdjacentLane(sourceLane, lane) && sector.units > 0 && !sector.broken && (!defenderCenterOnly || lane === 'center'));
          return (
            <button
              key={lane}
              type="button"
              className={`battle-flank-tap-zone lane-${lane}${valid ? ' is-valid-target' : ''}`}
              aria-disabled={!valid}
              aria-label={`Направить атаку на ${getLaneLabel(lane)} сектор противника`}
              onPointerUp={() => onTarget?.(lane)}
            />
          );
        })}
      </div>
      <div className="battle-flank-neutral-side" aria-hidden={!sourceLane}>
        {lanes.map((lane) => (
          <button
            key={lane}
            type="button"
            className={`battle-flank-neutral-zone lane-${lane}${sourceLane === lane && !coolingDown ? ' is-valid-clear' : ''}`}
            aria-disabled={!sourceLane || sourceLane !== lane || coolingDown || !onClear}
            aria-label={`Сбросить приказ на ${getLaneLabel(lane)} секторе до осторожного боя`}
            onPointerUp={() => onClear?.()}
          />
        ))}
      </div>
    </div>
  );
}


function FlankRedirectPaths({
  redirects,
  battleTime,
}: {
  redirects: Partial<Record<BattleLane, BattleLane>>;
  battleTime: number;
}) {
  const y: Record<BattleLane, number> = { left: 24, center: 50, right: 76 };
  const lanes: BattleLane[] = ['left', 'center', 'right'];
  const dash = -((battleTime * 9) % 14);
  return (
    <g className="battle-flank-redirect" aria-hidden="true">
      {lanes.map((source) => {
        const target = redirects[source];
        if (!target || target === source) return null;
        return (
          <path
            key={`${source}-${target}`}
            d={`M34 ${y[source]} C42 ${y[source]}, 43 ${y[target]}, 52 ${y[target]}`}
            style={{ strokeDashoffset: dash }}
            markerEnd="url(#battle-arrow-a)"
          />
        );
      })}
    </g>
  );
}

function OrcFlankAttackArrows({ side, battleTime }: { side: BattleSideId; battleTime: number }) {
  const phase = (battleTime % 1.5) / 1.5;
  const opacity = 0.42 + Math.sin(phase * Math.PI * 2) * 0.14;
  if (side === 'A') {
    return (
      <g className="orc-flank-attack-arrows side-a" style={{ opacity }}>
        <path d="M31 24 C39 25, 44 37, 51 48" />
        <path d="M31 76 C39 75, 44 63, 51 52" />
      </g>
    );
  }
  return (
    <g className="orc-flank-attack-arrows side-b" style={{ opacity }}>
      <path d="M69 24 C61 25, 56 37, 49 48" />
      <path d="M69 76 C61 75, 56 63, 49 52" />
    </g>
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


type DramaticBattleMoment = { title: string; detail: string; tone: 'positive' | 'danger' | 'neutral' };

function getBattleFrameOutcomeTone(frame: BattlePresentationFrame | undefined): DramaticBattleMoment['tone'] | null {
  if (!frame) return null;
  if (frame.title.includes('СЯН')) return 'positive';
  if (frame.title === 'Победа атакующих' || frame.title.includes('Оборона дрогнула')) return 'positive';
  if (frame.title === 'Атака отбита' || frame.title.includes('Линия атакующих сломлена')) return 'danger';
  if (frame.detail.includes('стороны A')) return 'danger';
  if (frame.detail.includes('стороны B')) return 'positive';
  const lossesA = frame.lossesThisFrame.A ?? 0;
  const lossesB = frame.lossesThisFrame.B ?? 0;
  if (lossesB > lossesA) return 'positive';
  if (lossesA > lossesB) return 'danger';
  return null;
}

function getDramaticBattleMoment(
  fromFrame: BattlePresentationFrame | undefined,
  toFrame: BattlePresentationFrame | undefined,
  progress: number,
): DramaticBattleMoment | null {
  if (!fromFrame || !toFrame) return null;
  if (progress < 0.18 || progress > 0.995 || fromFrame.index === toFrame.index) return null;
  if ((toFrame.stage ?? 1) !== (fromFrame.stage ?? 1) && (toFrame.stage ?? 1) > 1) {
    return {
      title: `ЭТАП ${toFrame.stage ?? 1} / 4`,
      detail: toFrame.stage === 4 ? 'Последняя четверть боя. Все прежние приказы сброшены.' : 'Натиск и защита сброшены. Фланги начинают этап со стандартного боя.',
      tone: 'neutral',
    };
  }
  if (toFrame.title.includes('СЯН')) {
    return { title: 'СЯН НАКОНЕЦ ПРИШЁЛ', detail: 'Опоздавший отряд врывается в бой и сносит целый вражеский фланг.', tone: 'positive' };
  }
  if (toFrame.detail.includes('Кубик паники')) {
    return { title: '🎲 ФЛАНГ СОРВАЛСЯ', detail: toFrame.detail, tone: toFrame.detail.includes('стороны A') ? 'danger' : 'positive' };
  }
  const lanes: BattleLane[] = ['left', 'center', 'right'];
  const newlyBrokenB = lanes.find((lane) => !fromFrame.sides.B.sectorState.sectors[lane].broken && toFrame.sides.B.sectorState.sectors[lane].broken);
  const newlyBrokenA = lanes.find((lane) => !fromFrame.sides.A.sectorState.sectors[lane].broken && toFrame.sides.A.sectorState.sectors[lane].broken);
  const bFlanksNow = toFrame.sides.B.sectorState.sectors.left.broken && toFrame.sides.B.sectorState.sectors.right.broken;
  const bFlanksBefore = fromFrame.sides.B.sectorState.sectors.left.broken && fromFrame.sides.B.sectorState.sectors.right.broken;
  const aFlanksNow = toFrame.sides.A.sectorState.sectors.left.broken && toFrame.sides.A.sectorState.sectors.right.broken;
  const aFlanksBefore = fromFrame.sides.A.sectorState.sectors.left.broken && fromFrame.sides.A.sectorState.sectors.right.broken;
  if (bFlanksNow && !bFlanksBefore) return { title: 'ОКРУЖЕНИЕ', detail: 'Оба вражеских фланга рухнули.', tone: 'positive' };
  if (aFlanksNow && !aFlanksBefore) return { title: 'ВАС ОКРУЖАЮТ', detail: 'Оба фланга экспедиции прорваны.', tone: 'danger' };
  if (newlyBrokenB) return { title: 'ФЛАНГ ПРОРВАН', detail: `${getLaneLabel(newlyBrokenB)} сектор противника бежит.`, tone: 'positive' };
  if (newlyBrokenA) return { title: 'НАШ ФЛАНГ ДРОГНУЛ', detail: `${getLaneLabel(newlyBrokenA)} сектор теряет строй.`, tone: 'danger' };
  const lossesA = toFrame.lossesThisFrame.A ?? 0;
  const lossesB = toFrame.lossesThisFrame.B ?? 0;
  if (lossesB >= 3 && lossesB >= lossesA + 2) return { title: 'СОКРУШИТЕЛЬНЫЙ УДАР', detail: `Противник теряет ${lossesB} бойцов за один обмен.`, tone: 'positive' };
  if (lossesA >= 3 && lossesA >= lossesB + 2) return { title: 'ТЯЖЁЛЫЕ ПОТЕРИ', detail: `Экспедиция теряет ${lossesA} бойцов за один обмен.`, tone: 'danger' };
  if (lossesB >= 2) return { title: 'УДАР ПО СТРОЮ', detail: `Вражеская линия теряет ${lossesB} бойцов.`, tone: 'positive' };
  if (lossesA >= 2) return { title: 'ЖЁСТКИЙ КОНТАКТ', detail: `Экспедиция теряет ${lossesA} бойцов.`, tone: 'danger' };
  return null;
}

function isAdjacentLane(source: BattleLane, target: BattleLane): boolean {
  const order: BattleLane[] = ['left', 'center', 'right'];
  return Math.abs(order.indexOf(source) - order.indexOf(target)) <= 1;
}

function getFlankCommand(source: BattleLane, target: BattleLane): BattleCommandId | null {
  if (source === 'left' && target === 'left') return 'flank_left_to_left';
  if (source === 'left' && target === 'center') return 'flank_left_to_center';
  if (source === 'center' && target === 'left') return 'flank_center_to_left';
  if (source === 'center' && target === 'center') return 'flank_center_to_center';
  if (source === 'center' && target === 'right') return 'flank_center_to_right';
  if (source === 'right' && target === 'center') return 'flank_right_to_center';
  if (source === 'right' && target === 'right') return 'flank_right_to_right';
  return null;
}

function getActiveLaneOrders(commands: BattleCommandId[], commandRounds: number[], round: number, resetRound = 1): ActiveLaneOrders {
  const result: ActiveLaneOrders = { left: null, center: null, right: null };
  const unresolved = new Set<BattleLane>(['left', 'center', 'right']);
  for (let index = commands.length - 1; index >= 0 && unresolved.size > 0; index -= 1) {
    const commandRound = commandRounds[index] ?? (index === 0 ? 2 : index === 1 ? 4 : (index + 1) * 2);
    if (commandRound > round || commandRound < resetRound) continue;
    const command = commands[index];
    if (command === 'none') break;
    for (const lane of [...unresolved]) {
      if ((command === 'clear_left' && lane === 'left') || (command === 'clear_center' && lane === 'center') || (command === 'clear_right' && lane === 'right')) {
        result[lane] = { mode: 'cautious' };
        unresolved.delete(lane);
        continue;
      }
      const order = getLaneOrderFromCommand(command, lane);
      if (!order) continue;
      result[lane] = order;
      unresolved.delete(lane);
    }
  }
  return result;
}

function getLaneOrderFromCommand(command: BattleCommandId, lane: BattleLane): ActiveLaneOrder {
  if (command === 'hold_line') return { mode: 'defend' };
  if (command === 'general_assault') return { mode: 'attack', target: lane };
  if (command === 'defend_left' && lane === 'left') return { mode: 'defend' };
  if (command === 'defend_center' && lane === 'center') return { mode: 'defend' };
  if (command === 'defend_right' && lane === 'right') return { mode: 'defend' };
  if (command === 'clear_left' && lane === 'left') return { mode: 'cautious' };
  if (command === 'clear_center' && lane === 'center') return { mode: 'cautious' };
  if (command === 'clear_right' && lane === 'right') return { mode: 'cautious' };
  if ((command === 'press_left' || command === 'flank_left_to_left') && lane === 'left') return { mode: 'attack', target: 'left' };
  if (command === 'flank_left_to_center' && lane === 'left') return { mode: 'attack', target: 'center' };
  if (command === 'flank_center_to_left' && lane === 'center') return { mode: 'attack', target: 'left' };
  if ((command === 'press_center' || command === 'flank_center_to_center') && lane === 'center') return { mode: 'attack', target: 'center' };
  if (command === 'flank_center_to_right' && lane === 'center') return { mode: 'attack', target: 'right' };
  if (command === 'flank_right_to_center' && lane === 'right') return { mode: 'attack', target: 'center' };
  if ((command === 'press_right' || command === 'flank_right_to_right') && lane === 'right') return { mode: 'attack', target: 'right' };
  return null;
}

function getGlobalBloodState(
  frame: BattlePresentationFrame | undefined,
  progress: number,
  guaranteedFrameIndex: number,
  factionA: string,
  factionB: string,
): { show: boolean; tone: 'red' | 'pink' } {
  if (!frame) return { show: false, tone: 'red' };
  const lossA = frame.lossesThisFrame.A ?? 0;
  const lossB = frame.lossesThisFrame.B ?? 0;
  const total = lossA + lossB;
  const guaranteed = frame.index === guaranteedFrameIndex && progress >= 0.30 && progress <= 0.88;
  const extra = total >= 3 && progress >= 0.48 && progress <= 0.82 && (frame.index + total) % 3 === 0;
  const victimFaction = lossA >= lossB ? factionA : factionB;
  return { show: guaranteed || extra, tone: getBloodTone(victimFaction) };
}

function GlobalBloodSplatter({ tone, phase }: { tone: 'red' | 'pink'; phase: number }) {
  const flip = phase % 2 === 0 ? 1 : -1;
  return (
    <svg className={`battle-global-blood is-${tone}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <g transform={`translate(${flip < 0 ? 100 : 0} 0) scale(${flip} 1)`}>
        <path d="M-4 42 C8 32 13 38 19 31 C24 27 26 36 32 34 C25 44 16 47 7 55 Z" />
        <path d="M7 18 C13 13 16 18 20 12 C23 21 20 29 14 33 Z" />
        <circle cx="26" cy="20" r="2.4" />
        <circle cx="33" cy="27" r="1.5" />
        <circle cx="18" cy="60" r="2.1" />
        <circle cx="38" cy="43" r="1.2" />
        <circle cx="11" cy="72" r="1.4" />
      </g>
      <g opacity=".72" transform={`translate(${flip > 0 ? 100 : 0} 0) scale(${-flip} 1)`}>
        <path d="M-3 68 C7 61 12 67 19 59 C22 69 19 77 11 83 Z" />
        <circle cx="23" cy="75" r="1.8" />
        <circle cx="31" cy="69" r="1" />
      </g>
    </svg>
  );
}

function shouldShowBloodSpray(
  frame: BattlePresentationFrame,
  side: BattleSideId,
  progress: number,
  guaranteedFrameIndex: number,
): boolean {
  const losses = frame.lossesThisFrame[side] ?? 0;
  const totalLosses = (frame.lossesThisFrame.A ?? 0) + (frame.lossesThisFrame.B ?? 0);
  if (frame.index === guaranteedFrameIndex && progress >= 0.18 && progress <= 0.99) {
    // Put the guaranteed spray on the side that actually lost people in this frame.
    // In a zero-casualty edge case, still show one visible spray so every battle has a visceral beat.
    if (totalLosses <= 0) return side === 'B';
    if (losses > 0) return true;
    const other: BattleSideId = side === 'A' ? 'B' : 'A';
    return (frame.lossesThisFrame[other] ?? 0) <= 0;
  }
  if (losses <= 0 || progress < 0.42 || progress > 0.97) return false;
  const salt = side === 'A' ? 3 : 7;
  return (frame.index * 5 + losses * 2 + salt) % 4 !== 0;
}

function BloodSpray({
  side,
  frameIndex,
  opacity,
  tone,
  guaranteed,
}: {
  side: BattleSideId;
  frameIndex: number;
  opacity: number;
  tone: 'red' | 'pink';
  guaranteed: boolean;
}) {
  const x = side === 'A' ? 42 : 58;
  const laneY = [24, 50, 76][frameIndex % 3] ?? 50;
  const direction = side === 'A' ? -1 : 1;
  const phase = frameIndex % 4;
  const size = guaranteed ? 1.55 : 1;
  const effectiveOpacity = guaranteed ? Math.max(0.82, opacity) : Math.max(0.52, opacity * 0.88);
  return (
    <g
      className={`battle-blood-spray is-${tone}${guaranteed ? ' is-guaranteed' : ''}`}
      opacity={effectiveOpacity}
      transform={`translate(${x} ${laneY}) scale(${size}) translate(${-x} ${-laneY})`}
      aria-hidden="true"
    >
      <path d={`M ${x} ${laneY} q ${direction * (5.4 + phase)} -${3.4 + phase * 0.5} ${direction * (11.5 + phase)} -${2.0 + phase * 0.4}`} />
      <path className="blood-secondary-streak" d={`M ${x + direction * 1.1} ${laneY + 1.2} q ${direction * 3.7} ${2.4 + phase * 0.2} ${direction * 8.5} ${3.6 + phase * 0.3}`} />
      <circle cx={x + direction * (5.1 + phase)} cy={laneY - 2.8} r="1.02" />
      <circle cx={x + direction * (8.3 + phase * 0.6)} cy={laneY + 1.8} r="0.72" />
      <circle cx={x + direction * (4.2 + phase * 0.4)} cy={laneY + 3.7} r="0.56" />
      <circle cx={x + direction * (11.1 + phase * 0.3)} cy={laneY - 4.1} r="0.46" />
      <circle cx={x + direction * (7.1 + phase * 0.2)} cy={laneY - 5.3} r="0.34" />
    </g>
  );
}

function getBloodTone(factionId: string): 'red' | 'pink' {
  return factionId === 'orsia-lateki' || factionId === 'orsia-tyranids' ? 'pink' : 'red';
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
  const animated = phase !== 'opening' && phase !== 'finish';
  return (
    <g className={`battle-dots side-${side.toLowerCase()}${animated ? ' is-animated' : ''}`}>
      {dots.map((dot, index) => (
        <g
          key={`${side}-${dot.id}`}
          className={`battle-unit-slot role-${dot.role} lane-${dot.lane}${prototypeUnits[dot.unitTypeId]?.isUnique ? ' is-unique' : ''}${dot.weakened ? ' is-weakened' : ''}${dot.brokenLane ? ' is-broken-lane' : ''}`}
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
  if (phase !== 'clash' && phase !== 'advance' && phase !== 'morale') return null;
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
    initialLaneRosters: to.initialLaneRosters,
    lateArrivalRoster: to.lateArrivalRoster,
    lateArrivalCommitted: progress >= 0.5 ? to.lateArrivalCommitted : from.lateArrivalCommitted,
    roster: progress >= 0.5 ? to.roster : from.roster,
    broken: progress >= 0.7 ? to.broken : from.broken,
    outcome: progress >= 0.96 ? to.outcome : from.outcome,
    initialSectorState: to.initialSectorState,
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
    posture: progress >= 0.55 ? to.posture : from.posture,
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
