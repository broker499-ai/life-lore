import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { BattleResult, BattleTacticId } from '@/core/battles/BattleTypes';
import type { BattleReport } from '@/ui/battles/BattleReport';
import type { AttackCityAvailability, AttackCityError } from '@/core/cities/attackCity';
import type { CityDefinition, RecruitmentOffer } from '@/core/cities/CityDefinition';
import type { RecruitAtCityAvailability, RecruitAtCityError } from '@/core/cities/recruitAtCity';
import type { RestAtCityAvailability, RestAtCityError } from '@/core/cities/restAtCity';
import type { MapNode } from '@/core/map/MapGraph';
import type { MoveArmyAvailability, MoveArmyError } from '@/core/map/moveArmy';
import type { CityState } from '@/core/state/GameState';
import type { TranslationKey } from '@/i18n/ru';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';
import { t } from '@/i18n/t';

const TACTICS: Array<{ id: BattleTacticId; label: string }> = [
  { id: 'assault', label: 'Натиск' },
  { id: 'balanced', label: 'Стандарт' },
  { id: 'cautious', label: 'Осторожно' },
  { id: 'flank', label: 'Обход' },
];

export function DecisionPanel({
  selectedNode,
  selectedCity,
  selectedCityDefinition,
  unitDefinitions,
  playerFactionId,
  playerNodeId,
  neighboringNodeIds,
  moveAvailability,
  attackAvailability,
  restAvailability,
  recruitAvailabilityByUnitTypeId,
  moveSupplyCost,
  attackSupplyCost,
  selectedTactic,
  battleReport,
  feedback,
  onMove,
  onAttack,
  onTacticChange,
  onRest,
  onRecruit,
  onEndTurn,
  onClear,
}: {
  selectedNode: MapNode | null;
  selectedCity: CityState | null;
  selectedCityDefinition: CityDefinition | null;
  unitDefinitions: UnitDefinitions;
  playerFactionId: string;
  playerNodeId: string;
  neighboringNodeIds: string[];
  moveAvailability: MoveArmyAvailability | null;
  attackAvailability: AttackCityAvailability | null;
  restAvailability: RestAtCityAvailability | null;
  recruitAvailabilityByUnitTypeId: Record<string, RecruitAtCityAvailability>;
  moveSupplyCost: number;
  attackSupplyCost: number;
  selectedTactic: BattleTacticId;
  battleReport: BattleReport | null;
  feedback: string | null;
  onMove: (nodeId: string) => void;
  onAttack: (cityId: string) => void;
  onTacticChange: (tactic: BattleTacticId) => void;
  onRest: (cityId: string) => void;
  onRecruit: (cityId: string, offer: RecruitmentOffer) => void;
  onEndTurn: () => void;
  onClear: () => void;
}) {
  if (!selectedNode) {
    return (
      <section className="decision-panel is-compact">
        <div className="decision-copy">
          <strong>{t('campaign.mapHint')}</strong>
          <span>{feedback ?? t('campaign.movementHint')}</span>
        </div>
        <button type="button" className="secondary-button turn-button" onClick={onEndTurn}>
          {t('campaign.endTurn')}
        </button>
      </section>
    );
  }

  const isCurrentNode = selectedNode.id === playerNodeId;
  const isNeighbor = neighboringNodeIds.includes(selectedNode.id);
  const canMove = moveAvailability?.canMove ?? false;
  const isControlledCity = selectedCity?.ownerFactionId === playerFactionId;
  const isNeutralCity = selectedCity?.ownerFactionId === null;
  const isEnemyCity = Boolean(selectedCity && selectedCity.ownerFactionId !== playerFactionId);
  const canUseCity = isCurrentNode && isControlledCity;
  const isAttackTarget = !isCurrentNode && isNeighbor && isEnemyCity;
  const garrisonUnits = selectedCity ? getRosterTotalUnits(selectedCity.garrison.roster) : 0;
  const defenderUnits = attackAvailability?.canAttack ? attackAvailability.defenderUnits : garrisonUnits;
  const visibleBattle = battleReport?.cityId === selectedNode.id ? battleReport.result : null;
  const effectiveMoveCost = moveAvailability?.canMove ? moveAvailability.supplyCost : moveSupplyCost;
  const effectiveAttackCost = attackAvailability?.canAttack ? attackAvailability.supplyCost : attackSupplyCost;
  const description = selectedNode.descriptionKey
    ? t(selectedNode.descriptionKey as TranslationKey)
    : getNodeMessage({
        isCurrentNode,
        isNeighbor,
        isControlledCity,
        isNeutralCity,
        moveAvailability,
        attackAvailability,
        garrisonUnits: defenderUnits,
      });

  return (
    <section className={`decision-panel location-dock${isAttackTarget ? ' is-attack' : ''}`}>
      <div className="decision-copy location-copy">
        <div className="location-title-row">
          <div>
            <span className="eyebrow">{getLocationEyebrow(selectedNode, selectedCity, playerFactionId)}</span>
            <h2>{t(selectedNode.nameKey as TranslationKey)}</h2>
          </div>
          <button type="button" className="location-close" aria-label="Снять выбор" onClick={onClear}>
            ×
          </button>
        </div>

        <p className="location-description">{description}</p>

        <div className="location-meta-row" aria-label="Состояние выбранной локации">
          {selectedCityDefinition ? <span>Налог +{selectedCityDefinition.taxIncome}/ход</span> : null}
          {selectedCityDefinition ? (
            <span>
              Отдых +{selectedCityDefinition.rest.suppliesRestore} прип. · +{selectedCityDefinition.rest.moraleRestore} мор.
            </span>
          ) : null}
          {selectedCity && !isControlledCity ? (
            <span className="garrison-pill">Защитники {defenderUnits}</span>
          ) : null}
          {moveAvailability?.canMove ? (
            <span className={`supply-pill is-${moveAvailability.supplyStatus.level}`}>
              {moveAvailability.supplyStatus.level === 'ignored' ? 'Припасы не требуются' : `После перехода: снабжение ${moveAvailability.supplyStatus.percent}%`}
            </span>
          ) : null}
          {attackAvailability?.canAttack ? (
            <span className={`supply-pill is-${attackAvailability.supplyStatus.level}`}>
              {attackAvailability.supplyStatus.level === 'ignored' ? 'Припасы не требуются' : `Снабжение атаки ${attackAvailability.supplyStatus.percent}%`}
            </span>
          ) : null}
          {!selectedCityDefinition ? (
            <span>{getNodeMessage({
              isCurrentNode,
              isNeighbor,
              isControlledCity,
              isNeutralCity,
              moveAvailability,
              attackAvailability,
              garrisonUnits: defenderUnits,
            })}</span>
          ) : null}
        </div>

        {visibleBattle ? <BattleResultStrip result={visibleBattle} /> : null}
        {feedback ? <div className="dock-feedback" title={feedback}>{feedback}</div> : null}
      </div>

      <div className="decision-actions action-strip" aria-label="Действия с выбранной локацией">
        {isAttackTarget
          ? TACTICS.map((tactic) => (
              <button
                key={tactic.id}
                type="button"
                className={`tactic-chip${selectedTactic === tactic.id ? ' is-active' : ''}`}
                onClick={() => onTacticChange(tactic.id)}
              >
                {tactic.label}
              </button>
            ))
          : null}

        {!isCurrentNode && !isAttackTarget ? (
          <button
            type="button"
            className="primary-button action-button"
            disabled={!canMove}
            title={moveAvailability && !moveAvailability.canMove ? getMoveErrorMessage(moveAvailability.reason) : ''}
            onClick={() => onMove(selectedNode.id)}
          >
            {t('campaign.move')} · {formatSupplyCost(effectiveMoveCost)}
          </button>
        ) : null}

        {isAttackTarget ? (
          <button
            type="button"
            className="primary-button action-button attack-button"
            disabled={!attackAvailability?.canAttack}
            title={getAttackDisabledReason(attackAvailability)}
            onClick={() => onAttack(selectedNode.id)}
          >
            {defenderUnits > 0 ? 'Атаковать' : 'Занять'} · {formatSupplyCost(effectiveAttackCost)}
          </button>
        ) : null}

        {canUseCity && selectedCityDefinition ? (
          <>
            <button
              type="button"
              className="primary-button action-button"
              disabled={!restAvailability?.canRest}
              title={getRestDisabledReason(restAvailability)}
              onClick={() => onRest(selectedNode.id)}
            >
              Отдохнуть
            </button>
            {selectedCityDefinition.recruitment.map((offer) => {
              const unit = unitDefinitions[offer.unitTypeId];
              const availability = recruitAvailabilityByUnitTypeId[offer.unitTypeId] ?? null;
              return (
                <button
                  key={offer.unitTypeId}
                  type="button"
                  className="secondary-button action-button recruit-button"
                  disabled={!availability?.canRecruit}
                  title={getRecruitDisabledReason(availability)}
                  onClick={() => onRecruit(selectedNode.id, offer)}
                >
                  +{offer.amount} {unit?.shortName ?? offer.unitTypeId} · −{offer.cost}
                </button>
              );
            })}
          </>
        ) : null}

        <button type="button" className="secondary-button action-button" onClick={onEndTurn}>
          {t('campaign.endTurn')}
        </button>
      </div>
    </section>
  );
}


