import { describe, expect, it } from 'vitest';
import { evaluatePlayerDefeat } from './campaignOutcome';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';

describe('campaign outcome', () => {
  it('ends the campaign if the player army has no surviving units', () => {
    const state = createPrototypeGameState(8);
    state.armies['player-main'].roster = {};

    const result = evaluatePlayerDefeat(state);

    expect(result.state.campaign.status).toBe('defeat');
    expect(result.state.campaign.endingReason).toBe('army_destroyed');
    expect(result.events).toContainEqual({
      type: 'campaign_ended',
      status: 'defeat',
      reason: 'army_destroyed',
      turn: 1,
    });
  });
});
