import type { ArmyRoster } from '@/core/state/GameState';
import type {
  BattleOutcome,
  BattleResult,
  BattleSideId,
  BattleSideSectorSnapshot,
  BattleTimelineEvent,
} from '@/core/battles/BattleTypes';

export type BattlePresentationPhase =
  | 'opening'
  | 'advance'
  | 'clash'
  | 'morale'
  | 'break'
  | 'finish';

export type BattlePresentationSide = {
  factionId: string;
  initialUnits: number;
  units: number;
  morale: number;
  totalLosses: number;
  initialRoster: ArmyRoster;
  roster: ArmyRoster;
  broken: boolean;
  outcome: BattleOutcome | null;
  sectorState: BattleSideSectorSnapshot;
};

export type BattlePresentationFrame = {
  index: number;
  at: number;
  round: number;
  phase: BattlePresentationPhase;
  title: string;
  detail: string;
  rolls: Partial<Record<BattleSideId, number>>;
  lossesThisFrame: Partial<Record<BattleSideId, number>>;
  sides: Record<BattleSideId, BattlePresentationSide>;
};

export type BattlePresentation = {
  battleId: string;
  scale: BattleResult['scale'];
  winnerSide: BattleResult['winnerSide'];
  frames: BattlePresentationFrame[];
};

type MutableSide = {
  factionId: string;
  initialUnits: number;
  units: number;
  morale: number;
  totalLosses: number;
  initialRoster: ArmyRoster;
  roster: ArmyRoster;
  broken: boolean;
  outcome: BattleOutcome | null;
  sectorState: BattleSideSectorSnapshot;
};

export function buildBattlePresentation(result: BattleResult): BattlePresentation {
  const initialSectorA = getInitialSectorSnapshot(result, 'A');
  const initialSectorB = getInitialSectorSnapshot(result, 'B');
  const mutableSides: Record<BattleSideId, MutableSide> = {
    A: {
      factionId: result.sides.A.factionId,
      initialUnits: result.sides.A.initialUnits,
      units: result.sides.A.initialUnits,
      morale: result.sides.A.moraleBefore,
      totalLosses: 0,
      initialRoster: cloneRoster(result.sides.A.initialRoster),
      roster: cloneRoster(result.sides.A.initialRoster),
      broken: false,
      outcome: null,
      sectorState: cloneSectorState(initialSectorA),
    },
    B: {
      factionId: result.sides.B.factionId,
      initialUnits: result.sides.B.initialUnits,
      units: result.sides.B.initialUnits,
      morale: result.sides.B.moraleBefore,
      totalLosses: 0,
      initialRoster: cloneRoster(result.sides.B.initialRoster),
      roster: cloneRoster(result.sides.B.initialRoster),
      broken: false,
      outcome: null,
      sectorState: cloneSectorState(initialSectorB),
    },
  };

  const grouped = groupTimelineByTime(result.timeline);
  const frames: BattlePresentationFrame[] = [];
  let round = 0;

  for (const group of grouped) {
    const rolls: Partial<Record<BattleSideId, number>> = {};
    const lossesThisFrame: Partial<Record<BattleSideId, number>> = {};

    for (const event of group.events) {
      if (event.type === 'round_start') round = event.round;
      if (event.type === 'formation_set') mutableSides[event.side].sectorState = cloneSectorState(event.snapshot);
      if (event.type === 'sector_status') mutableSides[event.side].sectorState = cloneSectorState(event.snapshot);
      if (event.type === 'combat_roll') rolls[event.side] = event.roll;
      if (event.type === 'casualties') {
        mutableSides[event.side].units = Math.max(
          0,
          mutableSides[event.side].units - event.totalLosses,
        );
        mutableSides[event.side].totalLosses += event.totalLosses;
        mutableSides[event.side].roster = subtractRosterLosses(
          mutableSides[event.side].roster,
          event.losses,
        );
        lossesThisFrame[event.side] = event.totalLosses;
      }
      if (event.type === 'morale_change') {
        mutableSides[event.side].morale = event.after;
      }
      if (event.type === 'line_break') {
        mutableSides[event.side].broken = true;
      }
      if (event.type === 'battle_end') {
        mutableSides.A.outcome = result.sides.A.outcome;
        mutableSides.B.outcome = result.sides.B.outcome;
      }
    }

    const phase = getFramePhase(group.events);
    const copy = getFrameCopy(group.events, round, rolls, lossesThisFrame, result);
    frames.push({
      index: frames.length,
      at: group.at,
      round,
      phase,
      title: copy.title,
      detail: copy.detail,
      rolls,
      lossesThisFrame,
      sides: {
        A: cloneSide(mutableSides.A),
        B: cloneSide(mutableSides.B),
      },
    });
  }

  if (frames.length === 0) {
    frames.push({
      index: 0,
      at: 0,
      round: 0,
      phase: 'finish',
      title: 'Бой завершён',
      detail: 'Нет событий для визуализации.',
      rolls: {},
      lossesThisFrame: {},
      sides: {
        A: {
          ...cloneSide(mutableSides.A),
          units: result.sides.A.remainingUnits,
          morale: result.sides.A.moraleAfter,
          totalLosses: result.sides.A.totalLosses,
          roster: cloneRoster(result.sides.A.remainingRoster),
          outcome: result.sides.A.outcome,
        },
        B: {
          ...cloneSide(mutableSides.B),
          units: result.sides.B.remainingUnits,
          morale: result.sides.B.moraleAfter,
          totalLosses: result.sides.B.totalLosses,
          roster: cloneRoster(result.sides.B.remainingRoster),
          outcome: result.sides.B.outcome,
        },
      },
    });
  }

  return {
    battleId: result.battleId,
    scale: result.scale,
    winnerSide: result.winnerSide,
    frames,
  };
}

