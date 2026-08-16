export type FactionDefeatEventDefinition = {
  id: string;
  title: string;
  description: string;
  acknowledgeLabel: string;
};

export const factionDefeatEvents: Record<string, FactionDefeatEventDefinition> = {
  'nazbol-first-defeat': {
    id: 'nazbol-first-defeat',
    title: 'Лимоненко пришёл к неожиданному выводу',
    description:
      '«Ты против наших идеалов. Но ты сильный. Поэтому мы пойдём и убьёмся об твоих врагов, а выжившие сядут к тебе в тюрьму». После этого заявления руководство Нацболов считает вопрос о дальнейшей государственности закрытым.',
    acknowledgeLabel: 'Нуу... Окей?',
  },
};
