import { describe, expect, it } from 'vitest';
import { getAttackCityAvailability } from '@/core/cities/attackCity';
import { recruitAtCity } from '@/core/cities/recruitAtCity';
import { restAtCity } from '@/core/cities/restAtCity';
import { moveArmy } from '@/core/map/moveArmy';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeMap } from '@/data/map/prototypeMap';

describe('developer mode', () => {
  it('allows repeated player strategic actions without giving the AI the same exemption', () => {
    const state = createPrototypeGameState(42, 'artemios');
    state.campaign.developerMode = true;
    state.cities['moss-market'].ownerFactionId = state.playerFactionId;

    const first = moveArmy(state, prototypeMap, {
      armyId: 'player-main',
      toNodeId: 'moss-market',
      supplyCost: 1,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.factions[state.playerFactionId].strategicActionSpent).toBe(false);

    const second = moveArmy(first.state, prototypeMap, {
      armyId: 'player-main',
      toNodeId: 'warehouse-2',
      supplyCost: 1,
    });
    expect(second.ok).toBe(true);
    expect(second.ok && second.state.factions[state.playerFactionId].strategicActionSpent).toBe(false);
  });

  it('bypasses an already-spent player action for attack, recruit and rest', () => {
    const attackState = createPrototypeGameState(7, 'artemios');
    attackState.campaign.developerMode = true;
    attackState.factions[attackState.playerFactionId].strategicActionSpent = true;
    expect(getAttackCityAvailability(attackState, prototypeMap, {
      armyId: 'player-main',
      cityId: 'moss-market',
      tactic: 'balanced',
      supplyCost: 1,
    })).not.toMatchObject({ canAttack: false, reason: 'strategic_action_spent' });

    const recruitState = createPrototypeGameState(8, 'artemios');
    recruitState.campaign.developerMode = true;
    recruitState.factions[recruitState.playerFactionId].strategicActionSpent = true;
    const offer = prototypeCities['outer-post'].recruitment[0];
    const recruited = recruitAtCity(recruitState, {
      armyId: 'player-main', cityId: 'outer-post', offer, moraleRestore: 1, moraleCap: 100,
    });
    expect(recruited.ok).toBe(true);
    expect(recruited.ok && recruited.state.factions[recruitState.playerFactionId].strategicActionSpent).toBe(false);

    const restState = createPrototypeGameState(9, 'artemios');
    restState.campaign.developerMode = true;
    restState.factions[restState.playerFactionId].strategicActionSpent = true;
    restState.factions[restState.playerFactionId].resources.supplies = 10;
    restState.armies['player-main'].morale = 40;
    const rested = restAtCity(restState, {
      armyId: 'player-main', cityId: 'outer-post', city: prototypeCities['outer-post'], supplyCap: 100, moraleCap: 100,
    });
    expect(rested.ok).toBe(true);
    expect(rested.ok && rested.state.factions[restState.playerFactionId].strategicActionSpent).toBe(false);
  });
});
