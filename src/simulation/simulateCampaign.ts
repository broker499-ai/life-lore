import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type { BattleTacticId } from '@/core/battles/BattleTypes';
import { claimRoot, getRootClaimAvailability } from '@/core/campaign/rootObjective';
import { attackCity } from '@/core/cities/attackCity';
import { getEffectiveCityRecruitmentOffers } from '@/core/cities/cityTraits';
import { recruitAtCity } from '@/core/cities/recruitAtCity';
import { restAtCity } from '@/core/cities/restAtCity';
import { getEventChoiceAvailability, resolveLocationEvent, triggerLocationEvent } from '@/core/events/LocationEvent';
import { acknowledgeSurfaceBriefing, triggerAvailableSurfaceBriefing } from '@/core/story/SurfaceBriefing';
import { canUseRiverDoubleMove } from '@/core/leaders/LeaderAbility';
import { getCampaignMap, isExtensionUnlocked, FALSE_ROOT_NODE_ID } from '@/core/map/extensionMap';
import { getNeighborNodeIds, type MapGraph } from '@/core/map/MapGraph';
import { moveArmy } from '@/core/map/moveArmy';
import { createPrototypeGameState, PLAYER_ARMY_ID, RIVAL_ARMY_ID, RIVAL_FACTION_ID } from '@/core/state/createPrototypeGameState';
import type { GameState } from '@/core/state/GameState';
import { advanceTurn } from '@/core/turns/advanceTurn';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { getPrototypeRootObjectiveRules, prototypeCampaignRules } from '@/data/campaign/prototypeRules';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeEvents } from '@/data/events/prototypeEvents';
import { prototypeLeaderById, prototypeLeaders } from '@/data/leaders/prototypeLeader';
import { prototypeSurfaceBriefings } from '@/data/story/prototypeSurfaceBriefings';
import { prototypeUnits } from '@/data/units/prototypeUnits';

export type SimulationStrategy = 'balanced' | 'aggressive' | 'knowledge' | 'artifact' | 'rush';

export const simulationStrategies: readonly SimulationStrategy[] = [
  'balanced',
  'aggressive',
  'knowledge',
  'artifact',
  'rush',
];

export type CampaignSimulationOptions = {
  seed: number;
  leaderId: string;
  strategy: SimulationStrategy;
  maxTurns?: number;
  verbose?: boolean;
};

export type CampaignSimulationResult = {
  seed: number;
  leaderId: string;
  strategy: SimulationStrategy;
  status: 'victory' | 'defeat' | 'timeout';
  endingReason: string;
  turns: number;
  falseRootTurn: number | null;
  extensionUnlockedTurn: number | null;
  playerCities: number;
  rivalCities: number;
  playerMoney: number;
  playerSupplies: number;
  knowledgeAvailable: number;
  knowledge: number;
  playerUnits: number;
  maxPlayerUnits: number;
  playerBattles: number;
  playerBattleWins: number;
  playerBattleLosses: number;
  playerCasualties: number;
  rivalActions: number;
  artifactsFound: number;
  activeArtifacts: number;
  legacyResearchCompleted: number;
  poiResolved: number;
  actionCounts: Record<string, number>;
  tacticCounts: Record<BattleTacticId, number>;
  extensionOrder: string;
  activeOrsiaFactions: string;
  rivalLeaderId: string;
  rivalOrganizationId: string;
  stuckTurns: number;
};

type MutableMetrics = Omit<CampaignSimulationResult,
  'status' | 'endingReason' | 'turns' | 'playerCities' | 'rivalCities' | 'playerMoney' | 'playerSupplies' |
  'knowledgeAvailable' | 'knowledge' | 'playerUnits' | 'artifactsFound' | 'activeArtifacts' |
  'legacyResearchCompleted' | 'poiResolved' | 'extensionOrder' | 'activeOrsiaFactions' | 'rivalLeaderId' | 'rivalOrganizationId'
>;

