import { randomInt, createRngStreams } from '@/core/rng/seededRandom';
import type { RngState } from '@/core/rng/RngState';
import { synchronizePlayerMapKnowledge } from '@/core/map/MapVisibility';
import type { CityState, FactionState, GameState } from '@/core/state/GameState';
import { DEFAULT_LEADER_ID, prototypeLeaderById, prototypeLeaders } from '@/data/leaders/prototypeLeader';
import { ORSIA_SUPER_FACTION_ID, orsiaMapSubfactions, orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';
import { RIVAL_FACTION_ID, rivalExpeditions } from '@/data/factions/rivalExpeditions';
import { chooseExtensionLocationOrder, extensionCityIds, getCampaignMap } from '@/core/map/extensionMap';
import { choosePreRootMap } from '@/core/map/preRootMap';
import { createFactionCapitalCityIds } from '@/core/map/factionCapitals';
import { STANDARD_RECRUITMENT_UNIT_IDS, RANDOM_LOCAL_RECRUITMENT_UNIT_IDS, UNIQUE_RECRUITMENT_UNIT_IDS, FRESHMAN_UNIT_ID } from '@/data/units/recruitmentPools';
import { createFreshmanStartingGroups, createInitialArmyGroups } from '@/core/armies/armyFlanks';
import { prototypeUnits } from '@/data/units/prototypeUnits';

export const PLAYER_FACTION_ID = 'expedition';
export { RIVAL_FACTION_ID };
export const PLAYER_ARMY_ID = 'player-main';
export const RIVAL_ARMY_ID = 'rival-main';


const EXTENSION_CITY_CONFIGS = [
  ['mining-kingdom', 22, 10, 80],
  ['lower-garden', 18, 12, 78],
  ['secret-city-7', 28, 14, 86],
  ['red-gallery', 24, 13, 82],
  ['undermoscow', 20, 12, 79],
  ['skovorodsk', 25, 10, 84],
  ['raw-material', 21, 14, 81],
  ['secondary-freshness', 26, 15, 85],
] as const;

const PROFKOM_FACTION_ID = 'orsia-profkom';
const LINHAO_FACTION_ID = 'orsia-linhao';

const ORSIA_CITY_CONFIGS = [
  ['moss-market', 8, 4, 62],
  ['quiet-scream', 7, 5, 66],
  ['big-lunch', 10, 4, 63],
  ['impassable', 14, 5, 73],
  ['crooked-chambers', 13, 7, 71],
  ['great-canteen-vaults', 11, 6, 66],
  ['underfountain', 12, 8, 64],
  ['club-club', 9, 6, 68],
  ['phalanstery', 15, 7, 74],
  ['echo-vault', 10, 5, 68],
  ['last-decent-inn', 14, 8, 76],
  ['root-limit', 18, 9, 82],
] as const;

function orsiaCity(
  id: string,
  ownerFactionId: string,
  guards: number,
  slingers: number,
  morale: number,
): CityState {
  return {
    id,
    ownerFactionId,
    garrison: {
      roster: {
        ...(guards > 0 ? { 'orssian-guard': guards } : {}),
        ...(slingers > 0 ? { 'orssian-slingers': slingers } : {}),
      },
      morale,
    },
    incomeMultiplier: 1,
  };
}

export function createPrototypeGameState(
  seed = 42,
  selectedLeaderId = DEFAULT_LEADER_ID,
): GameState {
  const leader = prototypeLeaderById[selectedLeaderId] ?? prototypeLeaderById[DEFAULT_LEADER_ID];
  let rng = createRngStreams(seed);

  const rivalIdentity = chooseRivalIdentity(leader.id, rng.campaign);
  rng = { ...rng, campaign: rivalIdentity.rngState };

  const preRootMapRoll = choosePreRootMap(rng.campaign);
  rng = { ...rng, campaign: preRootMapRoll.rngState };

  const distribution = distributeOrsiaCities(rng.campaign);
  rng = { ...rng, campaign: distribution.rngState };

  const extensionOrder = chooseExtensionLocationOrder(rng.campaign);
  rng = { ...rng, campaign: extensionOrder.rngState };
  const extensionDistribution = distributeExtensionCities(rng.campaign, distribution.activeFactionIds);
  rng = { ...rng, campaign: extensionDistribution.rngState };

  const rivalLeader = prototypeLeaderById[rivalIdentity.leaderId];
  if (!rivalLeader) throw new Error(`Missing rival leader definition ${rivalIdentity.leaderId}`);

  const factions: Record<string, FactionState> = {
    [PLAYER_FACTION_ID]: {
      id: PLAYER_FACTION_ID,
      superFactionId: null,
      resources: { money: 120, supplies: 80, specimens: 0 },
      specimensCollected: 0,
      strategicActionSpent: false,
      lastStrategicAction: null,
      leaderAbilityLastUsedTurn: null,
      traits: leader.traits.map((trait) => ({ ...trait })),
    },
    [RIVAL_FACTION_ID]: {
      id: RIVAL_FACTION_ID,
      superFactionId: null,
      resources: { money: 118, supplies: 80, specimens: 0 },
      specimensCollected: 0,
      strategicActionSpent: false,
      lastStrategicAction: null,
      leaderAbilityLastUsedTurn: null,
      traits: rivalLeader.traits.map((trait) => ({ ...trait })),
    },
  };

  for (const factionId of [...distribution.activeFactionIds, PROFKOM_FACTION_ID, LINHAO_FACTION_ID]) {
    factions[factionId] = {
      id: factionId,
      superFactionId: ORSIA_SUPER_FACTION_ID,
      resources: { money: 0, supplies: 0, specimens: 0 },
      specimensCollected: 0,
      strategicActionSpent: false,
      lastStrategicAction: null,
      leaderAbilityLastUsedTurn: null,
      traits: orsiaSubfactionById[factionId]?.traits.map((trait) => ({ ...trait })) ?? [],
    };
  }

  const cities: GameState['cities'] = {
    'outer-post': {
      id: 'outer-post',
      ownerFactionId: PLAYER_FACTION_ID,
      garrison: { roster: {}, morale: 80 },
      incomeMultiplier: 1,
    },
    'rival-post': {
      id: 'rival-post',
      ownerFactionId: RIVAL_FACTION_ID,
      garrison: { roster: {}, morale: 78 },
      incomeMultiplier: 1,
    },
  };

  for (const [id, guards, slingers, morale] of ORSIA_CITY_CONFIGS) {
    const ownerFactionId = distribution.cityOwners[id];
    const created = createFactionCity(id, ownerFactionId, guards, slingers, morale, rng.campaign);
    rng = { ...rng, campaign: created.rngState };
    cities[id] = created.city;
  }

  for (const [id, guards, slingers, morale] of EXTENSION_CITY_CONFIGS) {
    const ownerFactionId = extensionDistribution.cityOwners[id];
    if (ownerFactionId === LINHAO_FACTION_ID) {
      cities[id] = {
        id,
        ownerFactionId,
        garrison: { roster: { 'linhao-singular': 1 }, morale: 92 },
        incomeMultiplier: 1,
      };
      continue;
    }
    const created = createFactionCity(id, ownerFactionId, guards, slingers, morale, rng.campaign);
    rng = { ...rng, campaign: created.rngState };
    cities[id] = created.city;
  }

  const factionCapitalCityIds = createFactionCapitalCityIds(
    cities,
    extensionOrder.order,
    PLAYER_FACTION_ID,
  );

  const recruitmentAssignments = chooseRecruitmentAssignments(Object.keys(cities), rng.campaign);
  rng = { ...rng, campaign: recruitmentAssignments.rngState };

  const initialState: GameState = {
    turn: 1,
    playerFactionId: PLAYER_FACTION_ID,
    selectedLeaderId: leader.id,
    factions,
    cities,
    armies: {
      [PLAYER_ARMY_ID]: {
        id: PLAYER_ARMY_ID,
        factionId: PLAYER_FACTION_ID,
        nodeId: 'outer-post',
        morale: leader.traits.some((trait) => trait.type === 'ignore_morale') ? 100 : 80,
        roster: {
          [FRESHMAN_UNIT_ID]: 24,
        },
        groups: createFreshmanStartingGroups(FRESHMAN_UNIT_ID, 24),
      },
      [RIVAL_ARMY_ID]: {
        id: RIVAL_ARMY_ID,
        factionId: RIVAL_FACTION_ID,
        nodeId: 'rival-post',
        morale: rivalLeader.traits.some((trait) => trait.type === 'ignore_morale') ? 100 : 78,
        roster: {
          'expedition-infantry': 18,
          'expedition-rangers': 6,
        },
        groups: createInitialArmyGroups({ 'expedition-infantry': 18, 'expedition-rangers': 6 }, prototypeUnits, 'rival-initial'),
      },
    },
    campaign: {
      developerMode: false,
      rootObtainedByFactionId: null,
      pendingEventId: null,
      resolvedEventIds: [],
      artifactIds: [],
      activeArtifactIds: [],
      cityArtifactClaimedIds: [],
      pendingBriefingId: null,
      resolvedBriefingIds: [],
      discoveredNodeIds: [],
      completedResearchIds: [],
      pendingFactionEvent: null,
      resolvedFactionEventIds: [],
      tyranidEggClutches: {},
      shortRestUsedNodeIds: [],
      recruitmentBlockedUntilTurnByCityId: {},
      cityRecruitmentUnitIds: recruitmentAssignments.cityRecruitmentUnitIds,
      uniqueUnitCityIds: recruitmentAssignments.uniqueUnitCityIds,
      recruitedUniqueUnitIds: [],
      siriusBossCityId: recruitmentAssignments.siriusBossCityId,
      siriusDefeated: false,
      pendingReinforcements: [],
      homeRecruitmentRecoveryTurnByUnitId: {},
      gregJenkinsVictories: 0,
      preRootLayoutId: preRootMapRoll.layoutId,
      preRootLocationOrder: preRootMapRoll.locationOrder,
      extensionLocationOrder: extensionOrder.order,
      factionCapitalCityIds,
      rivalOrganizationId: rivalIdentity.organizationId,
      rivalLeaderId: rivalIdentity.leaderId,
      status: 'active',
      endingReason: null,
      endedTurn: null,
    },
    rng,
  };

  return synchronizePlayerMapKnowledge(initialState, getCampaignMap(initialState));
}


function createFactionCity(
  id: string,
  ownerFactionId: string,
  guards: number,
  slingers: number,
  morale: number,
  initialRng: RngState,
): { city: CityState; rngState: RngState } {
  let rng = initialRng;
  const factionDefinition = orsiaSubfactionById[ownerFactionId];
  const moraleFloor = factionDefinition?.traits
    .filter((trait) => trait.type === 'initial_garrison_morale_floor')
    .reduce((highest, trait) => Math.max(highest, trait.value), 0) ?? 0;
  const sizeRange = factionDefinition?.traits.find(
    (trait) => trait.type === 'initial_garrison_size_multiplier_range',
  );
  let sizeMultiplier = 1;
  if (sizeRange?.type === 'initial_garrison_size_multiplier_range') {
    const minPercent = Math.round(sizeRange.minMultiplier * 100);
    const maxPercent = Math.round(sizeRange.maxMultiplier * 100);
    const roll = randomInt(rng, minPercent, maxPercent);
    rng = roll.state;
    sizeMultiplier = roll.value / 100;
  }
  return {
    city: orsiaCity(
      id,
      ownerFactionId,
      Math.max(0, Math.round(guards * sizeMultiplier)),
      Math.max(0, Math.round(slingers * sizeMultiplier)),
      Math.max(morale, moraleFloor),
    ),
    rngState: rng,
  };
}

export type ExtensionDistribution = {
  cityOwners: Record<string, string>;
  rngState: RngState;
};

export function distributeExtensionCities(initialRng: RngState, activeOriginalFactionIds: readonly string[]): ExtensionDistribution {
  let rng = initialRng;
  const cityShuffle = shuffleWithRng([...extensionCityIds], rng);
  rng = cityShuffle.rngState;
  const cityOwners: Record<string, string> = {};

  const profkomCity = cityShuffle.items[0];
  const linhaoCity = cityShuffle.items[1];
  if (profkomCity) cityOwners[profkomCity] = PROFKOM_FACTION_ID;
  if (linhaoCity) cityOwners[linhaoCity] = LINHAO_FACTION_ID;

  const ownerPool = [...activeOriginalFactionIds, PROFKOM_FACTION_ID, LINHAO_FACTION_ID];
  for (const cityId of cityShuffle.items.slice(2)) {
    const ownerResult = randomInt(rng, 0, ownerPool.length - 1);
    rng = ownerResult.state;
    cityOwners[cityId] = ownerPool[ownerResult.value];
  }

  return { cityOwners, rngState: rng };
}

export type RivalIdentitySelection = {
  organizationId: string;
  leaderId: string;
  rngState: RngState;
};

export function chooseRivalIdentity(selectedLeaderId: string, initialRng: RngState): RivalIdentitySelection {
  let rng = initialRng;
  const organizationPick = randomInt(rng, 0, rivalExpeditions.length - 1);
  rng = organizationPick.state;

  const availableLeaders = prototypeLeaders.filter((candidate) => candidate.id !== selectedLeaderId);
  if (availableLeaders.length === 0) throw new Error('No unselected leader is available for the rival expedition');
  const leaderPick = randomInt(rng, 0, availableLeaders.length - 1);
  rng = leaderPick.state;

  return {
    organizationId: rivalExpeditions[organizationPick.value].id,
    leaderId: availableLeaders[leaderPick.value].id,
    rngState: rng,
  };
}

export type OrsiaDistribution = {
  activeFactionIds: string[];
  cityOwners: Record<string, string>;
  rngState: RngState;
};

export function distributeOrsiaCities(initialRng: RngState): OrsiaDistribution {
  let rng = initialRng;
  const countResult = randomInt(rng, 4, orsiaMapSubfactions.length);
  rng = countResult.state;

  const factionShuffle = shuffleWithRng(
    orsiaMapSubfactions.map((faction) => faction.id),
    rng,
  );
  rng = factionShuffle.rngState;
  const activeFactionIds = factionShuffle.items.slice(0, countResult.value);

  const cityShuffle = shuffleWithRng(
    ORSIA_CITY_CONFIGS.map(([id]) => id),
    rng,
  );
  rng = cityShuffle.rngState;
  const cityOwners: Record<string, string> = {};

  activeFactionIds.forEach((factionId, index) => {
    const cityId = cityShuffle.items[index];
    if (cityId) cityOwners[cityId] = factionId;
  });

  for (const cityId of cityShuffle.items.slice(activeFactionIds.length)) {
    const ownerResult = randomInt(rng, 0, activeFactionIds.length - 1);
    rng = ownerResult.state;
    cityOwners[cityId] = activeFactionIds[ownerResult.value];
  }

  return { activeFactionIds, cityOwners, rngState: rng };
}

export type RecruitmentAssignments = {
  cityRecruitmentUnitIds: Record<string, string[]>;
  uniqueUnitCityIds: Record<string, string>;
  siriusBossCityId: string;
  rngState: RngState;
};

export function chooseRecruitmentAssignments(cityIds: readonly string[], initialRng: RngState): RecruitmentAssignments {
  let rng = initialRng;
  const cityRecruitmentUnitIds: Record<string, string[]> = {};
  for (const cityId of cityIds) {
    if (cityId === 'outer-post') {
      cityRecruitmentUnitIds[cityId] = [...STANDARD_RECRUITMENT_UNIT_IDS];
      continue;
    }
    const shuffled = shuffleWithRng(RANDOM_LOCAL_RECRUITMENT_UNIT_IDS, rng);
    rng = shuffled.rngState;
    cityRecruitmentUnitIds[cityId] = [FRESHMAN_UNIT_ID, ...shuffled.items.slice(0, 2)];
  }

  const uniqueCandidates = cityIds.filter((cityId) => cityId !== 'outer-post');
  const uniqueShuffle = shuffleWithRng(uniqueCandidates, rng);
  rng = uniqueShuffle.rngState;
  const uniqueUnitCityIds: Record<string, string> = {};
  UNIQUE_RECRUITMENT_UNIT_IDS.forEach((unitTypeId, index) => {
    const fallback = uniqueCandidates[index % Math.max(1, uniqueCandidates.length)] ?? 'outer-post';
    uniqueUnitCityIds[unitTypeId] = uniqueShuffle.items[index] ?? fallback;
  });
  const siriusBossCityId = uniqueShuffle.items[UNIQUE_RECRUITMENT_UNIT_IDS.length]
    ?? uniqueShuffle.items[0]
    ?? 'outer-post';

  return { cityRecruitmentUnitIds, uniqueUnitCityIds, siriusBossCityId, rngState: rng };
}

function shuffleWithRng<T>(items: readonly T[], initialRng: RngState): { items: T[]; rngState: RngState } {
  const result = [...items];
  let rng = initialRng;
  for (let index = result.length - 1; index > 0; index -= 1) {
    const pick = randomInt(rng, 0, index);
    rng = pick.state;
    [result[index], result[pick.value]] = [result[pick.value], result[index]];
  }
  return { items: result, rngState: rng };
}
