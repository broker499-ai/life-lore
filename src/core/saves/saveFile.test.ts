import { describe, expect, it } from 'vitest';
import { createPrototypeGameState, RIVAL_FACTION_ID } from '@/core/state/createPrototypeGameState';
import { CURRENT_SAVE_VERSION, deserializeGame, serializeGame } from './saveFile';
import { prototypeMap } from '@/data/map/prototypeMap';

const LEGACY_RIVAL_FACTION_ID = 'meridian-company';

function withLegacyRival(state: ReturnType<typeof createPrototypeGameState>) {
  const factions = { ...state.factions } as Record<string, any>;
  const rival = factions[RIVAL_FACTION_ID];
  delete factions[RIVAL_FACTION_ID];
  if (rival) factions[LEGACY_RIVAL_FACTION_ID] = { ...rival, id: LEGACY_RIVAL_FACTION_ID, traits: [] };

  const cities = Object.fromEntries(
    Object.entries(state.cities).map(([id, city]) => [
      id,
      city.ownerFactionId === RIVAL_FACTION_ID
        ? { ...city, ownerFactionId: LEGACY_RIVAL_FACTION_ID }
        : city,
    ]),
  );
  const armies = Object.fromEntries(
    Object.entries(state.armies).map(([id, army]) => [
      id,
      army.factionId === RIVAL_FACTION_ID
        ? { ...army, factionId: LEGACY_RIVAL_FACTION_ID }
        : army,
    ]),
  );

  return { ...state, factions, cities, armies };
}

function toLegacyV5(state: ReturnType<typeof createPrototypeGameState>) {
  const old = withLegacyRival(state);
  const factions = Object.fromEntries(
    Object.entries(old.factions).map(([id, faction]) => {
      const { strategicActionSpent: _spent, lastStrategicAction: _last, leaderAbilityLastUsedTurn: _used, traits: _traits, superFactionId: _super, ...legacyFaction } = faction as any;
      return [id, legacyFaction];
    }),
  );
  return {
    ...old,
    factions,
    campaign: {
      rootObtainedByFactionId: old.campaign.rootObtainedByFactionId,
      strategicActionSpent: state.factions[state.playerFactionId].strategicActionSpent,
    },
  };
}

function stripGarrisons(state: ReturnType<typeof createPrototypeGameState>) {
  const legacyV5 = toLegacyV5(state);
  return {
    ...legacyV5,
    cities: Object.fromEntries(
      Object.entries(legacyV5.cities).map(([id, city]) => {
        const { garrison: _garrison, ...legacyCity } = city as any;
        return [id, legacyCity];
      }),
    ),
  };
}

