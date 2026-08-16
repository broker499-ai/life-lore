import { describe, expect, it } from 'vitest';
import { areNodesAdjacent, getNeighborNodeIds, getShortestPathDistance } from './MapGraph';
import { prototypeMap } from '@/data/map/prototypeMap';


describe('MapGraph', () => {
  it('treats an edge as traversable in both directions', () => {
    expect(areNodesAdjacent(prototypeMap, 'outer-post', 'moss-market')).toBe(true);
    expect(areNodesAdjacent(prototypeMap, 'moss-market', 'outer-post')).toBe(true);
  });

  it('computes shortest strategic distance on the expanded graph', () => {
    expect(getShortestPathDistance(prototypeMap, 'outer-post', 'root-sanctum')).toBe(7);
    expect(getShortestPathDistance(prototypeMap, 'rival-post', 'root-sanctum')).toBe(6);
  });

  it('returns only direct neighbors from the player start', () => {
    expect(getNeighborNodeIds(prototypeMap, 'outer-post').sort()).toEqual([
      'moss-market',
      'quiet-scream',
    ]);
    expect(areNodesAdjacent(prototypeMap, 'outer-post', 'big-lunch')).toBe(false);
  });

  it('gives every map node an in-game description', () => {
    expect(prototypeMap.nodes.every((node) => Boolean(node.descriptionKey))).toBe(true);
  });
});
