import { useEffect, useState, type ChangeEvent } from 'react';
import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { BattleFormationId, BattleLane, BattlePlan, BattleReservePercent, BattleTacticId } from '@/core/battles/BattleTypes';
import type { AttackCityAvailability, AttackCityError } from '@/core/cities/attackCity';
import type { CityDefinition, RecruitmentOffer } from '@/core/cities/CityDefinition';
import { getEffectiveCityRest, getEffectiveCityTaxIncome } from '@/core/cities/cityTraits';
import type { RecruitAtCityAvailability, RecruitAtCityError } from '@/core/cities/recruitAtCity';
import type { RestAtCityAvailability, RestAtCityError } from '@/core/cities/restAtCity';
import type { RootClaimAvailability } from '@/core/campaign/rootObjective';
import type { MapNode } from '@/core/map/MapGraph';
import type { MapNodeVisibility } from '@/core/map/MapVisibility';
import type { MoveArmyAvailability, MoveArmyError } from '@/core/map/moveArmy';
import type { CityState } from '@/core/state/GameState';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';
import type { TranslationKey } from '@/i18n/ru';
import { t } from '@/i18n/t';

const TACTICS: Array<{ id: BattleTacticId; label: string; title: string; hint: string }> = [
  { id: 'assault', label: 'Натиск', title: 'При равных силах рискованнее, зато при большом превосходстве резко снижает собственные потери. Если бой тянется с 3-го раунда, мораль падает быстрее.', hint: 'Паритет: риск ↑ · превосходство: потери ↓ · с 3-го раунда мораль ↓' },
  { id: 'balanced', label: 'Стандарт', title: 'Средний риск. При превосходстве снижает потери умеренно.', hint: 'Средний риск; при превосходстве потери снижаются умеренно' },
  { id: 'cautious', label: 'Осторожно', title: 'Лучше бережёт людей при равных силах, но при большом превосходстве становится медленным и сравнительно более затратным.', hint: 'Паритет: потери ↓ · большое превосходство: сравнительные потери ↑' },
  { id: 'flank', label: 'Обход', title: 'Манёвр с усилением стрелковых частей и умеренным риском.', hint: 'Манёвр: усиление стрелков и умеренный риск' },
];

const FORMATIONS: Array<{ id: BattleFormationId; label: string; hint: string }> = [
  { id: 'line', label: 'Линия', hint: '25 / 50 / 25' },
  { id: 'strong_center', label: 'Сильный центр', hint: '15 / 70 / 15' },
  { id: 'crescent', label: 'Полумесяц', hint: '35 / 30 / 35' },
];

const RESERVE_LEVELS: BattleReservePercent[] = [0, 15, 30];
const RESERVE_LANES: Array<{ id: BattleLane; label: string }> = [
  { id: 'left', label: 'Лево' },
  { id: 'center', label: 'Центр' },
  { id: 'right', label: 'Право' },
];

