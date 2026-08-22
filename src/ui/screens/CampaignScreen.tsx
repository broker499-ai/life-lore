import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_BATTLE_PLAN, type BattleCommandId, type BattlePlan, type BattleTacticId } from '@/core/battles/BattleTypes';
import {
  attackCity,
  getAttackCityAvailability,
  type AttackCityAvailability,
} from '@/core/cities/attackCity';
import type { RecruitmentOffer } from '@/core/cities/CityDefinition';
import { attemptRecruitAtCity, type RecruitmentAttemptError } from '@/core/cities/recruitmentAttempt';
import { clearTyranidEggClutch, getClearTyranidEggClutchAvailability } from '@/core/cities/clearTyranidEggClutch';
import { getTyranidEggClutchStatus } from '@/core/cities/tyranidEggClutch';
import { getHomeRecruitmentRecoveryTurnsRemaining, getHomeRecruitmentSafeMultiplier, getPlayerCityRecruitmentOffers, getUniqueRecruitmentUnitIdsAtCity } from '@/core/cities/playerRecruitment';
import { recruitUniqueUnit } from '@/core/cities/recruitUniqueUnit';
import { fightSiriusBoss } from '@/core/cities/fightSiriusBoss';
import {
  getRestAtCityAvailability,
  restAtCity,
  type RestAtCityAvailability,
} from '@/core/cities/restAtCity';
import { getNeighborNodeIds } from '@/core/map/MapGraph';
import { getMapNodeVisibilityById } from '@/core/map/MapVisibility';
import { getCapitalFactionIdByCityId } from '@/core/map/factionCapitals';
import {
  getMoveArmyAvailability,
  moveArmy,
  type MoveArmyAvailability,
  type MoveArmyError,
} from '@/core/map/moveArmy';
import type { ArmyFlankId, GameState } from '@/core/state/GameState';
import { autoDistributeArmyGroups, mergeArmyGroups, moveArmyGroup, splitArmyGroup, swapArmyFlanks } from '@/core/armies/armyFlanks';
import { claimRoot, getRootClaimAvailability } from '@/core/campaign/rootObjective';
import { developerTeleportArmy } from '@/core/dev/developerMode';
import { evaluatePlayerDefeat } from '@/core/campaign/campaignOutcome';
import { getSupplyStatus } from '@/core/supply/Supply';
import { canUseRiverDoubleMove } from '@/core/leaders/LeaderAbility';
import { resolveLocationEvent, triggerLocationEvent } from '@/core/events/LocationEvent';
import { getShortRestAtPoiAvailability, shortRestAtPoi } from '@/core/events/shortRestAtPoi';
import { toggleActiveArtifact } from '@/core/artifacts/artifactLoadout';
import { acknowledgeSurfaceBriefing, triggerAvailableSurfaceBriefing } from '@/core/story/SurfaceBriefing';
import { advanceTurn } from '@/core/turns/advanceTurn';
import { resolveFactionDefeatEvent } from '@/core/factions/resolveFactionDefeatEvent';
import { RIVAL_ARMY_ID, RIVAL_FACTION_ID } from '@/core/state/createPrototypeGameState';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { getPrototypeRootObjectiveRules, prototypeCampaignRules } from '@/data/campaign/prototypeRules';
import { getKnowledgeCorruptionStage, MAX_ORSIA_KNOWLEDGE } from '@/data/campaign/knowledgeRules';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeMapRegions } from '@/data/map/prototypeMap';
import { getCampaignMap, isExtensionUnlocked } from '@/core/map/extensionMap';
import type { MapGraph } from '@/core/map/MapGraph';
import { prototypeUnits } from '@/data/units/prototypeUnits';
import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';
import { prototypeEvents } from '@/data/events/prototypeEvents';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';
import { prototypeSurfaceBriefingById, prototypeSurfaceBriefings } from '@/data/story/prototypeSurfaceBriefings';
import { rivalExpeditionById } from '@/data/factions/rivalExpeditions';
import { factionDefeatEvents } from '@/data/factions/factionDefeatEvents';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';
import { t } from '@/i18n/t';
import type { TranslationKey } from '@/i18n/ru';
import { ArmyOverview } from '@/ui/components/ArmyOverview';
import {
  DecisionPanel,
  StrategicActionBar,
  getAttackErrorMessage,
  getRestErrorMessage,
} from '@/ui/components/DecisionPanel';
import type { BattleReport } from '@/ui/battles/BattleReport';
import { BattleViewer } from '@/ui/battles/BattleViewer';
import {
  SvgWorldMap,
  type MapCameraSnapshot,
  type PlayerMovementAnimation,
} from '@/ui/components/SvgWorldMap';
import { RaceIndicator } from '@/ui/components/RaceIndicator';
import { TopStatusBar } from '@/ui/components/TopStatusBar';
import { LocationEventOverlay } from '@/ui/components/LocationEventOverlay';
import { ArtifactInventory } from '@/ui/components/ArtifactInventory';
import { CitiesOverview } from '@/ui/components/CitiesOverview';
import { FactionDefeatOverlay } from '@/ui/components/FactionDefeatOverlay';
import { RootFinaleOverlay, type RootFinaleChoice } from '@/ui/components/RootFinaleOverlay';
import { SurfaceBriefingOverlay } from '@/ui/components/SurfaceBriefingOverlay';
import { RecruitmentRollOverlay, type RecruitmentRollOutcome } from '@/ui/components/RecruitmentRollOverlay';
import { CampaignEndScreen } from '@/ui/screens/CampaignEndScreen';
import {
  getDefaultCampaignUiSnapshot,
  saveCampaignSnapshot,
  type CampaignUiSnapshot,
} from '@/services/saves/CampaignStorage';

type CampaignView = 'map' | 'army' | 'artifacts' | 'cities' | 'battle';
type SuccessfulMoveResult = Extract<ReturnType<typeof moveArmy>, { ok: true }>;
type SuccessfulAttackResult = Extract<ReturnType<typeof attackCity>, { ok: true }>;
type SuccessfulRecruitmentAttempt = Extract<ReturnType<typeof attemptRecruitAtCity>, { ok: true }>;
type PendingMovement = PlayerMovementAnimation & (
  | { kind: 'move'; result: SuccessfulMoveResult }
  | {
      kind: 'attack';
      result: SuccessfulAttackResult;
      cityId: string;
      originNodeId: string | null;
      tactic: BattleTacticId;
      attackSupplyCost: number;
      sourceState: GameState;
      plan: BattlePlan;
    }
);

type ActivePlayerBattle = {
  kind?: 'city_attack' | 'tyranid_cleanup';
  sourceState: GameState;
  cityId: string;
  originNodeId: string | null;
  tactic: BattleTacticId;
  attackSupplyCost: number;
  plan: BattlePlan;
};

const PLAYER_MOVE_ANIMATION_MS = 1050;

