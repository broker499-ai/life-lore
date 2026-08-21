import { expect, it } from 'vitest';
import { applyTravelAttrition } from '@/core/supply/applyTravelAttrition';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';

it('loses a few units at end of a supplyless turn while travelling', () => {
  const state = createPrototypeGameState(41, 'vlados');
  const faction = state.factions[state.playerFactionId];
  const army = state.armies['player-main'];
  state.factions[state.playerFactionId] = { ...faction, resources: { ...faction.resources, supplies: 0 } };
  state.armies['player-main'] = { ...army, nodeId: 'warehouse-2' };
  const before = Object.values(army.roster).reduce((sum, amount) => sum + amount, 0);
  const result = applyTravelAttrition(state);
  const after = Object.values(result.state.armies['player-main'].roster).reduce((sum, amount) => sum + amount, 0);
  expect(after).toBeLessThan(before);
  expect(result.events[0]?.unitsLost).toBeGreaterThanOrEqual(1);
});
