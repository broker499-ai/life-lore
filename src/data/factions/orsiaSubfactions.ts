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
    traitSummary: 'Мораль орков может неожиданно вырасти прямо в ходе боя.',
    traits: [
      { type: 'random_battle_morale_gain', chancePercent: 32, minGain: 4, maxGain: 9 },
    ],
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
  },
  {
    id: 'orsia-tyranids',
    name: 'Тираниды',
    shortName: 'Тираниды',
    description: 'Колонии крайне коллективных существ. Орсийские чиновники считают их полноценной административной единицей, потому что так проще вести перепись.',
    mapClass: 'orsia-tyranids',
    portraitSrc: '/assets/factions/orsia/tyranids.png',
    leaderName: 'Дитя супа в столовой ГУМа',
    traitSummary: 'Получают на 30% меньше потерь, когда против них применяют Натиск или Осторожно.',
    traits: [
      {
        type: 'incoming_casualty_multiplier_by_enemy_tactic',
        enemyTactics: ['assault', 'cautious'],
        multiplier: 0.7,
      },
    ],
  },
  {
    id: 'orsia-fgushniki',
    name: 'ФГУшники',
    shortName: 'ФГУшники',
    description: 'Обитатели учреждений, ведомственных подвалов и коридоров без окон. Их владения начинаются там, где появляется табличка «посторонним вход воспрещён».',
    mapClass: 'orsia-fgushniki',
    portraitSrc: '/assets/factions/orsia/fgushniki.png',
    leaderName: 'Темный Декан',
    traitSummary: 'После захвата их города сохраняют коррупционный след и дают только 60% обычного налога.',
    traits: [
      { type: 'captured_city_income_multiplier', multiplier: 0.6 },
    ],
  },
];

export const orsiaSubfactionById = Object.fromEntries(
  orsiaSubfactions.map((faction) => [faction.id, faction]),
) as Record<string, OrsiaSubfactionDefinition>;
