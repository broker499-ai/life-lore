import { describe, expect, it } from 'vitest';
import { simulateCampaign } from '@/simulation/simulateCampaign';

describe('headless campaign simulator', () => {
  it('replays the same seed deterministically', () => {
    const input = { seed: 17, leaderId: 'makson', strategy: 'research' as const, maxTurns: 25 };
    expect(simulateCampaign(input)).toEqual(simulateCampaign(input));
  });

  it('produces a bounded result instead of mutating the campaign forever', () => {
    const result = simulateCampaign({ seed: 9, leaderId: 'artemios', strategy: 'balanced', maxTurns: 20 });
    expect(['victory', 'defeat', 'timeout']).toContain(result.status);
    expect(result.turns).toBeLessThanOrEqual(21);
    expect(result.seed).toBe(9);
  });
});