export function simulateCampaign(options: CampaignSimulationOptions): CampaignSimulationResult {
  const maxTurns = options.maxTurns ?? 90;
  let state = createPrototypeGameState(options.seed, options.leaderId);
  const metrics: MutableMetrics = {
    seed: options.seed,
    leaderId: options.leaderId,
    strategy: options.strategy,
    falseRootTurn: null,
    extensionUnlockedTurn: null,
    maxPlayerUnits: getPlayerUnits(state),
    playerBattles: 0,
    playerBattleWins: 0,
    playerBattleLosses: 0,
    playerCasualties: 0,
    rivalActions: 0,
    actionCounts: {},
    tacticCounts: { assault: 0, balanced: 0, cautious: 0, flank: 0 },
    stuckTurns: 0,
  };

  while (state.campaign.status === 'active' && state.turn <= maxTurns) {
    const turnStartedAt = state.turn;
    const beforeActionSpent = state.factions[state.playerFactionId]?.strategicActionSpent ?? false;
    state = autoAcknowledgeBriefings(state);
    state = autoResolvePendingEvent(state, options.strategy, metrics, options.verbose);

    const rootRules = getPrototypeRootObjectiveRules(state);
    const rootAvailability = getRootClaimAvailability(state, {
      factionId: state.playerFactionId,
      armyId: PLAYER_ARMY_ID,
      rules: rootRules,
      cityDefinitions: prototypeCities,
    });
    if (rootAvailability.canClaim) {
      const claimed = claimRoot(state, {
        factionId: state.playerFactionId,
        armyId: PLAYER_ARMY_ID,
        rules: rootRules,
        cityDefinitions: prototypeCities,
      });
      if (claimed.ok) {
        state = claimed.state;
        increment(metrics.actionCounts, 'claim_root');
        log(options.verbose, state.turn, 'CLAIM ROOT');
        break;
      }
    }

    let actionTaken = false;
    let actionAttempts = 0;
    while (state.campaign.status === 'active' && actionAttempts < 2) {
      actionAttempts += 1;
      state = autoAcknowledgeBriefings(state);
      state = autoResolvePendingEvent(state, options.strategy, metrics, options.verbose);
        if (state.campaign.pendingEventId) break;

      const faction = state.factions[state.playerFactionId];
      if (!faction) break;
      const canSecondMove = faction.strategicActionSpent && canUseRiverDoubleMove(state, state.playerFactionId);
      if (faction.strategicActionSpent && !canSecondMove) break;

      const result = chooseAndExecutePlayerAction(state, options.strategy, metrics, canSecondMove, options.verbose);
      state = result.state;
      actionTaken ||= result.taken;
      if (!result.taken || !canUseRiverDoubleMove(state, state.playerFactionId)) break;
    }

    if (state.campaign.status !== 'active') break;

    const graph = getCampaignMap(state);
    const advanced = advanceTurn(state, {
      graph,
      cityDefinitions: prototypeCities,
      unitDefinitions: prototypeUnits,
      battleRules: prototypeBattleRules,
      moveSupplyCost: prototypeCampaignRules.moveSupplyCost,
      attackSupplyCost: prototypeCampaignRules.attackSupplyCost,
      recruitMoraleRestore: prototypeCampaignRules.recruitMoraleRestore,
      moraleCap: prototypeCampaignRules.moraleCap,
      rootObjective: getPrototypeRootObjectiveRules(state),
      aiTurns: [{ factionId: RIVAL_FACTION_ID, armyId: RIVAL_ARMY_ID }],
    });
    state = advanced.state;
    for (const event of advanced.events) {
      if (event.type === 'ai_action_taken') metrics.rivalActions += 1;
    }

    if (!actionTaken && !beforeActionSpent) metrics.stuckTurns += 1;
    metrics.maxPlayerUnits = Math.max(metrics.maxPlayerUnits, getPlayerUnits(state));
    if (turnStartedAt === state.turn) {
      // Defensive guard against any accidental non-advancing turn loop.
      state = { ...state, turn: state.turn + 1 };
      metrics.stuckTurns += 1;
    }
  }

  const timedOut = state.campaign.status === 'active';
  const finalStatus: CampaignSimulationResult['status'] = timedOut
    ? 'timeout'
    : state.campaign.status === 'victory'
      ? 'victory'
      : 'defeat';
  return finalizeResult(state, metrics, finalStatus, timedOut ? 'max_turns' : state.campaign.endingReason ?? 'unknown');
}

