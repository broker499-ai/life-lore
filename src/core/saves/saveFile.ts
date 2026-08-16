import type {
  ArmyId,
  ArmyState,
  CampaignState,
  CityId,
  CityState,
  FactionId,
  GameState,
  ResourcesState,
} from '@/core/state/GameState';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { DEFAULT_LEADER_ID, prototypeLeaderById } from '@/data/leaders/prototypeLeader';

export const CURRENT_SAVE_VERSION = 8 as const;
const LEGACY_DEFAULT_UNIT_TYPE_ID = 'expedition-infantry';

type LegacyFactionStateV1 = { id: FactionId; controlledCityIds: string[] };
type LegacyFactionStateV2 = LegacyFactionStateV1 & { resources: ResourcesState };
type LegacyFactionStateV5 = { id: FactionId; resources: ResourcesState };
type LegacyFactionStateV6 = LegacyFactionStateV5 & { strategicActionSpent: boolean };
type LegacyCampaignStateV5 = CampaignState & { strategicActionSpent: boolean };
type LegacyCityStateV4 = Omit<CityState, 'garrison'>;
type LegacyArmyStateV3 = {
  id: ArmyId;
  factionId: FactionId;
  nodeId: string;
  morale: number;
  totalUnits: number;
};

type LegacyGameStateV7 = Omit<GameState, 'factions'> & {
  factions: Record<FactionId, LegacyFactionStateV6>;
};
type LegacyGameStateV5 = Omit<LegacyGameStateV7, 'factions' | 'campaign'> & {
  factions: Record<FactionId, LegacyFactionStateV5>;
  campaign: LegacyCampaignStateV5;
};
type LegacyGameStateV4 = Omit<LegacyGameStateV5, 'cities'> & {
  cities: Record<CityId, LegacyCityStateV4>;
};
type LegacyGameStateV3 = Omit<LegacyGameStateV4, 'armies'> & {
  armies: Record<ArmyId, LegacyArmyStateV3>;
};
type LegacyGameStateV2 = Omit<LegacyGameStateV3, 'factions'> & {
  factions: Record<FactionId, LegacyFactionStateV2>;
};
type LegacyGameStateV1 = Omit<LegacyGameStateV3, 'factions'> & {
  resources: ResourcesState;
  factions: Record<FactionId, LegacyFactionStateV1>;
};

export type SaveFileV1 = { version: 1; state: LegacyGameStateV1 };
export type SaveFileV2 = { version: 2; state: LegacyGameStateV2 };
export type SaveFileV3 = { version: 3; state: LegacyGameStateV3 };
export type SaveFileV4 = { version: 4; state: LegacyGameStateV4 };
export type SaveFileV5 = { version: 5; state: LegacyGameStateV5 };
export type SaveFileV6 = { version: 6; state: LegacyGameStateV7 };
export type SaveFileV7 = { version: 7; state: LegacyGameStateV7 };
export type SaveFileV8 = { version: typeof CURRENT_SAVE_VERSION; state: GameState };
export type SaveFile = SaveFileV1 | SaveFileV2 | SaveFileV3 | SaveFileV4 | SaveFileV5 | SaveFileV6 | SaveFileV7 | SaveFileV8;

export function serializeGame(state: GameState): string {
  const save: SaveFileV8 = { version: CURRENT_SAVE_VERSION, state };
  return JSON.stringify(save);
}

export function deserializeGame(serialized: string): GameState {
  const parsed: unknown = JSON.parse(serialized);
  if (!isRecord(parsed) || !isRecord(parsed.state) || typeof parsed.version !== 'number') {
    throw new Error('Unsupported or invalid save file');
  }

  if (parsed.version === CURRENT_SAVE_VERSION) return parsed.state as GameState;
  if (parsed.version === 7) return migrateV7ToV8(parsed.state as LegacyGameStateV7);
  if (parsed.version === 6) return migrateV7ToV8(migrateV6ToV7(parsed.state as LegacyGameStateV7));
  if (parsed.version === 5) return migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(parsed.state as LegacyGameStateV5)));
  if (parsed.version === 4) return migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(parsed.state as LegacyGameStateV4))));
  if (parsed.version === 3) return migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(parsed.state as LegacyGameStateV3)))));
  if (parsed.version === 2) return migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(parsed.state as LegacyGameStateV2))))));
  if (parsed.version === 1) return migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV1ToV3(parsed.state as LegacyGameStateV1))))));

  throw new Error('Unsupported or invalid save file');
}

