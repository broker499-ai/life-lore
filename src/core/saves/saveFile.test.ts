import { describe, expect, it } from 'vitest';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { CURRENT_SAVE_VERSION, deserializeGame, serializeGame } from './saveFile';

function toLegacyV5(state: ReturnType<typeof createPrototypeGameState>) {
  const factions = Object.fromEntries(
    Object.entries(state.factions).map(([id, faction]) => {
      const { strategicActionSpent: _spent, ...legacyFaction } = faction;
      return [id, legacyFaction];
    }),
  );
  return {
    ...state,
    factions,
    campaign: {
      ...state.campaign,
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
        const { garrison: _garrison, ...legacyCity } = city;
        return [id, legacyCity];
      }),
    ),
  };
}

describe('save file', () => {
  it('round-trips v8 including expanded map cities and battle RNG cursor', () => {
    const state = createPrototypeGameState(99);
    state.rng.battles.cursor = 7;
    state.factions['meridian-company'].strategicActionSpent = true;

    const restored = deserializeGame(serializeGame(state));

    expect(restored).toEqual(state);
    expect(restored.cities['moss-market'].garrison.roster['orssian-guard']).toBe(8);
    expect(restored.rng.battles.cursor).toBe(7);
    expect(JSON.parse(serializeGame(state)).version).toBe(CURRENT_SAVE_VERSION);
  });

  it('migrates v5 global player action into the player faction action budget', () => {
    const state = createPrototypeGameState(15);
    state.factions.expedition.strategicActionSpent = true;
    const legacy = { version: 5, state: toLegacyV5(state) };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.factions.expedition.strategicActionSpent).toBe(true);
    expect(restored.factions['meridian-company'].strategicActionSpent).toBe(false);
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

  it('migrates v6 saves by adding new Stage 12 cities without overwriting old city state', () => {
    const state = createPrototypeGameState(15);
    state.cities['moss-market'].ownerFactionId = 'expedition';
    const { ['underfountain']: _newCity, ...legacyCities } = state.cities;
    const legacy = { version: 6, state: { ...state, cities: legacyCities } };

    const restored = deserializeGame(JSON.stringify(legacy));

    expect(restored.cities['moss-market'].ownerFactionId).toBe('expedition');
    expect(restored.cities['underfountain']).toBeDefined();
    expect(restored.cities['root-limit']).toBeDefined();
  });

  it('rejects unsupported versions', () => {
    expect(() => deserializeGame('{"version":999,"state":{}}')).toThrow(
      'Unsupported or invalid save file',
    );
  });
});
