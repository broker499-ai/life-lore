import { useMemo, useState } from 'react';
import type { BattleTacticId } from '@/core/battles/BattleTypes';
import {
  attackCity,
  getAttackCityAvailability,
  type AttackCityAvailability,
} from '@/core/cities/attackCity';
import type { RecruitmentOffer } from '@/core/cities/CityDefinition';
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
import {
  getMoveArmyAvailability,
  moveArmy,
  type MoveArmyAvailability,
  type MoveArmyError,
} from '@/core/map/moveArmy';
import type { GameState } from '@/core/state/GameState';
import { getSupplyStatus } from '@/core/supply/Supply';
import { canUseRiverDoubleMove } from '@/core/leaders/LeaderAbility';
import { advanceTurn } from '@/core/turns/advanceTurn';
import { RIVAL_ARMY_ID, RIVAL_FACTION_ID } from '@/core/state/createPrototypeGameState';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeCampaignRules } from '@/data/campaign/prototypeRules';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeMap, prototypeMapRegions } from '@/data/map/prototypeMap';
import { prototypeUnits } from '@/data/units/prototypeUnits';
import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';
import { t } from '@/i18n/t';
import { ArmyOverview } from '@/ui/components/ArmyOverview';
import {
  DecisionPanel,
  getAttackErrorMessage,
  getRecruitErrorMessage,
  getRestErrorMessage,
} from '@/ui/components/DecisionPanel';
import type { BattleReport } from '@/ui/battles/BattleReport';
import { BattleViewer } from '@/ui/battles/BattleViewer';
import { SvgWorldMap } from '@/ui/components/SvgWorldMap';
import { RaceIndicator } from '@/ui/components/RaceIndicator';
import { TopStatusBar } from '@/ui/components/TopStatusBar';

type CampaignView = 'map' | 'army' | 'battle';

