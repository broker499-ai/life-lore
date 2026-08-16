import type { LocationEventDefinitions } from '@/core/events/LocationEvent';

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
        description: 'Экспедиция получает образцы бумаги, чернил и административной безысходности.',
        effects: [{ type: 'specimens', amount: 2 }],
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
        effects: [{ type: 'specimens', amount: 2 }],
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
          { type: 'specimens', amount: 2 },
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
        label: 'Снять кнопку со стены',
        effects: [{ type: 'artifact', artifactId: 'red-radish' }],
      },
      {
        id: 'inspect-lab',
        label: 'Осмотреть лабораторию',
        effects: [{ type: 'specimens', amount: 2 }],
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
        effects: [{ type: 'specimens', amount: 2 }],
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
        effects: [{ type: 'specimens', amount: 1 }],
      },
    ],
  },
};