function formatSupplyCost(cost: number): string {
  return cost === 0 ? 'без припасов' : `−${cost}`;
}

function BattleResultStrip({ result }: { result: BattleResult }) {
  const attacker = result.sides.A;
  const defender = result.sides.B;
  return (
    <div className={`battle-result-strip compact-result${result.winnerSide === 'A' ? ' is-victory' : ' is-defeat'}`}>
      <strong>{result.winnerSide === 'A' ? 'Победа' : 'Штурм отбит'}</strong>
      <span>Потери {attacker.totalLosses}/{defender.totalLosses}</span>
      <span>Мораль {attacker.moraleAfter}</span>
    </div>
  );
}

function getLocationEyebrow(
  node: MapNode,
  city: CityState | null,
  playerFactionId: string,
): string {
  if (node.isCentral) return 'Центральная цель';
  if (node.kind === 'poi') return 'Точка интереса';
  if (!city) return t('campaign.selected');
  if (city.ownerFactionId === playerFactionId) return 'Город экспедиции';
  if (city.ownerFactionId === null) return 'Нейтральный город';
  const orsiaOwner = orsiaSubfactionById[city.ownerFactionId];
  if (orsiaOwner) return `Орсия · ${orsiaOwner.name}`;
  if (city.ownerFactionId === 'meridian-company') return 'Компания «Меридиан»';
  return 'Чужой город';
}