export function CampaignScreen({
  initialState,
  onExit,
}: {
  initialState: GameState;
  onExit: () => void;
}) {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState<CampaignView>('map');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTactic, setSelectedTactic] = useState<BattleTacticId>('balanced');
  const [battleReport, setBattleReport] = useState<BattleReport | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => prototypeMap.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [selectedNodeId],
  );
  const selectedCity = selectedNodeId ? state.cities[selectedNodeId] ?? null : null;
  const selectedCityDefinition = selectedNodeId ? prototypeCities[selectedNodeId] ?? null : null;

  const playerArmy = state.armies['player-main'];
  const rivalArmy = state.armies[RIVAL_ARMY_ID];
  const playerNodeId = playerArmy?.nodeId ?? 'outer-post';
  const neighboringNodeIds = useMemo(
    () => getNeighborNodeIds(prototypeMap, playerNodeId),
    [playerNodeId],
  );
  const playerSupply = useMemo(
    () => getSupplyStatus(state, prototypeMap, state.playerFactionId, playerNodeId),
    [playerNodeId, state],
  );

  const selectedMoveAvailability = useMemo<MoveArmyAvailability | null>(() => {
    if (!selectedNodeId) return null;
    return getMoveArmyAvailability(state, prototypeMap, {
      armyId: 'player-main',
      toNodeId: selectedNodeId,
      supplyCost: prototypeCampaignRules.moveSupplyCost,
    });
  }, [selectedNodeId, state]);

  const selectedAttackAvailability = useMemo<AttackCityAvailability | null>(() => {
    if (!selectedNodeId || !state.cities[selectedNodeId]) return null;
    return getAttackCityAvailability(state, prototypeMap, {
      armyId: 'player-main',
      cityId: selectedNodeId,
      tactic: selectedTactic,
      supplyCost: prototypeCampaignRules.attackSupplyCost,
    });
  }, [selectedNodeId, selectedTactic, state]);

  const restAvailability = useMemo<RestAtCityAvailability | null>(() => {
    if (!selectedNodeId || !selectedCityDefinition) return null;
    return getRestAtCityAvailability(state, {
      armyId: 'player-main',
      cityId: selectedNodeId,
      city: selectedCityDefinition,
      supplyCap: prototypeCampaignRules.supplyCap,
      moraleCap: prototypeCampaignRules.moraleCap,
    });
  }, [selectedCityDefinition, selectedNodeId, state]);

  const recruitAvailabilityByUnitTypeId = useMemo<Record<string, RecruitAtCityAvailability>>(() => {
    if (!selectedNodeId || !selectedCityDefinition) return {};
    return Object.fromEntries(
      selectedCityDefinition.recruitment.map((offer) => [
        offer.unitTypeId,
        getRecruitAtCityAvailability(state, {
          armyId: 'player-main',
          cityId: selectedNodeId,
          offer,
        }),
      ]),
    );
  }, [selectedCityDefinition, selectedNodeId, state]);

  const movableNodeIds = useMemo(
    () =>
      neighboringNodeIds.filter(
        (nodeId) =>
          getMoveArmyAvailability(state, prototypeMap, {
            armyId: 'player-main',
            toNodeId: nodeId,
            supplyCost: prototypeCampaignRules.moveSupplyCost,
          }).canMove,
      ),
    [neighboringNodeIds, state],
  );

  const attackableNodeIds = useMemo(
    () =>
      neighboringNodeIds.filter((nodeId) => {
        if (!state.cities[nodeId]) return false;
        return getAttackCityAvailability(state, prototypeMap, {
          armyId: 'player-main',
          cityId: nodeId,
          tactic: selectedTactic,
          supplyCost: prototypeCampaignRules.attackSupplyCost,
        }).canAttack;
      }),
    [neighboringNodeIds, selectedTactic, state],
  );

  function handleMove(toNodeId: string) {
    const result = moveArmy(state, prototypeMap, {
      armyId: 'player-main',
      toNodeId,
      supplyCost: prototypeCampaignRules.moveSupplyCost,
    });

    if (!result.ok) {
      setFeedback(getMoveErrorMessage(result.error));
      return;
    }

    setState(result.state);
    setBattleReport(null);
    const event = result.events[0];
    const abilityText = event.leaderAbilityId === 'river_double_move' ? ' Лайош использовал подземную реку: второй переход выполнен.' : '';
    setFeedback(`Переход выполнен: −${event.supplyCost} припасов.${abilityText} Действие хода использовано.`);
  }

  function handleAttack(cityId: string) {
    const originNodeId = state.armies['player-main']?.nodeId;
    const result = attackCity(
      state,
      prototypeMap,
      {
        armyId: 'player-main',
        cityId,
        tactic: selectedTactic,
        supplyCost: prototypeCampaignRules.attackSupplyCost,
      },
      { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules },
    );

    if (!result.ok) {
      setFeedback(getAttackErrorMessage(result.error));
      return;
    }

    setState(result.state);
    if (!result.battle) {
      setBattleReport(null);
      const actualAttackCost =
        selectedAttackAvailability?.canAttack ? selectedAttackAvailability.supplyCost : prototypeCampaignRules.attackSupplyCost;
      setFeedback(`Гарнизон отсутствовал. Город занят за ${actualAttackCost} припасов.`);
      return;
    }

    setBattleReport({
      cityId,
      result: result.battle,
      attackerTactic: selectedTactic,
      defenderTactic: 'cautious',
    });
    setView('battle');
    const attacker = result.battle.sides.A;
    const defender = result.battle.sides.B;
    const cityNode = prototypeMap.nodes.find((node) => node.id === cityId);
    const originNode = prototypeMap.nodes.find((node) => node.id === originNodeId);
    const cityName = cityNode ? t(cityNode.nameKey as Parameters<typeof t>[0]) : cityId;
    const originName = originNode ? t(originNode.nameKey as Parameters<typeof t>[0]) : 'исходной позиции';

    if (result.captured) {
      setFeedback(
        `Победа: ${cityName} захвачен. Потери ${attacker.totalLosses}, защитники потеряли ${defender.totalLosses}. Мораль ${attacker.moraleAfter}.`,
      );
    } else {
      setFeedback(
        `Штурм отбит. Потери ${attacker.totalLosses}, защитники потеряли ${defender.totalLosses}. Армия отступила к ${originName}. Мораль ${attacker.moraleAfter}.`,
      );
    }
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
    });
    if (!result.ok) {
      setFeedback(getRecruitErrorMessage(result.error));
      return;
    }

    setState(result.state);
    setBattleReport(null);
    const event = result.events[0];
    const unitName = prototypeUnits[event.unitTypeId]?.shortName ?? event.unitTypeId;
    setFeedback(`Нанято: ${unitName} +${event.amount} за ${event.cost}. Действие хода использовано.`);
  }

  function handleEndTurn() {
    const result = advanceTurn(state, {
      graph: prototypeMap,
      cityDefinitions: prototypeCities,
      unitDefinitions: prototypeUnits,
      battleRules: prototypeBattleRules,
      moveSupplyCost: prototypeCampaignRules.moveSupplyCost,
      attackSupplyCost: prototypeCampaignRules.attackSupplyCost,
      aiTurns: [{ factionId: RIVAL_FACTION_ID, armyId: RIVAL_ARMY_ID }],
    });
    setState(result.state);
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
    const rivalText = aiAction?.type === 'ai_action_taken' ? ` ${describeAiAction(aiAction.action, aiAction.targetId)} ` : ' ';
    const supplyText =
      supplyPressure?.type === 'supply_pressure_applied'
        ? ` Снабжение ${supplyPressure.supplyPercent}%: мораль −${supplyPressure.moraleLost}.`
        : '';
    setFeedback(`Ход ${state.turn} завершён.${rivalText}${incomeText}${upkeepText}${supplyText} Армия снова может действовать.`);
  }

  if (view === 'battle' && battleReport) {
    const battleNode = prototypeMap.nodes.find((node) => node.id === battleReport.cityId);
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
          onClose={() => setView('map')}
        />
      </main>
    );
  }

  return (
    <main className="campaign-shell">
      <TopStatusBar state={state} />

      {view === 'map' ? (
        <section className="map-area">
          <CampaignToolbar state={state} morale={playerArmy?.morale ?? 0} supply={playerSupply} onExit={onExit} />
          <RaceIndicator
            state={state}
            graph={prototypeMap}
            rivalFactionId={RIVAL_FACTION_ID}
            rivalArmyId={RIVAL_ARMY_ID}
          />
          <SvgWorldMap
            graph={prototypeMap}
            regions={prototypeMapRegions}
            cities={state.cities}
            playerFactionId={state.playerFactionId}
            rivalFactionId={RIVAL_FACTION_ID}
            selectedNodeId={selectedNodeId}
            playerNodeId={playerNodeId}
            rivalNodeId={rivalArmy?.nodeId ?? null}
            reachableNodeIds={neighboringNodeIds}
            movableNodeIds={movableNodeIds}
            attackableNodeIds={attackableNodeIds}
            supplyPathNodeIds={playerSupply.path}
            onSelectNode={setSelectedNodeId}
          />
        </section>
      ) : (
        <section className="map-area army-area">
          <CampaignToolbar state={state} morale={playerArmy?.morale ?? 0} supply={playerSupply} onExit={onExit} />
          {playerArmy ? (
            <ArmyOverview army={playerArmy} unitDefinitions={prototypeUnits} />
          ) : (
            <div className="empty-state">Основная армия не найдена.</div>
          )}
        </section>
      )}

      {view === 'map' ? (
        <DecisionPanel
          selectedNode={selectedNode}
          selectedCity={selectedCity}
          selectedCityDefinition={selectedCityDefinition}
          unitDefinitions={prototypeUnits}
          playerFactionId={state.playerFactionId}
          playerNodeId={playerNodeId}
          neighboringNodeIds={neighboringNodeIds}
          moveAvailability={selectedMoveAvailability}
          attackAvailability={selectedAttackAvailability}
          restAvailability={restAvailability}
          recruitAvailabilityByUnitTypeId={recruitAvailabilityByUnitTypeId}
          moveSupplyCost={prototypeCampaignRules.moveSupplyCost}
          attackSupplyCost={prototypeCampaignRules.attackSupplyCost}
          selectedTactic={selectedTactic}
          battleReport={battleReport}
          feedback={feedback}
          onMove={handleMove}
          onAttack={handleAttack}
          onTacticChange={setSelectedTactic}
          onRest={handleRest}
          onRecruit={handleRecruit}
          onEndTurn={handleEndTurn}
          onClear={() => setSelectedNodeId(null)}
        />
      ) : (
        <section className="decision-panel is-compact army-footer">
          <div className="decision-copy">
            <strong>Армия не расходует действие при просмотре</strong>
            <span>{feedback ?? 'Содержание списывается автоматически при завершении хода.'}</span>
          </div>
          <button type="button" className="secondary-button turn-button" onClick={handleEndTurn}>
            {t('campaign.endTurn')}
          </button>
        </section>
      )}

      <nav className="bottom-nav" aria-label="Разделы кампании">
        <button
          type="button"
          className={`nav-button${view === 'map' ? ' is-active' : ''}`}
          onClick={() => setView('map')}
        >
          Карта
        </button>
        <button
          type="button"
          className={`nav-button${view === 'army' ? ' is-active' : ''}`}
          onClick={() => setView('army')}
        >
          Армия
        </button>
        <button type="button" className="nav-button" disabled>
          Города
        </button>
      </nav>
    </main>
  );
}

function CampaignToolbar({
  state,
  morale,
  supply,
  onExit,
}: {
  state: GameState;
  morale: number;
  supply: ReturnType<typeof getSupplyStatus>;
  onExit: () => void;
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
        <span className={`supply-toolbar-chip is-${supply.level}`} title={getSupplyTitle(supply)}>
          {supply.level === 'ignored' ? 'Снабжение — не требуется' : `Снабжение ${supply.percent}%`}
        </span>
        <button type="button" className="text-button" onClick={onExit}>
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

function describeAiAction(action: 'attack' | 'move' | 'recruit' | 'hold', targetId?: string): string {
  const node = targetId ? prototypeMap.nodes.find((item) => item.id === targetId) : null;
  const name = node ? t(node.nameKey as Parameters<typeof t>[0]) : targetId;
  if (action === 'attack') return `«Меридиан» атаковал ${name ?? 'соседний город'}.`;
  if (action === 'move') return `«Меридиан» переместился к ${name ?? 'новой позиции'}.`;
  if (action === 'recruit') return `«Меридиан» пополнил армию в ${name ?? 'своём городе'}.`;
  return '«Меридиан» удержал позицию.';
}

function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}
