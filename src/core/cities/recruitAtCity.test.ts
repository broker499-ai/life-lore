import { describe, expect, it } from 'vitest';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { recruitAtCity } from './recruitAtCity';

const infantryOffer = prototypeCities['outer-post'].recruitment[0];
const rangerOffer = prototypeCities['outer-post'].recruitment[1];

const recruit = (
  state: ReturnType<typeof createPrototypeGameState>,
  offer = infantryOffer,
) =>
  recruitAtCity(state, {
    armyId: 'player-main',
    cityId: 'outer-post',
    offer,
    moraleRestore: 4,
    moraleCap: 100,
  });

describe('recruitAtCity', () => {
  it('spends money, adds the selected unit type and consumes the strategic action', () => {
    const state = createPrototypeGameState();
    const result = recruit(state, rangerOffer);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.factions.expedition.resources.money).toBe(93);
    expect(result.state.armies['player-main'].roster['expedition-infantry']).toBe(20);
    expect(result.state.armies['player-main'].roster['expedition-rangers']).toBe(7);
    expect(result.state.factions[result.state.playerFactionId].strategicActionSpent).toBe(true);
    expect(result.state.armies['player-main'].morale).toBe(84);
    expect(result.state.factions.expedition.resources.supplies).toBe(80);
    expect(result.events[0]).toMatchObject({
      type: 'units_recruited',
      amount: 3,
      cost: 27,
      unitTypeId: 'expedition-rangers',
      moraleRestored: 4,
    });
  });

  it('rejects recruitment without enough money', () => {
    const state = createPrototypeGameState();
    state.factions.expedition.resources.money = 20;

    expect(recruit(state)).toMatchObject({ ok: false, error: 'insufficient_money' });
  });

  it('rejects recruitment after another strategic action', () => {
    const state = createPrototypeGameState();
    state.factions[state.playerFactionId].strategicActionSpent = true;

    expect(recruit(state)).toMatchObject({ ok: false, error: 'strategic_action_spent' });
  });
});
