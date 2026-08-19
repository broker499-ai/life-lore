import type {
  ArmyId,
  ArmyState,
  CityId,
  CityState,
  CampaignState,
  FactionId,
  FactionState,
  GameState,
  NodeId,
  ResourcesState,
} from '@/core/state/GameState';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { synchronizePlayerMapKnowledge } from '@/core/map/MapVisibility';
import { createFactionCapitalCityIds } from '@/core/map/factionCapitals';
import { DEFAULT_LEADER_ID, prototypeLeaderById, prototypeLeaders } from '@/data/leaders/prototypeLeader';
import { RIVAL_FACTION_ID } from '@/data/factions/rivalExpeditions';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';
import { prototypeMap } from '@/data/map/prototypeMap';
import { extensionCityIds } from '@/core/map/extensionMap';
import { PRE_ROOT_CLASSIC_LAYOUT_ID } from '@/core/map/preRootMap';
import { factionIgnoresMorale } from '@/core/leaders/LeaderAbility';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';
import { MAX_ACTIVE_ARTIFACTS, rebuildActiveArtifactTraits } from '@/core/artifacts/artifactLoadout';

export const CURRENT_SAVE_VERSION = 20 as const;
const LEGACY_DEFAULT_UNIT_TYPE_ID = 'expedition-infantry';
const LEGACY_RIVAL_FACTION_ID = 'meridian-company';
const LEGACY_RESEARCH_COSTS_V14: Record<string, number> = {
  'flora-field-rations': 2,
  'flora-root-tonics': 3,
  'fauna-tunnel-tracks': 2,
  'fauna-pack-logistics': 3,
  'anomaly-office-resonance': 2,
  'anomaly-root-signal': 4,
};

// Previous stages are kept as explicit legacy shapes so save migrations remain readable.
type LegacyFactionStateV1 = { id: FactionId; controlledCityIds: string[] };
type LegacyFactionStateV2 = LegacyFactionStateV1 & { resources: ResourcesState };
type LegacyFactionStateV5 = { id: FactionId; resources: ResourcesState };
type LegacyFactionStateV6 = LegacyFactionStateV5 & { strategicActionSpent: boolean };
type LegacyCampaignStateV5 = { rootObtainedByFactionId: FactionId | null; strategicActionSpent: boolean };
type LegacyCampaignStateV8 = { rootObtainedByFactionId: FactionId | null };
type LegacyCampaignStateV9 = LegacyCampaignStateV8 & {
  pendingEventId: string | null;
  resolvedEventIds: string[];
  artifactIds: string[];
};
type LegacyCampaignStateV10 = {
  rootObtainedByFactionId: FactionId | null;
  pendingEventId: string | null;
  resolvedEventIds: string[];
  artifactIds: string[];
  rivalOrganizationId: string;
  rivalLeaderId: string;
  status: CampaignState['status'];
  endingReason: CampaignState['endingReason'];
  endedTurn: number | null;
};
type LegacyCampaignStateV11 = LegacyCampaignStateV10 & { discoveredNodeIds: NodeId[] };
type LegacyFactionStateV13 = Omit<FactionState, 'specimensCollected'>;
type LegacyCampaignStateV13 = Omit<CampaignState, 'tyranidEggClutches' | 'developerMode' | 'activeArtifactIds' | 'cityArtifactClaimedIds' | 'pendingBriefingId' | 'resolvedBriefingIds' | 'preRootLayoutId' | 'preRootLocationOrder' | 'extensionLocationOrder' | 'factionCapitalCityIds'>;
type LegacyCampaignStateV14 = Omit<CampaignState, 'tyranidEggClutches' | 'developerMode' | 'activeArtifactIds' | 'preRootLayoutId' | 'preRootLocationOrder' | 'extensionLocationOrder' | 'factionCapitalCityIds'>;
type LegacyCampaignStateV15 = Omit<CampaignState, 'tyranidEggClutches' | 'developerMode' | 'preRootLayoutId' | 'preRootLocationOrder' | 'extensionLocationOrder' | 'factionCapitalCityIds'>;
type LegacyCampaignStateV16 = Omit<CampaignState, 'tyranidEggClutches' | 'developerMode' | 'preRootLayoutId' | 'preRootLocationOrder' | 'factionCapitalCityIds'>;
type LegacyCampaignStateV17 = Omit<CampaignState, 'tyranidEggClutches' | 'developerMode' | 'preRootLayoutId' | 'preRootLocationOrder'>;
type LegacyCampaignStateV18 = Omit<CampaignState, 'preRootLayoutId' | 'preRootLocationOrder' | 'tyranidEggClutches'>;
type LegacyCampaignStateV19 = Omit<CampaignState, 'tyranidEggClutches'>;
type LegacyCityStateV4 = Omit<CityState, 'garrison'>;
type LegacyArmyStateV3 = {
  id: ArmyId;
  factionId: FactionId;
  nodeId: string;
  morale: number;
  totalUnits: number;
};

