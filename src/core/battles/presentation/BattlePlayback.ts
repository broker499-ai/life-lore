import type { BattlePresentationFrame, BattlePresentationPhase } from '@/core/battles/presentation/BattlePresentation';

export type BattlePlaybackSpeed = 1 | 2 | 4;

export type BattlePlaybackSegment = {
  fromIndex: number;
  toIndex: number;
  startMs: number;
  endMs: number;
  durationMs: number;
};

export type BattlePlaybackTrack = {
  durationMs: number;
  segments: BattlePlaybackSegment[];
  frameTimesMs: number[];
};

export type BattlePlaybackSample = {
  fromIndex: number;
  toIndex: number;
  progress: number;
  easedProgress: number;
  elapsedMs: number;
  battleTime: number;
};

const PHASE_MINIMUM_MS: Record<BattlePresentationPhase, number> = {
  opening: 900,
  advance: 1050,
  clash: 1900,
  morale: 1300,
  break: 2300,
  finish: 1900,
};

const TIMELINE_MS_PER_SECOND = 220;
const MIN_PLAYBACK_DELAY_MS = 140;
const MAX_PLAYBACK_DELAY_MS = 2600;
// The opening has several bookkeeping frames (formation, stage reset, round start).
// Without compressing that micro-window, phase minimums postpone the first visible
// enemy posture to ~7–8 real seconds. Keep the first tactical reveal near 2s at x1.
const INITIAL_TACTICAL_REVEAL_SIM_SECONDS = 1.08;
const INITIAL_TACTICAL_REVEAL_REAL_MS = 2000;

/**
 * Legacy-compatible segment timing helper. Stage 10 uses this value as the
 * x1 visual duration of a segment; playback speed now advances the continuous
 * battle clock faster instead of scheduling discrete timeouts.
 */
export function getBattlePlaybackDelayMs(
  current: BattlePresentationFrame,
  next: BattlePresentationFrame,
  speed: BattlePlaybackSpeed,
): number {
  return Math.max(MIN_PLAYBACK_DELAY_MS, Math.round(getBattleSegmentDurationMs(current, next) / speed));
}

export function getBattleSegmentDurationMs(
  current: BattlePresentationFrame,
  next: BattlePresentationFrame,
): number {
  const simulatedSeconds = Math.max(1, next.at - current.at);
  const timelineDelay = simulatedSeconds * TIMELINE_MS_PER_SECOND;
  const phaseDelay = PHASE_MINIMUM_MS[next.phase];
  return clamp(Math.max(timelineDelay, phaseDelay), 650, MAX_PLAYBACK_DELAY_MS);
}

export function buildBattlePlaybackTrack(frames: BattlePresentationFrame[]): BattlePlaybackTrack {
  if (frames.length <= 1) {
    return {
      durationMs: 0,
      segments: [],
      frameTimesMs: frames.length === 1 ? [0] : [],
    };
  }

  const segments: BattlePlaybackSegment[] = [];
  const frameTimesMs = new Array<number>(frames.length).fill(0);
  let cursorMs = 0;

  for (let index = 0; index < frames.length - 1; index += 1) {
    const current = frames[index];
    const next = frames[index + 1];
    if (!current || !next) continue;

    const durationMs = getTrackSegmentDurationMs(current, next, cursorMs);
    segments.push({
      fromIndex: index,
      toIndex: index + 1,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
      durationMs,
    });
    frameTimesMs[index] = cursorMs;
    cursorMs += durationMs;
    frameTimesMs[index + 1] = cursorMs;
  }

  return { durationMs: cursorMs, segments, frameTimesMs };
}


function getTrackSegmentDurationMs(
  current: BattlePresentationFrame,
  next: BattlePresentationFrame,
  cursorMs: number,
): number {
  if (next.at <= INITIAL_TACTICAL_REVEAL_SIM_SECONDS + 0.0001) {
    const targetEndMs = Math.round(
      (Math.max(0, next.at) / INITIAL_TACTICAL_REVEAL_SIM_SECONDS) * INITIAL_TACTICAL_REVEAL_REAL_MS,
    );
    return Math.max(1, targetEndMs - cursorMs);
  }
  return getBattleSegmentDurationMs(current, next);
}

export function sampleBattlePlayback(
  frames: BattlePresentationFrame[],
  track: BattlePlaybackTrack,
  elapsedMs: number,
): BattlePlaybackSample {
  if (frames.length === 0) {
    return {
      fromIndex: 0,
      toIndex: 0,
      progress: 0,
      easedProgress: 0,
      elapsedMs: 0,
      battleTime: 0,
    };
  }

  if (frames.length === 1 || track.durationMs <= 0 || track.segments.length === 0) {
    return {
      fromIndex: 0,
      toIndex: 0,
      progress: 1,
      easedProgress: 1,
      elapsedMs: 0,
      battleTime: frames[0]?.at ?? 0,
    };
  }

  const safeElapsed = clamp(elapsedMs, 0, track.durationMs);
  if (safeElapsed >= track.durationMs) {
    const lastIndex = frames.length - 1;
    return {
      fromIndex: lastIndex,
      toIndex: lastIndex,
      progress: 1,
      easedProgress: 1,
      elapsedMs: track.durationMs,
      battleTime: frames[lastIndex]?.at ?? 0,
    };
  }

  const segment =
    track.segments.find((candidate) => safeElapsed >= candidate.startMs && safeElapsed < candidate.endMs) ??
    track.segments[track.segments.length - 1];

  if (!segment) {
    return {
      fromIndex: 0,
      toIndex: 0,
      progress: 0,
      easedProgress: 0,
      elapsedMs: safeElapsed,
      battleTime: frames[0]?.at ?? 0,
    };
  }

  const progress = clamp((safeElapsed - segment.startMs) / Math.max(1, segment.durationMs), 0, 1);
  const from = frames[segment.fromIndex] ?? frames[0];
  const to = frames[segment.toIndex] ?? from;
  const easedProgress = smoothstep(progress);

  return {
    fromIndex: segment.fromIndex,
    toIndex: segment.toIndex,
    progress,
    easedProgress,
    elapsedMs: safeElapsed,
    battleTime: lerp(from?.at ?? 0, to?.at ?? from?.at ?? 0, progress),
  };
}

export function advanceBattleElapsedMs(
  elapsedMs: number,
  realDeltaMs: number,
  speed: BattlePlaybackSpeed,
  durationMs: number,
): number {
  return clamp(elapsedMs + Math.max(0, realDeltaMs) * speed, 0, Math.max(0, durationMs));
}

export function getBattleFrameTimeMs(track: BattlePlaybackTrack, frameIndex: number): number {
  if (track.frameTimesMs.length === 0) return 0;
  const safeIndex = clamp(Math.round(frameIndex), 0, track.frameTimesMs.length - 1);
  return track.frameTimesMs[safeIndex] ?? 0;
}

export function getNextBattleFrameIndex(currentIndex: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.min(Math.max(0, currentIndex + 1), frameCount - 1);
}

export function getPreviousBattleFrameIndex(currentIndex: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.max(0, Math.min(frameCount - 1, currentIndex - 1));
}

function smoothstep(value: number): number {
  const safe = clamp(value, 0, 1);
  return safe * safe * (3 - 2 * safe);
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