function groupTimelineByTime(
  timeline: BattleTimelineEvent[],
): Array<{ at: number; events: BattleTimelineEvent[] }> {
  const groups = new Map<number, BattleTimelineEvent[]>();
  for (const event of timeline) {
    const events = groups.get(event.at) ?? [];
    events.push(event);
    groups.set(event.at, events);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([at, events]) => ({ at, events }));
}

function getFramePhase(events: BattleTimelineEvent[]): BattlePresentationPhase {
  if (events.some((event) => event.type === 'battle_end')) return 'finish';
  if (events.some((event) => event.type === 'line_break')) return 'break';
  if (events.some((event) => event.type === 'morale_change')) return 'morale';
  if (events.some((event) => event.type === 'casualties')) return 'clash';
  if (events.some((event) => event.type === 'combat_roll')) return 'advance';
  return 'opening';
}

function getFrameCopy(
  events: BattleTimelineEvent[],
  round: number,
  rolls: Partial<Record<BattleSideId, number>>,
  losses: Partial<Record<BattleSideId, number>>,
  result: BattleResult,
): { title: string; detail: string } {
  if (events.some((event) => event.type === 'battle_start')) {
    return {
      title: 'Стороны занимают позиции',
      detail: result.scale === 'battle' ? 'Крупное столкновение начинается.' : 'Стычка начинается.',
    };
  }

  const command = events.find((event) => event.type === 'command_order');
  if (command?.type === 'command_order') {
    return { title: `Раунд ${round}: приказ`, detail: describeCommand(command.command, command.side) };
  }

  const reserve = events.find((event) => event.type === 'reserve_committed');
  if (reserve?.type === 'reserve_committed') {
    return { title: `Раунд ${round}: введён резерв`, detail: `Сторона ${reserve.side} вводит ${reserve.units} бойцов в ${describeLane(reserve.lane)}.` };
  }

  const sectorBreak = events.find((event) => event.type === 'sector_break');
  if (sectorBreak?.type === 'sector_break') {
    return { title: `Раунд ${round}: сектор сломлен`, detail: `${describeLane(sectorBreak.lane)} стороны ${sectorBreak.side} больше не удерживается.` };
  }

  const encirclement = events.find((event) => event.type === 'encirclement');
  if (encirclement?.type === 'encirclement') {
    return { title: `Раунд ${round}: окружение`, detail: `Оба фланга стороны ${encirclement.side} потеряны. Центр оказывается под перекрёстным давлением.` };
  }

  const retreat = events.find((event) => event.type === 'organized_retreat');
  if (retreat?.type === 'organized_retreat') {
    return { title: `Раунд ${round}: организованный отход`, detail: `Сторона ${retreat.side} выходит из боя до полного разгрома.` };
  }

  if (events.some((event) => event.type === 'battle_end')) {
    if (result.winnerSide === 'A') {
      return { title: 'Победа атакующих', detail: describeOutcome(result.sides.A.outcome) };
    }
    if (result.winnerSide === 'B') {
      return { title: 'Атака отбита', detail: describeOutcome(result.sides.B.outcome) };
    }
    return { title: 'Бой завершён без победителя', detail: 'Обе стороны потеряли способность продолжать бой.' };
  }

  const broken = events.find((event) => event.type === 'line_break');
  if (broken?.type === 'line_break') {
    return {
      title: broken.side === 'A' ? 'Линия атакующих сломлена' : 'Оборона дрогнула',
      detail: `Раунд ${round}: строй стороны ${broken.side} больше не удерживается.`,
    };
  }

  if (events.some((event) => event.type === 'morale_change')) {
    return {
      title: `Раунд ${round}: проверка стойкости`,
      detail: 'Потери и давление отражаются на морали сторон.',
    };
  }

  if (events.some((event) => event.type === 'casualties')) {
    return {
      title: `Раунд ${round}: столкновение`,
      detail: `Потери атакующих ${losses.A ?? 0}, защитников ${losses.B ?? 0}.`,
    };
  }

  if (events.some((event) => event.type === 'combat_roll')) {
    return {
      title: `Раунд ${round}: сближение`,
      detail: `Броски давления: ${rolls.A ?? '—'} против ${rolls.B ?? '—'}.`,
    };
  }

  if (events.some((event) => event.type === 'round_start')) {
    return { title: `Раунд ${round}`, detail: 'Отряды перестраиваются перед новым обменом ударами.' };
  }

  return { title: `Событие ${round}`, detail: 'Боевая обстановка меняется.' };
}