type LegacyGameStateV13 = Omit<GameState, 'campaign' | 'factions'> & { campaign: LegacyCampaignStateV13; factions: Record<FactionId, LegacyFactionStateV13> };
type LegacyGameStateV14 = Omit<GameState, 'campaign' | 'factions'> & { campaign: LegacyCampaignStateV14; factions: Record<FactionId, LegacyFactionStateV13> };
type LegacyGameStateV15 = Omit<GameState, 'campaign'> & { campaign: LegacyCampaignStateV15 };
type LegacyGameStateV16 = Omit<GameState, 'campaign'> & { campaign: LegacyCampaignStateV16 };
type LegacyGameStateV17 = Omit<GameState, 'campaign'> & { campaign: LegacyCampaignStateV17 };
type LegacyGameStateV18 = Omit<GameState, 'campaign'> & { campaign: LegacyCampaignStateV18 };
type LegacyGameStateV19 = Omit<GameState, 'campaign'> & { campaign: LegacyCampaignStateV19 };
type LegacyGameStateV11 = Omit<LegacyGameStateV13, 'campaign'> & { campaign: LegacyCampaignStateV11 };
type LegacyGameStateV10 = Omit<LegacyGameStateV11, 'campaign'> & { campaign: LegacyCampaignStateV10 };
type LegacyGameStateV9 = Omit<LegacyGameStateV10, 'campaign'> & { campaign: LegacyCampaignStateV9 };
type LegacyGameStateV8 = Omit<LegacyGameStateV9, 'campaign'> & { campaign: LegacyCampaignStateV8 };
type LegacyGameStateV7 = Omit<LegacyGameStateV8, 'factions'> & {
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
export type SaveFileV8 = { version: 8; state: LegacyGameStateV8 };
export type SaveFileV9 = { version: 9; state: LegacyGameStateV9 };
export type SaveFileV10 = { version: 10; state: LegacyGameStateV10 };
export type SaveFileV11 = { version: 11; state: LegacyGameStateV11 };
export type SaveFileV12 = { version: 12; state: LegacyGameStateV13 };
export type SaveFileV13 = { version: 13; state: LegacyGameStateV13 };
export type SaveFileV14 = { version: 14; state: LegacyGameStateV14 };
export type SaveFileV15 = { version: 15; state: LegacyGameStateV15 };
export type SaveFileV16 = { version: 16; state: LegacyGameStateV16 };
export type SaveFileV17 = { version: 17; state: LegacyGameStateV17 };
export type SaveFileV18 = { version: 18; state: LegacyGameStateV18 };
export type SaveFileV19 = { version: 19; state: LegacyGameStateV19 };
export type SaveFileV20 = { version: typeof CURRENT_SAVE_VERSION; state: GameState };
export type SaveFile =
  | SaveFileV1
  | SaveFileV2
  | SaveFileV3
  | SaveFileV4
  | SaveFileV5
  | SaveFileV6
  | SaveFileV7
  | SaveFileV8
  | SaveFileV9
  | SaveFileV10
  | SaveFileV11
  | SaveFileV12
  | SaveFileV13
  | SaveFileV14
  | SaveFileV15
  | SaveFileV16
  | SaveFileV17
  | SaveFileV18
  | SaveFileV19
  | SaveFileV20;

export function serializeGame(state: GameState): string {
  const save: SaveFileV20 = { version: CURRENT_SAVE_VERSION, state };
  return JSON.stringify(save);
}

export function deserializeGame(serialized: string): GameState {
  const parsed: unknown = JSON.parse(serialized);
  if (!isRecord(parsed) || !isRecord(parsed.state) || typeof parsed.version !== 'number') {
    throw new Error('Unsupported or invalid save file');
  }

  if (parsed.version === CURRENT_SAVE_VERSION) return parsed.state as GameState;
  if (parsed.version === 19) return migrateV19ToV20(parsed.state as LegacyGameStateV19);

  let v18: LegacyGameStateV18;
  if (parsed.version === 18) v18 = parsed.state as LegacyGameStateV18;
  else if (parsed.version === 17) v18 = migrateV17ToV18(parsed.state as LegacyGameStateV17);
  else if (parsed.version === 16) v18 = migrateV17ToV18(migrateV16ToV17(parsed.state as LegacyGameStateV16));
  else if (parsed.version === 15) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(parsed.state as LegacyGameStateV15)));
  else if (parsed.version === 14) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(parsed.state as LegacyGameStateV14))));
  else if (parsed.version === 13) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(parsed.state as LegacyGameStateV13)))));
  else if (parsed.version === 12) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(parsed.state as LegacyGameStateV13))))));
  else if (parsed.version === 11) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(parsed.state as LegacyGameStateV11)))))));
  else if (parsed.version === 10) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(parsed.state as LegacyGameStateV10))))))));
  else if (parsed.version === 9) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(migrateV9ToV10(parsed.state as LegacyGameStateV9)))))))));
  else if (parsed.version === 8) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(migrateV9ToV10(migrateV8ToV9(parsed.state as LegacyGameStateV8))))))))));
  else if (parsed.version === 7) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(migrateV9ToV10(migrateV8ToV9(migrateV7ToV8(parsed.state as LegacyGameStateV7)))))))))));
  else if (parsed.version === 6) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(migrateV9ToV10(migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(parsed.state as LegacyGameStateV7))))))))))));
  else if (parsed.version === 5) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(migrateV9ToV10(migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(parsed.state as LegacyGameStateV5)))))))))))));
  else if (parsed.version === 4) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(migrateV9ToV10(migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(parsed.state as LegacyGameStateV4))))))))))))));
  else if (parsed.version === 3) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(migrateV9ToV10(migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(parsed.state as LegacyGameStateV3)))))))))))))));
  else if (parsed.version === 2) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(migrateV9ToV10(migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(parsed.state as LegacyGameStateV2))))))))))))))));
  else if (parsed.version === 1) v18 = migrateV17ToV18(migrateV16ToV17(migrateV15ToV16(migrateV14ToV15(migrateV13ToV14(migrateV12ToV13(migrateV11ToV12(migrateV10ToV11(migrateV9ToV10(migrateV8ToV9(migrateV7ToV8(migrateV6ToV7(migrateV5ToV6(migrateV4ToV5(migrateV3ToV4(migrateV1ToV3(parsed.state as LegacyGameStateV1))))))))))))))));
  else throw new Error('Unsupported or invalid save file');

  return migrateV19ToV20(migrateV18ToV19(v18));
}

