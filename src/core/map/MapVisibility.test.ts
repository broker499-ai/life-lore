import { describe, expect, it } from 'vitest';
import { getNeighborNodeIds } from '@/core/map/MapGraph';
import {
  getMapNodeVisibilityById,
  synchronizePlayerMapKnowledge,
} from '@/core/map/MapVisibility';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeMap } from '@/data/map/prototypeMap';

describe('map visibility', () => {
  it('reveals the starting node and adjacent nodes but leaves remote nodes unknown', () => {
    const state = createPrototypeGameState(42, 'vlados');
    const visibility = getMapNodeVisibilityById(state, prototypeMap, state.playerFactionId);
    const start = state.armies['player-main'].nodeId;

    expect(visibility[start]).toBe('visible');
    for (const neighbor of getNeighborNodeIds(prototypeMap, start)) {
      expect(visibility[neighbor]).toBe('visible');
    }
    expect(Object.values(visibility).some((value) => value === 'unknown')).toBe(true);
  });

  it('keeps previously discovered nodes as explored after the army moves away', () => {
    const state = createPrototypeGameState(42, 'vlados');
    const relocated = synchronizePlayerMapKnowledge(
      {
        ...state,
        armies: {
          ...state.armies,
          'player-main': { ...state.armies['player-main'], nodeId: 'moss-market' },
        },
      },
      prototypeMap,
    );

    const visibility = getMapNodeVisibilityById(relocated, prototypeMap, relocated.playerFactionId);
    expect(visibility['moss-market']).toBe('visible');
    expect(visibility['quiet-scream']).toBe('explored');
    expect(relocated.campaign.discoveredNodeIds).toContain('quiet-scream');
  });

  it('lets the map_revealed trait ignore fog of war entirely', () => {
    const state = createPrototypeGameState(42, 'iliesh');
    const synchronized = synchronizePlayerMapKnowledge(state, prototypeMap);
    const visibility = getMapNodeVisibilityById(synchronized, prototypeMap, synchronized.playerFactionId);

    expect(Object.values(visibility).every((value) => value === 'visible')).toBe(true);
    expect(synchronized.campaign.discoveredNodeIds).toHaveLength(prototypeMap.nodes.length);
  });
});
