import type { LocationEventDefinitions } from '@/core/events/LocationEvent';
import { extensionLocationIds, TRUE_ROOT_NODE_ID } from '@/core/map/extensionMap';

export const prototypeEvents: LocationEventDefinitions = {
  'warehouse-inventory': {
    id: 'warehouse-inventory',
    nodeId: 'warehouse-2',
    title: 'Инвентаризация отсутствующего склада',
    description: 'Заведующий Складом №2 уверяет, что Склад №1 никогда не существовал. За его спиной висит дверь с табличкой «Склад №1. Посторонним вход воспрещён».',
    choices: [
      {
        id: 'demand-bribe',
        label: 'Потребовать взятку',
        description: 'Заведующий вздыхает и отдаёт старый скелет яблока.',
        effects: [{ type: 'artifact', artifactId: 'apple-skeleton' }],
      },
      {
        id: 'sign-act',
        label: 'Подписать акт об отсутствии',
        description: 'Экспедиция тщательно документирует бумагу, чернила и административную безысходность.',
        effects: [{ type: 'knowledge', amount: 2 }],
      },
    ],
  },
  'normal-lake-water': {
    id: 'normal-lake-water',
    nodeId: 'normal-lake',
    title: 'Совершенно нормальное',
    description: 'Местные повторяют, что с озером из березового сока всё нормально. Чем дольше они это повторяют, тем сильнее вы в этом не уверены.',
    choices: [
      {
        id: 'take-flask',
        label: 'Набрать флягу',
        effects: [{ type: 'artifact', artifactId: 'normal-juice-flask' }],
      },
      {
        id: 'believe-them',
        label: 'Поверить местным',
        description: 'Редкое чувство доверия приносит пользу, местные поделились грибами.',
        effects: [{ type: 'knowledge', amount: 2 }],
      },
    ],
  },
  'polyclinic-cabinet': {
    id: 'polyclinic-cabinet',
    nodeId: 'polyclinic-202-basement',
    title: 'Кабинет -260 принимает',
    description: 'Поликлиника 202, к сожалению, всё ещё открыта. В подвале дверь кабинета -260 открылась сама, и изнутри попросили следующего.',
    choices: [
      {
        id: 'enter-cabinet',
        label: 'Войти по записи',
        description: 'После очень короткого осмотра выдают талон к врачу на прошлый век и некую настойку.',
        effects: [
          { type: 'morale', amount: -3 },
          { type: 'artifact', artifactId: 'uboynastoyka' },
        ],
      },
      {
        id: 'inspect-corridor',
        label: 'Исследовать только коридор',
        effects: [
          { type: 'knowledge', amount: 2 },
          { type: 'morale', amount: -2 },
        ],
      },
    ],
  },
  'physics-red-button': {
    id: 'physics-red-button',
    nodeId: 'physics-secret-floors',
    title: 'Этаж, которого нет',
    description: 'Лифт останавливается между официальными этажами. В пустой лаборатории осталась только красная редиска и очень подробная инструкция о том, как её не раздавить.',
    choices: [
      {
        id: 'take-radish',
        label: 'Забрать редиску',
        description: 'Аккуратно вынести редиску вместе с инструкцией по её безопасной транспортировке.',
        effects: [{ type: 'artifact', artifactId: 'red-radish' }],
      },
      {
        id: 'inspect-lab',
        label: 'Осмотреть лабораторию',
        effects: [{ type: 'knowledge', amount: 2 }],
      },
    ],
  },
  'jungle-foraging': {
    id: 'jungle-foraging',
    nodeId: 'temporary-outpost',
    title: 'Поход по грибы',
    description: 'Один из ваших солдат нашел пальму, на которой растет подобие мяса с невероятно сладким ароматом. Оно призывает ваш желудок и притупляет чувство осязания.',
    choices: [
      {
        id: 'hide-delicacy',
        label: 'Спрятать изыск в поклаже, подальше от голодных ртов',
        effects: [{ type: 'artifact', artifactId: 'vanilla-cartilage' }],
      },
      {
        id: 'preserve-in-spirit',
        label: 'Положить мясо в спирт',
        effects: [{ type: 'knowledge', amount: 2 }],
      },
    ],
  },
  'almost-root-shop': {
    id: 'almost-root-shop',
    nodeId: 'almost-root',
    title: 'Сувенирная лавка почти у Корня',
    description: 'Продавец гарантирует, что каждый сувенир сделан из материала, находившегося очень близко к чему-то, что могло быть почти Корнем или хотя бы травой.',
    choices: [
      {
        id: 'buy-souvenir',
        label: 'Купить «Почти-корень» · −15',
        effects: [
          { type: 'money', amount: -15 },
          { type: 'artifact', artifactId: 'almost-grass' },
        ],
      },
      {
        id: 'take-brochure',
        label: 'Взять бесплатную брошюру',
        effects: [{ type: 'knowledge', amount: 1 }],
      },
    ],
  },

  'false-root-revelation': {
    id: 'false-root-revelation',
    nodeId: 'root-sanctum',
    title: 'Не тот корень',
    description: 'После нескольких минут торжественных измерений приходит уточнение с поверхности. Это не Корень Живознания. Перед экспедицией всего лишь зрительный корень — редкая подземная структура, которая очень убедительно выглядит корнем. Настоящий Корень находится дальше.',
    choices: [
      {
        id: 'continue-deeper',
        label: 'Идём дальше',
        description: 'За корневой областью обнаруживается ещё один длинный маршрут в глубину Орсии.',
        effects: [{ type: 'discover_nodes', nodeIds: [...extensionLocationIds, TRUE_ROOT_NODE_ID] }],
      },
    ],
  },
  'oven-zero-control-bake': {
    id: 'oven-zero-control-bake',
    nodeId: 'oven-zero',
    title: 'Контрольная выпечка',
    description: 'Внутри лежит небольшая котлета. Судя по журналу наблюдений, она находится там не менее 63 лет. Она всё ещё сырая.',
    choices: [
      {
        id: 'take-permanent-cutlet',
        label: 'Забрать котлету',
        effects: [{ type: 'artifact', artifactId: 'permanent-raw-cutlet' }],
      },
      {
        id: 'raise-temperature',
        label: 'Повысить температуру',
        description: 'Через несколько секунд из печи раздаётся стук.',
        effects: [{ type: 'knowledge', amount: 3 }, { type: 'morale', amount: -2 }],
      },
    ],
  },
  'salt-department-lecture': {
    id: 'salt-department-lecture',
    nodeId: 'salt-department',
    title: 'Это лекция?',
    description: 'В голове слышится эхо переклички.',
    choices: [
      {
        id: 'you-decide',
        label: 'Тебе решать',
        effects: [{ type: 'artifact', artifactId: 'dancing-cow' }],
      },
      {
        id: 'what-is-state',
        label: 'Что такое государство?',
        description: 'Часть пайков обращается в кисловатую соль.',
        effects: [{ type: 'knowledge', amount: 3 }, { type: 'supplies', amount: -1 }],
      },
    ],
  },
  'reverse-fermentation-harvest': {
    id: 'reverse-fermentation-harvest',
    nodeId: 'reverse-fermentation-cellar',
    title: 'Урожай следующего года',
    description: 'В глубине погреба найдена бутылка с датой розлива, которая наступит через 11 лет.',
    choices: [
      {
        id: 'open-future-bottle',
        label: 'Открыть бутылку',
        description: 'Все присутствующие на несколько секунд вспоминают один и тот же пикник, которого никогда не было.',
        effects: [{ type: 'morale', amount: 4 }],
      },
      {
        id: 'keep-bottle',
        label: 'Не открывать',
        effects: [{ type: 'artifact', artifactId: 'young-ancient-wine' }],
      },
    ],
  },
  'dumpling-deep-drilling': {
    id: 'dumpling-deep-drilling',
    nodeId: 'dumpling-mine',
    title: 'Глубокое бурение',
    description: 'Из породы извлечён особенно крупный экземпляр. Внутри вместо мяса обнаружена ещё одна пельмешка. Внутри неё тоже что-то есть.',
    choices: [
      {
        id: 'stop-third-level',
        label: 'Прекратить вскрытие на третьем уровне',
        effects: [{ type: 'artifact', artifactId: 'meat-geology-matryoshka' }],
      },
      {
        id: 'continue-to-end',
        label: 'Продолжать до конца',
        description: 'На четырнадцатом уровне содержимое становится слишком маленьким для инструментов.',
        effects: [{ type: 'knowledge', amount: 4 }],
      },
    ],
  },
  'sweet-corner-expeditions': {
    id: 'sweet-corner-expeditions',
    nodeId: 'sweet-corner',
    title: 'Сколько было экспедиций?',
    description: 'Вы никогда не видели такого красивого пышного хлеба.',
    choices: [
      {
        id: 'drink-tea',
        label: 'Выпить',
        description: 'Чай действительно не остывает. В том числе внутри человека.',
        effects: [{ type: 'morale', amount: 5 }],
      },
      {
        id: 'take-cup',
        label: 'Взять чашку с собой',
        effects: [{ type: 'artifact', artifactId: 'still-hot-tea' }],
      },
    ],
  },
  'deep-freezer-soup': {
    id: 'deep-freezer-soup',
    nodeId: 'deep-freezer',
    title: 'О, великий суп наварили',
    description: 'На единственной полке стоит кастрюля. На крышке записка: «НЕ ЕШЬ, ЭТО НА ЗАВТРА». Возраст записки оценивается в 600–900 лет.',
    choices: [
      {
        id: 'open-soup',
        label: 'Открыть кастрюлю',
        effects: [{ type: 'artifact', artifactId: 'yesterdays-soup' }],
      },
      {
        id: 'respect-request',
        label: 'Соблюсти просьбу неизвестного хозяина',
        description: 'Экспедицию внезапно охватывает необъяснимое ощущение нравственного превосходства.',
        effects: [{ type: 'morale', amount: 4 }],
      },
    ],
  },
  'pyroral-mandrake': {
    id: 'pyroral-mandrake',
    nodeId: 'pyroral-workshop',
    title: 'Пыр-пыр',
    description: 'Вы вырвали мандрагору и видите, что она уже набирает воздух в то, что у неё вместо лёгких.',
    choices: [
      {
        id: 'limit-speech',
        label: 'Ограничить свободу слова',
        effects: [{ type: 'artifact', artifactId: 'oppressed-mandrake' }],
      },
      {
        id: 'scream-together',
        label: 'Вместе с мандрагорой закричать ПЫНЯВЫЙ',
        description: 'Мандрагоры быстро высыхают, сохраняя форму и упоённую улыбку.',
        effects: [{ type: 'knowledge', amount: 4 }],
      },
    ],
  },
};