function migrateV19ToV20(state: LegacyGameStateV19): GameState {
  const factions = { ...state.factions } as GameState['factions'];
  for (const factionId of ['orsia-orcs', 'orsia-tyranids', 'orsia-lateki']) {
    const faction = factions[factionId];
    const definition = orsiaSubfactionById[factionId];
    if (!faction || !definition) continue;
    factions[factionId] = { ...faction, traits: definition.traits.map((trait) => ({ ...trait })) };
  }
  return {
    ...state,
    factions,
    campaign: { ...state.campaign, tyranidEggClutches: {} },
  };
}

function migrateV18ToV19(state: LegacyGameStateV18): GameState {
  const LEGACY_FGU_ID = 'orsia-fgushniki';
  const LATEKI_ID = 'orsia-lateki';
  const factions = { ...state.factions } as GameState['factions'];
  const legacyFgu = factions[LEGACY_FGU_ID];
  if (legacyFgu) {
    delete factions[LEGACY_FGU_ID];
    factions[LATEKI_ID] = {
      ...legacyFgu,
      id: LATEKI_ID,
      traits: orsiaSubfactionById[LATEKI_ID]?.traits.map((trait) => ({ ...trait })) ?? legacyFgu.traits,
    };
  }

  const leaderTraitTypes = new Set([
    'ignore_supply',
    'ignore_morale',
    'artifact_effect_multiplier',
    'map_revealed',
    'river_double_move',
    'morale_damage_inflicted_multiplier',
  ]);
  const applyCurrentLeaderTraits = (factionId: string, leaderId: string) => {
    const faction = factions[factionId];
    const leader = prototypeLeaderById[leaderId];
    if (!faction || !leader) return;
    factions[factionId] = {
      ...faction,
      traits: [
        ...faction.traits.filter((trait) => trait.source !== undefined || !leaderTraitTypes.has(trait.type)),
        ...leader.traits.map((trait) => ({ ...trait })),
      ],
    };
  };
  applyCurrentLeaderTraits(state.playerFactionId, state.selectedLeaderId);
  applyCurrentLeaderTraits(RIVAL_FACTION_ID, state.campaign.rivalLeaderId);

  const cities = Object.fromEntries(
    Object.entries(state.cities).map(([cityId, city]) => [
      cityId,
      city.ownerFactionId === LEGACY_FGU_ID ? { ...city, ownerFactionId: LATEKI_ID } : city,
    ]),
  ) as GameState['cities'];
  const armies = Object.fromEntries(
    Object.entries(state.armies).map(([armyId, army]) => {
      const factionId = army.factionId === LEGACY_FGU_ID ? LATEKI_ID : army.factionId;
      const nextArmy = { ...army, factionId };
      return [armyId, nextArmy];
    }),
  ) as GameState['armies'];

  const factionCapitalCityIds = Object.fromEntries(
    Object.entries(state.campaign.factionCapitalCityIds).map(([factionId, cityId]) => [
      factionId === LEGACY_FGU_ID ? LATEKI_ID : factionId,
      cityId,
    ]),
  );
  const pendingFactionEvent = state.campaign.pendingFactionEvent
    ? {
        ...state.campaign.pendingFactionEvent,
        factionId: state.campaign.pendingFactionEvent.factionId === LEGACY_FGU_ID ? LATEKI_ID : state.campaign.pendingFactionEvent.factionId,
        beneficiaryFactionId: state.campaign.pendingFactionEvent.beneficiaryFactionId === LEGACY_FGU_ID ? LATEKI_ID : state.campaign.pendingFactionEvent.beneficiaryFactionId,
      }
    : null;

  let migrated: GameState = {
    ...state,
    factions,
    cities,
    armies,
    campaign: {
      ...state.campaign,
      preRootLayoutId: PRE_ROOT_CLASSIC_LAYOUT_ID,
      preRootLocationOrder: [],
      factionCapitalCityIds,
      pendingFactionEvent,
      tyranidEggClutches: {},
    },
  };

  // Artemios' new perk is absolute: old saves immediately normalize his expedition to 100 morale.
  const normalizedArmies = Object.fromEntries(
    Object.entries(migrated.armies).map(([armyId, army]) => [
      armyId,
      factionIgnoresMorale(migrated, army.factionId) ? { ...army, morale: 100 } : army,
    ]),
  ) as GameState['armies'];
  migrated = { ...migrated, armies: normalizedArmies };
  return migrated;
}

