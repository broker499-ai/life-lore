import { describe, expect, it } from 'vitest';
import { createRngState, createRngStreams, nextRandom, randomInt } from './seededRandom';

describe('seeded RNG', () => {
  it('replays the same sequence from the same saved state', () => {
    const start = createRngState(12345);
    const first = nextRandom(start);
    const second = nextRandom(first.state);

    const replayFirst = nextRandom(start);
    const replaySecond = nextRandom(replayFirst.state);

    expect([replayFirst.value, replaySecond.value]).toEqual([first.value, second.value]);
    expect(second.state.cursor).toBe(2);
  });

  it('keeps campaign and battle streams independent', () => {
    const streams = createRngStreams(42);
    const battleBeforeCampaignCall = nextRandom(streams.battles);

    const campaignCall = nextRandom(streams.campaign);
    expect(campaignCall.state.cursor).toBe(1);

    const battleAfterCampaignCall = nextRandom(streams.battles);
    expect(battleAfterCampaignCall.value).toBe(battleBeforeCampaignCall.value);
  });

  it('produces inclusive integer bounds', () => {
    let state = createRngState(7);
    for (let i = 0; i < 100; i += 1) {
      const result = randomInt(state, 1, 20);
      expect(result.value).toBeGreaterThanOrEqual(1);
      expect(result.value).toBeLessThanOrEqual(20);
      state = result.state;
    }
  });
});
