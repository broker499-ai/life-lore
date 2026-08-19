import { describe, expect, it } from 'vitest';
import type { BattlePresentationFrame } from '@/core/battles/presentation/BattlePresentation';
import {
  advanceBattleElapsedMs,
  buildBattlePlaybackTrack,
  getBattleFrameTimeMs,
  getBattlePlaybackDelayMs,
  getNextBattleFrameIndex,
  sampleBattlePlayback,
} from '@/core/battles/presentation/BattlePlayback';

function frame(index: number, at: number, phase: BattlePresentationFrame['phase']): BattlePresentationFrame {
  return {
    index,
    at,
    round: index,
    phase,
    title: 'test',
    detail: 'test',
    rolls: {},
    lossesThisFrame: {},
    sides: {
      A: { factionId: 'a', initialUnits: 10, units: 10, morale: 80, totalLosses: 0, initialRoster: { line: 10 }, roster: { line: 10 }, broken: false, outcome: null, sectorState: { sectors: { left: { units: 2, morale: 80, broken: false }, center: { units: 6, morale: 80, broken: false }, right: { units: 2, morale: 80, broken: false } }, reserveUnits: 0, reserveCommitted: true } },
      B: { factionId: 'b', initialUnits: 10, units: 10, morale: 80, totalLosses: 0, initialRoster: { line: 10 }, roster: { line: 10 }, broken: false, outcome: null, sectorState: { sectors: { left: { units: 2, morale: 80, broken: false }, center: { units: 6, morale: 80, broken: false }, right: { units: 2, morale: 80, broken: false } }, reserveUnits: 0, reserveCommitted: true } },
    },
  };
}

describe('battle playback timing', () => {
  it('keeps legacy x1/x2/x4 timing proportional', () => {
    const current = frame(0, 0, 'opening');
    const next = frame(1, 4, 'clash');
    const x1 = getBattlePlaybackDelayMs(current, next, 1);
    const x2 = getBattlePlaybackDelayMs(current, next, 2);
    const x4 = getBattlePlaybackDelayMs(current, next, 4);

    expect(x2).toBeLessThan(x1);
    expect(x4).toBeLessThan(x2);
    expect(x4).toBeGreaterThanOrEqual(140);
  });

  it('caps long simulation gaps so large battles remain watchable', () => {
    const current = frame(0, 0, 'opening');
    const next = frame(1, 60, 'advance');
    expect(getBattlePlaybackDelayMs(current, next, 1)).toBeLessThanOrEqual(1200);
  });
});

describe('continuous battle playback track', () => {
  const frames = [frame(0, 0, 'opening'), frame(1, 4, 'advance'), frame(2, 8, 'clash')];
  const track = buildBattlePlaybackTrack(frames);

  it('builds one continuous segment between every pair of frames', () => {
    expect(track.segments).toHaveLength(2);
    expect(track.durationMs).toBeGreaterThan(0);
    expect(getBattleFrameTimeMs(track, 0)).toBe(0);
    expect(getBattleFrameTimeMs(track, 2)).toBe(track.durationMs);
  });

  it('samples between frames instead of jumping discretely', () => {
    const firstSegment = track.segments[0];
    expect(firstSegment).toBeDefined();
    if (!firstSegment) return;

    const sample = sampleBattlePlayback(frames, track, firstSegment.startMs + firstSegment.durationMs / 2);
    expect(sample.fromIndex).toBe(0);
    expect(sample.toIndex).toBe(1);
    expect(sample.progress).toBeCloseTo(0.5, 4);
    expect(sample.easedProgress).toBeCloseTo(0.5, 4);
    expect(sample.battleTime).toBeCloseTo(2, 4);
  });

  it('advances the same continuous clock faster at x2/x4', () => {
    expect(advanceBattleElapsedMs(0, 100, 1, 1000)).toBe(100);
    expect(advanceBattleElapsedMs(0, 100, 2, 1000)).toBe(200);
    expect(advanceBattleElapsedMs(0, 100, 4, 1000)).toBe(400);
    expect(advanceBattleElapsedMs(900, 100, 4, 1000)).toBe(1000);
  });
});

describe('getNextBattleFrameIndex', () => {
  it('never advances beyond the final frame', () => {
    expect(getNextBattleFrameIndex(0, 3)).toBe(1);
    expect(getNextBattleFrameIndex(2, 3)).toBe(2);
    expect(getNextBattleFrameIndex(0, 0)).toBe(0);
  });
});
