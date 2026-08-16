import { describe, expect, it } from 'vitest';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeMap } from '@/data/map/prototypeMap';
import { moveArmy } from './moveArmy';

const move = (state: ReturnType<typeof createPrototypeGameState>, toNodeId: string) =>
  moveArmy(state, prototypeMap, {
    armyId: 'player-main',
    toNodeId,
    supplyCost: 6,
  });

describe('moveArmy', () => {
  it('moves to an adjacent controlled node, spends supplies and consumes the strategic action', () => {
    const state = createPrototypeGameState();
    state.cities['moss-market'].ownerFactionId = 'expedition';
    const result = move(state, 'moss-market');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.armies['player-main'].nodeId).toBe('moss-market');
    expect(result.state.factions.expedition.resources.supplies).toBe(74);
    expect(result.state.factions[result.state.playerFactionId].strategicActionSpent).toBe(true);
    expect(result.events).toEqual([
      {
        type: 'army_moved',
        armyId: 'player-main',
        fromNodeId: 'outer-post',
        toNodeId: 'moss-market',
        supplyCost: 6,
      },
    ]);

    expect(state.armies['player-main'].nodeId).toBe('outer-post');
    expect(state.factions.expedition.resources.supplies).toBe(80);
  });

  it('requires capture instead of normal movement into a neutral city', () => {
    const result = move(createPrototypeGameState(), 'moss-market');
    expect(result).toMatchObject({ ok: false, error: 'destination_requires_capture' });
  });

  it('rejects a non-adjacent destination', () => {
    const result = move(createPrototypeGameState(), 'warehouse-2');
    expect(result).toMatchObject({ ok: false, error: 'not_adjacent' });
  });

  it('rejects a second strategic action in the same turn', () => {
    const state = createPrototypeGameState();
    state.cities['moss-market'].ownerFactionId = 'expedition';
        const first = move(state, 'moss-market');
    if (!first.ok) throw new Error('First move should succeed');

    const second = move(first.state, 'warehouse-2');
    expect(second).toMatchObject({ ok: false, error: 'strategic_action_spent' });
  });

  it('rejects movement when the faction cannot pay the supply cost', () => {
    const state = createPrototypeGameState();
    state.cities['moss-market'].ownerFactionId = 'expedition';
    state.factions.expedition.resources.supplies = 5;

    const result = move(state, 'moss-market');
    expect(result).toMatchObject({ ok: false, error: 'insufficient_supplies' });
  });
});
