import { describe, expect, it } from 'vitest';
import { getShortestPathDistance } from '@/core/map/MapGraph';
import { getCampaignMap } from '@/core/map/extensionMap';
import { PRE_ROOT_LAYOUT_IDS, PRE_ROOT_RANDOMIZED_LOCATION_IDS } from '@/core/map/preRootMap';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';

describe('Stage 34 randomized pre-root map', () => {
  it('is deterministic for a seed but varies across campaigns', () => {
    const a = createPrototypeGameState(341);
    const b = createPrototypeGameState(341);
    expect(a.campaign.preRootLayoutId).toBe(b.campaign.preRootLayoutId);
    expect(a.campaign.preRootLocationOrder).toEqual(b.campaign.preRootLocationOrder);

    const variants = Array.from({ length: 24 }, (_, index) => createPrototypeGameState(500 + index));
    expect(new Set(variants.map((state) => state.campaign.preRootLayoutId)).size).toBeGreaterThan(1);
    expect(new Set(variants.map((state) => state.campaign.preRootLocationOrder.join('|'))).size).toBeGreaterThan(20);
  });

  it('uses every randomized location once and keeps the Root approach fixed', () => {
    const state = createPrototypeGameState(777);
    expect(PRE_ROOT_LAYOUT_IDS).toContain(state.campaign.preRootLayoutId);
    expect(new Set(state.campaign.preRootLocationOrder).size).toBe(PRE_ROOT_RANDOMIZED_LOCATION_IDS.length);
    expect(new Set(state.campaign.preRootLocationOrder)).toEqual(new Set(PRE_ROOT_RANDOMIZED_LOCATION_IDS));

    const graph = getCampaignMap(state);
    expect(graph.nodes).toHaveLength(21);
    expect(getShortestPathDistance(graph, 'outer-post', 'root-sanctum')).toBeGreaterThanOrEqual(8);
    expect(getShortestPathDistance(graph, 'rival-post', 'root-sanctum')).toBeGreaterThanOrEqual(8);
    expect(getShortestPathDistance(graph, 'almost-root', 'root-sanctum')).toBe(2);
  });
});
