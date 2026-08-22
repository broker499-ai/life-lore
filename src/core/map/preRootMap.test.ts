import { describe, expect, it } from 'vitest';
import { getShortestPathDistance } from '@/core/map/MapGraph';
import { FALSE_ROOT_EVENT_ID, getCampaignMap } from '@/core/map/extensionMap';
import { PRE_ROOT_LAYOUT_IDS, PRE_ROOT_RANDOMIZED_LOCATION_IDS, getPreRootExtensionRoute, getPreRootMap } from '@/core/map/preRootMap';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';

describe('Stage 52 distinct pre-root maps', () => {
  it('is deterministic for a seed but varies across campaigns', () => {
    const a = createPrototypeGameState(341);
    const b = createPrototypeGameState(341);
    expect(a.campaign.preRootLayoutId).toBe(b.campaign.preRootLayoutId);
    expect(a.campaign.preRootLocationOrder).toEqual(b.campaign.preRootLocationOrder);

    const variants = Array.from({ length: 48 }, (_, index) => createPrototypeGameState(500 + index));
    expect(new Set(variants.map((state) => state.campaign.preRootLayoutId)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(variants.map((state) => state.campaign.preRootLocationOrder.join('|'))).size).toBeGreaterThan(40);
  });

  it('rolls only the seven new visibly distinct layouts', () => {
    expect(PRE_ROOT_LAYOUT_IDS).toEqual([
      'ridge',
      'delta',
      'cavern-archipelago',
      'ring',
      'abyss',
      'false-root-orbit',
      'false-root-labyrinth',
    ]);
  });

  it('uses every randomized location once and keeps a deliberately long route to the false Root', () => {
    const base = createPrototypeGameState(777);
    expect(new Set(base.campaign.preRootLocationOrder).size).toBe(PRE_ROOT_RANDOMIZED_LOCATION_IDS.length);
    expect(new Set(base.campaign.preRootLocationOrder)).toEqual(new Set(PRE_ROOT_RANDOMIZED_LOCATION_IDS));

    for (const layoutId of PRE_ROOT_LAYOUT_IDS) {
      const state = {
        ...base,
        campaign: { ...base.campaign, preRootLayoutId: layoutId },
      };
      const graph = getCampaignMap(state);
      expect(graph.nodes).toHaveLength(21);
      expect(getShortestPathDistance(graph, 'outer-post', 'root-sanctum'), layoutId).toBeGreaterThanOrEqual(8);
      expect(getShortestPathDistance(graph, 'rival-post', 'root-sanctum'), layoutId).toBeGreaterThanOrEqual(8);
      expect(getShortestPathDistance(graph, 'almost-root', 'root-sanctum'), layoutId).toBe(2);
    }
  });

  it('puts the false Root in the geometric middle on both central layouts', () => {
    const base = createPrototypeGameState(912);
    for (const layoutId of ['false-root-orbit', 'false-root-labyrinth'] as const) {
      const state = { ...base, campaign: { ...base.campaign, preRootLayoutId: layoutId } };
      const root = getPreRootMap(state).nodes.find((node) => node.id === 'root-sanctum');
      expect(root?.x, layoutId).toBeGreaterThanOrEqual(47);
      expect(root?.x, layoutId).toBeLessThanOrEqual(53);
      expect(root?.y, layoutId).toBeGreaterThanOrEqual(45);
      expect(root?.y, layoutId).toBeLessThanOrEqual(52);
      expect(getPreRootExtensionRoute(state).entryNodeId, layoutId).not.toBe('root-sanctum');
    }
  });

  it('opens the deep route from a peripheral branch after the central false Root revelation', () => {
    const base = createPrototypeGameState(913);
    for (const layoutId of ['false-root-orbit', 'false-root-labyrinth'] as const) {
      const state = {
        ...base,
        campaign: {
          ...base.campaign,
          preRootLayoutId: layoutId,
          resolvedEventIds: [...base.campaign.resolvedEventIds, FALSE_ROOT_EVENT_ID],
        },
      };
      const route = getPreRootExtensionRoute(state);
      const graph = getCampaignMap(state);
      const firstDeepNodeId = state.campaign.extensionLocationOrder[0];
      expect(route.entryNodeId).not.toBe('root-sanctum');
      expect(graph.edges.some((edge) => edge.from === route.entryNodeId && edge.to === firstDeepNodeId)).toBe(true);
      expect(graph.edges.some((edge) => edge.from === 'root-sanctum' && edge.to === firstDeepNodeId)).toBe(false);
    }
  });
});
