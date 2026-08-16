import { describe, expect, it } from 'vitest';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeUnits } from '@/data/units/prototypeUnits';
import { payArmyUpkeep } from './payArmyUpkeep';

describe('payArmyUpkeep', () => {
  it('charges upkeep from each faction treasury', () => {
    const result = payArmyUpkeep(createPrototypeGameState(), prototypeUnits);

    expect(result.state.factions.expedition.resources.money).toBe(113);
    expect(result.state.factions['meridian-company'].resources.money).toBe(110.5);
    expect(result.events).toEqual([
      { type: 'army_upkeep_paid', factionId: 'expedition', amount: 7, unpaid: 0 },
      { type: 'army_upkeep_paid', factionId: 'meridian-company', amount: 7.5, unpaid: 0 },
    ]);
  });

  it('never pushes treasury below zero and reports unpaid upkeep', () => {
    const state = createPrototypeGameState();
    state.factions.expedition.resources.money = 2;

    const result = payArmyUpkeep(state, prototypeUnits);

    expect(result.state.factions.expedition.resources.money).toBe(0);
    expect(result.events[0]).toMatchObject({ amount: 2, unpaid: 5 });
  });
});
