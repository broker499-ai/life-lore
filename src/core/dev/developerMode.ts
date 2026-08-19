import type { FactionId, GameState } from '@/core/state/GameState';

export function hasUnlimitedStrategicActions(state: GameState, factionId: FactionId): boolean {
  return state.campaign.developerMode && factionId === state.playerFactionId;
}

export function shouldSpendStrategicAction(state: GameState, factionId: FactionId): boolean {
  return !hasUnlimitedStrategicActions(state, factionId);
}