function describeCommand(command: import('@/core/battles/BattleTypes').BattleCommandId, side: BattleSideId): string {
  const label = command === 'press_left'
    ? 'давить левый фланг'
    : command === 'press_center'
      ? 'давить центр'
      : command === 'press_right'
        ? 'давить правый фланг'
        : command === 'general_assault'
          ? 'общий натиск'
          : command === 'hold_line'
            ? 'удерживать строй'
            : 'оставить прежний приказ';
  return `Сторона ${side}: ${label}.`;
}

function describeLane(lane: import('@/core/battles/BattleTypes').BattleLane): string {
  return lane === 'left' ? 'левый фланг' : lane === 'right' ? 'правый фланг' : 'центр';
}

function describeOutcome(outcome: BattleOutcome): string {
  switch (outcome) {
    case 'victory':
      return 'Победа достигнута без критического истощения.';
    case 'pyrrhic_victory':
      return 'Победа далась слишком высокой ценой.';
    case 'retreat':
      return 'Сторона организованно отступает.';
    case 'rout':
      return 'Строй разрушен, начинается бегство.';
  }
}

function cloneSide(side: MutableSide): BattlePresentationSide {
  return {
    ...side,
    initialRoster: cloneRoster(side.initialRoster),
    roster: cloneRoster(side.roster),
    sectorState: cloneSectorState(side.sectorState),
  };
}

function getInitialSectorSnapshot(result: BattleResult, side: BattleSideId): BattleSideSectorSnapshot {
  const event = result.timeline.find((item) => item.type === 'formation_set' && item.side === side);
  if (event?.type === 'formation_set') return event.snapshot;
  return result.sides[side].sectorState;
}

function cloneSectorState(snapshot: BattleSideSectorSnapshot): BattleSideSectorSnapshot {
  return {
    reserveUnits: snapshot.reserveUnits,
    reserveCommitted: snapshot.reserveCommitted,
    sectors: {
      left: { ...snapshot.sectors.left },
      center: { ...snapshot.sectors.center },
      right: { ...snapshot.sectors.right },
    },
  };
}

function subtractRosterLosses(roster: ArmyRoster, losses: ArmyRoster): ArmyRoster {
  const next = cloneRoster(roster);
  for (const [unitTypeId, loss] of Object.entries(losses)) {
    next[unitTypeId] = Math.max(0, (next[unitTypeId] ?? 0) - Math.max(0, loss ?? 0));
  }
  return next;
}

function cloneRoster(roster: ArmyRoster): ArmyRoster {
  return { ...roster };
}