function migrateV17ToV18(state: LegacyGameStateV17): LegacyGameStateV18 {
  return {
    ...state,
    campaign: {
      ...state.campaign,
      developerMode: false,
    },
  };
}

function migrateV16ToV17(state: LegacyGameStateV16): LegacyGameStateV17 {
  const factionCapitalCityIds = createFactionCapitalCityIds(
    state.cities,
    state.campaign.extensionLocationOrder,
    state.playerFactionId,
  );
  return {
    ...state,
    campaign: {
      ...state.campaign,
      factionCapitalCityIds,
    },
  };
}


function migrateV15ToV16(state: LegacyGameStateV15): LegacyGameStateV16 {
  const defaults = createPrototypeGameState(state.rng.campaign.seed, state.selectedLeaderId);
  const factions = { ...state.factions } as GameState['factions'];
  for (const factionId of ['orsia-profkom', 'orsia-linhao']) {
    if (!factions[factionId] && defaults.factions[factionId]) {
      factions[factionId] = defaults.factions[factionId];
    }
  }

  const cities = { ...state.cities } as GameState['cities'];
  for (const cityId of extensionCityIds) {
    if (!cities[cityId] && defaults.cities[cityId]) cities[cityId] = defaults.cities[cityId];
  }

  return {
    ...state,
    factions,
    cities,
    campaign: {
      ...state.campaign,
      extensionLocationOrder: [...defaults.campaign.extensionLocationOrder],
    },
  };
}

