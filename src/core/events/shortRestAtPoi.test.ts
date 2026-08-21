import { expect, it } from 'vitest';
import { shortRestAtPoi } from '@/core/events/shortRestAtPoi';
import { getCampaignMap } from '@/core/map/extensionMap';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';

it('gives one small field rest per POI', () => {
  const state = createPrototypeGameState(42, 'vlados');
  const army = state.armies['player-main'];
  const faction = state.factions[state.playerFactionId];
  state.armies['player-main'] = { ...army, nodeId: 'warehouse-2', morale: 60 };
  state.factions[state.playerFactionId] = { ...faction, resources: { ...faction.resources, supplies: 0 } };
  const graph = getCampaignMap(state);
  const first = shortRestAtPoi(state, graph, { armyId: 'player-main', nodeId: 'warehouse-2', supplyCap: 100, moraleCap: 100 });
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  expect(first.suppliesRestored).toBeGreaterThan(0);
  const second = shortRestAtPoi(first.state, graph, { armyId: 'player-main', nodeId: 'warehouse-2', supplyCap: 100, moraleCap: 100 });
  expect(second.ok).toBe(false);
});