describe('save file', () => {
  it('round-trips v15 including research, artifact loadout, scientific progress, story state and battle RNG cursor', () => {
    const state = createPrototypeGameState(99);
    state.rng.battles.cursor = 7;
    state.factions[RIVAL_FACTION_ID].strategicActionSpent = true;
    state.campaign.artifactIds = ['apple-skeleton'];
    state.campaign.activeArtifactIds = ['apple-skeleton'];
    state.factions.expedition.specimensCollected = 4;
    state.campaign.cityArtifactClaimedIds = ['moss-market'];
    state.campaign.resolvedBriefingIds = ['surface-artifact-directive'];
    state.campaign.resolvedEventIds = ['warehouse-inventory'];
    state.campaign.completedResearchIds = ['flora-field-rations'];
    state.factions.expedition.traits.push({ type: 'supply_action_cost_multiplier', multiplier: 0.9 });

    const restored = deserializeGame(serializeGame(state));

    expect(restored).toEqual(state);
    expect(restored.cities['moss-market'].incomeMultiplier).toBe(1);
    expect(restored.rng.battles.cursor).toBe(7);
    expect(restored.campaign.rivalOrganizationId).toBe(state.campaign.rivalOrganizationId);
    expect(restored.campaign.rivalLeaderId).toBe(state.campaign.rivalLeaderId);
    expect(JSON.parse(serializeGame(state)).version).toBe(CURRENT_SAVE_VERSION);
  });


  it('migrates v14 by reconstructing total collected specimens and activating up to three existing artifacts', () => {
    const current = createPrototypeGameState(90, 'vlados');
    current.factions.expedition.resources.specimens = 1;
    current.campaign.completedResearchIds = ['flora-field-rations'];
    current.campaign.artifactIds = ['apple-skeleton', 'last-word-stone'];
    const legacyFactions = Object.fromEntries(
      Object.entries(current.factions).map(([id, faction]) => {
        const { specimensCollected: _collected, ...legacyFaction } = faction;
        return [id, legacyFaction];
      }),
    );
    const { activeArtifactIds: _active, ...legacyCampaign } = current.campaign;

    const restored = deserializeGame(JSON.stringify({
      version: 14,
      state: { ...current, factions: legacyFactions, campaign: legacyCampaign },
    }));

    expect(restored.factions.expedition.specimensCollected).toBe(3);
    expect(restored.campaign.activeArtifactIds).toEqual(['apple-skeleton', 'last-word-stone']);
    const artifactTrait = restored.factions.expedition.traits.find((trait) => trait.source === 'artifact:apple-skeleton');
    expect(artifactTrait?.type).toBe('city_income_multiplier');
    if (artifactTrait?.type === 'city_income_multiplier') expect(artifactTrait.multiplier).toBeCloseTo(1.27);
  });


  it('migrates v13 map artifacts and initializes Stage 23 city/story state', () => {
    const current = createPrototypeGameState(84);
    const { activeArtifactIds: _activeArtifacts, cityArtifactClaimedIds: _cityArtifacts, pendingBriefingId: _pendingBriefing, resolvedBriefingIds: _resolvedBriefings, ...legacyCampaign } = current.campaign;
    const legacy = {
      version: 13,
      state: {
        ...current,
        campaign: {
          ...legacyCampaign,
          pendingEventId: 'temporary-pass',
          resolvedEventIds: ['warehouse-inventory'],
          artifactIds: ['warehouse-one-seal', 'temporary-key'],
        },
      },
    };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.campaign.pendingEventId).toBe('jungle-foraging');
    expect(restored.campaign.artifactIds).toEqual(['apple-skeleton', 'vanilla-cartilage']);
    expect(restored.campaign.cityArtifactClaimedIds).toEqual([]);
    expect(restored.campaign.pendingBriefingId).toBeNull();
    expect(restored.campaign.resolvedBriefingIds).toEqual([]);
    expect(restored.campaign.activeArtifactIds).toEqual(['apple-skeleton', 'vanilla-cartilage']);
  });


  it('migrates v12 saves by adding Stage 22 traits and city income multipliers', () => {
    const current = createPrototypeGameState(83);
    const legacyFactions = Object.fromEntries(
      Object.entries(current.factions).map(([id, faction]) => [
        id,
        id.startsWith('orsia-') ? { ...faction, traits: faction.traits.filter((trait) => ![
          'random_battle_morale_gain',
          'battle_unit_power_multiplier',
          'initial_garrison_size_multiplier_range',
          'captured_city_income_multiplier',
        ].includes(trait.type)) } : faction,
      ]),
    );
    const legacyCities = Object.fromEntries(
      Object.entries(current.cities).map(([id, city]) => {
        const { incomeMultiplier: _incomeMultiplier, ...legacyCity } = city;
        return [id, legacyCity];
      }),
    );
    const restored = deserializeGame(JSON.stringify({
      version: 12,
      state: { ...current, factions: legacyFactions, cities: legacyCities },
    }));

    for (const city of Object.values(restored.cities)) expect(city.incomeMultiplier).toBe(1);
    if (restored.factions['orsia-orcs']) {
      expect(restored.factions['orsia-orcs'].traits.some((trait) => trait.type === 'random_battle_morale_gain')).toBe(true);
    }
    if (restored.factions['orsia-goblins']) {
      expect(restored.factions['orsia-goblins'].traits.some((trait) => trait.type === 'battle_unit_power_multiplier')).toBe(true);
    }
    if (restored.factions['orsia-fgushniki']) {
      expect(restored.factions['orsia-fgushniki'].traits.some((trait) => trait.type === 'captured_city_income_multiplier')).toBe(true);
    }
  });



  it('migrates v11 saves by initializing Stage 21 research and faction-event state', () => {
    const current = createPrototypeGameState(61);
    const { completedResearchIds: _research, pendingFactionEvent: _pendingFaction, resolvedFactionEventIds: _resolvedFaction, ...legacyCampaign } = current.campaign;
    const legacyFactions = Object.fromEntries(
      Object.entries(current.factions).map(([id, faction]) => [
        id,
        id === 'orsia-nazbols' || id === 'orsia-tyranids'
          ? { ...faction, traits: [] }
          : faction,
      ]),
    );
    const legacy = {
      version: 11,
      state: { ...current, factions: legacyFactions, campaign: legacyCampaign },
    };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.campaign.completedResearchIds).toEqual([]);
    expect(restored.campaign.pendingFactionEvent).toBeNull();
    expect(restored.campaign.resolvedFactionEventIds).toEqual([]);
    if (restored.factions['orsia-nazbols']) {
      expect(restored.factions['orsia-nazbols'].traits.some((trait) => trait.type === 'defeat_reaction')).toBe(true);
      const cities = Object.values(restored.cities).filter((city) => city.ownerFactionId === 'orsia-nazbols');
      for (const city of cities) expect(city.garrison.morale).toBeGreaterThanOrEqual(94);
    }
    if (restored.factions['orsia-tyranids']) {
      expect(restored.factions['orsia-tyranids'].traits.some((trait) => trait.type === 'incoming_casualty_multiplier_by_enemy_tactic')).toBe(true);
    }
  });

  it('migrates v10 saves by initializing Stage 20 map knowledge', () => {
    const current = createPrototypeGameState(31, 'vlados');
    const { discoveredNodeIds: _fog, ...legacyCampaign } = current.campaign;
    const legacy = { version: 10, state: { ...current, campaign: legacyCampaign } };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.campaign.discoveredNodeIds).toContain(restored.armies['player-main'].nodeId);
    expect(restored.campaign.discoveredNodeIds.length).toBeGreaterThan(1);
    expect(restored.campaign.discoveredNodeIds.length).toBeLessThan(prototypeMap.nodes.length);
  });

  it('migrates v9 Meridian into the Stage 18 rival faction and assigns an unselected leader', () => {
    const current = createPrototypeGameState(23, 'artemios');
    const old = withLegacyRival(current);
    const legacy = {
      version: 9,
      state: {
        ...old,
        campaign: {
          rootObtainedByFactionId: null,
          pendingEventId: null,
          resolvedEventIds: ['warehouse-inventory'],
          artifactIds: ['warehouse-one-seal'],
        },
      },
    };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.factions[RIVAL_FACTION_ID]).toBeDefined();
    expect(restored.factions[LEGACY_RIVAL_FACTION_ID]).toBeUndefined();
    expect(restored.armies['rival-main'].factionId).toBe(RIVAL_FACTION_ID);
    expect(restored.campaign.rivalOrganizationId).toBe('gospol');
    expect(restored.campaign.rivalLeaderId).not.toBe(restored.selectedLeaderId);
    expect(restored.campaign.status).toBe('active');
  });

  it('migrates v5 global player action into the player faction action budget', () => {
    const state = createPrototypeGameState(15);
    state.factions.expedition.strategicActionSpent = true;
    const legacy = { version: 5, state: toLegacyV5(state) };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.factions.expedition.strategicActionSpent).toBe(true);
    expect(restored.factions[RIVAL_FACTION_ID].strategicActionSpent).toBe(false);
    expect('strategicActionSpent' in restored.campaign).toBe(false);
  });

  it('migrates v4 cities to empty legacy-safe garrisons', () => {
    const current = createPrototypeGameState(15);
    const legacy = { version: 4, state: stripGarrisons(current) };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.cities['moss-market'].garrison).toEqual({ roster: {}, morale: 60 });
    expect(restored.armies['player-main'].roster['expedition-rangers']).toBe(4);
  });

  it('migrates v3 totalUnits and then adds garrisons', () => {
    const current = createPrototypeGameState(15);
    const base = stripGarrisons(current);
    const legacy = {
      version: 3,
      state: {
        ...base,
        armies: {
          'player-main': {
            id: 'player-main',
            factionId: 'expedition',
            nodeId: 'outer-post',
            morale: 80,
            totalUnits: 24,
          },
        },
      },
    };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.armies['player-main'].roster).toEqual({ 'expedition-infantry': 24 });
    expect(restored.cities['outer-post'].garrison).toEqual({ roster: {}, morale: 60 });
    expect('totalUnits' in restored.armies['player-main']).toBe(false);
  });

  it('migrates v6 saves by adding later cities without overwriting old city state', () => {
    const state = createPrototypeGameState(15);
    const legacyBase = toLegacyV5(state);
    legacyBase.cities['moss-market'].ownerFactionId = 'expedition';
    const { ['underfountain']: _newCity, ...legacyCities } = legacyBase.cities;
    const legacyFactions = Object.fromEntries(
      Object.entries(legacyBase.factions).map(([id, faction]) => [
        id,
        { ...faction, strategicActionSpent: false },
      ]),
    );
    const legacy = {
      version: 6,
      state: {
        ...legacyBase,
        factions: legacyFactions,
        cities: legacyCities,
        campaign: { rootObtainedByFactionId: null },
      },
    };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.cities['moss-market'].ownerFactionId).toBe('expedition');
    expect(restored.cities['underfountain']).toBeDefined();
    expect(restored.cities['root-limit']).toBeDefined();
  });

  it('migrates v8 saves with an empty Stage 17 event/artifact state', () => {
    const current = withLegacyRival(createPrototypeGameState(23));
    const legacy = {
      version: 8,
      state: {
        ...current,
        campaign: { rootObtainedByFactionId: null },
      },
    };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.campaign.pendingEventId).toBeNull();
    expect(restored.campaign.resolvedEventIds).toEqual([]);
    expect(restored.campaign.artifactIds).toEqual([]);
  });

  it('rejects unsupported versions', () => {
    expect(() => deserializeGame('{"version":999,"state":{}}')).toThrow(
      'Unsupported or invalid save file',
    );
  });
});
