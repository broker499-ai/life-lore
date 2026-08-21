import { expect, it } from 'vitest';
import { getCampaignMap } from '@/core/map/extensionMap';
import { getNeighborNodeIds } from '@/core/map/MapGraph';
import { moveArmy } from '@/core/map/moveArmy';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';

it('allows a supplyless expedition to keep travelling instead of softlocking', () => {
  const state = createPrototypeGameState(22, 'vlados');
  const faction = state.factions[state.playerFactionId];
  state.factions[state.playerFactionId] = { ...faction, resources: { ...faction.resources, supplies: 0 } };
  const graph = getCampaignMap(state);
  const from = state.armies['player-main'].nodeId;
  const to = getNeighborNodeIds(graph, from)[0];
  if (!to) throw new Error('expected a neighbor');
  if (state.cities[to]) state.cities[to] = { ...state.cities[to], ownerFactionId: state.playerFactionId };
  const result = moveArmy(state, graph, { armyId: 'player-main', toNodeId: to, supplyCost: 8 });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.events[0].supplyCost).toBe(0);
  expect(result.events[0].supplyShortfall).toBeGreaterThan(0);
});