function chooseAndExecutePlayerAction(
  state: GameState,
  strategy: SimulationStrategy,
  metrics: MutableMetrics,
  movementOnly: boolean,
  verbose = false,
): { state: GameState; taken: boolean } {
  const army = state.armies[PLAYER_ARMY_ID];
  const faction = state.factions[state.playerFactionId];
  if (!army || !faction || getRosterTotalUnits(army.roster) <= 0) return { state, taken: false };

  const graph = getCampaignMap(state);
  const rootRules = getPrototypeRootObjectiveRules(state);
  const targetId = isExtensionUnlocked(state) ? rootRules.stagingCityId : FALSE_ROOT_NODE_ID;
  const currentCity = state.cities[army.nodeId];
  const currentCityDef = prototypeCities[army.nodeId];
  const units = getRosterTotalUnits(army.roster);

  if (!movementOnly && currentCity?.ownerFactionId === state.playerFactionId && currentCityDef) {
    const moraleThreshold = strategy === 'aggressive' ? 38 : strategy === 'rush' ? 34 : 52;
    if (army.morale < moraleThreshold || faction.resources.supplies < 24) {
      const rested = restAtCity(state, {
        armyId: PLAYER_ARMY_ID,
        cityId: army.nodeId,
        city: currentCityDef,
        supplyCap: prototypeCampaignRules.supplyCap,
        moraleCap: prototypeCampaignRules.moraleCap,
      });
      if (rested.ok) {
        increment(metrics.actionCounts, 'rest');
        log(verbose, state.turn, `REST at ${army.nodeId}`);
        return { state: rested.state, taken: true };
      }
    }

    const baseRecruitTarget = strategy === 'aggressive' ? 34 : strategy === 'rush' ? 28 : strategy === 'knowledge' ? 40 : 38;
    const recruitTarget = isExtensionUnlocked(state)
      ? Math.max(baseRecruitTarget, strategy === 'aggressive' ? 58 : strategy === 'rush' ? 54 : strategy === 'knowledge' ? 72 : 66)
      : baseRecruitTarget;
    if (units < recruitTarget) {
      const offers = getEffectiveCityRecruitmentOffers(currentCityDef)
        .filter((offer) => faction.resources.money >= offer.cost)
        .sort((a, b) => b.amount - a.amount || a.cost - b.cost);
      const offer = offers[0];
      if (offer) {
        const recruited = recruitAtCity(state, {
          armyId: PLAYER_ARMY_ID,
          cityId: army.nodeId,
          offer,
          moraleRestore: prototypeCampaignRules.recruitMoraleRestore,
          moraleCap: prototypeCampaignRules.moraleCap,
        });
        if (recruited.ok) {
          increment(metrics.actionCounts, 'recruit');
          log(verbose, state.turn, `RECRUIT ${offer.amount} ${offer.unitTypeId}`);
          return { state: recruited.state, taken: true };
        }
      }
    }
  }

  const path = shortestPath(graph, army.nodeId, targetId);
  if (!path || path.length < 2) return { state, taken: false };
  const nextNodeId = path[1];
  const city = state.cities[nextNodeId];

  if (!movementOnly && city && city.ownerFactionId !== state.playerFactionId) {
    const regroupUnitThreshold = strategy === 'aggressive' ? 20 : strategy === 'rush' ? 22 : strategy === 'knowledge' ? 34 : 30;
    const regroupMoraleThreshold = strategy === 'aggressive' ? 28 : strategy === 'rush' ? 34 : strategy === 'knowledge' ? 52 : 44;
    if (units < regroupUnitThreshold || army.morale < regroupMoraleThreshold) {
      const regroupPath = pathToNearestOwnedCity(state, graph, army.nodeId);
      const backNodeId = regroupPath?.[1];
      if (backNodeId && backNodeId !== nextNodeId) {
        const movedBack = moveArmy(state, graph, {
          armyId: PLAYER_ARMY_ID,
          toNodeId: backNodeId,
          supplyCost: prototypeCampaignRules.moveSupplyCost,
        });
        if (movedBack.ok) {
          increment(metrics.actionCounts, 'regroup');
          log(verbose, state.turn, `REGROUP ${army.nodeId} -> ${backNodeId}`);
          return { state: processArrival(movedBack.state, backNodeId, strategy, metrics, verbose), taken: true };
        }
      }
    }
    const tactic = choosePlayerTactic(strategy, state, nextNodeId);
    const beforeUnits = getPlayerUnits(state);
    const attacked = attackCity(state, graph, {
      armyId: PLAYER_ARMY_ID,
      cityId: nextNodeId,
      tactic,
      supplyCost: prototypeCampaignRules.attackSupplyCost,
    }, { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules, cityDefinitions: prototypeCities });
    if (attacked.ok) {
      increment(metrics.actionCounts, 'attack');
      metrics.tacticCounts[tactic] += 1;
      if (attacked.battle) {
        metrics.playerBattles += 1;
        metrics.playerCasualties += attacked.battle.sides.A.totalLosses;
        if (attacked.battle.winnerFactionId === state.playerFactionId) metrics.playerBattleWins += 1;
        else metrics.playerBattleLosses += 1;
      }
      let next = attacked.state;
      if (attacked.captured) next = processArrival(next, nextNodeId, strategy, metrics, verbose);
      metrics.maxPlayerUnits = Math.max(metrics.maxPlayerUnits, beforeUnits, getPlayerUnits(next));
      log(verbose, state.turn, `ATTACK ${nextNodeId} (${tactic}) ${attacked.captured ? 'captured' : 'failed'}`);
      return { state: next, taken: true };
    }
    return { state, taken: false };
  }

  const moved = moveArmy(state, graph, {
    armyId: PLAYER_ARMY_ID,
    toNodeId: nextNodeId,
    supplyCost: prototypeCampaignRules.moveSupplyCost,
  });
  if (!moved.ok) return { state, taken: false };
  increment(metrics.actionCounts, 'move');
  log(verbose, state.turn, `MOVE ${army.nodeId} -> ${nextNodeId}`);
  return { state: processArrival(moved.state, nextNodeId, strategy, metrics, verbose), taken: true };
}