function migrateV14ToV15(state: LegacyGameStateV14): LegacyGameStateV15 {
  const completedResearchCost = state.campaign.completedResearchIds.reduce(
    (sum, researchId) => sum + (LEGACY_RESEARCH_COSTS_V14[researchId] ?? 0),
    0,
  );
  const factions = Object.fromEntries(
    Object.entries(state.factions).map(([factionId, faction]) => [
      factionId,
      {
        ...faction,
        specimensCollected: Math.max(
          0,
          faction.resources.specimens + (factionId === state.playerFactionId ? completedResearchCost : 0),
        ),
      },
    ]),
  ) as GameState['factions'];
  const activeArtifactIds = state.campaign.artifactIds.slice(0, MAX_ACTIVE_ARTIFACTS);
  // Stage 15 predates the extension map. Build a temporary current-shaped state only
  // so the existing trait/map helpers can be reused, then return the exact v15 shape.
  const temporary = {
    ...state,
    factions,
    campaign: {
      ...state.campaign,
      activeArtifactIds,
      preRootLayoutId: PRE_ROOT_CLASSIC_LAYOUT_ID,
      preRootLocationOrder: [],
      extensionLocationOrder: [],
      factionCapitalCityIds: {},
      developerMode: false,
      tyranidEggClutches: {},
    },
  } as GameState;
  const rebuilt = synchronizePlayerMapKnowledge(
    rebuildActiveArtifactTraits(temporary, temporary.playerFactionId, prototypeArtifacts),
    prototypeMap,
  );
  const { preRootLayoutId: legacyPreRootLayoutId, preRootLocationOrder: legacyPreRootLocationOrder, extensionLocationOrder: legacyExtensionOrder, factionCapitalCityIds: legacyCapitals, developerMode: legacyDeveloperMode, ...campaign } = rebuilt.campaign;
  void legacyPreRootLayoutId;
  void legacyPreRootLocationOrder;
  void legacyExtensionOrder;
  void legacyCapitals;
  void legacyDeveloperMode;
  return { ...rebuilt, campaign };
}

function migrateV13ToV14(state: LegacyGameStateV13): LegacyGameStateV14 {
  const artifactIdMap: Record<string, string> = {
    'warehouse-one-seal': 'apple-skeleton',
    'normal-water-flask': 'normal-juice-flask',
    'yesterday-appointment-slip': 'uboynastoyka',
    'unlabeled-red-button': 'red-radish',
    'temporary-key': 'vanilla-cartilage',
    'almost-root-souvenir': 'almost-grass',
  };
  const mapEventId = (eventId: string) => eventId === 'temporary-pass' ? 'jungle-foraging' : eventId;
  const artifactIds = Array.from(new Set(state.campaign.artifactIds.map((artifactId) => artifactIdMap[artifactId] ?? artifactId)));
  return {
    ...state,
    campaign: {
      ...state.campaign,
      pendingEventId: state.campaign.pendingEventId ? mapEventId(state.campaign.pendingEventId) : null,
      resolvedEventIds: Array.from(new Set(state.campaign.resolvedEventIds.map(mapEventId))),
      artifactIds,
      cityArtifactClaimedIds: [],
      pendingBriefingId: null,
      resolvedBriefingIds: [],
    },
  };
}

