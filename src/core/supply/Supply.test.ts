import { describe, expect, it } from 'vitest';
import { getProjectedMoveSupplyStatus, getSupplyAdjustedActionCost, getSupplyStatus } from '@/core/supply/Supply';
import { createPrototypeGameState, PLAYER_FACTION_ID } from '@/core/state/createPrototypeGameState';
import { prototypeMap } from '@/data/map/prototypeMap';

describe('campaign supply', () => {
  it('is secured in an owned city and connected on a neighboring POI', () => {
    const state = createPrototypeGameState(42);
    const city = getSupplyStatus(state, prototypeMap, PLAYER_FACTION_ID, 'outer-post');
    const projected = getProjectedMoveSupplyStatus(state, prototypeMap, PLAYER_FACTION_ID, 'moss-market');

    expect(city.level).toBe('secured');
    expect(city.percent).toBe(100);
    // Supplies can reach the gates from the adjacent owned city, but a neutral city cannot relay them onward.
    expect(projected.level).toBe('connected');
  });

  it('routes through POIs but not through uncontrolled cities', () => {
    const state = createPrototypeGameState(42);
    state.cities['moss-market'] = {
      ...state.cities['moss-market'],
      ownerFactionId: PLAYER_FACTION_ID,
    };

    const warehouse = getSupplyStatus(state, prototypeMap, PLAYER_FACTION_ID, 'warehouse-2');
    expect(warehouse.level).toBe('connected');
    expect(warehouse.nearestCityId).toBe('moss-market');
    expect(warehouse.path).toEqual(['warehouse-2', 'moss-market']);
  });

  it('raises action cost when the supply line is stretched', () => {
    const state = createPrototypeGameState(42);
    state.cities['moss-market'] = { ...state.cities['moss-market'], ownerFactionId: PLAYER_FACTION_ID };
    const status = getSupplyStatus(state, prototypeMap, PLAYER_FACTION_ID, 'big-lunch');
    expect(status.level).toBe('stretched');
    expect(getSupplyAdjustedActionCost(6, status)).toBe(8);
  });
});
