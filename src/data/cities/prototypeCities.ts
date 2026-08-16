import type { CityDefinitions } from '@/core/cities/CityDefinition';

const standardRecruitment = [
  { unitTypeId: 'expedition-infantry', amount: 5, cost: 30 },
  { unitTypeId: 'expedition-rangers', amount: 3, cost: 27 },
] as const;

export const prototypeCities: CityDefinitions = {
  'outer-post': {
    id: 'outer-post',
    taxIncome: 12,
    rest: { suppliesRestore: 20, moraleRestore: 15 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Перевал на поверхность',
      description: 'Близость к верхним маршрутам упрощает снабжение тыла. Пока город под контролем, содержание всех армий владельца дешевле на 10%.',
      traits: [{ type: 'faction_army_upkeep_multiplier', multiplier: 0.9 }],
    },
  },
  'moss-market': {
    id: 'moss-market',
    taxIncome: 18,
    rest: { suppliesRestore: 26, moraleRestore: 12 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 28 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 30 },
    ],
    special: {
      name: 'Рынок выдержанного мха',
      description: 'Оборот мха здесь удивительно ликвиден. Налоговый доход города повышен на 35%.',
      traits: [{ type: 'tax_income_multiplier', multiplier: 1.35 }],
    },
  },
  'quiet-scream': {
    id: 'quiet-scream',
    taxIncome: 14,
    rest: { suppliesRestore: 18, moraleRestore: 21 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 30 },
      { unitTypeId: 'student-103', amount: 3, cost: 33 },
    ],
    special: {
      name: 'Кадровый резерв 103',
      description: 'Убежище умеет быстро собирать отряды из тех, кто ещё числится студентом. Каждый найм даёт примерно на треть больше бойцов.',
      traits: [{ type: 'recruitment_amount_multiplier', multiplier: 1.35 }],
    },
  },
  'big-lunch': {
    id: 'big-lunch',
    taxIncome: 17,
    rest: { suppliesRestore: 34, moraleRestore: 20 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 31 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 29 },
    ],
    special: {
      name: 'Послеобеденный привал',
      description: 'Здесь действительно кормят. Отдых восстанавливает на 45% больше припасов и на 25% больше морали.',
      traits: [
        { type: 'rest_supplies_multiplier', multiplier: 1.45 },
        { type: 'rest_morale_multiplier', multiplier: 1.25 },
      ],
    },
  },
  impassable: {
    id: 'impassable',
    taxIncome: 15,
    rest: { suppliesRestore: 22, moraleRestore: 16 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Узкое место',
      description: 'Подступы к городу действительно почти непроходимы. Защитники города получают +25% к боевой силе.',
      traits: [{ type: 'defender_unit_power_multiplier', multiplier: 1.25 }],
    },
  },
  'crooked-chambers': {
    id: 'crooked-chambers',
    taxIncome: 22,
    rest: { suppliesRestore: 18, moraleRestore: 16 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 32 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 28 },
    ],
    special: {
      name: 'Вертикаль власти',
      description: 'Столица умеет собирать деньги и создавать согласования. Налоги выше на 20%, но найм дороже на 12%.',
      traits: [
        { type: 'tax_income_multiplier', multiplier: 1.2 },
        { type: 'recruitment_cost_multiplier', multiplier: 1.12 },
      ],
    },
  },
  'great-canteen-vaults': {
    id: 'great-canteen-vaults',
    taxIncome: 19,
    rest: { suppliesRestore: 36, moraleRestore: 12 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 29 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 30 },
    ],
    special: {
      name: 'Стратегический компот',
      description: 'Запасов бесконечно много, комфорта — заметно меньше. Отдых восстанавливает на 80% больше припасов, но на 20% меньше морали.',
      traits: [
        { type: 'rest_supplies_multiplier', multiplier: 1.8 },
        { type: 'rest_morale_multiplier', multiplier: 0.8 },
      ],
    },
  },
  underfountain: {
    id: 'underfountain',
    taxIncome: 21,
    rest: { suppliesRestore: 24, moraleRestore: 12 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 27 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 25 },
    ],
    special: {
      name: 'Подписали не глядя',
      description: 'Местный рынок труда крайне выгоден работодателю. Найм войск дешевле на 25%.',
      traits: [{ type: 'recruitment_cost_multiplier', multiplier: 0.75 }],
    },
  },
  'club-club': {
    id: 'club-club',
    taxIncome: 20,
    rest: { suppliesRestore: 20, moraleRestore: 24 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Социальная программа',
      description: 'В городе легко восстановить желание жить, чуть сложнее — запасы. Отдых даёт на 75% больше морали, но на 15% меньше припасов.',
      traits: [
        { type: 'rest_morale_multiplier', multiplier: 1.75 },
        { type: 'rest_supplies_multiplier', multiplier: 0.85 },
      ],
    },
  },
  'rival-post': {
    id: 'rival-post',
    taxIncome: 16,
    rest: { suppliesRestore: 20, moraleRestore: 15 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Рента с разрешений',
      description: 'За каждое разрешение берут плату, за отказ в разрешении — тоже. Налоговый доход выше на 45%, но отдых восстанавливает на 20% меньше морали.',
      traits: [
        { type: 'tax_income_multiplier', multiplier: 1.45 },
        { type: 'rest_morale_multiplier', multiplier: 0.8 },
      ],
    },
  },
  phalanstery: {
    id: 'phalanstery',
    taxIncome: 18,
    rest: { suppliesRestore: 27, moraleRestore: 18 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 27 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 29 },
    ],
    special: {
      name: 'Общий котёл',
      description: 'Общий быт снижает расходы на содержание армии владельца на 12%, зато денежный налог города ниже на 10%.',
      traits: [
        { type: 'faction_army_upkeep_multiplier', multiplier: 0.88 },
        { type: 'tax_income_multiplier', multiplier: 0.9 },
      ],
    },
  },
  'echo-vault': {
    id: 'echo-vault',
    taxIncome: 16,
    rest: { suppliesRestore: 18, moraleRestore: 20 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 32 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 25 },
    ],
    special: {
      name: 'Приказ повторён',
      description: 'Под куполом любой приказ звучит убедительнее. Защитники получают +15% к боевой силе, а отдых восстанавливает на 20% больше морали.',
      traits: [
        { type: 'defender_unit_power_multiplier', multiplier: 1.15 },
        { type: 'rest_morale_multiplier', multiplier: 1.2 },
      ],
    },
  },
  'last-decent-inn': {
    id: 'last-decent-inn',
    taxIncome: 14,
    rest: { suppliesRestore: 40, moraleRestore: 30 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 34 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 31 },
    ],
    special: {
      name: 'Действительно приличная гостиница',
      description: 'Лучший отдых на маршруте: +25% к восстановлению припасов и +50% к морали. Местный найм, соответственно, на 10% дороже.',
      traits: [
        { type: 'rest_supplies_multiplier', multiplier: 1.25 },
        { type: 'rest_morale_multiplier', multiplier: 1.5 },
        { type: 'recruitment_cost_multiplier', multiplier: 1.1 },
      ],
    },
  },
  'root-limit': {
    id: 'root-limit',
    taxIncome: 13,
    rest: { suppliesRestore: 16, moraleRestore: 18 },
    recruitment: [
      { unitTypeId: 'expedition-infantry', amount: 5, cost: 36 },
      { unitTypeId: 'expedition-rangers', amount: 3, cost: 34 },
    ],
    special: {
      name: 'Передовая у предполагаемого Корня',
      description: 'Город готовили как базу последнего броска к тому, что все считали Корнем. Отдых здесь восстанавливает на 30% больше припасов.',
      traits: [{ type: 'rest_supplies_multiplier', multiplier: 1.3 }],
    },
  },

  'mining-kingdom': {
    id: 'mining-kingdom',
    taxIncome: 24,
    rest: { suppliesRestore: 22, moraleRestore: 15 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Третий Рим шахтёров',
      description: 'Шахты дают устойчивую ренту и дисциплинированное ополчение. Налоговый доход выше на 30%, защитники сильнее на 10%.',
      traits: [
        { type: 'tax_income_multiplier', multiplier: 1.3 },
        { type: 'defender_unit_power_multiplier', multiplier: 1.1 },
      ],
    },
  },
  'lower-garden': {
    id: 'lower-garden',
    taxIncome: 26,
    rest: { suppliesRestore: 24, moraleRestore: 18 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Петербургская контрабанда',
      description: 'Торговые тоннели в странные подвалы наверху делают город богаче и снижают цену найма.',
      traits: [
        { type: 'tax_income_multiplier', multiplier: 1.25 },
        { type: 'recruitment_cost_multiplier', multiplier: 0.88 },
      ],
    },
  },
  'secret-city-7': {
    id: 'secret-city-7',
    taxIncome: 17,
    rest: { suppliesRestore: 18, moraleRestore: 14 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Засекречено даже от жителей',
      description: 'КПП, бетон и привычка ничего не объяснять делают город крайне тяжёлой целью. Защитники получают +35% к силе, но налоги ниже на 15%.',
      traits: [
        { type: 'defender_unit_power_multiplier', multiplier: 1.35 },
        { type: 'tax_income_multiplier', multiplier: 0.85 },
      ],
    },
  },
  'red-gallery': {
    id: 'red-gallery',
    taxIncome: 21,
    rest: { suppliesRestore: 28, moraleRestore: 15 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Тоннельная логистика',
      description: 'Старый железнодорожный тоннель облегчает снабжение и быстрый сбор людей. Найм даёт на 20% больше бойцов, содержание армий владельца дешевле на 6%.',
      traits: [
        { type: 'recruitment_amount_multiplier', multiplier: 1.2 },
        { type: 'faction_army_upkeep_multiplier', multiplier: 0.94 },
      ],
    },
  },
  undermoscow: {
    id: 'undermoscow',
    taxIncome: 18,
    rest: { suppliesRestore: 34, moraleRestore: 13 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Мусоропроводная экономика',
      description: 'Поток вещей из Надподподмосковья отлично пополняет запасы, хотя психологически не вдохновляет. Отдых даёт +55% припасов и −15% морали.',
      traits: [
        { type: 'rest_supplies_multiplier', multiplier: 1.55 },
        { type: 'rest_morale_multiplier', multiplier: 0.85 },
      ],
    },
  },
  skovorodsk: {
    id: 'skovorodsk',
    taxIncome: 20,
    rest: { suppliesRestore: 30, moraleRestore: 20 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Городская сковорода',
      description: 'Любой первый этаж здесь одновременно кухня. Отдых восстанавливает на 45% больше припасов и на 20% больше морали.',
      traits: [
        { type: 'rest_supplies_multiplier', multiplier: 1.45 },
        { type: 'rest_morale_multiplier', multiplier: 1.2 },
      ],
    },
  },
  'raw-material': {
    id: 'raw-material',
    taxIncome: 23,
    rest: { suppliesRestore: 20, moraleRestore: 14 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Концептуально незавершённое',
      description: 'Здесь всё дешевле, если согласиться не доводить процесс до конца. Найм дешевле на 18%, но отдых восстанавливает на 20% меньше морали.',
      traits: [
        { type: 'recruitment_cost_multiplier', multiplier: 0.82 },
        { type: 'rest_morale_multiplier', multiplier: 0.8 },
      ],
    },
  },
  'secondary-freshness': {
    id: 'secondary-freshness',
    taxIncome: 27,
    rest: { suppliesRestore: 27, moraleRestore: 18 },
    recruitment: [...standardRecruitment],
    special: {
      name: 'Рынок вторичной свежести',
      description: 'Крупнейший поздний торговый узел маршрута. Налоговый доход выше на 40%, припасы при отдыхе восстанавливаются на 20% лучше.',
      traits: [
        { type: 'tax_income_multiplier', multiplier: 1.4 },
        { type: 'rest_supplies_multiplier', multiplier: 1.2 },
      ],
    },
  },
};
