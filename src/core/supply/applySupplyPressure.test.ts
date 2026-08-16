import { describe, expect, it } from 'vitest';
import { applySupplyPressure } from '@/core/supply/applySupplyPressure';
import { createPrototypeGameState, PLAYER_FACTION_ID } from '@/core/state/createPrototypeGameState';
import { prototypeMap } from '@/data/map/prototypeMap';

describe('applySupplyPressure', () => {
  it('does not hurt an army in its own city', () => {
    const state = createPrototypeGameState(42);
    const result = applySupplyPressure(state, prototypeMap);
    expect(result.state.armies['player-main'].morale).toBe(80);
    expect(result.events.some((event) => event.type === 'supply_pressure_applied' && event.armyId === 'player-main')).toBe(false);
  });

  it('applies morale pressure to a stretched expedition', () => {
    const state = createPrototypeGameState(42);
    state.cities['moss-market'] = { ...state.cities['moss-market'], ownerFactionId: PLAYER_FACTION_ID };
    state.armies['player-main'] = { ...state.armies['player-main'], nodeId: 'big-lunch' };

    const result = applySupplyPressure(state, prototypeMap);
    expect(result.state.armies['player-main'].morale).toBe(78);
    expect(result.events).toContainEqual({
      type: 'supply_pressure_applied',
      armyId: 'player-main',
      factionId: PLAYER_FACTION_ID,
      supplyPercent: 65,
      moraleLost: 2,
    });
  });
});
