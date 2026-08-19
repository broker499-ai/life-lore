import type { FactionTrait } from '@/core/leaders/LeaderAbility';

export const ORSIA_SUPER_FACTION_ID = 'orsia';

export type OrsiaSubfactionDefinition = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  mapClass: string;
  portraitSrc: string;
  leaderName: string;
  traitSummary: string;
  traits: FactionTrait[];
  enabledForDistribution: boolean;
};

export const orsiaSubfactions: OrsiaSubfactionDefinition[] = [
  {
    id: 'orsia-orcs',
    name: 'Орки',
    shortName: 'Орки',
    description: 'Крупнейшие традиционалисты Орсии. Предпочитают простые стены, тяжёлые дубины и сложные церемонии перед тем, как применить дубину.',
    mapClass: 'orsia-orcs',
    portraitSrc: '/assets/factions/orsia/orcs.png',
    leaderName: 'Моркогоркид',
    traitSummary: 'Орки принципиально строятся одной тяжёлой массой в центре. Флангов у них нет: обходить их выгодно, давить в лоб — наоборот.',
    traits: [
      { type: 'center_only_formation' },
    ],
    enabledForDistribution: true,
  },
  {
    id: 'orsia-goblins',
    name: 'Гоблины',
    shortName: 'Гоблины',
    description: 'Торгово-инженерные общины, способные построить рынок, мост и схему ухода от налога раньше, чем экспедиция успеет разбить лагерь.',
    mapClass: 'orsia-goblins',
    portraitSrc: '/assets/factions/orsia/goblins.png',
    leaderName: 'Тонкий Нечеловек',
    traitSummary: 'Гарнизоны в 2–3 раза многочисленнее обычных, но сила каждого бойца сильно ниже.',
    traits: [
      { type: 'initial_garrison_size_multiplier_range', minMultiplier: 2, maxMultiplier: 3 },
      { type: 'battle_unit_power_multiplier', multiplier: 0.45 },
    ],
    enabledForDistribution: true,
  },
  {
    id: 'orsia-nazbols',
    name: 'Нацболы',
    shortName: 'Нацболы',
    description: 'Громкая политико-военная субкультура Орсии. Отличаются большим количеством знамён, манифестов и крайне небольшим количеством согласованных манифестов.',
    mapClass: 'orsia-nazbols',
    portraitSrc: '/assets/factions/orsia/nazbols.png',
    leaderName: 'Лимоненко',
    traitSummary: 'Очень высокая стартовая мораль; первое поражение от игрока запускает особую реакцию фракции.',
    traits: [
      { type: 'initial_garrison_morale_floor', value: 94 },
      { type: 'defeat_reaction', eventId: 'nazbol-first-defeat', triggerOpponent: 'player' },
    ],
    enabledForDistribution: true,
  },
  {
    id: 'orsia-tyranids',
    name: 'Тираниды',
    shortName: 'Тираниды',
    description: 'Колонии крайне коллективных существ. Орсийские чиновники считают их полноценной административной единицей, потому что так проще вести перепись.',
    mapClass: 'orsia-tyranids',
    portraitSrc: '/assets/factions/orsia/tyranids.png',
    leaderName: 'Дитя супа в столовой ГУМа',
    traitSummary: 'После захвата города остаётся кладка. В течение трёх ходов её можно зачистить отдельным боем; иначе город вернётся тиранидам после ухода экспедиции.',
    traits: [
      { type: 'post_capture_egg_clutch', deadlineTurns: 3, hatchlingUnitTypeId: 'tyranid-hatchling', hatchlingCount: 12, morale: 64 },
    ],
    enabledForDistribution: true,
  },
  {
    id: 'orsia-lateki',
    name: 'Латеки',
    shortName: 'Латеки',
    description: 'Федеральная сеть подземных представительств, советов и комиссий, которая считает Орсию территорией большого межведомственного эксперимента.',
    mapClass: 'orsia-lateki',
    portraitSrc: '/assets/factions/orsia/lateki.webp',
    leaderName: 'Федеральный Совет',
    traitSummary: 'После захвата их города неожиданно начинают получать федеральные субсидии и дают 140% обычного налога.',
    traits: [
      { type: 'captured_city_income_multiplier', multiplier: 1.4 },
    ],
    enabledForDistribution: true,
  },
  {
    id: 'orsia-profkom',
    name: 'Профком',
    shortName: 'Профком',
    description: 'Разросшаяся сеть распределителей льгот, общежитий и очень неприятных разговоров в тесных кабинетах. Формально всегда помогают. Фактически сначала собирают бумагу в трёх экземплярах.',
    mapClass: 'orsia-profkom',
    portraitSrc: '/assets/factions/orsia/profkom.png',
    leaderName: 'Коменда',
    traitSummary: 'По устройству эквивалентны Латеки: после захвата их городов остаётся административный след и доход проседает до 60%.',
    traits: [
      { type: 'captured_city_income_multiplier', multiplier: 0.6 },
    ],
    enabledForDistribution: false,
  },
  {
    id: 'orsia-linhao',
    name: 'Линьхао',
    shortName: 'Линьхао',
    description: 'Персональное владение сущности по имени Линьхао. Обычно это не гарнизон, а один единственный сторож, который почему-то эквивалентен полноценной полусотне бойцов.',
    mapClass: 'orsia-linhao',
    portraitSrc: '/assets/factions/orsia/linhao.png',
    leaderName: 'Линьхао',
    traitSummary: 'Каждый их город охраняет ровно один особый юнит, по боевой мощи сопоставимый примерно с 50 обычными бойцами.',
    traits: [],
    enabledForDistribution: false,
  },
];

export const orsiaMapSubfactions = orsiaSubfactions.filter((faction) => faction.enabledForDistribution);

export const orsiaSubfactionById = Object.fromEntries(
  orsiaSubfactions.map((faction) => [faction.id, faction]),
) as Record<string, OrsiaSubfactionDefinition>;
