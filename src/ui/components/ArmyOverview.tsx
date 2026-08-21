import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react';
import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import { getArmySummary } from '@/core/armies/armyStats';
import { ARMY_FLANKS, canMergeArmyGroups, getArmyFlankPower, getArmyFlankRosters } from '@/core/armies/armyFlanks';
import type { ArmyFlankId, ArmyGroupState, ArmyState } from '@/core/state/GameState';

const FLANK_LABELS: Record<ArmyFlankId, string> = { left: 'Левый', center: 'Центр', right: 'Правый' };
type DropTarget =
  | { kind: 'flank'; id: ArmyFlankId }
  | { kind: 'merge'; id: string }
  | { kind: 'swap'; id: ArmyFlankId }
  | null;

type PointerDragState = {
  groupId: string;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
};

type DragGhostState = { groupId: string; x: number; y: number } | null;

export function ArmyOverview({
  army,
  unitDefinitions,
  onSwapFlanks,
  onMoveGroup,
  onMergeGroups,
  onSplitGroup,
  onAutoDistribute,
}: {
  army: ArmyState;
  unitDefinitions: UnitDefinitions;
  onSwapFlanks?: (first: ArmyFlankId, second: ArmyFlankId) => void;
  onMoveGroup?: (groupId: string, targetFlank: ArmyFlankId) => void;
  onMergeGroups?: (sourceGroupId: string, targetGroupId: string) => void;
  onSplitGroup?: (groupId: string, parts: 2 | 3) => void;
  onAutoDistribute?: () => void;
}) {
  const summary = getArmySummary(army, unitDefinitions);
  const flankRosters = getArmyFlankRosters(army);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedFlank, setSelectedFlank] = useState<ArmyFlankId | null>(null);
  const [dragSourceGroupId, setDragSourceGroupId] = useState<string | null>(null);
  const [dragSourceFlank, setDragSourceFlank] = useState<ArmyFlankId | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [dragGhost, setDragGhost] = useState<DragGhostState>(null);
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const suppressClickRef = useRef(false);
  const groupsById = useMemo(() => new Map((army.groups ?? []).map((group) => [group.id, group])), [army.groups]);

  useEffect(() => {
    if (selectedGroupId && !groupsById.has(selectedGroupId)) setSelectedGroupId(null);
  }, [groupsById, selectedGroupId]);

  function clearDragState() {
    setDragSourceGroupId(null);
    setDragSourceFlank(null);
    setDropTarget(null);
    setDragGhost(null);
  }

  function moveSelectedGroup(targetFlank: ArmyFlankId) {
    if (!selectedGroupId || !onMoveGroup) return false;
    const group = groupsById.get(selectedGroupId);
    if (!group) {
      setSelectedGroupId(null);
      return false;
    }
    if (group.flank !== targetFlank) onMoveGroup(group.id, targetFlank);
    setSelectedGroupId(null);
    setSelectedFlank(null);
    return true;
  }

  function handleFlankHeaderClick(flank: ArmyFlankId) {
    if (moveSelectedGroup(flank)) return;
    if (!onSwapFlanks) return;
    if (!selectedFlank) {
      setSelectedFlank(flank);
      return;
    }
    if (selectedFlank === flank) {
      setSelectedFlank(null);
      return;
    }
    onSwapFlanks(selectedFlank, flank);
    setSelectedFlank(null);
  }

  function handleGroupClick(groupId: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setSelectedFlank(null);
    setSelectedGroupId((current) => current === groupId ? null : groupId);
  }

  function handleFlankDragStart(event: DragEvent<HTMLElement>, flank: ArmyFlankId) {
    if (!onSwapFlanks) return;
    setSelectedGroupId(null);
    setSelectedFlank(null);
    setDragSourceGroupId(null);
    setDragSourceFlank(flank);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-koren-army-flank', flank);
  }

  function handleFlankDragOver(event: DragEvent<HTMLElement>, flank: ArmyFlankId) {
    const sourceFlank = dragSourceFlank || (event.dataTransfer.getData('application/x-koren-army-flank') as ArmyFlankId | '');
    if (sourceFlank && sourceFlank !== flank && onSwapFlanks) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropTarget({ kind: 'swap', id: flank });
    }
  }

  function handleFlankDrop(event: DragEvent<HTMLElement>, flank: ArmyFlankId) {
    event.preventDefault();
    const sourceFlank = dragSourceFlank || (event.dataTransfer.getData('application/x-koren-army-flank') as ArmyFlankId | '');
    if (sourceFlank && sourceFlank !== flank && onSwapFlanks) onSwapFlanks(sourceFlank, flank);
    clearDragState();
  }

  function resolvePointerTarget(clientX: number, clientY: number, sourceGroupId: string): DropTarget {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const groupElement = element?.closest<HTMLElement>('[data-army-group-id]') ?? null;
    const targetGroupId = groupElement?.dataset.armyGroupId ?? null;
    if (targetGroupId && targetGroupId !== sourceGroupId && onMergeGroups && canMergeArmyGroups(army, sourceGroupId, targetGroupId)) {
      return { kind: 'merge', id: targetGroupId };
    }
    const flankElement = element?.closest<HTMLElement>('[data-army-flank-id]') ?? null;
    const flank = flankElement?.dataset.armyFlankId as ArmyFlankId | undefined;
    return flank && ARMY_FLANKS.includes(flank) ? { kind: 'flank', id: flank } : null;
  }

  function handleGroupPointerDown(event: PointerEvent<HTMLDivElement>, groupId: string) {
    if (!onMoveGroup || !event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;
    pointerDragRef.current = {
      groupId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleGroupPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointerDragRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
    if (!pointer.active && distance < 7) return;
    if (!pointer.active) {
      pointer.active = true;
      suppressClickRef.current = true;
      setSelectedGroupId(null);
      setSelectedFlank(null);
      setDragSourceFlank(null);
      setDragSourceGroupId(pointer.groupId);
    }
    event.preventDefault();
    setDragGhost({ groupId: pointer.groupId, x: event.clientX, y: event.clientY });
    setDropTarget(resolvePointerTarget(event.clientX, event.clientY, pointer.groupId));
  }

  function finishPointerDrag(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const pointer = pointerDragRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointerDragRef.current = null;
    if (!pointer.active) return;
    event.preventDefault();
    if (!cancelled) {
      const target = resolvePointerTarget(event.clientX, event.clientY, pointer.groupId);
      if (target?.kind === 'merge' && onMergeGroups) onMergeGroups(pointer.groupId, target.id);
      else if (target?.kind === 'flank' && onMoveGroup) onMoveGroup(pointer.groupId, target.id);
    }
    clearDragState();
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  }

  function handleSplit(group: ArmyGroupState, parts: 2 | 3) {
    if (!onSplitGroup || group.unique || getGroupTotal(group) < parts) return;
    onSplitGroup(group.id, parts);
    setSelectedGroupId(null);
  }

  const ghostGroup = dragGhost ? groupsById.get(dragGhost.groupId) ?? null : null;

  return (
    <section className="army-overview" aria-label="Состав основной армии">
      <div className="army-hero">
        <div>
          <span className="eyebrow">Основная армия</span>
          <h2>Экспедиционный отряд</h2>
          <p>Перетаскивайте отряды между флангами. Бросьте отряд прямо на такой же — они сольются.</p>
        </div>
        <div className="morale-badge">
          <span>Моральная паника</span>
          <strong>{army.morale}</strong>
        </div>
      </div>

      <div className="army-summary-grid">
        <SummaryStat label="Бойцов" value={summary.totalUnits} />
        <SummaryStat label="Атака" value={summary.totalAttack} />
        <SummaryStat label="Защита" value={summary.totalDefense} />
        <SummaryStat label="Содержание" value={`${formatMoney(summary.upkeep)}/ход`} />
      </div>

      <section className="flank-management" aria-label="Управление флангами">
        <div className="flank-management-heading">
          <div>
            <span className="eyebrow">Построение до боя</span>
            <h3>Три фланга</h3>
          </div>
          <div className="flank-management-actions">
            {onAutoDistribute ? <button type="button" className="flank-auto-button" onClick={onAutoDistribute}>⚖ Автораспределение</button> : null}
            <span>Тап по отряду открывает деление. Его также можно перетащить на другой фланг или на такой же отряд для слияния.</span>
          </div>
        </div>
        <div className={`flank-grid${dragSourceGroupId || dragSourceFlank ? ' is-dragging' : ''}`}>
          {ARMY_FLANKS.map((flank) => {
            const groups = (army.groups ?? []).filter((group) => group.flank === flank);
            const power = getArmyFlankPower(army, flank, unitDefinitions);
            const unique = groups.some((group) => group.unique);
            const isFlankDrop = dropTarget?.kind === 'flank' && dropTarget.id === flank;
            const isSwapDrop = dropTarget?.kind === 'swap' && dropTarget.id === flank;
            return (
              <article
                className={`flank-card${unique ? ' has-unique' : ''}${isFlankDrop ? ' is-drop-target' : ''}${isSwapDrop ? ' is-swap-target' : ''}`}
                key={flank}
                data-army-flank-id={flank}
                onDragOver={(event: DragEvent<HTMLElement>) => handleFlankDragOver(event, flank)}
                onDrop={(event: DragEvent<HTMLElement>) => handleFlankDrop(event, flank)}
              >
                <header
                  className={`flank-title-zone${selectedFlank === flank ? ' is-selected' : ''}`}
                  draggable={Boolean(onSwapFlanks)}
                  onDragStart={(event: DragEvent<HTMLElement>) => handleFlankDragStart(event, flank)}
                  onDragEnd={clearDragState}
                  onClick={() => handleFlankHeaderClick(flank)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleFlankHeaderClick(flank);
                    }
                  }}
                  aria-pressed={selectedFlank === flank}
                  title="Выберите этот фланг или перетащите заголовок на другой, чтобы поменять их местами"
                >
                  <strong>{FLANK_LABELS[flank]}</strong>
                  <span>Сила {Math.round(power)}</span>
                  <i className="flank-title-grip" aria-hidden="true">⋮⋮</i>
                </header>
                <div className="flank-groups">
                  {groups.length === 0 ? <span className="flank-empty">Перетащите отряд сюда</span> : groups.map((group) => {
                    const mergeTarget = dropTarget?.kind === 'merge' && dropTarget.id === group.id;
                    const selected = selectedGroupId === group.id;
                    const total = getGroupTotal(group);
                    return (
                      <div className={`flank-group-shell${selected ? ' is-open' : ''}`} key={group.id}>
                        <div
                          className={`flank-group${group.unique ? ' is-unique' : ''}${selected ? ' is-selected' : ''}${dragSourceGroupId === group.id ? ' is-drag-source' : ''}${mergeTarget ? ' is-merge-target' : ''}`}
                          data-army-group-id={group.id}
                          onPointerDown={(event: PointerEvent<HTMLDivElement>) => handleGroupPointerDown(event, group.id)}
                          onPointerMove={handleGroupPointerMove}
                          onPointerUp={(event: PointerEvent<HTMLDivElement>) => finishPointerDrag(event)}
                          onPointerCancel={(event: PointerEvent<HTMLDivElement>) => finishPointerDrag(event, true)}
                          onClick={() => handleGroupClick(group.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleGroupClick(group.id);
                            }
                          }}
                          aria-pressed={selected}
                        >
                          <i aria-hidden="true" />
                          <div>
                            {Object.entries(group.roster).filter(([, amount]) => amount > 0).map(([unitTypeId, amount]) => (
                              <span key={unitTypeId}>{unitDefinitions[unitTypeId]?.shortName ?? unitTypeId} ×{amount}</span>
                            ))}
                          </div>
                          <b className="flank-group-grip" aria-hidden="true">⠿</b>
                          {mergeTarget ? <em className="flank-merge-label">СЛИТЬ</em> : null}
                        </div>
                        {onSplitGroup ? (
                          <div className="flank-group-split-actions" aria-hidden={!selected}>
                            <button
                              type="button"
                              disabled={!selected || group.unique || total < 2}
                              onClick={(event) => { event.stopPropagation(); handleSplit(group, 2); }}
                              title={group.unique ? 'Уникальный отряд нельзя делить' : total < 2 ? 'Недостаточно бойцов' : 'Разделить эту группу на две части'}
                            >½ На 2</button>
                            <button
                              type="button"
                              disabled={!selected || group.unique || total < 3}
                              onClick={(event) => { event.stopPropagation(); handleSplit(group, 3); }}
                              title={group.unique ? 'Уникальный отряд нельзя делить' : total < 3 ? 'Недостаточно бойцов' : 'Разделить эту группу на три части'}
                            >⅓ На 3</button>
                            {selected && group.unique ? <span>Уникальные не делятся</span> : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <small>{Object.values(flankRosters[flank]).reduce((sum, amount) => sum + amount, 0)} бойцов</small>
              </article>
            );
          })}
        </div>
      </section>

      {dragGhost && ghostGroup ? (
        <div className="army-group-drag-ghost" style={{ left: dragGhost.x, top: dragGhost.y }} aria-hidden="true">
          <i />
          <div>
            {Object.entries(ghostGroup.roster).filter(([, amount]) => amount > 0).map(([unitTypeId, amount]) => (
              <span key={unitTypeId}>{unitDefinitions[unitTypeId]?.shortName ?? unitTypeId} ×{amount}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="unit-list">
        {summary.composition.map((row) => {
          const unit = unitDefinitions[row.unitTypeId];
          if (!unit) return null;
          return (
            <article className={`unit-card${unit.isUnique ? ' is-unique' : ''}`} key={row.unitTypeId}>
              <UnitGlyph role={unit.role} unique={Boolean(unit.isUnique)} />
              <div className="unit-copy">
                <div className="unit-card-heading">
                  <div>
                    <strong>{unit.name}</strong>
                    <span>{unit.isUnique ? 'Уникальный' : unit.role === 'line' ? 'Линия' : 'Стрелки'}</span>
                  </div>
                  <b>×{row.amount}</b>
                </div>
                <p>{unit.description}</p>
                <div className="unit-stat-row">
                  <span>АТК {unit.attack}</span>
                  <span>ЗАЩ {unit.defense}</span>
                  <span>Сод. {formatMoney(unit.upkeepPerUnit)}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getGroupTotal(group: ArmyGroupState): number {
  return Object.values(group.roster).reduce((sum, amount) => sum + Math.max(0, amount ?? 0), 0);
}

function SummaryStat({ label, value }: { label: string; value: number | string }) {
  return <div className="army-summary-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function UnitGlyph({ role, unique }: { role: 'line' | 'ranged'; unique: boolean }) {
  return (
    <div className={`unit-glyph is-${role}${unique ? ' is-unique' : ''}`} aria-hidden="true">
      <i className="pixel-head" /><i className="pixel-body" /><i className="pixel-gear" />
    </div>
  );
}

function formatMoney(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}
