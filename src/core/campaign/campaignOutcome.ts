import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type { GameEvent } from '@/core/commands/CommandResult';
import type { GameState } from '@/core/state/GameState';

export function evaluatePlayerDefeat(
  state: GameState,
  playerArmyId = 'player-main',
): { state: GameState; events: GameEvent[] } {
  if (state.campaign.status !== 'active') return { state, events: [] };
  const army = state.armies[playerArmyId];
  if (army && getRosterTotalUnits(army.roster) > 0) return { state, events: [] };

  return {
    state: {
      ...state,
      campaign: {
        ...state.campaign,
        pendingEventId: null,
        pendingBriefingId: null,
        status: 'defeat',
        endingReason: 'army_destroyed',
        endedTurn: state.turn,
      },
    },
    events: [{ type: 'campaign_ended', status: 'defeat', reason: 'army_destroyed', turn: state.turn }],
  };
}
