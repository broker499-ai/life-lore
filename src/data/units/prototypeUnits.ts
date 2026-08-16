import type { UnitDefinitions } from '@/core/armies/UnitDefinition';

export const prototypeUnits: UnitDefinitions = {
  'expedition-infantry': {
    id: 'expedition-infantry',
    name: 'Пехота экспедиции',
    shortName: 'Пехота',
    role: 'line',
    attack: 6,
    defense: 7,
    upkeepPerUnit: 0.25,
    description: 'Надёжная линейная пехота. Хорошо держит строй и составляет основу экспедиции.',
  },
  'expedition-rangers': {
    id: 'expedition-rangers',
    name: 'Следопыты экспедиции',
    shortName: 'Следопыты',
    role: 'ranged',
    attack: 8,
    defense: 4,
    upkeepPerUnit: 0.5,
    description: 'Лёгкие стрелки и разведчики. Бьют сильнее, но хуже держат прямое давление.',
  },
  'orssian-guard': {
    id: 'orssian-guard',
    name: 'Страж Орсии',
    shortName: 'Стражи',
    role: 'line',
    attack: 5,
    defense: 8,
    upkeepPerUnit: 0.2,
    description: 'Тяжёлые местные стражи. Слабее в наступлении, но устойчивы под давлением.',
  },
  'orssian-slingers': {
    id: 'orssian-slingers',
    name: 'Пращники Орсии',
    shortName: 'Пращники',
    role: 'ranged',
    attack: 7,
    defense: 3,
    upkeepPerUnit: 0.3,
    description: 'Лёгкие местные стрелки, опасные при удачном манёвре и уязвимые в прямом бою.',
  },
};
