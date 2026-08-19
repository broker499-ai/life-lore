import { describe, expect, it } from 'vitest';
import { attackCity } from '@/core/cities/attackCity';
import { clearTyranidEggClutch } from '@/core/cities/clearTyranidEggClutch';
import { getTyranidEggClutchStatus } from '@/core/cities/tyranidEggClutch';
import { getCampaignMap } from '@/core/map/extensionMap';
import { getNeighborNodeIds } from '@/core/map/MapGraph';
import { moveArmy } from '@/core/map/moveArmy';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeUnits } from '@/data/units/prototypeUnits';

const deps = {
  unitDefinitions: prototypeUnits,
  battleRules: prototypeBattleRules,
  cityDefinitions: prototypeCities,
};

function preparedState() {
  const base = createPrototypeGameState(4, 'makson');
  return {
    ...base,
    campaign: { ...base.campaign, developerMode: true },
    armies: {
      ...base.armies,
      'player-main': {
        ...base.armies['player-main'],
        roster: { 'expedition-infantry': 120, 'expedition-rangers': 30 },
        morale: 90,
      },
    },
  };
}

describe('Tyranid egg clutches', () => {
  it('creates a three-future-turn cleanup window and clears it through a real battle', () => {
    let state = preparedState();
    const graph = getCampaignMap(state);
    const origin = state.armies['player-main'].nodeId;
    const cityId = getNeighborNodeIds(graph, origin).find((id) => state.cities[id]);
    expect(cityId).toBeDefined();
    if (!cityId) return;

    state = {
      ...state,
      cities: {
        ...state.cities,
        [cityId]: {
          ...state.cities[cityId],
          ownerFactionId: 'orsia-tyranids',
          garrison: { roster: {}, morale: 0 },
        },
      },
    };

    const capture = attackCity(state, graph, {
      armyId: 'player-main', cityId, tactic: 'balanced', supplyCost: 0,
    }, deps);
    expect(capture.ok && capture.captured).toBe(true);
    if (!capture.ok) return;

    const status = getTyranidEggClutchStatus(capture.state, cityId);
    expect(status?.turnsRemaining).toBe(3);
    expect(status?.overdue).toBe(false);

    const cleanup = clearTyranidEggClutch(capture.state, {
      armyId: 'player-main', cityId, tactic: 'balanced',
      battlePlan: { formation: 'line', reservePercent: 0, reserveTarget: 'center', commands: [], retreatMoraleThreshold: null },
    }, { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules });
    expect(cleanup.ok && cleanup.cleared).toBe(true);
    if (cleanup.ok) expect(cleanup.state.campaign.tyranidEggClutches[cityId]).toBeUndefined();
  });

  it('returns an uncleared city to Tyranids immediately when the army leaves after the deadline', () => {
    let state = preparedState();
    const graph = getCampaignMap(state);
    const origin = state.armies['player-main'].nodeId;
    const cityId = getNeighborNodeIds(graph, origin).find((id) => state.cities[id]);
    expect(cityId).toBeDefined();
    if (!cityId) return;
    state = {
      ...state,
      cities: { ...state.cities, [cityId]: { ...state.cities[cityId], ownerFactionId: 'orsia-tyranids', garrison: { roster: {}, morale: 0 } } },
    };
    const capture = attackCity(state, graph, { armyId: 'player-main', cityId, tactic: 'balanced', supplyCost: 0 }, deps);
    if (!capture.ok) throw new Error('capture failed');
    const clutch = capture.state.campaign.tyranidEggClutches[cityId];
    expect(clutch).toBeDefined();
    if (!clutch) return;
    const overdue = {
      ...capture.state,
      turn: clutch.deadlineTurn + 1,
      factions: {
        ...capture.state.factions,
        [capture.state.playerFactionId]: {
          ...capture.state.factions[capture.state.playerFactionId],
          strategicActionSpent: false,
        },
      },
    };
    const departure = moveArmy(overdue, getCampaignMap(overdue), { armyId: 'player-main', toNodeId: origin, supplyCost: 0 });
    expect(departure.ok).toBe(true);
    if (departure.ok) {
      expect(departure.state.cities[cityId].ownerFactionId).toBe('orsia-tyranids');
      expect(departure.state.campaign.tyranidEggClutches[cityId]).toBeUndefined();
    }
  });
});
