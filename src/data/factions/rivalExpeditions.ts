export const RIVAL_FACTION_ID = 'rival-expedition';

export type RivalExpeditionDefinition = {
  id: string;
  name: string;
  shortName: string;
  description: string;
};

export const rivalExpeditions: RivalExpeditionDefinition[] = [
  {
    id: 'gospol',
    name: 'Госпол',
    shortName: 'Госпол',
    description: 'Конкурирующая экспедиционная структура с крайне серьёзным отношением к печатям, допускам и чужим находкам.',
  },
  {
    id: 'rospol',
    name: 'Роспол',
    shortName: 'Роспол',
    description: 'Полевое объединение, которое считает любую пещеру временным подразделением до окончания экспедиции.',
  },
  {
    id: 'ispu',
    name: 'ИСПУ',
    shortName: 'ИСПУ',
    description: 'Исследовательская экспедиция с внушительным штатом методистов и неожиданно боеспособным хозяйственным отделом.',
  },
  {
    id: 'socpsy',
    name: 'Соцпсих',
    shortName: 'Соцпсих',
    description: 'Конкуренты, измеряющие мораль, тревогу и готовность респондентов уступить город в пользу науки.',
  },
  {
    id: 'istoter',
    name: 'Истотер',
    shortName: 'Истотер',
    description: 'Историко-теоретическая экспедиция, уверенная, что Корень уже был описан в утраченном приложении к ещё более утраченному отчёту.',
  },
];

export const rivalExpeditionById = Object.fromEntries(
  rivalExpeditions.map((faction) => [faction.id, faction]),
) as Record<string, RivalExpeditionDefinition>;