export function DecisionPanel({
  selectedNode,
  selectedNodeVisibility,
  selectedCity,
  selectedCityDefinition,
  playerFactionId,
  rivalFactionId,
  rivalFactionName,
  capitalFactionId,
  playerNodeId,
  neighboringNodeIds,
  moveAvailability,
  rootClaimAvailability,
  attackAvailability,
  selectedTactic,
  onClear,
}: {
  selectedNode: MapNode | null;
  selectedNodeVisibility: MapNodeVisibility | null;
  selectedCity: CityState | null;
  selectedCityDefinition: CityDefinition | null;
  playerFactionId: string;
  rivalFactionId: string;
  rivalFactionName: string;
  capitalFactionId?: string | null;
  playerNodeId: string;
  neighboringNodeIds: string[];
  moveAvailability: MoveArmyAvailability | null;
  rootClaimAvailability: RootClaimAvailability | null;
  attackAvailability: AttackCityAvailability | null;
  selectedTactic: BattleTacticId;
  onClear: () => void;
}) {
  if (!selectedNode) {
    return (
      <section className="decision-panel is-compact">
        <div className="decision-copy">
          <strong>{t('campaign.mapHint')}</strong>
          <span>{t('campaign.movementHint')}</span>
        </div>
      </section>
    );
  }

  if (selectedNodeVisibility === 'unknown') {
    const capitalLabel = capitalFactionId
      ? getCapitalFactionLabel(capitalFactionId, playerFactionId, rivalFactionId, rivalFactionName)
      : null;
    return (
      <section className="decision-panel location-dock is-charted-only">
        <div className="decision-copy location-copy">
          <LocationHeader
            eyebrow={capitalLabel ? `Известная столица · ${capitalLabel}` : 'Поселение отмечено на карте'}
            name={t(selectedNode.nameKey as TranslationKey)}
            onClear={onClear}
          />
          <p className="location-description">
            {capitalLabel
              ? 'Положение столицы известно заранее, но свежих разведданных о дороге и гарнизоне нет.'
              : 'Название и положение известны по старым схемам. Кто контролирует поселение и что ждёт внутри — неизвестно.'}
          </p>
          <div className="location-meta-row">
            <span className="fog-intel-pill">Владелец · гарнизон · налог: нет данных</span>
          </div>
        </div>
      </section>
    );
  }

  if (selectedNodeVisibility === 'explored') {
    const rememberedDescription = selectedNode.descriptionKey
      ? t(selectedNode.descriptionKey as TranslationKey)
      : 'Локация была разведана ранее.';
    return (
      <section className="decision-panel location-dock is-fog-memory">
        <div className="decision-copy location-copy">
          <LocationHeader
            eyebrow="Разведано ранее"
            name={t(selectedNode.nameKey as TranslationKey)}
            onClear={onClear}
          />
          <p className="location-description">{rememberedDescription}</p>
          <div className="location-meta-row">
            <span className="fog-intel-pill">Текущие владелец, гарнизон и присутствие армий неизвестны</span>
          </div>
        </div>
      </section>
    );
  }

  const isCurrentNode = selectedNode.id === playerNodeId;
  const isRootObjective = rootClaimAvailability !== null;
  const isNeighbor = neighboringNodeIds.includes(selectedNode.id);
  const isControlledCity = selectedCity?.ownerFactionId === playerFactionId;
  const isNeutralCity = selectedCity?.ownerFactionId === null;
  const isEnemyCity = Boolean(selectedCity && selectedCity.ownerFactionId !== playerFactionId);
  const isAttackTarget = !isCurrentNode && isNeighbor && isEnemyCity;
  const garrisonUnits = selectedCity ? getRosterTotalUnits(selectedCity.garrison.roster) : 0;
  const defenderUnits = attackAvailability?.canAttack ? attackAvailability.defenderUnits : garrisonUnits;
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
  const storedIncomeMultiplier = selectedCity?.incomeMultiplier ?? 1;
  const captureIncomeMultiplier = selectedCity?.ownerFactionId
    ? getCapturedIncomeMultiplierFromDefinition(selectedCity.ownerFactionId)
    : 1;
  const effectiveIncomeMultiplier = isControlledCity
    ? storedIncomeMultiplier
    : Math.min(storedIncomeMultiplier, captureIncomeMultiplier);
  const effectiveTax = selectedCityDefinition
    ? Math.round(getEffectiveCityTaxIncome(selectedCityDefinition) * effectiveIncomeMultiplier * 100) / 100
    : null;
  const effectiveRest = selectedCityDefinition ? getEffectiveCityRest(selectedCityDefinition) : null;

  return (
    <section className={`decision-panel location-dock${isAttackTarget ? ' is-attack' : ''}`}>
      <div className="decision-copy location-copy">
        <LocationHeader
          eyebrow={getLocationEyebrow(
            selectedNode,
            selectedCity,
            playerFactionId,
            rivalFactionId,
            rivalFactionName,
          )}
          name={t(selectedNode.nameKey as TranslationKey)}
          onClear={onClear}
        />

        <p className="location-description">{description}</p>

        <div className="location-meta-row" aria-label="Характеристики выбранной локации">
          {selectedCityDefinition ? (
            <span>
              Налог +{effectiveTax}/ход
            </span>
          ) : null}
          {selectedCityDefinition ? (
            <span>
              Отдых +{effectiveRest?.suppliesRestore ?? 0} прип. · +{effectiveRest?.moraleRestore ?? 0} мор.
            </span>
          ) : null}
          {selectedCityDefinition ? (
            <span className="city-special-pill" title={selectedCityDefinition.special.description}>
              {selectedCityDefinition.special.name}: {selectedCityDefinition.special.description}
            </span>
          ) : null}
          {selectedCity && !isControlledCity ? (
            <span className="garrison-pill">Защитники {defenderUnits}</span>
          ) : null}
          {selectedCity?.ownerFactionId && orsiaSubfactionById[selectedCity.ownerFactionId] ? (
            <span className="faction-trait-pill">{orsiaSubfactionById[selectedCity.ownerFactionId].traitSummary}</span>
          ) : null}
          {effectiveIncomeMultiplier < 0.999 ? (
            <span className="corruption-pill">Коррупция: налог ×{effectiveIncomeMultiplier.toFixed(2)}</span>
          ) : null}
          {moveAvailability?.canMove ? (
            <span className={`supply-pill is-${moveAvailability.supplyStatus.level}`}>
              {moveAvailability.supplyStatus.level === 'ignored'
                ? 'Припасы не требуются'
                : `После перехода: снабжение ${moveAvailability.supplyStatus.percent}%`}
            </span>
          ) : null}
          {attackAvailability?.canAttack ? (
            <span className={`supply-pill is-${attackAvailability.supplyStatus.level}`}>
              {attackAvailability.supplyStatus.level === 'ignored'
                ? 'Припасы не требуются'
                : `Снабжение атаки ${attackAvailability.supplyStatus.percent}%`}
            </span>
          ) : null}
          {isAttackTarget ? (
            <span className="tactic-dynamic-hint">{TACTICS.find((tactic) => tactic.id === selectedTactic)?.hint}</span>
          ) : null}
          {isRootObjective && rootClaimAvailability ? (
            <>
              <span className={rootClaimAvailability.progress.controlledCities >= rootClaimAvailability.progress.requiredCities ? 'root-requirement is-ready' : 'root-requirement'}>
                Города {rootClaimAvailability.progress.controlledCities}/{rootClaimAvailability.progress.requiredCities}
              </span>
              <span className={rootClaimAvailability.progress.specimensCollected >= rootClaimAvailability.progress.requiredSpecimensCollected ? 'root-requirement is-ready' : 'root-requirement'}>
                Научная готовность {rootClaimAvailability.progress.specimensCollected}/{rootClaimAvailability.progress.requiredSpecimensCollected}
              </span>
              {rootClaimAvailability.progress.requiredEventId ? (
                <span className={rootClaimAvailability.progress.requiredEventResolved ? 'root-requirement is-ready' : 'root-requirement'}>
                  Разведка у Корня {rootClaimAvailability.progress.requiredEventResolved ? 'готова' : 'не завершена'}
                </span>
              ) : null}
              <span className={rootClaimAvailability.progress.controlsStagingCity && rootClaimAvailability.progress.armyAtStagingCity ? 'root-requirement is-ready' : 'root-requirement'}>
                Финальный рубеж {rootClaimAvailability.progress.controlsStagingCity && rootClaimAvailability.progress.armyAtStagingCity ? 'занят' : 'не готов'}
              </span>
            </>
          ) : null}
          {!selectedCityDefinition && !isRootObjective ? (
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
      </div>
    </section>
  );
}

export function StrategicActionBar({
  selectedNode,
  selectedNodeVisibility,
  selectedCity,
  playerFactionId,
  playerNodeId,
  neighboringNodeIds,
  moveAvailability,
  rootClaimAvailability,
  attackAvailability,
  currentCityId,
  currentCityDefinition,
  currentRecruitmentOffers,
  currentCityControlled,
  restAvailability,
  recruitAvailabilityByUnitTypeId,
  unitDefinitions,
  moveSupplyCost,
  attackSupplyCost,
  selectedTactic,
  battlePlan,
  feedback,
  onMove,
  onOpenRootFinale,
  onAttack,
  onTacticChange,
  onBattlePlanChange,
  onRest,
  onRecruit,
}: {
  selectedNode: MapNode | null;
  selectedNodeVisibility: MapNodeVisibility | null;
  selectedCity: CityState | null;
  playerFactionId: string;
  playerNodeId: string;
  neighboringNodeIds: string[];
  moveAvailability: MoveArmyAvailability | null;
  rootClaimAvailability: RootClaimAvailability | null;
  attackAvailability: AttackCityAvailability | null;
  currentCityId: string | null;
  currentCityDefinition: CityDefinition | null;
  currentRecruitmentOffers: RecruitmentOffer[];
  currentCityControlled: boolean;
  restAvailability: RestAtCityAvailability | null;
  recruitAvailabilityByUnitTypeId: Record<string, RecruitAtCityAvailability>;
  unitDefinitions: UnitDefinitions;
  moveSupplyCost: number;
  attackSupplyCost: number;
  selectedTactic: BattleTacticId;
  battlePlan: BattlePlan;
  feedback: string | null;
  onMove: (nodeId: string) => void;
  onOpenRootFinale: () => void;
  onAttack: (cityId: string) => void;
  onTacticChange: (tactic: BattleTacticId) => void;
  onBattlePlanChange: (plan: BattlePlan) => void;
  onRest: (cityId: string) => void;
  onRecruit: (cityId: string, offer: RecruitmentOffer) => void;
}) {
  const [showTactics, setShowTactics] = useState(false);
  const [showRecruit, setShowRecruit] = useState(false);
  const visibleSelectedNode = selectedNodeVisibility === 'visible' ? selectedNode : null;
  const isCurrentNode = visibleSelectedNode?.id === playerNodeId;
  const isRootObjective = rootClaimAvailability !== null;
  const isNeighbor = visibleSelectedNode ? neighboringNodeIds.includes(visibleSelectedNode.id) : false;
  const isEnemyCity = Boolean(selectedCity && selectedCity.ownerFactionId !== playerFactionId && !isCurrentNode);
  const isAttackTarget = Boolean(visibleSelectedNode && isNeighbor && isEnemyCity);
  const canMoveTarget = Boolean(visibleSelectedNode && !isCurrentNode && !isAttackTarget && !isRootObjective);
  const showCurrentCityActions = Boolean(
    currentCityId && currentCityControlled && currentCityDefinition && (!selectedNode || isCurrentNode),
  );
  const effectiveMoveCost = moveAvailability?.canMove ? moveAvailability.supplyCost : moveSupplyCost;
  const effectiveAttackCost = attackAvailability?.canAttack ? attackAvailability.supplyCost : attackSupplyCost;
  const defenderUnits = attackAvailability?.canAttack
    ? attackAvailability.defenderUnits
    : selectedCity
      ? getRosterTotalUnits(selectedCity.garrison.roster)
      : 0;
  const selectedTacticDefinition = TACTICS.find((tactic) => tactic.id === selectedTactic) ?? TACTICS[1];

  useEffect(() => {
    setShowTactics(false);
    setShowRecruit(false);
  }, [selectedNode?.id]);

  return (
    <section className="strategic-action-panel" aria-label="Стратегические действия">
      <div className="strategic-action-grid">
        {canMoveTarget && visibleSelectedNode ? (
          <button
            type="button"
            className="primary-button action-button"
            disabled={!moveAvailability?.canMove}
            title={moveAvailability && !moveAvailability.canMove ? getMoveErrorMessage(moveAvailability.reason) : ''}
            onClick={() => onMove(visibleSelectedNode.id)}
          >
            {t('campaign.move')} · {formatSupplyCost(effectiveMoveCost)}
          </button>
        ) : null}

        {isRootObjective ? (
          <button
            type="button"
            className="primary-button action-button root-operation-button"
            disabled={!rootClaimAvailability?.canClaim}
            title={getRootClaimDisabledReason(rootClaimAvailability)}
            onClick={onOpenRootFinale}
          >
            Финальная операция · {formatSupplyCost(rootClaimAvailability?.supplyCost ?? 0)}
          </button>
        ) : null}

        {isAttackTarget && visibleSelectedNode ? (
          <>
            <button
              type="button"
              className="primary-button action-button attack-button"
              disabled={!attackAvailability?.canAttack}
              title={getAttackDisabledReason(attackAvailability)}
              onClick={() => onAttack(visibleSelectedNode.id)}
            >
              {defenderUnits > 0 ? 'Атаковать' : 'Занять'} · {formatSupplyCost(effectiveAttackCost)}
            </button>
            <button
              type="button"
              className={`secondary-button action-button tactic-toggle${showTactics ? ' is-active' : ''}`}
              onClick={() => setShowTactics((value) => !value)}
              aria-expanded={showTactics}
            >
              План боя · {selectedTacticDefinition.label}
            </button>
          </>
        ) : null}

        {showCurrentCityActions && currentCityId ? (
          <>
            <button
              type="button"
              className="secondary-button action-button rest-button"
              disabled={!restAvailability?.canRest}
              title={getRestDisabledReason(restAvailability)}
              onClick={() => onRest(currentCityId)}
            >
              Привал
            </button>
            {currentRecruitmentOffers.length > 0 ? (
              <button
                type="button"
                className={`secondary-button action-button recruit-toggle${showRecruit ? ' is-active' : ''}`}
                onClick={() => setShowRecruit((value) => !value)}
                aria-expanded={showRecruit}
              >
                Набор · {currentRecruitmentOffers.length}
              </button>
            ) : null}
          </>
        ) : null}

        {!isAttackTarget && !canMoveTarget && !isRootObjective && !showCurrentCityActions ? (
          <span className="strategic-action-hint">
            {selectedNodeVisibility === 'unknown'
              ? 'Поселение известно, но путь и обстановка ещё не разведаны.'
              : selectedNodeVisibility === 'explored'
                ? 'Вернитесь в зону наблюдения, чтобы действовать здесь.'
                : 'Выберите соседнюю точку для хода.'}
          </span>
        ) : null}
      </div>

      {showTactics && isAttackTarget ? (
        <div className="battle-plan-panel" aria-label="План боя">
          <PlanSection title="Тактика">
            <div className="tactic-option-grid">
              {TACTICS.map((tactic) => (
                <button
                  key={tactic.id}
                  type="button"
                  className={`tactic-chip${selectedTactic === tactic.id ? ' is-active' : ''}`}
                  title={tactic.title}
                  onClick={() => onTacticChange(tactic.id)}
                >
                  <strong>{tactic.label}</strong>
                  <span>{tactic.hint}</span>
                </button>
              ))}
            </div>
          </PlanSection>

          <PlanSection title="Построение">
            <div className="battle-plan-chip-row">
              {FORMATIONS.map((formation) => (
                <button
                  key={formation.id}
                  type="button"
                  className={`battle-plan-chip${battlePlan.formation === formation.id ? ' is-active' : ''}`}
                  onClick={() => onBattlePlanChange({ ...battlePlan, formation: formation.id })}
                >
                  <strong>{formation.label}</strong><span>{formation.hint}</span>
                </button>
              ))}
            </div>
          </PlanSection>

          <PlanSection title="Резерв · вводится в 3-м раунде">
            <div className="battle-plan-chip-row is-tight">
              {RESERVE_LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`battle-plan-chip is-compact${battlePlan.reservePercent === value ? ' is-active' : ''}`}
                  onClick={() => onBattlePlanChange({ ...battlePlan, reservePercent: value })}
                >
                  {value}%
                </button>
              ))}
            </div>
            {battlePlan.reservePercent > 0 ? (
              <div className="battle-plan-chip-row is-tight" aria-label="Куда ввести резерв">
                {RESERVE_LANES.map((lane) => (
                  <button
                    key={lane.id}
                    type="button"
                    className={`battle-plan-chip is-compact${battlePlan.reserveTarget === lane.id ? ' is-active' : ''}`}
                    onClick={() => onBattlePlanChange({ ...battlePlan, reserveTarget: lane.id })}
                  >
                    {lane.label}
                  </button>
                ))}
              </div>
            ) : null}
          </PlanSection>

          <PlanSection title="Командование во время боя">
            <div className="battle-live-orders-note">
              <strong>2 приказа</strong>
              <span>Бой автоматически остановится перед 2-м и 4-м раундами. В этот момент можно усилить сектор, приказать общий натиск, удерживать строй или не вмешиваться.</span>
            </div>
          </PlanSection>

          <label className="battle-retreat-toggle">
            <input
              type="checkbox"
              checked={battlePlan.retreatMoraleThreshold !== null}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onBattlePlanChange({ ...battlePlan, retreatMoraleThreshold: event.target.checked ? 30 : null })}
            />
            <span><strong>Организованный отход</strong><small>Отступить, если общая мораль упадёт до 30, вместо риска полного разгрома.</small></span>
          </label>
        </div>
      ) : null}

      {showRecruit && showCurrentCityActions && currentCityId ? (
        <div className="recruit-option-grid" aria-label="Набор войск">
          {currentRecruitmentOffers.map((offer) => {
            const unit = unitDefinitions[offer.unitTypeId];
            const availability = recruitAvailabilityByUnitTypeId[offer.unitTypeId] ?? null;
            return (
              <button
                key={offer.unitTypeId}
                type="button"
                className="secondary-button recruit-option"
                disabled={!availability?.canRecruit}
                title={getRecruitDisabledReason(availability)}
                onClick={() => onRecruit(currentCityId, offer)}
              >
                <strong>+{offer.amount} {unit?.shortName ?? offer.unitTypeId}</strong>
                <span>−{offer.cost}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {feedback ? <div className="strategic-action-feedback" title={feedback}>{feedback}</div> : null}
    </section>
  );
}
function LocationHeader({ eyebrow, name, onClear }: { eyebrow: string; name: string; onClear: () => void }) {
  return (
    <div className="location-title-row">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{name}</h2>
      </div>
      <button type="button" className="location-close" aria-label="Снять выбор" onClick={onClear}>×</button>
    </div>
  );
}

function getCapitalFactionLabel(
  factionId: string,
  playerFactionId: string,
  rivalFactionId: string,
  rivalFactionName: string,
): string {
  if (factionId === playerFactionId) return 'Экспедиция';
  if (factionId === rivalFactionId) return rivalFactionName;
  return orsiaSubfactionById[factionId]?.name ?? 'неизвестная фракция';
}

function getCapturedIncomeMultiplierFromDefinition(factionId: string): number {
  const definition = orsiaSubfactionById[factionId];
  if (!definition) return 1;
  return definition.traits
    .filter((trait) => trait.type === 'captured_city_income_multiplier')
    .reduce((multiplier, trait) => multiplier * trait.multiplier, 1);
}

function formatSupplyCost(cost: number): string {
  return cost === 0 ? 'без припасов' : `−${cost}`;
}

function getLocationEyebrow(
  node: MapNode,
  city: CityState | null,
  playerFactionId: string,
  rivalFactionId: string,
  rivalFactionName: string,
): string {
  if (node.isCentral) return 'Центральная цель';
  if (node.kind === 'poi') return 'Точка интереса';
  if (!city) return t('campaign.selected');
  if (city.ownerFactionId === playerFactionId) return 'Город экспедиции';
  if (city.ownerFactionId === null) return 'Нейтральный город';
  const orsiaOwner = orsiaSubfactionById[city.ownerFactionId];
  if (orsiaOwner) return `Орсия · ${orsiaOwner.name}`;
  if (city.ownerFactionId === rivalFactionId) return rivalFactionName;
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
  if (isCurrentNode && isControlledCity) return 'Опорная точка экспедиции.';
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

function PlanSection({ title, children }: { title: string; children: import('react').ReactNode }) {
  return (
    <div className="battle-plan-section">
      <small className="battle-plan-section-title">{title}</small>
      {children}
    </div>
  );
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

function getRootClaimDisabledReason(availability: RootClaimAvailability | null): string {
  if (!availability || availability.canClaim) return '';
  switch (availability.reason) {
    case 'campaign_finished': return 'Кампания уже завершена.';
    case 'army_not_found': return 'Основная армия не найдена.';
    case 'army_empty': return 'Для финальной операции нужна боеспособная армия.';
    case 'not_at_staging_city': return 'Армия должна находиться в Корневом Пределе.';
    case 'staging_city_not_controlled': return 'Сначала захватите Корневой Предел.';
    case 'requirements_not_met': return 'Не выполнены требования доступа к Корню.';
    case 'strategic_action_spent': return 'Стратегическое действие этого хода уже использовано.';
    case 'insufficient_supplies': return 'Недостаточно припасов для финальной операции.';
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