export function CampaignScreen({
  initialState,
  initialUi = getDefaultCampaignUiSnapshot(),
  onExit,
}: {
  initialState: GameState;
  initialUi?: CampaignUiSnapshot;
  onExit: () => void;
}) {
  const [state, setState] = useState(() => triggerAvailableSurfaceBriefing(evaluatePlayerDefeat(initialState).state, prototypeSurfaceBriefings));
  const campaignMap = useMemo(() => getCampaignMap(state), [state.campaign.preRootLayoutId, state.campaign.preRootLocationOrder, state.campaign.extensionLocationOrder, state.campaign.resolvedEventIds, state.campaign.developerMode]);
  const capitalFactionIdByCityId = useMemo(() => getCapitalFactionIdByCityId(state), [state.campaign.factionCapitalCityIds]);
  const campaignRegions = useMemo(() => (isExtensionUnlocked(state) || state.campaign.developerMode)
    ? [
        ...prototypeMapRegions,
        { id: 'deep-route-upper', cx: 50, cy: -86, rx: 21, ry: 88, kind: 'root' as const },
        { id: 'deep-route-lower', cx: 50, cy: -168, rx: 18, ry: 38, kind: 'fungal' as const },
      ]
    : prototypeMapRegions, [state.campaign.resolvedEventIds, state.campaign.developerMode]);
  const rootObjectiveRules = useMemo(() => getPrototypeRootObjectiveRules(state), [state.campaign.extensionLocationOrder]);
  const [view, setView] = useState<CampaignView>(initialUi.view === 'army' || initialUi.view === 'artifacts' || initialUi.view === 'cities' ? initialUi.view : 'map');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialUi.selectedNodeId);
  const [mapCamera, setMapCamera] = useState<MapCameraSnapshot | null>(initialUi.mapCamera);
  const [selectedTactic, setSelectedTactic] = useState<BattleTacticId>('balanced');
  const [battlePlan, setBattlePlan] = useState<BattlePlan>(() => ({ ...DEFAULT_BATTLE_PLAN, commands: [] }));
  const [recruitmentRollOutcome, setRecruitmentRollOutcome] = useState<RecruitmentRollOutcome | null>(null);
  const recruitmentRollTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (recruitmentRollTimerRef.current !== null) {
      window.clearTimeout(recruitmentRollTimerRef.current);
    }
  }, []);

  const [battleReport, setBattleReport] = useState<BattleReport | null>(null);
  const [activePlayerBattle, setActivePlayerBattle] = useState<ActivePlayerBattle | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingMovement, setPendingMovement] = useState<PendingMovement | null>(null);
  const [autoEndAfterPendingEvent, setAutoEndAfterPendingEvent] = useState(false);
  const [rootFinaleOpen, setRootFinaleOpen] = useState(false);
  const movementSequenceRef = useRef(0);
  const manualSaveAtRef = useRef(0);
  const playerKnowledge = state.factions[state.playerFactionId]?.specimensCollected ?? 0;
  const knowledgeCorruptionStage = getKnowledgeCorruptionStage(playerKnowledge);
  const knowledgeClass = knowledgeCorruptionStage === 2
    ? ' knowledge-stage-2'
    : knowledgeCorruptionStage === 1
      ? ' knowledge-stage-1'
      : '';

  useEffect(() => {
    saveCampaignSnapshot(state, {
      view: view === 'battle' ? 'map' : view,
      selectedNodeId,
      mapCamera,
    });
    // Game-state changes are committed immediately. The debounced effect below
    // is only there to avoid excessive writes while the player pans the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (Date.now() - manualSaveAtRef.current < 750) return;
      saveCampaignSnapshot(state, {
        view: view === 'battle' ? 'map' : view,
        selectedNodeId,
        mapCamera,
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [mapCamera, selectedNodeId, state, view]);

  const mapVisibilityById = useMemo(
    () => getMapNodeVisibilityById(state, campaignMap, state.playerFactionId),
    [state],
  );
  const selectedNodeVisibility = selectedNodeId
    ? mapVisibilityById[selectedNodeId] ?? 'unknown'
    : null;
  const selectedNode = useMemo(() => {
    const node = campaignMap.nodes.find((candidate) => candidate.id === selectedNodeId) ?? null;
    if (!node) return null;
    if (selectedNodeVisibility === 'unknown' && node.kind !== 'city') return null;
    return node;
  }, [campaignMap, selectedNodeId, selectedNodeVisibility]);
  const selectedCapitalFactionId = selectedNode ? capitalFactionIdByCityId[selectedNode.id] ?? null : null;
  const selectedCity = selectedNodeId && selectedNodeVisibility === 'visible'
    ? state.cities[selectedNodeId] ?? null
    : null;
  const selectedCityDefinition = selectedNodeId && selectedNodeVisibility !== 'unknown'
    ? prototypeCities[selectedNodeId] ?? null
    : null;
  const playerArmy = state.armies['player-main'];
  const playerLeader = prototypeLeaderById[state.selectedLeaderId];
  const rivalArmy = state.armies[RIVAL_ARMY_ID];
  const rivalLeader = prototypeLeaderById[state.campaign.rivalLeaderId];
  const rivalOrganization = rivalExpeditionById[state.campaign.rivalOrganizationId];
  const rivalName = rivalOrganization?.name ?? 'Конкурирующая экспедиция';
  const playerRootAvailability = useMemo(
    () => getRootClaimAvailability(state, {
      factionId: state.playerFactionId,
      armyId: 'player-main',
      rules: rootObjectiveRules,
      cityDefinitions: prototypeCities,
    }),
    [state],
  );
  const isPlayerMoving = pendingMovement !== null;
  const movementDestination = pendingMovement
    ? campaignMap.nodes.find((node) => node.id === pendingMovement.toNodeId) ?? null
    : null;
  const playerNodeId = playerArmy?.nodeId ?? 'outer-post';
  const currentCity = state.cities[playerNodeId] ?? null;
  const currentCityDefinition = prototypeCities[playerNodeId] ?? null;
  const currentCityControlled = currentCity?.ownerFactionId === state.playerFactionId;
  const recruitmentCityId = selectedCity?.ownerFactionId === state.playerFactionId &&
    (selectedCity.id === playerNodeId || selectedCity.id === 'outer-post')
    ? selectedCity.id
    : currentCityControlled
      ? playerNodeId
      : null;
  const recruitmentCityDefinition = recruitmentCityId ? prototypeCities[recruitmentCityId] ?? null : null;
  const recruitmentCityControlled = Boolean(recruitmentCityId && state.cities[recruitmentCityId]?.ownerFactionId === state.playerFactionId);
  const currentRecruitmentOffers = useMemo(
    () => recruitmentCityId ? getPlayerCityRecruitmentOffers(state, recruitmentCityId) : [],
    [recruitmentCityId, state],
  );
  const uniqueRecruitmentUnitIds = useMemo(
    () => recruitmentCityId ? getUniqueRecruitmentUnitIdsAtCity(state, recruitmentCityId) : [],
    [recruitmentCityId, state],
  );
  const recruitmentSafeLimitMultiplierByUnitId = useMemo(
    () => Object.fromEntries(currentRecruitmentOffers.map((offer) => [
      offer.unitTypeId,
      recruitmentCityId ? getHomeRecruitmentSafeMultiplier(state, recruitmentCityId, offer.unitTypeId) : 1,
    ])),
    [currentRecruitmentOffers, recruitmentCityId, state],
  );
  const recruitmentRecoveryTurnsByUnitId = useMemo(
    () => Object.fromEntries(currentRecruitmentOffers.map((offer) => [
      offer.unitTypeId,
      recruitmentCityId ? getHomeRecruitmentRecoveryTurnsRemaining(state, recruitmentCityId, offer.unitTypeId) : 0,
    ])),
    [currentRecruitmentOffers, recruitmentCityId, state],
  );
  const currentNode = useMemo(() => campaignMap.nodes.find((node) => node.id === playerNodeId) ?? null, [campaignMap, playerNodeId]);
  const shortRestAvailability = useMemo(
    () => currentNode?.kind === 'poi'
      ? getShortRestAtPoiAvailability(state, campaignMap, { armyId: 'player-main', nodeId: playerNodeId })
      : null,
    [campaignMap, currentNode?.kind, playerNodeId, state],
  );
  const recruitmentBlockedTurns = state.campaign.developerMode || !recruitmentCityId ? 0 : Math.max(0, (state.campaign.recruitmentBlockedUntilTurnByCityId[recruitmentCityId] ?? 0) - state.turn);
  const currentTyranidClutchStatus = currentCityDefinition
    ? getTyranidEggClutchStatus(state, playerNodeId)
    : null;
  const currentTyranidClutchAvailability = currentTyranidClutchStatus
    ? getClearTyranidEggClutchAvailability(state, { armyId: 'player-main', cityId: playerNodeId })
    : null;
  const siriusBossAvailable = !state.campaign.siriusDefeated && playerNodeId === state.campaign.siriusBossCityId;

  const neighboringNodeIds = useMemo(
    () => getNeighborNodeIds(campaignMap, playerNodeId),
    [campaignMap, playerNodeId],
  );
  const playerSupply = useMemo(
    () => getSupplyStatus(state, campaignMap, state.playerFactionId, playerNodeId),
    [playerNodeId, state],
  );
  const pendingEvent = state.campaign.pendingEventId
    ? prototypeEvents[state.campaign.pendingEventId] ?? null
    : null;
  const pendingEventNode = pendingEvent
    ? campaignMap.nodes.find((node) => node.id === pendingEvent.nodeId) ?? null
    : null;
  const pendingEventLocationName = pendingEventNode ? t(pendingEventNode.nameKey as TranslationKey) : null;
  const pendingEventLocationDescription = pendingEventNode?.descriptionKey ? t(pendingEventNode.descriptionKey as TranslationKey) : null;
  const pendingBriefing = state.campaign.pendingBriefingId
    ? prototypeSurfaceBriefingById[state.campaign.pendingBriefingId] ?? null
    : null;
  const pendingFactionEvent = state.campaign.pendingFactionEvent;
  const pendingFactionEventDefinition = pendingFactionEvent
    ? factionDefeatEvents[pendingFactionEvent.eventId] ?? null
    : null;
  const pendingFactionDefinition = pendingFactionEvent
    ? orsiaSubfactionById[pendingFactionEvent.factionId] ?? null
    : null;

  const selectedMoveAvailability = useMemo<MoveArmyAvailability | null>(() => {
    if (!selectedNodeId || selectedNodeVisibility !== 'visible' || selectedNodeId === rootObjectiveRules.nodeId) return null;
    return getMoveArmyAvailability(state, campaignMap, {
      armyId: 'player-main',
      toNodeId: selectedNodeId,
      supplyCost: prototypeCampaignRules.moveSupplyCost,
    });
  }, [campaignMap, rootObjectiveRules.nodeId, selectedNodeId, selectedNodeVisibility, state]);

  const selectedAttackAvailability = useMemo<AttackCityAvailability | null>(() => {
    if (!selectedNodeId || selectedNodeVisibility !== 'visible' || !state.cities[selectedNodeId]) return null;
    return getAttackCityAvailability(state, campaignMap, {
      armyId: 'player-main',
      cityId: selectedNodeId,
      tactic: selectedTactic,
      supplyCost: prototypeCampaignRules.attackSupplyCost,
    });
  }, [campaignMap, selectedNodeId, selectedNodeVisibility, selectedTactic, state]);

  const restAvailability = useMemo<RestAtCityAvailability | null>(() => {
    if (!currentCityDefinition || !currentCityControlled) return null;
    return getRestAtCityAvailability(state, {
      armyId: 'player-main',
      cityId: playerNodeId,
      city: currentCityDefinition,
      supplyCap: prototypeCampaignRules.supplyCap,
      moraleCap: prototypeCampaignRules.moraleCap,
    });
  }, [currentCityControlled, currentCityDefinition, playerNodeId, state]);

  const movableNodeIds = useMemo(
    () =>
      neighboringNodeIds.filter((nodeId) => {
        if (nodeId === rootObjectiveRules.nodeId) return playerRootAvailability.canClaim;
        return getMoveArmyAvailability(state, campaignMap, {
          armyId: 'player-main',
          toNodeId: nodeId,
          supplyCost: prototypeCampaignRules.moveSupplyCost,
        }).canMove;
      }),
    [campaignMap, neighboringNodeIds, playerRootAvailability.canClaim, rootObjectiveRules.nodeId, state],
  );

  const attackableNodeIds = useMemo(
    () =>
      neighboringNodeIds.filter((nodeId) => {
        if (!state.cities[nodeId]) return false;
        return getAttackCityAvailability(state, campaignMap, {
          armyId: 'player-main',
          cityId: nodeId,
          tactic: selectedTactic,
          supplyCost: prototypeCampaignRules.attackSupplyCost,
        }).canAttack;
      }),
    [campaignMap, neighboringNodeIds, selectedTactic, state],
  );

  function autoAdvanceTurnAfterAction(sourceState: GameState, message: string) {
    if (sourceState.campaign.developerMode) {
      setState(sourceState);
      setBattleReport(null);
      setFeedback(`${message} DEV: ход не завершается автоматически.`);
      return;
    }
    const graph = getCampaignMap(sourceState);
    const result = advanceTurn(sourceState, {
      graph,
      cityDefinitions: prototypeCities,
      unitDefinitions: prototypeUnits,
      battleRules: prototypeBattleRules,
      moveSupplyCost: prototypeCampaignRules.moveSupplyCost,
      attackSupplyCost: prototypeCampaignRules.attackSupplyCost,
      recruitMoraleRestore: prototypeCampaignRules.recruitMoraleRestore,
      moraleCap: prototypeCampaignRules.moraleCap,
      rootObjective: getPrototypeRootObjectiveRules(sourceState),
      aiTurns: [{ factionId: RIVAL_FACTION_ID, armyId: RIVAL_ARMY_ID }],
    });
    setState(triggerAvailableSurfaceBriefing(result.state, prototypeSurfaceBriefings));
    setBattleReport(null);
    setFeedback(`${message} Ход автоматически завершён.`);
  }

  function updatePlayerArmyFormation(transform: (army: NonNullable<GameState['armies'][string]>) => NonNullable<GameState['armies'][string]>) {
    setState((current) => {
      const army = current.armies['player-main'];
      if (!army) return current;
      return { ...current, armies: { ...current.armies, [army.id]: transform(army) } };
    });
  }

  function handleSwapFlanks(first: ArmyFlankId, second: ArmyFlankId) {
    updatePlayerArmyFormation((army) => swapArmyFlanks(army, first, second));
    setFeedback('Фланги поменяны местами. Новое построение сохранено для следующего боя.');
  }

  function handleMoveArmyGroup(groupId: string, targetFlank: ArmyFlankId) {
    updatePlayerArmyFormation((army) => moveArmyGroup(army, groupId, targetFlank));
    setFeedback('Отряд перенесён на выбранный фланг.');
  }

  function handleMergeArmyGroups(sourceGroupId: string, targetGroupId: string) {
    updatePlayerArmyFormation((army) => mergeArmyGroups(army, sourceGroupId, targetGroupId));
    setFeedback('Одинаковые отряды слиты в одну группу.');
  }

  function handleSplitArmyGroup(groupId: string, parts: 2 | 3) {
    updatePlayerArmyFormation((army) => splitArmyGroup(army, groupId, parts));
    setFeedback(`Отряд разделён на ${parts} части.`);
  }

  function handleAutoDistributeArmyGroups() {
    updatePlayerArmyFormation((army) => autoDistributeArmyGroups(army, prototypeUnits));
    setFeedback('Армия автоматически распределена по силе флангов. Уникальные бойцы оставлены вместе.');
  }

  function handleMove(toNodeId: string) {
    if (pendingMovement) return;

    const result = moveArmy(state, campaignMap, {
      armyId: 'player-main',
      toNodeId,
      supplyCost: prototypeCampaignRules.moveSupplyCost,
    });

    if (!result.ok) {
      setFeedback(getMoveErrorMessage(result.error));
      return;
    }

    const event = result.events[0];
    const movementId = movementSequenceRef.current + 1;
    movementSequenceRef.current = movementId;
    setBattleReport(null);
    setFeedback('Экспедиция в пути…');
    setPendingMovement({
      kind: 'move',
      id: movementId,
      fromNodeId: event.fromNodeId,
      toNodeId: event.toNodeId,
      durationMs: PLAYER_MOVE_ANIMATION_MS,
      result,
    });
  }

  function handlePlayerMovementComplete(movementId: number) {
    const movement = pendingMovement;
    if (!movement || movement.id !== movementId) return;

    if (movement.kind === 'attack') {
      completeAttackMovement(movement);
      return;
    }

    const triggered = triggerLocationEvent(movement.result.state, movement.toNodeId, prototypeEvents);
    const nextState = triggerAvailableSurfaceBriefing(triggered.state, prototypeSurfaceBriefings);
    const event = movement.result.events[0];
    setPendingMovement(null);
    setBattleReport(null);

    const abilityText = event.leaderAbilityId === 'river_double_move'
      ? ' Лайош использовал подземную реку: второй переход выполнен.'
      : '';
    const eventText = triggered.events.length > 0 ? ' Обнаружено событие.' : '';
    const shortageText = event.supplyShortfall && event.supplyShortfall > 0 ? ' Припасов не хватило: переход продолжен в голодном режиме.' : '';
    const message = `Переход выполнен: −${event.supplyCost} припасов.${shortageText}${abilityText}${eventText}`;
    if (triggered.events.length > 0 && !nextState.campaign.developerMode) {
      setState(nextState);
      setAutoEndAfterPendingEvent(true);
      setFeedback(`${message} Сначала разрешите событие; после него ход завершится автоматически.`);
      return;
    }
    if (!nextState.campaign.developerMode && canUseRiverDoubleMove(nextState, nextState.playerFactionId)) {
      setState(nextState);
      setFeedback(`${message} Лайош может выполнить второй переход до автозавершения хода.`);
      return;
    }
    autoAdvanceTurnAfterAction(nextState, message);
  }

  function handleAttack(cityId: string) {
    if (pendingMovement) return;

    const originNodeId = state.armies['player-main']?.nodeId ?? null;
    const planSnapshot: BattlePlan = { ...battlePlan, commands: [...battlePlan.commands], commandRounds: [...(battlePlan.commandRounds ?? [])] };
    const result = attackCity(
      state,
      campaignMap,
      {
        armyId: 'player-main',
        cityId,
        tactic: selectedTactic,
        battlePlan: planSnapshot,
        supplyCost: prototypeCampaignRules.attackSupplyCost,
      },
      { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules, cityDefinitions: prototypeCities },
    );

    if (!result.ok) {
      setFeedback(getAttackErrorMessage(result.error));
      return;
    }

    const actualAttackCost = selectedAttackAvailability?.canAttack
      ? selectedAttackAvailability.supplyCost
      : prototypeCampaignRules.attackSupplyCost;
    const movementId = movementSequenceRef.current + 1;
    movementSequenceRef.current = movementId;
    setBattleReport(null);
    setFeedback('Экспедиция выдвигается на штурм…');
    setPendingMovement({
      kind: 'attack',
      id: movementId,
      fromNodeId: originNodeId ?? cityId,
      toNodeId: cityId,
      durationMs: PLAYER_MOVE_ANIMATION_MS,
      result,
      cityId,
      originNodeId,
      tactic: selectedTactic,
      attackSupplyCost: actualAttackCost,
      sourceState: state,
      plan: planSnapshot,
    });
  }

  function completeAttackMovement(movement: Extract<PendingMovement, { kind: 'attack' }>) {
    setPendingMovement(null);
    applyPlayerAttackOutcome(movement.result, {
      sourceState: movement.sourceState,
      cityId: movement.cityId,
      originNodeId: movement.originNodeId,
      tactic: movement.tactic,
      attackSupplyCost: movement.attackSupplyCost,
      plan: movement.plan,
    });
  }

  function applyPlayerAttackOutcome(result: SuccessfulAttackResult, context: ActivePlayerBattle) {
    const nextState = triggerAvailableSurfaceBriefing(result.state, prototypeSurfaceBriefings);
    setState(nextState);
    if (!result.battle) {
      setActivePlayerBattle(null);
      setBattleReport(null);
      setFeedback(`Гарнизон отсутствовал. Город занят за ${context.attackSupplyCost} припасов.`);
      return;
    }

    const normalizedContext: ActivePlayerBattle = {
      ...context,
      kind: 'city_attack',
      plan: { ...result.battle.sides.A.plan, commands: [...result.battle.sides.A.plan.commands], commandRounds: [...(result.battle.sides.A.plan.commandRounds ?? [])] },
    };
    setActivePlayerBattle(normalizedContext);
    setBattleReport({
      cityId: context.cityId,
      result: result.battle,
      attackerTactic: context.tactic,
      defenderTactic: 'cautious',
    });
    setView('battle');

    const attacker = result.battle.sides.A;
    const defender = result.battle.sides.B;
    const resultMap = getCampaignMap(context.sourceState);
    const cityNode = resultMap.nodes.find((node) => node.id === context.cityId);
    const originNode = resultMap.nodes.find((node) => node.id === context.originNodeId);
    const cityName = cityNode ? t(cityNode.nameKey as Parameters<typeof t>[0]) : context.cityId;
    const originName = originNode ? t(originNode.nameKey as Parameters<typeof t>[0]) : 'исходной позиции';

    if (result.captured) {
      setFeedback(
        `Победа: ${cityName} захвачен. Потери ${attacker.totalLosses}, защитники потеряли ${defender.totalLosses}. Моральная паника ${attacker.moraleAfter}.`,
      );
    } else if (attacker.outcome === 'retreat') {
      setFeedback(
        `Организованный отход от ${cityName}. Потери ${attacker.totalLosses}, защитники потеряли ${defender.totalLosses}. Армия вернулась к ${originName}. Моральная паника ${attacker.moraleAfter}.`,
      );
    } else {
      setFeedback(
        `Штурм отбит. Потери ${attacker.totalLosses}, защитники потеряли ${defender.totalLosses}. Армия отступила к ${originName}. Моральная паника ${attacker.moraleAfter}.`,
      );
    }
  }

  function handleIssueBattleCommand(command: BattleCommandId, round: number): boolean {
    if (!activePlayerBattle || !battleReport) return false;
    const commands = [...activePlayerBattle.plan.commands];
    const commandRounds = [...(activePlayerBattle.plan.commandRounds ?? [])];
    commands.push(command);
    commandRounds.push(Math.max(1, Math.round(round)));
    const nextPlan: BattlePlan = {
      ...activePlayerBattle.plan,
      commands,
      commandRounds,
    };
    if (activePlayerBattle.kind === 'tyranid_cleanup') {
      const rerun = clearTyranidEggClutch(
        activePlayerBattle.sourceState,
        { armyId: 'player-main', cityId: activePlayerBattle.cityId, tactic: activePlayerBattle.tactic, battlePlan: nextPlan },
        { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules },
      );
      if (!rerun.ok) {
        setFeedback('Не удалось пересчитать зачистку кладки после приказа.');
        return false;
      }
      applyTyranidCleanupOutcome(rerun, { ...activePlayerBattle, plan: nextPlan });
      return true;
    }

    const sourceMap = getCampaignMap(activePlayerBattle.sourceState);
    const rerun = attackCity(
      activePlayerBattle.sourceState,
      sourceMap,
      {
        armyId: 'player-main',
        cityId: activePlayerBattle.cityId,
        tactic: activePlayerBattle.tactic,
        battlePlan: nextPlan,
        supplyCost: prototypeCampaignRules.attackSupplyCost,
      },
      { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules, cityDefinitions: prototypeCities },
    );

    if (!rerun.ok || !rerun.battle) {
      setFeedback(!rerun.ok ? getAttackErrorMessage(rerun.error) : 'Не удалось пересчитать бой после приказа.');
      return false;
    }

    // Re-run from the exact pre-battle GameState and RNG seed. Everything before the
    // command round therefore stays identical; only the intervention and its consequences change.
    applyPlayerAttackOutcome(rerun, { ...activePlayerBattle, plan: nextPlan });
    return true;
  }

  function handleOpenRootFinale() {
    if (!playerRootAvailability.canClaim) {
      setFeedback(getRootClaimErrorMessage(playerRootAvailability.reason));
      return;
    }
    setRootFinaleOpen(true);
  }

  function handleClaimRoot(choice: RootFinaleChoice) {
    const result = claimRoot(state, {
      factionId: state.playerFactionId,
      armyId: 'player-main',
      rules: rootObjectiveRules,
      cityDefinitions: prototypeCities,
    });
    if (!result.ok) {
      setRootFinaleOpen(false);
      setFeedback(getRootClaimErrorMessage(result.error));
      return;
    }
    setState(result.state);
    setRootFinaleOpen(false);
    setBattleReport(null);
    setFeedback(choice === 'deliver'
      ? 'Корень упакован и подготовлен к возвращению на поверхность.'
      : 'Экспедиция принимает зов Корня.');
  }

  function handleDeveloperTeleport(nodeId: string) {
    const teleported = developerTeleportArmy(state, campaignMap, { armyId: 'player-main', toNodeId: nodeId });
    if (!teleported.ok) {
      setFeedback('DEV-телепорт сейчас недоступен.');
      return;
    }
    const triggered = triggerLocationEvent(teleported.state, nodeId, prototypeEvents);
    const nextState = triggerAvailableSurfaceBriefing(triggered.state, prototypeSurfaceBriefings);
    setPendingMovement(null);
    setActivePlayerBattle(null);
    setBattleReport(null);
    setState(nextState);
    setSelectedNodeId(nodeId);
    setView('map');
    setFeedback(triggered.events.length > 0
      ? 'DEV: телепорт выполнен. В точке обнаружено событие.'
      : 'DEV: телепорт выполнен.');
  }

  function handleCloseBattle() {
    setActivePlayerBattle(null);
    const defeat = evaluatePlayerDefeat(state);
    if (defeat.state !== state) setState(defeat.state);
    setView('map');
  }

  function handleClearTyranidClutch(cityId: string) {
    const result = clearTyranidEggClutch(
      state,
      { armyId: 'player-main', cityId, tactic: selectedTactic, battlePlan },
      { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules },
    );
    if (!result.ok) {
      const message = result.error === 'deadline_expired'
        ? 'Срок зачистки кладки истёк. При уходе экспедиции город снова станет тиранидским.'
        : result.error === 'strategic_action_spent'
          ? 'На этом ходу действие уже использовано.'
          : 'Зачистку кладки сейчас провести нельзя.';
      setFeedback(message);
      return;
    }
    applyTyranidCleanupOutcome(result, {
      kind: 'tyranid_cleanup',
      sourceState: state,
      cityId,
      originNodeId: cityId,
      tactic: selectedTactic,
      attackSupplyCost: 0,
      plan: { ...result.battle.sides.A.plan, commands: [...result.battle.sides.A.plan.commands], commandRounds: [...(result.battle.sides.A.plan.commandRounds ?? [])] },
    });
  }

  function applyTyranidCleanupOutcome(
    result: Extract<ReturnType<typeof clearTyranidEggClutch>, { ok: true }>,
    context: ActivePlayerBattle,
  ) {
    setState(result.state);
    setActivePlayerBattle({ ...context, kind: 'tyranid_cleanup', plan: { ...result.battle.sides.A.plan, commands: [...result.battle.sides.A.plan.commands], commandRounds: [...(result.battle.sides.A.plan.commandRounds ?? [])] } });
    setBattleReport({
      cityId: context.cityId,
      result: result.battle,
      attackerTactic: context.tactic,
      defenderTactic: 'balanced',
    });
    setView('battle');
    const attacker = result.battle.sides.A;
    setFeedback(result.cleared
      ? `Кладка тиранидов уничтожена. Потери экспедиции: ${attacker.totalLosses}.`
      : `Зачистка кладки не удалась. Потери экспедиции: ${attacker.totalLosses}. Кладка остаётся активной.`);
  }

  function handleRest(cityId: string) {
    const city = prototypeCities[cityId];
    if (!city) return;
    const result = restAtCity(state, {
      armyId: 'player-main',
      cityId,
      city,
      supplyCap: prototypeCampaignRules.supplyCap,
      moraleCap: prototypeCampaignRules.moraleCap,
    });
    if (!result.ok) {
      setFeedback(getRestErrorMessage(result.error));
      return;
    }

    const event = result.events[0];
    autoAdvanceTurnAfterAction(result.state, `Отдых: +${event.suppliesRestored} припасов, +${event.moraleRestored} морали.`);
  }

  function finalizeRecruitmentAttempt(result: SuccessfulRecruitmentAttempt, cityId: string, sourceState: GameState) {
    setState(result.state);
    setActivePlayerBattle(null);
    if (result.riot && result.battle) {
      setBattleReport({
        cityId,
        result: result.battle,
        attackerTactic: 'balanced',
        defenderTactic: 'balanced',
        kind: 'recruitment_riot',
        identityOverrides: {
          ...(sourceState.armies['player-main']?.nodeId !== cityId
            ? { A: { name: 'Вербовщики', leaderName: null, portraitSrc: null, hidePortrait: true } }
            : {}),
          B: { name: 'Горожане', leaderName: null, portraitSrc: null, hidePortrait: true },
        },
      });
      setView('battle');
      setFeedback(`Кубик: ${result.roll}. Набор сорвался — жители взялись за оружие. Город закрыт для найма на 5 ходов.`);
      return;
    }

    const unitName = prototypeUnits[result.quote.unitTypeId]?.shortName ?? result.quote.unitTypeId;
    const riskText = result.quote.risky ? ` Кубик: ${result.roll}/${result.quote.successChancePercent} — риск оправдался.` : '';
    const immediate = sourceState.armies['player-main']?.nodeId === cityId;
    const deliveryText = immediate ? '' : ' Подкрепление выйдет к основной армии и прибудет через 3 хода.';
    setBattleReport(null);
    setFeedback(`Нанято: ${unitName} +${result.quote.amount} за ${result.quote.cost}.${riskText}${deliveryText}${sourceState.campaign.developerMode ? ' DEV: бесплатный набор.' : ' Найм не расходует действие хода. Этот город закрыт для нового найма на 3 хода.'}`);
  }

  function handleRecruit(cityId: string, offer: RecruitmentOffer, amount: number) {
    if (recruitmentRollOutcome) return;
    const sourceState = state;
    const result = attemptRecruitAtCity(
      sourceState,
      {
        armyId: 'player-main',
        cityId,
        offer,
        amount,
        moraleRestore: prototypeCampaignRules.recruitMoraleRestore,
        moraleCap: prototypeCampaignRules.moraleCap,
      },
      { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules },
    );
    if (!result.ok) {
      setFeedback(getRecruitmentAttemptErrorMessage(result.error, result.quote?.blockedTurnsRemaining));
      return;
    }

    if (!result.quote.risky) {
      finalizeRecruitmentAttempt(result, cityId, sourceState);
      return;
    }

    const outcome: RecruitmentRollOutcome = result.riot ? 'fail' : 'success';
    setRecruitmentRollOutcome(outcome);
    if (recruitmentRollTimerRef.current !== null) window.clearTimeout(recruitmentRollTimerRef.current);
    recruitmentRollTimerRef.current = window.setTimeout(() => {
      setRecruitmentRollOutcome(null);
      recruitmentRollTimerRef.current = null;
      finalizeRecruitmentAttempt(result, cityId, sourceState);
    }, 1100);
  }

  function handleRecruitUnique(cityId: string, unitTypeId: string) {
    const result = recruitUniqueUnit(state, { armyId: 'player-main', cityId, unitTypeId });
    if (!result.ok) {
      const message = result.error === 'artifact_required'
        ? 'Для найма уникального бойца нужен хотя бы один артефакт.'
        : result.error === 'insufficient_money'
          ? 'Недостаточно денег для найма уникального бойца.'
          : result.error === 'recruitment_blocked'
            ? 'Найм в этом городе ещё восстанавливается.'
            : 'Уникальный боец сейчас недоступен.';
      setFeedback(message);
      return;
    }
    setState(result.state);
    const name = prototypeUnits[unitTypeId]?.name ?? unitTypeId;
    setFeedback(result.immediate
      ? `${name} присоединился к армии. Уникальный отряд занял выделенный фланг. Найм в городе закрыт на 3 хода.`
      : `${name} нанят. Подкрепление прибудет к основной армии через 3 хода. Найм в городе закрыт на 3 хода.`);
  }

  function handleFightSiriusBoss() {
    const result = fightSiriusBoss(
      state,
      { armyId: 'player-main', tactic: selectedTactic, battlePlan: { ...battlePlan, commands: [], commandRounds: [] } },
      { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules },
    );
    if (!result.ok) {
      setFeedback('Сириус Морфей Нан сейчас недоступен для боя.');
      return;
    }
    setState(result.state);
    setActivePlayerBattle(null);
    setBattleReport({
      cityId: state.campaign.siriusBossCityId,
      result: result.battle,
      attackerTactic: selectedTactic,
      defenderTactic: 'balanced',
      identityOverrides: {
        B: { name: 'Сириус Морфей Нан', leaderName: null, portraitSrc: null, hidePortrait: true },
      },
    });
    setView('battle');
    setFeedback(result.recruited
      ? 'Сириус Морфей Нан побеждён и, по неясной причине, решил присоединиться к экспедиции.'
      : 'Сириус Морфей Нан отбил вызов. Его можно будет попытаться победить позже.');
  }

  function handleShortRest() {
    if (!currentNode || currentNode.kind !== 'poi') return;
    const result = shortRestAtPoi(state, campaignMap, {
      armyId: 'player-main',
      nodeId: currentNode.id,
      supplyCap: prototypeCampaignRules.supplyCap,
      moraleCap: prototypeCampaignRules.moraleCap,
    });
    if (!result.ok) {
      setFeedback(result.error === 'already_used' ? 'Короткий привал в этой точке уже использован.' : 'Здесь сейчас нельзя устроить короткий привал.');
      return;
    }
    autoAdvanceTurnAfterAction(result.state, `Короткий привал: +${result.suppliesRestored} припасов, +${result.moraleRestored} к моральной панике. Повторно здесь отдыхать нельзя.`);
  }

  function handleResolveEvent(choiceId: string) {
    const eventId = state.campaign.pendingEventId;
    if (!eventId) return;
    const result = resolveLocationEvent(
      state,
      {
        eventId,
        choiceId,
        factionId: state.playerFactionId,
        armyId: 'player-main',
        supplyCap: prototypeCampaignRules.supplyCap,
        moraleCap: prototypeCampaignRules.moraleCap,
      },
      prototypeEvents,
      prototypeArtifacts,
    );
    if (!result.ok) {
      setFeedback(`Событие не разрешено: ${result.error}.`);
      return;
    }
    const nextState = triggerAvailableSurfaceBriefing(result.state, prototypeSurfaceBriefings);
    const artifact = result.events.find((event) => event.type === 'artifact_acquired');
    const eventFeedback = artifact?.type === 'artifact_acquired'
      ? (() => {
          const definition = prototypeArtifacts[artifact.artifactId];
          const bonus = artifact.multiplier > 1 ? ` Владос усиливает его численные эффекты ×${artifact.multiplier}.` : '';
          const activation = artifact.activated ? ' Артефакт автоматически помещён в свободный активный слот.' : ' Активные слоты заполнены — предмет добавлен в коллекцию.';
          return `Получен артефакт «${definition?.name ?? artifact.artifactId}». Познание +1. Городские гарнизоны Орсии слегка усилились.${activation}${bonus}`;
        })()
      : 'Событие завершено. Результат записан в экспедиционный журнал.';

    if (autoEndAfterPendingEvent) {
      setAutoEndAfterPendingEvent(false);
      if (!nextState.campaign.developerMode && canUseRiverDoubleMove(nextState, nextState.playerFactionId)) {
        setState(nextState);
        setFeedback(`${eventFeedback} Лайош может выполнить второй переход до автозавершения хода.`);
        return;
      }
      autoAdvanceTurnAfterAction(nextState, eventFeedback);
      return;
    }

    setState(nextState);
    setFeedback(eventFeedback);
  }

  function handleToggleArtifact(artifactId: string) {
    const result = toggleActiveArtifact(
      state,
      { factionId: state.playerFactionId, armyId: 'player-main', artifactId },
      prototypeArtifacts,
    );
    if (!result.ok) {
      const message = result.error === 'not_in_controlled_city'
        ? 'Комплект артефактов можно менять только в своём городе.'
        : result.error === 'slots_full'
          ? 'Все три слота заняты. Сначала снимите один активный артефакт.'
          : 'Не удалось изменить комплект артефактов.';
      setFeedback(message);
      return;
    }
    setState(result.state);
    const isActive = result.state.campaign.activeArtifactIds.includes(artifactId);
    setFeedback(isActive ? 'Артефакт активирован.' : 'Артефакт снят с активного комплекта.');
  }


  function handleFactionDefeatAcknowledge() {
    const pending = state.campaign.pendingFactionEvent;
    if (!pending) return;
    const result = resolveFactionDefeatEvent(state, pending.eventId, campaignMap);
    if (!result.ok) {
      setFeedback('Не удалось оформить капитуляцию фракции.');
      return;
    }
    const transferred = result.events.find((event) => event.type === 'faction_defeat_event_resolved');
    const count = transferred?.type === 'faction_defeat_event_resolved' ? transferred.transferredCityIds.length : 0;
    setState(triggerAvailableSurfaceBriefing(result.state, prototypeSurfaceBriefings));
    setBattleReport(null);
    setView('map');
    setFeedback(`Нацболы распущены. Под контроль экспедиции перешло городов: ${count}.`);
  }

  function handleAcknowledgeSurfaceBriefing() {
    const briefingId = state.campaign.pendingBriefingId;
    if (!briefingId) return;
    const nextState = acknowledgeSurfaceBriefing(state, briefingId);
    setState(nextState);
  }

  function handleEndTurn() {
    if (pendingMovement) return;

    const result = advanceTurn(state, {
      graph: campaignMap,
      cityDefinitions: prototypeCities,
      unitDefinitions: prototypeUnits,
      battleRules: prototypeBattleRules,
      moveSupplyCost: prototypeCampaignRules.moveSupplyCost,
      attackSupplyCost: prototypeCampaignRules.attackSupplyCost,
      recruitMoraleRestore: prototypeCampaignRules.recruitMoraleRestore,
      moraleCap: prototypeCampaignRules.moraleCap,
      rootObjective: rootObjectiveRules,
      aiTurns: [{ factionId: RIVAL_FACTION_ID, armyId: RIVAL_ARMY_ID }],
    });
    setState(triggerAvailableSurfaceBriefing(result.state, prototypeSurfaceBriefings));
    setBattleReport(null);

    const income = result.events.find(
      (event) => event.type === 'income_collected' && event.factionId === state.playerFactionId,
    );
    const upkeep = result.events.find(
      (event) => event.type === 'army_upkeep_paid' && event.factionId === state.playerFactionId,
    );
    const aiAction = result.events.find(
      (event) => event.type === 'ai_action_taken' && event.factionId === RIVAL_FACTION_ID,
    );
    const supplyPressure = result.events.find(
      (event) => event.type === 'supply_pressure_applied' && event.armyId === 'player-main',
    );
    const travelAttrition = result.events.find(
      (event) => event.type === 'travel_attrition_applied' && event.armyId === 'player-main',
    );
    const passiveSupplies = result.events.find(
      (event) => event.type === 'passive_supplies_produced' && event.factionId === state.playerFactionId,
    );
    const reinforcements = result.events.filter(
      (event) => event.type === 'reinforcements_arrived' && event.armyId === 'player-main',
    );

    const incomeText = income?.type === 'income_collected' ? ` Налоги +${formatMoney(income.amount)}.` : '';
    const upkeepText =
      upkeep?.type === 'army_upkeep_paid'
        ? ` Содержание −${formatMoney(upkeep.amount)}${
            upkeep.unpaid > 0 ? `, не оплачено ${formatMoney(upkeep.unpaid)}` : ''
          }.`
        : '';
    const rivalText = aiAction?.type === 'ai_action_taken' ? ` ${describeAiAction(aiAction.action, aiAction.targetId, rivalName, campaignMap)} ` : ' ';
    const supplyText =
      supplyPressure?.type === 'supply_pressure_applied'
        ? ` Снабжение ${supplyPressure.supplyPercent}%: моральная паника −${supplyPressure.moraleLost}.`
        : '';
    const attritionText = travelAttrition?.type === 'travel_attrition_applied' ? ` Без припасов в пути потеряно бойцов: ${travelAttrition.unitsLost}.` : '';
    const passiveText = passiveSupplies?.type === 'passive_supplies_produced' ? ` Экономисты произвели +${passiveSupplies.amount} припасов.` : '';
    const reinforcementText = reinforcements.length > 0
      ? ` Прибыло подкрепление: ${reinforcements.map((event) => event.type === 'reinforcements_arrived' ? `${prototypeUnits[event.unitTypeId]?.shortName ?? event.unitTypeId} +${event.amount}` : '').filter(Boolean).join(', ')}.`
      : '';
    setFeedback(`Ход ${state.turn} завершён.${rivalText}${incomeText}${upkeepText}${supplyText}${attritionText}${passiveText}${reinforcementText} Армия снова может действовать.`);
  }

  function handleToggleDeveloperMode() {
    setState((current) => ({
      ...current,
      factions: {
        ...current.factions,
        [current.playerFactionId]: {
          ...current.factions[current.playerFactionId],
          strategicActionSpent: false,
          lastStrategicAction: null,
        },
      },
      campaign: {
        ...current.campaign,
        developerMode: !current.campaign.developerMode,
      },
    }));
    setFeedback(state.campaign.developerMode
      ? 'Режим разработчика выключен.'
      : 'DEV включён: вся карта раскрыта, деньги ∞, найм бесплатный, действия без лимита; доступен телепорт в выбранную точку.');
  }

  function handleManualSave() {
    if (pendingMovement) return;
    manualSaveAtRef.current = Date.now();
    const result = saveCampaignSnapshot(
      state,
      {
        view: view === 'battle' ? 'map' : view,
        selectedNodeId,
        mapCamera,
      },
      'manual',
    );
    setFeedback(result.ok ? 'Экспедиционный журнал сохранён.' : 'Не удалось записать сохранение в память браузера.');
  }

  if (state.campaign.status !== 'active') {
    return <CampaignEndScreen state={state} onExit={onExit} />;
  }

  if (view === 'battle' && battleReport) {
    const battleNode = campaignMap.nodes.find((node) => node.id === battleReport.cityId);
    const battleCityName = battleNode
      ? t(battleNode.nameKey as Parameters<typeof t>[0])
      : battleReport.cityId;

    return (
      <main className={`campaign-shell battle-shell${knowledgeClass}${recruitmentRollOutcome === 'fail' ? ' is-recruitment-fail-shake' : ''}`}>
        <TopStatusBar state={state} morale={playerArmy?.morale ?? 0} supplyLabel={getSupplyHeaderLabel(playerSupply)} leaderStatus={getLeaderStatus(state)} onSave={handleManualSave} onExit={onExit} onToggleDeveloperMode={handleToggleDeveloperMode} interactionLocked={isPlayerMoving} />
        {recruitmentRollOutcome ? <RecruitmentRollOverlay outcome={recruitmentRollOutcome} /> : null}
        {knowledgeCorruptionStage > 0 ? <div className="knowledge-corruption-overlay" aria-hidden="true"><i /><i /><i /></div> : null}
        <BattleViewer
          key={battleReport.result.battleId}
          report={battleReport}
          cityName={battleCityName}
          state={state}
          onIssueCommand={activePlayerBattle ? handleIssueBattleCommand : undefined}
          onClose={handleCloseBattle}
        />
      </main>
    );
  }

  return (
    <main className={`campaign-shell${knowledgeClass}${recruitmentRollOutcome === 'fail' ? ' is-recruitment-fail-shake' : ''}`}>
      <TopStatusBar state={state} morale={playerArmy?.morale ?? 0} supplyLabel={getSupplyHeaderLabel(playerSupply)} leaderStatus={`${getLeaderStatus(state)} · Познание ${playerKnowledge}/${MAX_ORSIA_KNOWLEDGE}`} onSave={handleManualSave} onExit={onExit} onToggleDeveloperMode={handleToggleDeveloperMode} interactionLocked={isPlayerMoving} />
      {recruitmentRollOutcome ? <RecruitmentRollOverlay outcome={recruitmentRollOutcome} /> : null}
      {knowledgeCorruptionStage > 0 ? <div className="knowledge-corruption-overlay" aria-hidden="true"><i /><i /><i /></div> : null}

      {view === 'map' ? (
        <section className="map-area">
          <div className="map-stage">
            <RaceIndicator
              state={state}
              graph={campaignMap}
              rivalArmyId={RIVAL_ARMY_ID}
            />
            <SvgWorldMap
            graph={campaignMap}
            nodeVisibilityById={mapVisibilityById}
            regions={campaignRegions}
            cities={state.cities}
            capitalFactionIdByCityId={capitalFactionIdByCityId}
            playerFactionId={state.playerFactionId}
            rivalFactionId={RIVAL_FACTION_ID}
            rivalPortraitSrc={rivalLeader?.portraitSrc}
            selectedNodeId={selectedNode?.id ?? null}
            playerNodeId={playerNodeId}
            playerPortraitSrc={playerLeader?.portraitSrc}
            playerWalkFrameSrcs={playerLeader?.walkFrameSrcs}
            playerMovement={pendingMovement}
            onPlayerMovementComplete={handlePlayerMovementComplete}
            initialCamera={initialUi.mapCamera}
            onCameraChange={setMapCamera}
            rivalNodeId={rivalArmy?.nodeId ?? null}
            reachableNodeIds={neighboringNodeIds}
            movableNodeIds={movableNodeIds}
            attackableNodeIds={attackableNodeIds}
            supplyPathNodeIds={playerSupply.path}
            onSelectNode={isPlayerMoving ? () => undefined : (nodeId) => {
              const visibility = mapVisibilityById[nodeId] ?? 'unknown';
              const node = campaignMap.nodes.find((candidate) => candidate.id === nodeId);
              if (visibility === 'unknown' && node?.kind !== 'city') return;
              setSelectedNodeId(nodeId);
            }}
            />
          </div>
        </section>
      ) : view === 'army' ? (
        <section className="map-area army-area">
          <div className="army-scroll">
            {playerArmy ? (
              <ArmyOverview
                army={playerArmy}
                unitDefinitions={prototypeUnits}
                onSwapFlanks={handleSwapFlanks}
                onMoveGroup={handleMoveArmyGroup}
                onMergeGroups={handleMergeArmyGroups}
                onSplitGroup={handleSplitArmyGroup}
                onAutoDistribute={handleAutoDistributeArmyGroups}
              />
            ) : (
              <div className="empty-state">Основная армия не найдена.</div>
            )}
          </div>
        </section>
      ) : view === 'artifacts' ? (
        <section className="map-area army-area artifact-area">
          <div className="army-scroll">
            <ArtifactInventory
              artifactIds={state.campaign.artifactIds}
              activeArtifactIds={state.campaign.activeArtifactIds}
              definitions={prototypeArtifacts}
              canManage={currentCityControlled}
              onToggle={handleToggleArtifact}
            />
          </div>
        </section>
      ) : (
        <section className="map-area army-area cities-area">
          <div className="army-scroll">
            <CitiesOverview state={state} rivalFactionId={RIVAL_FACTION_ID} />
          </div>
        </section>
      )}

      <section className="campaign-command-deck">
        {view === 'map' ? (
          isPlayerMoving ? (
            <section className="decision-panel is-compact movement-progress-panel">
              <div className="decision-copy">
                <strong>{pendingMovement?.kind === 'attack' ? 'Экспедиция идёт на штурм' : 'Экспедиция в пути'}</strong>
                <span>{pendingMovement?.kind === 'attack' ? 'Цель' : 'Курс'}: {movementDestination ? t(movementDestination.nameKey as Parameters<typeof t>[0]) : 'следующий узел'}.</span>
              </div>
            </section>
          ) : (
          <div className="campaign-command-main">
            <DecisionPanel
              selectedNode={selectedNode}
              selectedNodeVisibility={selectedNodeVisibility}
              selectedCity={selectedCity}
              selectedCityDefinition={selectedCityDefinition}
              playerFactionId={state.playerFactionId}
              rivalFactionId={RIVAL_FACTION_ID}
              rivalFactionName={rivalName}
              capitalFactionId={selectedCapitalFactionId}
              playerNodeId={playerNodeId}
              neighboringNodeIds={neighboringNodeIds}
              moveAvailability={selectedMoveAvailability}
              rootClaimAvailability={selectedNodeId === rootObjectiveRules.nodeId ? playerRootAvailability : null}
              attackAvailability={selectedAttackAvailability}
              selectedTactic={selectedTactic}
              onClear={() => setSelectedNodeId(null)}
            />
            <StrategicActionBar
              selectedNode={selectedNode}
              selectedNodeVisibility={selectedNodeVisibility}
              selectedCity={selectedCity}
              playerFactionId={state.playerFactionId}
              playerNodeId={playerNodeId}
              neighboringNodeIds={neighboringNodeIds}
              moveAvailability={selectedMoveAvailability}
              rootClaimAvailability={selectedNodeId === rootObjectiveRules.nodeId ? playerRootAvailability : null}
              attackAvailability={selectedAttackAvailability}
              currentCityId={currentCityDefinition ? playerNodeId : null}
              currentCityDefinition={currentCityDefinition}
              currentRecruitmentOffers={currentRecruitmentOffers}
              recruitmentCityId={recruitmentCityId}
              recruitmentCityDefinition={recruitmentCityDefinition}
              recruitmentCityControlled={recruitmentCityControlled}
              uniqueRecruitmentUnitIds={uniqueRecruitmentUnitIds}
              artifactCount={state.campaign.artifactIds.length}
              recruitmentSafeLimitMultiplierByUnitId={recruitmentSafeLimitMultiplierByUnitId}
              recruitmentRecoveryTurnsByUnitId={recruitmentRecoveryTurnsByUnitId}
              siriusBossAvailable={siriusBossAvailable}
              currentCityControlled={currentCityControlled}
              tyranidClutchStatus={currentTyranidClutchStatus}
              tyranidClutchAvailability={currentTyranidClutchAvailability}
              restAvailability={restAvailability}
              recruitmentBlockedTurns={recruitmentBlockedTurns}
              developerMode={state.campaign.developerMode}
              playerMoney={state.factions[state.playerFactionId]?.resources.money ?? 0}
              shortRestAvailability={shortRestAvailability}
              currentPoiNodeId={currentNode?.kind === 'poi' ? currentNode.id : null}
              unitDefinitions={prototypeUnits}
              moveSupplyCost={prototypeCampaignRules.moveSupplyCost}
              attackSupplyCost={prototypeCampaignRules.attackSupplyCost}
              selectedTactic={selectedTactic}
              battlePlan={battlePlan}
              feedback={feedback}
              onMove={handleMove}
              onDeveloperTeleport={handleDeveloperTeleport}
              onOpenRootFinale={handleOpenRootFinale}
              onAttack={handleAttack}
              onTacticChange={setSelectedTactic}
              onBattlePlanChange={setBattlePlan}
              onClearTyranidClutch={handleClearTyranidClutch}
              onRest={handleRest}
              onRecruit={handleRecruit}
              onRecruitUnique={handleRecruitUnique}
              onFightSiriusBoss={handleFightSiriusBoss}
              onShortRest={handleShortRest}
            />
          </div>
          )
        ) : (
          <section className="decision-panel is-compact army-footer">
            <div className="decision-copy">
              <strong>{view === 'army' ? 'Построение экспедиции' : view === 'artifacts' ? 'Артефакты экспедиции' : 'Ведомость владений'}</strong>
              <span>{feedback ?? (view === 'army' ? 'Здесь можно менять фланги местами без расхода действия.' : view === 'artifacts' ? 'До трёх активных артефактов; менять комплект можно в своём городе.' : 'Города обновляются сразу после захвата.')}</span>
            </div>
          </section>
        )}

        <section className="persistent-turn-bar" aria-label="Управление ходом">
          <div>
            <span>Ход {state.turn}</span>
            <strong>{isPlayerMoving
              ? pendingMovement?.kind === 'attack' ? 'Выдвижение на штурм' : 'Переход выполняется'
              : state.campaign.developerMode
                ? 'DEV · действия без лимита'
                : state.factions[state.playerFactionId]?.strategicActionSpent ? 'Действие использовано' : 'Действие доступно'}</strong>
          </div>
          <button type="button" className="primary-button persistent-end-turn" onClick={handleEndTurn} disabled={isPlayerMoving}>
            {t('campaign.endTurn')}
          </button>
        </section>
      </section>

      <nav className="bottom-nav" aria-label="Разделы кампании">
        <button
          type="button"
          disabled={isPlayerMoving}
          className={`nav-button${view === 'map' ? ' is-active' : ''}`}
          onClick={() => setView('map')}
        >
          Карта
        </button>
        <button
          type="button"
          disabled={isPlayerMoving}
          className={`nav-button${view === 'army' ? ' is-active' : ''}`}
          onClick={() => setView('army')}
        >
          Армия
        </button>
        <button
          type="button"
          disabled={isPlayerMoving}
          className={`nav-button${view === 'artifacts' ? ' is-active' : ''}`}
          onClick={() => setView('artifacts')}
        >
          Артефакты
        </button>
        <button
          type="button"
          disabled={isPlayerMoving}
          className={`nav-button${view === 'cities' ? ' is-active' : ''}`}
          onClick={() => setView('cities')}
        >
          Города
        </button>
      </nav>

      {rootFinaleOpen && playerRootAvailability.canClaim ? (
        <RootFinaleOverlay
          availability={playerRootAvailability}
          maxKnowledge={MAX_ORSIA_KNOWLEDGE}
          onChoose={handleClaimRoot}
        />
      ) : null}

      {!rootFinaleOpen && pendingEvent ? (
        <LocationEventOverlay
          state={state}
          event={pendingEvent}
          artifacts={prototypeArtifacts}
          locationName={pendingEventLocationName}
          locationDescription={pendingEventLocationDescription}
          onChoose={handleResolveEvent}
        />
      ) : null}

      {!rootFinaleOpen && !pendingEvent && pendingFactionEventDefinition && pendingFactionDefinition ? (
        <FactionDefeatOverlay
          event={pendingFactionEventDefinition}
          faction={pendingFactionDefinition}
          onAcknowledge={handleFactionDefeatAcknowledge}
        />
      ) : null}

      {!rootFinaleOpen && view !== 'battle' && !pendingEvent && !pendingFactionEventDefinition && pendingBriefing ? (
        <SurfaceBriefingOverlay
          briefing={pendingBriefing}
          onAcknowledge={handleAcknowledgeSurfaceBriefing}
        />
      ) : null}
    </main>
  );
}

function getSupplyHeaderLabel(supply: ReturnType<typeof getSupplyStatus>): string {
  if (supply.level === 'ignored') return 'СНАБЖ. ∞';
  if (supply.distance === null) return 'СНАБЖ. 0%';
  return `СНАБЖ. ${supply.percent}%`;
}


function getLeaderStatus(state: GameState): string {
  const leader = prototypeLeaderById[state.selectedLeaderId];
  if (!leader) return 'лидер';
  if (leader.id === 'artemios') return 'моральная паника всегда 100';
  if (leader.id === 'vlados') return 'артефакты ×1,5';
  if (leader.id === 'iliesh') return 'карта известна';
  if (leader.id === 'makson') return 'Наземный флот · припасы не требуются';
  if (leader.id === 'layosh') {
    const faction = state.factions[state.playerFactionId];
    if (faction?.leaderAbilityLastUsedTurn === state.turn) return 'подземная река использована';
    if (canUseRiverDoubleMove(state, state.playerFactionId)) return 'доступен второй переход';
    if (state.turn % 3 === 0) return 'двойное перемещение активно';
    return `реки через ${3 - (state.turn % 3)} ход.`;
  }
  return leader.abilityName;
}

function getMoveErrorMessage(error: MoveArmyError): string {
  switch (error) {
    case 'strategic_action_spent':
      return 'На этом ходу стратегическое действие уже использовано.';
    case 'insufficient_supplies':
      return 'Недостаточно припасов для перехода.';
    case 'destination_requires_capture':
      return 'Этот город сначала нужно захватить.';
    case 'not_adjacent':
      return 'Армия может перейти только в соседний узел.';
    case 'already_there':
      return 'Армия уже находится в этом узле.';
    case 'army_not_found':
      return 'Основная армия не найдена.';
    case 'destination_not_found':
      return 'Такого узла нет на карте.';
  }
}

function getRootClaimErrorMessage(error: import('@/core/campaign/rootObjective').RootClaimError): string {
  if (error === 'campaign_finished') return 'Кампания уже завершена.';
  if (error === 'army_not_found') return 'Основная армия не найдена.';
  if (error === 'army_empty') return 'Для финальной операции нужна боеспособная армия.';
  if (error === 'not_at_staging_city') return 'Армия должна находиться в последнем городе перед настоящим Корнем.';
  if (error === 'staging_city_not_controlled') return 'Сначала захватите последний город перед настоящим Корнем.';
  if (error === 'requirements_not_met') return 'Не выполнены условия доступа к Корню.';
  if (error === 'strategic_action_spent') return 'Стратегическое действие этого хода уже использовано.';
  return 'Недостаточно припасов для финальной операции.';
}

function describeAiAction(
  action: 'attack' | 'move' | 'recruit' | 'hold',
  targetId: string | undefined,
  rivalName: string,
  graph: MapGraph,
): string {
  const node = targetId ? graph.nodes.find((item) => item.id === targetId) : null;
  const name = node ? t(node.nameKey as Parameters<typeof t>[0]) : targetId;
  if (action === 'attack') return `${rivalName} атаковал ${name ?? 'соседний город'}.`;
  if (action === 'move') return `${rivalName} переместился к ${name ?? 'новой позиции'}.`;
  if (action === 'recruit') return `${rivalName} пополнил армию в ${name ?? 'своём городе'}.`;
  return `${rivalName} удержал позицию.`;
}

function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

function getRecruitmentAttemptErrorMessage(error: RecruitmentAttemptError, blockedTurns?: number): string {
  switch (error) {
    case 'recruitment_blocked': return `После столкновения с жителями набор закрыт ещё на ${blockedTurns ?? 1} ход.`;
    case 'insufficient_money': return 'Недостаточно денег для выбранного числа бойцов.';
    case 'city_not_controlled': return 'Найм доступен только в своём городе.';
    case 'army_not_in_city': return 'Армия должна находиться в городе.';
    case 'invalid_amount': return 'Некорректное число бойцов.';
    case 'army_not_found': return 'Основная армия не найдена.';
    case 'city_not_found': return 'Город не найден.';
  }
}