function migrateV7ToV8(state: LegacyGameStateV7): GameState {
  const selectedLeaderId = prototypeLeaderById[state.selectedLeaderId]
    ? state.selectedLeaderId
    : DEFAULT_LEADER_ID;
  const defaults = createPrototypeGameState(state.rng.campaign.seed, selectedLeaderId);
  const factions = { ...defaults.factions };

  for (const factionId of [state.playerFactionId, 'meridian-company']) {
    const legacy = state.factions[factionId];
    const current = factions[factionId];
    if (!legacy || !current) continue;
    factions[factionId] = {
      ...current,
      resources: legacy.resources,
      strategicActionSpent: legacy.strategicActionSpent,
      lastStrategicAction: null,
      leaderAbilityLastUsedTurn: null,
    };
  }

  const cities = { ...defaults.cities };
  for (const [cityId, oldCity] of Object.entries(state.cities)) {
    const defaultCity = defaults.cities[cityId];
    if (!defaultCity) {
      cities[cityId] = oldCity;
      continue;
    }
    const ownerFactionId =
      oldCity.ownerFactionId === null || oldCity.ownerFactionId === 'orssia-neutral'
        ? defaultCity.ownerFactionId
        : oldCity.ownerFactionId;
    cities[cityId] = { ...oldCity, ownerFactionId };
  }

  return {
    ...state,
    selectedLeaderId,
    factions,
    cities,
  };
}

function migrateV6ToV7(state: LegacyGameStateV7): LegacyGameStateV7 {
  const defaults = createPrototypeGameState(state.rng.campaign.seed, state.selectedLeaderId);
  return { ...state, cities: { ...defaults.cities, ...state.cities } };
}

function migrateV5ToV6(state: LegacyGameStateV5): LegacyGameStateV7 {
  const { strategicActionSpent, ...campaign } = state.campaign;
  const factions = Object.fromEntries(
    Object.entries(state.factions).map(([factionId, faction]) => [
      factionId,
      { ...faction, strategicActionSpent: factionId === state.playerFactionId ? strategicActionSpent : false },
    ]),
  ) as Record<FactionId, LegacyFactionStateV6>;
  return { ...state, factions, campaign };
}

function migrateV4ToV5(state: LegacyGameStateV4): LegacyGameStateV5 {
  const cities = Object.fromEntries(
    Object.entries(state.cities).map(([cityId, city]) => [cityId, { ...city, garrison: { roster: {}, morale: 60 } }]),
  ) as Record<CityId, CityState>;
  return { ...state, cities };
}

function migrateV3ToV4(state: LegacyGameStateV3): LegacyGameStateV4 {
  const armies = Object.fromEntries(
    Object.entries(state.armies).map(([armyId, army]) => {
      if (!Number.isInteger(army.totalUnits) || army.totalUnits < 0) {
        throw new Error(`Invalid legacy army total for ${armyId}`);
      }
      const { totalUnits, ...rest } = army;
      const migrated: ArmyState = {
        ...rest,
        roster: totalUnits > 0 ? { [LEGACY_DEFAULT_UNIT_TYPE_ID]: totalUnits } : {},
      };
      return [armyId, migrated];
    }),
  ) as Record<ArmyId, ArmyState>;
  return { ...state, armies };
}

function migrateV2ToV3(state: LegacyGameStateV2): LegacyGameStateV3 {
  const factions = Object.fromEntries(
    Object.entries(state.factions).map(([factionId, faction]) => [factionId, stripControlledCities(faction)]),
  ) as Record<FactionId, LegacyFactionStateV5>;
  return { ...state, factions };
}

function migrateV1ToV3(state: LegacyGameStateV1): LegacyGameStateV3 {
  const { resources, factions: legacyFactions, ...rest } = state;
  const factions = Object.fromEntries(
    Object.entries(legacyFactions).map(([factionId, faction]) => [
      factionId,
      {
        id: faction.id,
        resources: factionId === state.playerFactionId ? resources : { money: 0, supplies: 0, specimens: 0 },
      },
    ]),
  ) as Record<FactionId, LegacyFactionStateV5>;
  return { ...rest, factions };
}

function stripControlledCities(faction: LegacyFactionStateV2): LegacyFactionStateV5 {
  return { id: faction.id, resources: faction.resources };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
