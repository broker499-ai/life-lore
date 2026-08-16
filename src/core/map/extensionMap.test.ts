import { describe, expect, it } from 'vitest';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { resolveLocationEvent, triggerLocationEvent } from '@/core/events/LocationEvent';
import {
  FALSE_ROOT_EVENT_ID,
  TRUE_ROOT_NODE_ID,
  extensionLocationIds,
  getCampaignMap,
  getExtensionStagingCityId,
} from '@/core/map/extensionMap';
import { prototypeEvents } from '@/data/events/prototypeEvents';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';

function revealExtension() {
  let state = createPrototypeGameState(123, 'vlados');
  state.armies['player-main'].nodeId = 'root-sanctum';
  state = triggerLocationEvent(state, 'root-sanctum', prototypeEvents).state;
  const result = resolveLocationEvent(
    state,
    {
      eventId: FALSE_ROOT_EVENT_ID,
      choiceId: 'continue-deeper',
      factionId: state.playerFactionId,
      armyId: 'player-main',
      supplyCap: 100,
      moraleCap: 100,
    },
    prototypeEvents,
    prototypeArtifacts,
  );
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe('Stage 28 map extension', () => {
  it('keeps the second map completely absent before the false-root event', () => {
    const state = createPrototypeGameState(123, 'iliesh');
    const graph = getCampaignMap(state);
    expect(graph.nodes).toHaveLength(21);
    expect(graph.nodes.some((node) => extensionLocationIds.includes(node.id as (typeof extensionLocationIds)[number]))).toBe(false);
  });

  it('uses a reproducible randomized linear order and ends it with a city', () => {
    const a = createPrototypeGameState(123);
    const b = createPrototypeGameState(123);
    expect(a.campaign.extensionLocationOrder).toEqual(b.campaign.extensionLocationOrder);
    expect(new Set(a.campaign.extensionLocationOrder).size).toBe(extensionLocationIds.length);
    expect(a.campaign.extensionLocationOrder).not.toEqual([...extensionLocationIds]);
    expect(getExtensionStagingCityId(a)).toBe(a.campaign.extensionLocationOrder.at(-1));
  });

  it('reveals the full second section only after acknowledging the visual-root event', () => {
    const state = revealExtension();
    const graph = getCampaignMap(state);
    expect(graph.nodes).toHaveLength(21 + extensionLocationIds.length + 1);
    expect(graph.nodes.some((node) => node.id === TRUE_ROOT_NODE_ID)).toBe(true);
    for (const nodeId of [...extensionLocationIds, TRUE_ROOT_NODE_ID]) {
      expect(state.campaign.discoveredNodeIds).toContain(nodeId);
    }
    const order = state.campaign.extensionLocationOrder;
    for (let index = 1; index < order.length; index += 1) {
      const from = order[index - 1];
      const to = order[index];
      expect(graph.edges.some((edge) => edge.from === from && edge.to === to)).toBe(true);
    }
  });
});