function migrateV12ToV13(state: LegacyGameStateV13): LegacyGameStateV13 {
  const factions = { ...state.factions };
  for (const [factionId, definition] of Object.entries(orsiaSubfactionById)) {
    const faction = factions[factionId];
    if (!faction) continue;
    const existingTypes = new Set(faction.traits.map((trait) => trait.type));
    factions[factionId] = {
      ...faction,
      traits: [
        ...faction.traits,
        ...definition.traits.filter((trait) => !existingTypes.has(trait.type)).map((trait) => ({ ...trait })),
      ],
    };
  }

  const cities = Object.fromEntries(
    Object.entries(state.cities).map(([cityId, city]) => [
      cityId,
      { ...city, incomeMultiplier: city.incomeMultiplier ?? 1 },
    ]),
  ) as GameState['cities'];

  return { ...state, factions, cities };
}

function migrateV11ToV12(state: LegacyGameStateV11): LegacyGameStateV13 {
  const factions = { ...state.factions };
  for (const [factionId, definition] of Object.entries(orsiaSubfactionById)) {
    const faction = factions[factionId];
    if (!faction) continue;
    const existingTypes = new Set(faction.traits.map((trait) => trait.type));
    factions[factionId] = {
      ...faction,
      traits: [
        ...faction.traits,
        ...definition.traits.filter((trait) => !existingTypes.has(trait.type)).map((trait) => ({ ...trait })),
      ],
    };
  }

  const nazbolFloor = orsiaSubfactionById['orsia-nazbols']?.traits
    .filter((trait) => trait.type === 'initial_garrison_morale_floor')
    .reduce((highest, trait) => Math.max(highest, trait.value), 0) ?? 0;
  const cities = Object.fromEntries(
    Object.entries(state.cities).map(([cityId, city]) => [
      cityId,
      city.ownerFactionId === 'orsia-nazbols' && city.garrison.morale > 0
        ? { ...city, garrison: { ...city.garrison, morale: Math.max(city.garrison.morale, nazbolFloor) } }
        : city,
    ]),
  ) as GameState['cities'];

  return {
    ...state,
    factions,
    cities,
    campaign: {
      ...state.campaign,
      completedResearchIds: [],
      pendingFactionEvent: null,
      resolvedFactionEventIds: [],
    },
  };
}

function migrateV10ToV11(state: LegacyGameStateV10): LegacyGameStateV11 {
  const migrated: LegacyGameStateV11 = {
    ...state,
    campaign: {
      ...state.campaign,
      discoveredNodeIds: [],
    },
  };
  return migrated;
}

