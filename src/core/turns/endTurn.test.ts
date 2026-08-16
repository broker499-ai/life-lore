import { describe, expect, it } from 'vitest';
import { moveArmy } from '@/core/map/moveArmy';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeMap } from '@/data/map/prototypeMap';
import { prototypeUnits } from '@/data/units/prototypeUnits';
import { endTurn } from './endTurn';

const finishTurn = (state: ReturnType<typeof createPrototypeGameState>) =>
  endTurn(state, { cityDefinitions: prototypeCities, unitDefinitions: prototypeUnits });

describe('endTurn', () => {
  it('collects tax, pays upkeep for all factions, advances the turn and refreshes actions', () => {
    const state = createPrototypeGameState();
    state.factions.expedition.strategicActionSpent = true;
    state.factions['meridian-company'].strategicActionSpent = true;

    const result = finishTurn(state);

    expect(result.state.turn).toBe(2);
    expect(result.state.factions.expedition.resources.money).toBe(125);
    expect(result.state.factions['meridian-company'].resources.money).toBe(126.5);
    expect(result.state.factions.expedition.strategicActionSpent).toBe(false);
    expect(result.state.factions['meridian-company'].strategicActionSpent).toBe(false);
    expect(result.events).toEqual(expect.arrayContaining([
      { type: 'income_collected', factionId: 'expedition', amount: 12 },
      { type: 'income_collected', factionId: 'meridian-company', amount: 16 },
      { type: 'army_upkeep_paid', factionId: 'expedition', amount: 7, unpaid: 0 },
      { type: 'army_upkeep_paid', factionId: 'meridian-company', amount: 7.5, unpaid: 0 },
      { type: 'turn_ended', turn: 1 },
    ]));
  });

  it('allows another movement after ending the turn', () => {
    const state = createPrototypeGameState();
    state.cities['moss-market'].ownerFactionId = 'expedition';
        const firstMove = moveArmy(state, prototypeMap, {
      armyId: 'player-main',
      toNodeId: 'moss-market',
      supplyCost: 6,
    });
    if (!firstMove.ok) throw new Error('First move should succeed');

    const nextTurn = finishTurn(firstMove.state);
    const secondMove = moveArmy(nextTurn.state, prototypeMap, {
      armyId: 'player-main',
      toNodeId: 'warehouse-2',
      supplyCost: 6,
    });

    expect(secondMove.ok).toBe(true);
    if (!secondMove.ok) return;
    expect(secondMove.state.armies['player-main'].nodeId).toBe('warehouse-2');
    expect(secondMove.state.turn).toBe(2);
    expect(secondMove.state.factions.expedition.resources.supplies).toBe(68);
    expect(secondMove.state.factions.expedition.resources.money).toBe(143);
  });
});
