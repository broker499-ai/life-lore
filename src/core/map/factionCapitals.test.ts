import { describe, expect, it } from 'vitest';
import { createFactionCapitalCityIds, getCapitalFactionIdByCityId } from '@/core/map/factionCapitals';
import { createPrototypeGameState, PLAYER_FACTION_ID, RIVAL_FACTION_ID } from '@/core/state/createPrototypeGameState';

describe('faction capitals', () => {
  it('assigns one stable capital to every faction that starts with a city', () => {
    const state = createPrototypeGameState(42, 'artemios');
    const capitals = state.campaign.factionCapitalCityIds;

    expect(capitals[PLAYER_FACTION_ID]).toBe('outer-post');
    expect(capitals[RIVAL_FACTION_ID]).toBe('rival-post');

    const foundingFactions = new Set(
      Object.values(state.cities)
        .map((city) => city.ownerFactionId)
        .filter((factionId): factionId is string => Boolean(factionId)),
    );
    for (const factionId of foundingFactions) expect(capitals[factionId]).toBeDefined();
  });

  it('keeps capital knowledge tied to the founding faction after capture', () => {
    const state = createPrototypeGameState(99, 'vlados');
    const capitals = createFactionCapitalCityIds(
      state.cities,
      state.campaign.extensionLocationOrder,
      state.playerFactionId,
    );
    const orsiaCapital = Object.entries(capitals).find(([factionId]) => factionId.startsWith('orsia-'));
    expect(orsiaCapital).toBeDefined();
    if (!orsiaCapital) return;

    const [factionId, cityId] = orsiaCapital;
    state.campaign.factionCapitalCityIds = capitals;
    state.cities[cityId].ownerFactionId = state.playerFactionId;

    expect(getCapitalFactionIdByCityId(state)[cityId]).toBe(factionId);
  });
});