function migrateV9ToV10(state: LegacyGameStateV9): LegacyGameStateV10 {
  const rivalLeader = prototypeLeaders.find((leader) => leader.id !== state.selectedLeaderId) ?? prototypeLeaders[0];
  const oldRival = state.factions[LEGACY_RIVAL_FACTION_ID];
  const factions = { ...state.factions } as Record<FactionId, LegacyFactionStateV13>;
  delete factions[LEGACY_RIVAL_FACTION_ID];
  if (oldRival) {
    factions[RIVAL_FACTION_ID] = {
      ...oldRival,
      id: RIVAL_FACTION_ID,
      superFactionId: null,
      lastStrategicAction: null,
      leaderAbilityLastUsedTurn: null,
      traits: rivalLeader.traits.map((trait) => ({ ...trait })),
    };
  } else if (!factions[RIVAL_FACTION_ID]) {
    const defaults = createPrototypeGameState(state.rng.campaign.seed, state.selectedLeaderId);
    const { specimensCollected: _specimensCollected, ...legacyDefaultRival } = defaults.factions[RIVAL_FACTION_ID];
    factions[RIVAL_FACTION_ID] = legacyDefaultRival;
  }

  const cities = Object.fromEntries(
    Object.entries(state.cities).map(([cityId, city]) => [
      cityId,
      city.ownerFactionId === LEGACY_RIVAL_FACTION_ID
        ? { ...city, ownerFactionId: RIVAL_FACTION_ID }
        : city,
    ]),
  ) as GameState['cities'];

  const armies = Object.fromEntries(
    Object.entries(state.armies).map(([armyId, army]) => [
      armyId,
      army.factionId === LEGACY_RIVAL_FACTION_ID
        ? { ...army, factionId: RIVAL_FACTION_ID }
        : army,
    ]),
  ) as GameState['armies'];

  const rootOwner = state.campaign.rootObtainedByFactionId === LEGACY_RIVAL_FACTION_ID
    ? RIVAL_FACTION_ID
    : state.campaign.rootObtainedByFactionId;
  const status = rootOwner === state.playerFactionId ? 'victory' : rootOwner === RIVAL_FACTION_ID ? 'defeat' : 'active';

  return {
    ...state,
    factions,
    cities,
    armies,
    campaign: {
      ...state.campaign,
      rootObtainedByFactionId: rootOwner,
      rivalOrganizationId: 'gospol',
      rivalLeaderId: rivalLeader.id,
      status,
      endingReason: status === 'victory' ? 'root_claimed' : status === 'defeat' ? 'rival_root_claimed' : null,
      endedTurn: status === 'active' ? null : state.turn,
    },
  };
}

function migrateV8ToV9(state: LegacyGameStateV8): LegacyGameStateV9 {
  return {
    ...state,
    campaign: {
      ...state.campaign,
      pendingEventId: null,
      resolvedEventIds: [],
      artifactIds: [],
    },
  };
}

function migrateV7ToV8(state: LegacyGameStateV7): LegacyGameStateV8 {
  const selectedLeaderId = prototypeLeaderById[state.selectedLeaderId]
    ? state.selectedLeaderId
    : DEFAULT_LEADER_ID;
  const currentDefaults = createPrototypeGameState(state.rng.campaign.seed, selectedLeaderId);
  const defaults = convertCurrentDefaultsToLegacyRival(currentDefaults);
  const factions = { ...defaults.factions };

  for (const factionId of [state.playerFactionId, LEGACY_RIVAL_FACTION_ID]) {
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
  const defaults = convertCurrentDefaultsToLegacyRival(createPrototypeGameState(state.rng.campaign.seed, state.selectedLeaderId));
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

function convertCurrentDefaultsToLegacyRival(state: GameState): LegacyGameStateV8 {
  const factions = { ...state.factions } as Record<string, any>;
  const rival = factions[RIVAL_FACTION_ID];
  delete factions[RIVAL_FACTION_ID];
  if (rival) factions[LEGACY_RIVAL_FACTION_ID] = { ...rival, id: LEGACY_RIVAL_FACTION_ID };

  const cities = Object.fromEntries(
    Object.entries(state.cities).map(([cityId, city]) => [
      cityId,
      city.ownerFactionId === RIVAL_FACTION_ID ? { ...city, ownerFactionId: LEGACY_RIVAL_FACTION_ID } : city,
    ]),
  );
  const armies = Object.fromEntries(
    Object.entries(state.armies).map(([armyId, army]) => [
      armyId,
      army.factionId === RIVAL_FACTION_ID ? { ...army, factionId: LEGACY_RIVAL_FACTION_ID } : army,
    ]),
  );

  return {
    ...state,
    factions,
    cities,
    armies,
    campaign: { rootObtainedByFactionId: state.campaign.rootObtainedByFactionId },
  } as LegacyGameStateV8;
}

function stripControlledCities(faction: LegacyFactionStateV2): LegacyFactionStateV5 {
  return { id: faction.id, resources: faction.resources };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
