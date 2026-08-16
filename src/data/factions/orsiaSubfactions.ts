export const ORSIA_SUPER_FACTION_ID = 'orsia';

export type OrsiaSubfactionDefinition = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  mapClass: string;
};

export const orsiaSubfactions: OrsiaSubfactionDefinition[] = [
  {
    id: 'orsia-orcs',
    name: 'Орки',
    shortName: 'Орки',
    description: 'Крупнейшие традиционалисты Орсии. Предпочитают простые стены, тяжёлые дубины и сложные церемонии перед тем, как применить дубину.',
    mapClass: 'orsia-orcs',
  },
  {
    id: 'orsia-goblins',
    name: 'Гоблины',
    shortName: 'Гоблины',
    description: 'Торгово-инженерные общины, способные построить рынок, мост и схему ухода от налога раньше, чем экспедиция успеет разбить лагерь.',
    mapClass: 'orsia-goblins',
  },
  {
    id: 'orsia-nazbols',
    name: 'Нацболы',
    shortName: 'Нацболы',
    description: 'Громкая политико-военная субкультура Орсии. Отличаются большим количеством знамён, манифестов и крайне небольшим количеством согласованных манифестов.',
    mapClass: 'orsia-nazbols',
  },
  {
    id: 'orsia-tyranids',
    name: 'Тираниды',
    shortName: 'Тираниды',
    description: 'Колонии крайне коллективных существ. Орсийские чиновники считают их полноценной административной единицей, потому что так проще вести перепись.',
    mapClass: 'orsia-tyranids',
  },
  {
    id: 'orsia-fgushniki',
    name: 'ФГУшники',
    shortName: 'ФГУшники',
    description: 'Обитатели учреждений, ведомственных подвалов и коридоров без окон. Их владения начинаются там, где появляется табличка «посторонним вход воспрещён».',
    mapClass: 'orsia-fgushniki',
  },
];

export const orsiaSubfactionById = Object.fromEntries(
  orsiaSubfactions.map((faction) => [faction.id, faction]),
) as Record<string, OrsiaSubfactionDefinition>;