function processArrival(
  state: GameState,
  nodeId: string,
  strategy: SimulationStrategy,
  metrics: MutableMetrics,
  verbose: boolean,
): GameState {
  let next = state;
  next = triggerLocationEvent(next, nodeId, prototypeEvents).state;
  if (nodeId === FALSE_ROOT_NODE_ID && metrics.falseRootTurn === null) metrics.falseRootTurn = next.turn;
  const wasUnlocked = isExtensionUnlocked(next);
  next = autoResolvePendingEvent(next, strategy, metrics, verbose);
  if (!wasUnlocked && isExtensionUnlocked(next) && metrics.extensionUnlockedTurn === null) {
    metrics.extensionUnlockedTurn = next.turn;
  }
  return next;
}

function autoResolvePendingEvent(
  state: GameState,
  strategy: SimulationStrategy,
  metrics: MutableMetrics,
  verbose = false,
): GameState {
  const eventId = state.campaign.pendingEventId;
  if (!eventId) return state;
  const event = prototypeEvents[eventId];
  if (!event) return state;

  const choice = chooseEventChoice(state, event, strategy);
  if (!choice) return state;
  const resolved = resolveLocationEvent(state, {
    eventId,
    choiceId: choice.id,
    factionId: state.playerFactionId,
    armyId: PLAYER_ARMY_ID,
    supplyCap: prototypeCampaignRules.supplyCap,
    moraleCap: prototypeCampaignRules.moraleCap,
  }, prototypeEvents, prototypeArtifacts);
  if (!resolved.ok) return state;
  increment(metrics.actionCounts, `event:${choice.id}`);
  log(verbose, state.turn, `EVENT ${eventId} -> ${choice.id}`);
  return resolved.state;
}

function chooseEventChoice(state: GameState, event: (typeof prototypeEvents)[string], strategy: SimulationStrategy) {
  const available = event.choices.filter((choice) => getEventChoiceAvailability(state, choice, state.playerFactionId).canChoose);
  if (available.length === 0) return null;
  if (event.id === 'false-root-revelation') return available[0];

  const artifactChoices = available.filter((choice) => choice.effects.some((effect) => effect.type === 'artifact'));
  const knowledgeChoices = available.filter((choice) => choice.effects.some((effect) => effect.type === 'knowledge' && effect.amount > 0));
  const positiveMoraleChoices = available.filter((choice) => choice.effects.some((effect) => effect.type === 'morale' && effect.amount > 0));

  if (strategy === 'artifact' && artifactChoices[0]) return artifactChoices[0];
  if ((strategy === 'knowledge' || strategy === 'rush') && knowledgeChoices[0]) return knowledgeChoices[0];
  if (strategy === 'aggressive') return artifactChoices[0] ?? positiveMoraleChoices[0] ?? knowledgeChoices[0] ?? available[0];

  const collected = state.factions[state.playerFactionId]?.specimensCollected ?? 0;
  if (strategy === 'balanced' && collected < 8 && knowledgeChoices[0]) return knowledgeChoices[0];
  return artifactChoices[0] ?? knowledgeChoices[0] ?? positiveMoraleChoices[0] ?? available[0];
}


function autoAcknowledgeBriefings(state: GameState): GameState {
  let next = triggerAvailableSurfaceBriefing(state, prototypeSurfaceBriefings);
  let guard = 0;
  while (next.campaign.pendingBriefingId && guard < 20) {
    const id = next.campaign.pendingBriefingId;
    next = acknowledgeSurfaceBriefing(next, id);
    next = triggerAvailableSurfaceBriefing(next, prototypeSurfaceBriefings);
    guard += 1;
  }
  return next;
}

