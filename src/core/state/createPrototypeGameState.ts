import { randomInt, createRngStreams } from '@/core/rng/seededRandom';
import type { RngState } from '@/core/rng/RngState';
import type { CityState, FactionState, GameState } from '@/core/state/GameState';
import { DEFAULT_LEADER_ID, prototypeLeaderById } from '@/data/leaders/prototypeLeader';
import { ORSIA_SUPER_FACTION_ID, orsiaSubfactions } from '@/data/factions/orsiaSubfactions';

export const PLAYER_FACTION_ID = 'expedition';
export const RIVAL_FACTION_ID = 'meridian-company';
export const PLAYER_ARMY_ID = 'player-main';
export const RIVAL_ARMY_ID = 'rival-main';

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
  };
}

export function createPrototypeGameState(
  seed = 42,
  selectedLeaderId = DEFAULT_LEADER_ID,
): GameState {
  const leader = prototypeLeaderById[selectedLeaderId] ?? prototypeLeaderById[DEFAULT_LEADER_ID];
  let rng = createRngStreams(seed);
  const distribution = distributeOrsiaCities(rng.campaign);
  rng = { ...rng, campaign: distribution.rngState };

  const factions: Record<string, FactionState> = {
    [PLAYER_FACTION_ID]: {
      id: PLAYER_FACTION_ID,
      superFactionId: null,
      resources: { money: 120, supplies: 80, specimens: 0 },
      strategicActionSpent: false,
      lastStrategicAction: null,
      leaderAbilityLastUsedTurn: null,
      traits: leader.traits.map((trait) => ({ ...trait })),
    },
    [RIVAL_FACTION_ID]: {
      id: RIVAL_FACTION_ID,
      superFactionId: null,
      resources: { money: 118, supplies: 80, specimens: 0 },
      strategicActionSpent: false,
      lastStrategicAction: null,
      leaderAbilityLastUsedTurn: null,
      traits: [],
    },
  };

  for (const factionId of distribution.activeFactionIds) {
    factions[factionId] = {
      id: factionId,
      superFactionId: ORSIA_SUPER_FACTION_ID,
      resources: { money: 0, supplies: 0, specimens: 0 },
      strategicActionSpent: false,
      lastStrategicAction: null,
      leaderAbilityLastUsedTurn: null,
      traits: [],
    };
  }

  const cities: GameState['cities'] = {
    'outer-post': {
      id: 'outer-post',
      ownerFactionId: PLAYER_FACTION_ID,
      garrison: { roster: {}, morale: 80 },
    },
    'rival-post': {
      id: 'rival-post',
      ownerFactionId: RIVAL_FACTION_ID,
      garrison: { roster: {}, morale: 78 },
    },
  };

  for (const [id, guards, slingers, morale] of ORSIA_CITY_CONFIGS) {
    cities[id] = orsiaCity(id, distribution.cityOwners[id], guards, slingers, morale);
  }

  return {
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
        morale: 80,
        roster: {
          'expedition-infantry': 20,
          'expedition-rangers': 4,
        },
      },
      [RIVAL_ARMY_ID]: {
        id: RIVAL_ARMY_ID,
        factionId: RIVAL_FACTION_ID,
        nodeId: 'rival-post',
        morale: 78,
        roster: {
          'expedition-infantry': 18,
          'expedition-rangers': 6,
        },
      },
    },
    campaign: { rootObtainedByFactionId: null },
    rng,
  };
}

export type OrsiaDistribution = {
  activeFactionIds: string[];
  cityOwners: Record<string, string>;
  rngState: RngState;
};

export function distributeOrsiaCities(initialRng: RngState): OrsiaDistribution {
  let rng = initialRng;
  const countResult = randomInt(rng, 4, orsiaSubfactions.length);
  rng = countResult.state;

  const factionShuffle = shuffleWithRng(
    orsiaSubfactions.map((faction) => faction.id),
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
