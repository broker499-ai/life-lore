import { describe, expect, it } from 'vitest';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { restAtCity } from './restAtCity';

const rest = (state: ReturnType<typeof createPrototypeGameState>) =>
  restAtCity(state, {
    armyId: 'player-main',
    cityId: 'outer-post',
    city: prototypeCities['outer-post'],
    supplyCap: 100,
    moraleCap: 100,
  });

describe('restAtCity', () => {
  it('restores supplies and morale up to caps and spends the strategic action', () => {
    const state = createPrototypeGameState();
    const result = rest(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.factions.expedition.resources.supplies).toBe(100);
    expect(result.state.armies['player-main'].morale).toBe(95);
    expect(result.state.factions[result.state.playerFactionId].strategicActionSpent).toBe(true);
    expect(result.events[0]).toEqual({
      type: 'army_rested',
      armyId: 'player-main',
      cityId: 'outer-post',
      suppliesRestored: 20,
      moraleRestored: 15,
    });
  });

  it('rejects rest in a neutral city', () => {
    const state = createPrototypeGameState();
    state.armies['player-main'].nodeId = 'moss-market';

    const result = restAtCity(state, {
      armyId: 'player-main',
      cityId: 'moss-market',
      city: prototypeCities['moss-market'],
      supplyCap: 100,
      moraleCap: 100,
    });

    expect(result).toMatchObject({ ok: false, error: 'city_not_controlled' });
  });

  it('rejects rest when nothing can be restored', () => {
    const state = createPrototypeGameState();
    state.factions.expedition.resources.supplies = 100;
    state.armies['player-main'].morale = 100;

    expect(rest(state)).toMatchObject({ ok: false, error: 'nothing_to_restore' });
  });
});