function getNodeMessage({
  isCurrentNode,
  isNeighbor,
  isControlledCity,
  isNeutralCity,
  moveAvailability,
  attackAvailability,
  garrisonUnits,
}: {
  isCurrentNode: boolean;
  isNeighbor: boolean;
  isControlledCity: boolean;
  isNeutralCity: boolean;
  moveAvailability: MoveArmyAvailability | null;
  attackAvailability: AttackCityAvailability | null;
  garrisonUnits: number;
}): string {
  if (isCurrentNode && isControlledCity) return 'Опорная точка: доступны отдых и найм.';
  if (isCurrentNode && isNeutralCity) return 'Незахваченный город требует штурма.';
  if (isCurrentNode) return t('campaign.armyHere');
  if (!isNeighbor) return t('campaign.notAdjacent');
  if (attackAvailability) {
    if (!attackAvailability.canAttack) return getAttackErrorMessage(attackAvailability.reason);
    return garrisonUnits > 0 ? `Доступен штурм · защитников ${garrisonUnits}` : 'Можно занять без боя.';
  }
  if (moveAvailability && !moveAvailability.canMove) return getMoveErrorMessage(moveAvailability.reason);
  return t('campaign.canMove');
}

function getMoveErrorMessage(error: MoveArmyError): string {
  switch (error) {
    case 'strategic_action_spent': return t('campaign.actionSpent');
    case 'insufficient_supplies': return t('campaign.noSupplies');
    case 'destination_requires_capture': return 'Сначала нужно захватить город.';
    case 'not_adjacent': return t('campaign.notAdjacent');
    case 'already_there': return t('campaign.armyHere');
    case 'army_not_found': return 'Основная армия не найдена.';
    case 'destination_not_found': return 'Такого узла нет на карте.';
  }
}

function getAttackDisabledReason(availability: AttackCityAvailability | null): string {
  if (!availability || availability.canAttack) return '';
  return getAttackErrorMessage(availability.reason);
}

export function getAttackErrorMessage(error: AttackCityError): string {
  switch (error) {
    case 'strategic_action_spent': return 'Стратегическое действие этого хода уже использовано.';
    case 'insufficient_supplies': return 'Недостаточно припасов для штурма.';
    case 'not_adjacent': return 'Атаковать можно только соседний город.';
    case 'already_controlled': return 'Этот город уже контролируется экспедицией.';
    case 'allied_city': return 'Этот город принадлежит союзной фракции.';
    case 'army_empty': return 'В основной армии нет бойцов.';
    case 'army_not_found': return 'Основная армия не найдена.';
    case 'city_not_found': return 'Город не найден.';
  }
}

function getRestDisabledReason(availability: RestAtCityAvailability | null): string {
  if (!availability || availability.canRest) return '';
  return getRestErrorMessage(availability.reason);
}

function getRecruitDisabledReason(availability: RecruitAtCityAvailability | null): string {
  if (!availability || availability.canRecruit) return '';
  return getRecruitErrorMessage(availability.reason);
}

export function getRestErrorMessage(error: RestAtCityError): string {
  switch (error) {
    case 'strategic_action_spent': return 'Стратегическое действие этого хода уже использовано.';
    case 'nothing_to_restore': return 'Припасы и мораль уже на максимуме.';
    case 'city_not_controlled': return 'Отдых доступен только в своём городе.';
    case 'army_not_in_city': return 'Армия должна находиться в городе.';
    case 'army_not_found': return 'Основная армия не найдена.';
    case 'city_not_found': return 'Город не найден.';
  }
}

export function getRecruitErrorMessage(error: RecruitAtCityError): string {
  switch (error) {
    case 'strategic_action_spent': return 'Стратегическое действие этого хода уже использовано.';
    case 'insufficient_money': return 'Недостаточно денег для найма.';
    case 'city_not_controlled': return 'Найм доступен только в своём городе.';
    case 'army_not_in_city': return 'Армия должна находиться в городе.';
    case 'army_not_found': return 'Основная армия не найдена.';
    case 'city_not_found': return 'Город не найден.';
  }
}