function choosePlayerTactic(strategy: SimulationStrategy, state: GameState, cityId: string): BattleTacticId {
  if (strategy === 'aggressive') return 'assault';
  if (strategy === 'rush') return 'assault';
  if (strategy === 'knowledge') return 'cautious';
  if (strategy === 'artifact') return 'flank';
  const attacker = getPlayerUnits(state);
  const defender = Object.values(state.cities[cityId]?.garrison.roster ?? {}).reduce((sum, amount) => sum + (amount ?? 0), 0);
  if (defender <= 0 || attacker / defender >= 1.7) return 'assault';
  if (attacker / Math.max(1, defender) < 0.95) return 'cautious';
  return 'balanced';
}

function pathToNearestOwnedCity(state: GameState, graph: MapGraph, from: string): string[] | null {
  const targets = new Set(
    Object.values(state.cities)
      .filter((city) => city.ownerFactionId === state.playerFactionId)
      .map((city) => city.id),
  );
  if (targets.has(from)) return [from];
  const queue = [from];
  const previous = new Map<string, string | null>([[from, null]]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const neighbor of getNeighborNodeIds(graph, current)) {
      if (previous.has(neighbor)) continue;
      const city = state.cities[neighbor];
      if (city && city.ownerFactionId !== null && city.ownerFactionId !== state.playerFactionId) continue;
      previous.set(neighbor, current);
      if (targets.has(neighbor)) {
        const path = [neighbor];
        let cursor: string | null = current;
        while (cursor) {
          path.push(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }
  return null;
}

function shortestPath(graph: MapGraph, from: string, to: string): string[] | null {
  if (from === to) return [from];
  const queue = [from];
  const previous = new Map<string, string | null>([[from, null]]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const neighbor of getNeighborNodeIds(graph, current)) {
      if (previous.has(neighbor)) continue;
      previous.set(neighbor, current);
      if (neighbor === to) {
        const path = [to];
        let cursor: string | null = current;
        while (cursor) {
          path.push(cursor);
          cursor = previous.get(cursor) ?? null;
        }
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }
  return null;
}

function finalizeResult(
  state: GameState,
  metrics: MutableMetrics,
  status: CampaignSimulationResult['status'],
  endingReason: string,
): CampaignSimulationResult {
  const playerFaction = state.factions[state.playerFactionId];
  return {
    ...metrics,
    status,
    endingReason,
    turns: Math.min(state.turn, state.campaign.endedTurn ?? state.turn),
    playerCities: Object.values(state.cities).filter((city) => city.ownerFactionId === state.playerFactionId).length,
    rivalCities: Object.values(state.cities).filter((city) => city.ownerFactionId === RIVAL_FACTION_ID).length,
    playerMoney: round(playerFaction?.resources.money ?? 0),
    playerSupplies: round(playerFaction?.resources.supplies ?? 0),
    knowledgeAvailable: playerFaction?.resources.specimens ?? 0,
    knowledge: playerFaction?.specimensCollected ?? 0,
    playerUnits: getPlayerUnits(state),
    artifactsFound: state.campaign.artifactIds.length,
    activeArtifacts: state.campaign.activeArtifactIds.length,
    legacyResearchCompleted: 0,
    poiResolved: state.campaign.resolvedEventIds.length,
    extensionOrder: state.campaign.extensionLocationOrder.join('>'),
    activeOrsiaFactions: Object.values(state.factions)
      .filter((faction) => faction.superFactionId === 'orsia')
      .map((faction) => faction.id)
      .sort()
      .join('|'),
    rivalLeaderId: state.campaign.rivalLeaderId,
    rivalOrganizationId: state.campaign.rivalOrganizationId,
  };
}

function getPlayerUnits(state: GameState): number {
  const army = state.armies[PLAYER_ARMY_ID];
  return army ? getRosterTotalUnits(army.roster) : 0;
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function log(verbose: boolean | undefined, turn: number, text: string): void {
  if (verbose) console.log(`T${String(turn).padStart(2, '0')} ${text}`);
}

export function getDefaultSimulationMatrix(): Array<{ leaderId: string; strategy: SimulationStrategy }> {
  return prototypeLeaders.flatMap((leader) => simulationStrategies.map((strategy) => ({ leaderId: leader.id, strategy })));
}

export function getLeaderName(id: string): string {
  return prototypeLeaderById[id]?.name ?? id;
}
