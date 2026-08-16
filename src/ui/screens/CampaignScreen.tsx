import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleTacticId } from '@/core/battles/BattleTypes';
import {
  attackCity,
  getAttackCityAvailability,
  type AttackCityAvailability,
} from '@/core/cities/attackCity';
import type { RecruitmentOffer } from '@/core/cities/CityDefinition';
import { getEffectiveCityRecruitmentOffers } from '@/core/cities/cityTraits';
import {
  getRecruitAtCityAvailability,
  recruitAtCity,
  type RecruitAtCityAvailability,
} from '@/core/cities/recruitAtCity';
import {
  getRestAtCityAvailability,
  restAtCity,
  type RestAtCityAvailability,
} from '@/core/cities/restAtCity';
import { getNeighborNodeIds } from '@/core/map/MapGraph';
import { getMapNodeVisibilityById } from '@/core/map/MapVisibility';
import {
  getMoveArmyAvailability,
  moveArmy,
  type MoveArmyAvailability,
  type MoveArmyError,
} from '@/core/map/moveArmy';
import type { GameState } from '@/core/state/GameState';
import { claimRoot, getRootClaimAvailability } from '@/core/campaign/rootObjective';
import { evaluatePlayerDefeat } from '@/core/campaign/campaignOutcome';
import { getSupplyStatus } from '@/core/supply/Supply';
import { canUseRiverDoubleMove } from '@/core/leaders/LeaderAbility';
import { resolveLocationEvent, triggerLocationEvent } from '@/core/events/LocationEvent';
import { resolveCityVisitArtifact } from '@/core/artifacts/resolveCityVisitArtifact';
import { toggleActiveArtifact } from '@/core/artifacts/artifactLoadout';
import { acknowledgeSurfaceBriefing, triggerAvailableSurfaceBriefing, triggerSurfaceBriefingById } from '@/core/story/SurfaceBriefing';
import { advanceTurn } from '@/core/turns/advanceTurn';
import { completeResearch } from '@/core/research/completeResearch';
import { resolveFactionDefeatEvent } from '@/core/factions/resolveFactionDefeatEvent';
import { RIVAL_ARMY_ID, RIVAL_FACTION_ID } from '@/core/state/createPrototypeGameState';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { getPrototypeRootObjectiveRules, prototypeCampaignRules } from '@/data/campaign/prototypeRules';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeMapRegions } from '@/data/map/prototypeMap';
import { getCampaignMap, isExtensionUnlocked } from '@/core/map/extensionMap';
import type { MapGraph } from '@/core/map/MapGraph';
import { prototypeUnits } from '@/data/units/prototypeUnits';
import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';
import { prototypeEvents } from '@/data/events/prototypeEvents';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';
import { cityVisitArtifactByCityId } from '@/data/artifacts/cityVisitArtifacts';
import { ROOT_PRIORITY_BRIEFING_ID, prototypeSurfaceBriefingById, prototypeSurfaceBriefings } from '@/data/story/prototypeSurfaceBriefings';
import { rivalExpeditionById } from '@/data/factions/rivalExpeditions';
import { factionDefeatEvents } from '@/data/factions/factionDefeatEvents';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';
import { prototypeResearch } from '@/data/research/prototypeResearch';
import { t } from '@/i18n/t';
import type { TranslationKey } from '@/i18n/ru';
import { ArmyOverview } from '@/ui/components/ArmyOverview';
import {
  DecisionPanel,
  StrategicActionBar,
  getAttackErrorMessage,
  getRecruitErrorMessage,
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
import { ResearchOverview } from '@/ui/components/ResearchOverview';
import { FactionDefeatOverlay } from '@/ui/components/FactionDefeatOverlay';
import { RootFinaleOverlay } from '@/ui/components/RootFinaleOverlay';
import { SurfaceBriefingOverlay } from '@/ui/components/SurfaceBriefingOverlay';
import { CampaignEndScreen } from '@/ui/screens/CampaignEndScreen';
import {
  getDefaultCampaignUiSnapshot,
  saveCampaignSnapshot,
  type CampaignUiSnapshot,
} from '@/services/saves/CampaignStorage';

type CampaignView = 'map' | 'army' | 'cities' | 'research' | 'battle';
type SuccessfulMoveResult = Extract<ReturnType<typeof moveArmy>, { ok: true }>;
type SuccessfulAttackResult = Extract<ReturnType<typeof attackCity>, { ok: true }>;
type PendingMovement = PlayerMovementAnimation & (
  | { kind: 'move'; result: SuccessfulMoveResult }
  | {
      kind: 'attack';
      result: SuccessfulAttackResult;
      cityId: string;
      originNodeId: string | null;
      tactic: BattleTacticId;
      attackSupplyCost: number;
    }
);

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
  const campaignMap = useMemo(() => getCampaignMap(state), [state.campaign.extensionLocationOrder, state.campaign.resolvedEventIds]);
  const campaignRegions = useMemo(() => isExtensionUnlocked(state)
    ? [
        ...prototypeMapRegions,
        { id: 'deep-route-upper', cx: 50, cy: -86, rx: 21, ry: 88, kind: 'root' as const },
        { id: 'deep-route-lower', cx: 50, cy: -168, rx: 18, ry: 38, kind: 'fungal' as const },
      ]
    : prototypeMapRegions, [state.campaign.resolvedEventIds]);
  const rootObjectiveRules = useMemo(() => getPrototypeRootObjectiveRules(state), [state.campaign.extensionLocationOrder]);
  const [view, setView] = useState<CampaignView>(initialUi.view);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialUi.selectedNodeId);
  const [mapCamera, setMapCamera] = useState<MapCameraSnapshot | null>(initialUi.mapCamera);
  const [selectedTactic, setSelectedTactic] = useState<BattleTacticId>('balanced');
  const [battleReport, setBattleReport] = useState<BattleReport | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingMovement, setPendingMovement] = useState<PendingMovement | null>(null);
  const [rootFinaleOpen, setRootFinaleOpen] = useState(false);
  const movementSequenceRef = useRef(0);
  const manualSaveAtRef = useRef(0);

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
  const selectedNode = useMemo(
    () => selectedNodeVisibility === 'unknown'
      ? null
      : campaignMap.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [selectedNodeId, selectedNodeVisibility],
  );
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
  const currentRecruitmentOffers = useMemo(
    () => currentCityDefinition ? getEffectiveCityRecruitmentOffers(currentCityDefinition) : [],
    [currentCityDefinition],
  );

  const neighboringNodeIds = useMemo(
    () => getNeighborNodeIds(campaignMap, playerNodeId),
    [playerNodeId],
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
  }, [selectedNodeId, selectedNodeVisibility, state]);

  const selectedAttackAvailability = useMemo<AttackCityAvailability | null>(() => {
    if (!selectedNodeId || selectedNodeVisibility !== 'visible' || !state.cities[selectedNodeId]) return null;
    return getAttackCityAvailability(state, campaignMap, {
      armyId: 'player-main',
      cityId: selectedNodeId,
      tactic: selectedTactic,
      supplyCost: prototypeCampaignRules.attackSupplyCost,
    });
  }, [selectedNodeId, selectedNodeVisibility, selectedTactic, state]);

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

  const recruitAvailabilityByUnitTypeId = useMemo<Record<string, RecruitAtCityAvailability>>(() => {
    if (!currentCityDefinition || !currentCityControlled) return {};
    return Object.fromEntries(
      currentRecruitmentOffers.map((offer) => [
        offer.unitTypeId,
        getRecruitAtCityAvailability(state, {
          armyId: 'player-main',
          cityId: playerNodeId,
          offer,
          moraleRestore: prototypeCampaignRules.recruitMoraleRestore,
          moraleCap: prototypeCampaignRules.moraleCap,
        }),
      ]),
    );
  }, [currentCityControlled, currentCityDefinition, currentRecruitmentOffers, playerNodeId, state]);

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
    [neighboringNodeIds, playerRootAvailability.canClaim, state],
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
    [neighboringNodeIds, selectedTactic, state],
  );

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

    const visit = resolveCityVisitArtifact(
      movement.result.state,
      {
        cityId: movement.toNodeId,
        factionId: state.playerFactionId,
        armyId: 'player-main',
        supplyCap: prototypeCampaignRules.supplyCap,
        moraleCap: prototypeCampaignRules.moraleCap,
      },
      cityVisitArtifactByCityId,
      prototypeArtifacts,
    );
    const triggered = triggerLocationEvent(visit.state, movement.toNodeId, prototypeEvents);
    const nextState = triggerAvailableSurfaceBriefing(triggered.state, prototypeSurfaceBriefings);
    const event = movement.result.events[0];
    setState(nextState);
    setPendingMovement(null);
    setBattleReport(null);

    const abilityText = event.leaderAbilityId === 'river_double_move'
      ? ' Лайош использовал подземную реку: второй переход выполнен.'
      : '';
    const eventText = triggered.events.length > 0 ? ' Обнаружено событие.' : '';
    const artifactEvent = visit.events.find((item) => item.type === 'artifact_acquired');
    const artifactText = artifactEvent?.type === 'artifact_acquired'
      ? ` Найден городской артефакт «${prototypeArtifacts[artifactEvent.artifactId]?.name ?? artifactEvent.artifactId}».`
      : '';
    setFeedback(`Переход выполнен: −${event.supplyCost} припасов.${abilityText}${artifactText}${eventText} Действие хода использовано.`);
  }

  function handleAttack(cityId: string) {
    if (pendingMovement) return;

    const originNodeId = state.armies['player-main']?.nodeId ?? null;
    const result = attackCity(
      state,
      campaignMap,
      {
        armyId: 'player-main',
        cityId,
        tactic: selectedTactic,
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
    });
  }

  function completeAttackMovement(movement: Extract<PendingMovement, { kind: 'attack' }>) {
    const result = movement.result;
    setPendingMovement(null);
    const visit = result.captured
      ? resolveCityVisitArtifact(
          result.state,
          {
            cityId: movement.cityId,
            factionId: state.playerFactionId,
            armyId: 'player-main',
            supplyCap: prototypeCampaignRules.supplyCap,
            moraleCap: prototypeCampaignRules.moraleCap,
          },
          cityVisitArtifactByCityId,
          prototypeArtifacts,
        )
      : { state: result.state, events: [] };
    const nextState = triggerAvailableSurfaceBriefing(visit.state, prototypeSurfaceBriefings);
    setState(nextState);
    const cityArtifactEvent = visit.events.find((item) => item.type === 'artifact_acquired');
    const cityArtifactText = cityArtifactEvent?.type === 'artifact_acquired'
      ? ` Найден артефакт «${prototypeArtifacts[cityArtifactEvent.artifactId]?.name ?? cityArtifactEvent.artifactId}».`
      : '';

    if (!result.battle) {
      setBattleReport(null);
      setFeedback(`Гарнизон отсутствовал. Город занят за ${movement.attackSupplyCost} припасов.${cityArtifactText}`);
      return;
    }

    setBattleReport({
      cityId: movement.cityId,
      result: result.battle,
      attackerTactic: movement.tactic,
      defenderTactic: 'cautious',
    });
    setView('battle');

    const attacker = result.battle.sides.A;
    const defender = result.battle.sides.B;
    const cityNode = campaignMap.nodes.find((node) => node.id === movement.cityId);
    const originNode = campaignMap.nodes.find((node) => node.id === movement.originNodeId);
    const cityName = cityNode ? t(cityNode.nameKey as Parameters<typeof t>[0]) : movement.cityId;
    const originName = originNode ? t(originNode.nameKey as Parameters<typeof t>[0]) : 'исходной позиции';

    if (result.captured) {
      setFeedback(
        `Победа: ${cityName} захвачен. Потери ${attacker.totalLosses}, защитники потеряли ${defender.totalLosses}. Мораль ${attacker.moraleAfter}.${cityArtifactText}`,
      );
    } else {
      setFeedback(
        `Штурм отбит. Потери ${attacker.totalLosses}, защитники потеряли ${defender.totalLosses}. Армия отступила к ${originName}. Мораль ${attacker.moraleAfter}.`,
      );
    }
  }

  function handleOpenRootFinale() {
    if (!playerRootAvailability.canClaim) {
      setFeedback(getRootClaimErrorMessage(playerRootAvailability.reason));
      return;
    }
    if (!state.campaign.resolvedBriefingIds.includes(ROOT_PRIORITY_BRIEFING_ID)) {
      const nextState = triggerSurfaceBriefingById(state, ROOT_PRIORITY_BRIEFING_ID, prototypeSurfaceBriefings);
      setState(nextState);
      return;
    }
    setRootFinaleOpen(true);
  }

  function handleClaimRoot() {
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
  }

  function handleCloseBattle() {
    const defeat = evaluatePlayerDefeat(state);
    if (defeat.state !== state) setState(defeat.state);
    setView('map');
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

    setState(result.state);
    setBattleReport(null);
    const event = result.events[0];
    setFeedback(`Отдых: +${event.suppliesRestored} припасов, +${event.moraleRestored} морали.`);
  }

  function handleRecruit(cityId: string, offer: RecruitmentOffer) {
    const result = recruitAtCity(state, {
      armyId: 'player-main',
      cityId,
      offer,
      moraleRestore: prototypeCampaignRules.recruitMoraleRestore,
      moraleCap: prototypeCampaignRules.moraleCap,
    });
    if (!result.ok) {
      setFeedback(getRecruitErrorMessage(result.error));
      return;
    }

    setState(result.state);
    setBattleReport(null);
    const event = result.events[0];
    const unitName = prototypeUnits[event.unitTypeId]?.shortName ?? event.unitTypeId;
    setFeedback(`Нанято: ${unitName} +${event.amount} за ${event.cost}. Короткий привал: мораль +${event.moraleRestored}. Припасы не пополнялись. Действие хода использовано.`);
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
    setState(nextState);
    const artifact = result.events.find((event) => event.type === 'artifact_acquired');
    if (artifact?.type === 'artifact_acquired') {
      const definition = prototypeArtifacts[artifact.artifactId];
      const bonus = artifact.multiplier > 1 ? ` Владос усиливает его численные эффекты ×${artifact.multiplier}.` : '';
      const activation = artifact.activated ? ' Артефакт автоматически помещён в свободный активный слот.' : ' Активные слоты заполнены — предмет добавлен в коллекцию.';
      setFeedback(`Получен артефакт «${definition?.name ?? artifact.artifactId}».${activation}${bonus}`);
    } else {
      setFeedback('Событие завершено. Результат записан в экспедиционный журнал.');
    }
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

  function handleResearch(researchId: string) {
    const result = completeResearch(
      state,
      { factionId: state.playerFactionId, researchId },
      prototypeResearch,
      campaignMap,
    );
    if (!result.ok) {
      const message =
        result.error === 'insufficient_specimens'
          ? 'Недостаточно образцов для исследования.'
          : result.error === 'prerequisite_missing'
            ? 'Сначала завершите предыдущее исследование этой ветки.'
            : 'Это исследование сейчас недоступно.';
      setFeedback(message);
      return;
    }
    setState(result.state);
    const definition = prototypeResearch[researchId];
    setFeedback(`Исследование завершено: ${definition?.name ?? researchId}. ${definition?.effectLabel ?? ''}`);
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
    if (briefingId === ROOT_PRIORITY_BRIEFING_ID) setRootFinaleOpen(true);
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
        ? ` Снабжение ${supplyPressure.supplyPercent}%: мораль −${supplyPressure.moraleLost}.`
        : '';
    setFeedback(`Ход ${state.turn} завершён.${rivalText}${incomeText}${upkeepText}${supplyText} Армия снова может действовать.`);
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
      <main className="campaign-shell battle-shell">
        <TopStatusBar state={state} />
        <BattleViewer
          key={battleReport.result.battleId}
          report={battleReport}
          cityName={battleCityName}
          state={state}
          onClose={handleCloseBattle}
        />
      </main>
    );
  }

  return (
    <main className="campaign-shell">
      <TopStatusBar state={state} />

      {view === 'map' ? (
        <section className="map-area">
          <CampaignToolbar state={state} morale={playerArmy?.morale ?? 0} supply={playerSupply} onSave={handleManualSave} onExit={onExit} interactionLocked={isPlayerMoving} />
          <RaceIndicator
            state={state}
            graph={campaignMap}
            rivalFactionId={RIVAL_FACTION_ID}
            rivalArmyId={RIVAL_ARMY_ID}
          />
          <SvgWorldMap
            graph={campaignMap}
            nodeVisibilityById={mapVisibilityById}
            regions={campaignRegions}
            cities={state.cities}
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
              if ((mapVisibilityById[nodeId] ?? 'unknown') === 'unknown') return;
              setSelectedNodeId(nodeId);
            }}
          />
        </section>
      ) : view === 'army' ? (
        <section className="map-area army-area">
          <CampaignToolbar state={state} morale={playerArmy?.morale ?? 0} supply={playerSupply} onSave={handleManualSave} onExit={onExit} interactionLocked={isPlayerMoving} />
          <div className="army-scroll">
            {playerArmy ? (
              <ArmyOverview army={playerArmy} unitDefinitions={prototypeUnits} />
            ) : (
              <div className="empty-state">Основная армия не найдена.</div>
            )}
            <ArtifactInventory
              artifactIds={state.campaign.artifactIds}
              activeArtifactIds={state.campaign.activeArtifactIds}
              definitions={prototypeArtifacts}
              canManage={currentCityControlled}
              onToggle={handleToggleArtifact}
            />
          </div>
        </section>
      ) : view === 'cities' ? (
        <section className="map-area army-area cities-area">
          <CampaignToolbar state={state} morale={playerArmy?.morale ?? 0} supply={playerSupply} onSave={handleManualSave} onExit={onExit} interactionLocked={isPlayerMoving} />
          <div className="army-scroll">
            <CitiesOverview state={state} rivalFactionId={RIVAL_FACTION_ID} />
          </div>
        </section>
      ) : (
        <section className="map-area army-area research-area">
          <CampaignToolbar state={state} morale={playerArmy?.morale ?? 0} supply={playerSupply} onSave={handleManualSave} onExit={onExit} interactionLocked={isPlayerMoving} />
          <div className="army-scroll research-scroll">
            <ResearchOverview state={state} definitions={prototypeResearch} onResearch={handleResearch} />
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
              currentCityControlled={currentCityControlled}
              restAvailability={restAvailability}
              recruitAvailabilityByUnitTypeId={recruitAvailabilityByUnitTypeId}
              unitDefinitions={prototypeUnits}
              moveSupplyCost={prototypeCampaignRules.moveSupplyCost}
              attackSupplyCost={prototypeCampaignRules.attackSupplyCost}
              selectedTactic={selectedTactic}
              feedback={feedback}
              onMove={handleMove}
              onOpenRootFinale={handleOpenRootFinale}
              onAttack={handleAttack}
              onTacticChange={setSelectedTactic}
              onRest={handleRest}
              onRecruit={handleRecruit}
            />
          </div>
          )
        ) : (
          <section className="decision-panel is-compact army-footer">
            <div className="decision-copy">
              <strong>{view === 'army' ? 'Лист состава экспедиции' : view === 'cities' ? 'Ведомость владений' : 'Лаборатория образцов'}</strong>
              <span>{feedback ?? (view === 'army' ? 'Просмотр армии не расходует действие.' : view === 'cities' ? 'Города обновляются сразу после захвата.' : 'Исследования не расходуют стратегическое действие.')}</span>
            </div>
          </section>
        )}

        <section className="persistent-turn-bar" aria-label="Управление ходом">
          <div>
            <span>Ход {state.turn}</span>
            <strong>{isPlayerMoving ? pendingMovement?.kind === 'attack' ? 'Выдвижение на штурм' : 'Переход выполняется' : state.factions[state.playerFactionId]?.strategicActionSpent ? 'Действие использовано' : 'Действие доступно'}</strong>
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
          className={`nav-button${view === 'cities' ? ' is-active' : ''}`}
          onClick={() => setView('cities')}
        >
          Города
        </button>
        <button
          type="button"
          disabled={isPlayerMoving}
          className={`nav-button${view === 'research' ? ' is-active' : ''}`}
          onClick={() => setView('research')}
        >
          Исследования
        </button>
      </nav>

      {rootFinaleOpen && playerRootAvailability.canClaim ? (
        <RootFinaleOverlay
          availability={playerRootAvailability}
          onConfirm={handleClaimRoot}
          onCancel={() => setRootFinaleOpen(false)}
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

function CampaignToolbar({
  state,
  morale,
  supply,
  onSave,
  onExit,
  interactionLocked = false,
}: {
  state: GameState;
  morale: number;
  supply: ReturnType<typeof getSupplyStatus>;
  onSave: () => void;
  onExit: () => void;
  interactionLocked?: boolean;
}) {
  const leader = prototypeLeaderById[state.selectedLeaderId];
  return (
    <div className="campaign-toolbar">
      <div>
        <span className="eyebrow">Орсия · экспедиционный журнал</span>
        <strong>{t('app.title')}</strong>
        {leader ? <span className="leader-toolbar-skill">{leader.name} · {getLeaderStatus(state)}</span> : null}
      </div>
      <div className="toolbar-meta">
        <span>Мораль {morale}</span>
        <span className="artifact-toolbar-chip">Артефакты {state.campaign.artifactIds.length} · активно {state.campaign.activeArtifactIds.length}/3</span>
        <span className={`supply-toolbar-chip is-${supply.level}`} title={getSupplyTitle(supply)}>
          {supply.level === 'ignored' ? 'Снабжение — не требуется' : `Снабжение ${supply.percent}%`}
        </span>
        <button type="button" className="text-button campaign-save-button" onClick={onSave} disabled={interactionLocked}>
          Сохранить
        </button>
        <button type="button" className="text-button" onClick={onExit} disabled={interactionLocked}>
          {t('campaign.exit')}
        </button>
      </div>
    </div>
  );
}

function getSupplyTitle(supply: ReturnType<typeof getSupplyStatus>): string {
  if (supply.level === 'ignored') return 'Артемиос игнорирует снабжение: припасы не расходуются на движение и штурмы.';
  if (supply.distance === null) return 'Линия снабжения отрезана. Действия дороже, в конце хода падает мораль.';
  if (supply.distance === 0) return 'Армия находится в собственной опорной точке.';
  return `До ближайшей своей опорной точки: ${supply.distance} ребр. Дальние действия становятся дороже.`;
}


function getLeaderStatus(state: GameState): string {
  const leader = prototypeLeaderById[state.selectedLeaderId];
  if (!leader) return 'лидер';
  if (leader.id === 'artemios') return 'припасы не требуются';
  if (leader.id === 'vlados') return 'артефакты ×1,5';
  if (leader.id === 'iliesh') return 'карта известна';
  if (leader.id === 'makson') return 'урон морали ×1,25';
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
