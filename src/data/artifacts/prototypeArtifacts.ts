import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';

export const prototypeArtifacts: ArtifactDefinitions = {
  'apple-skeleton': {
    id: 'apple-skeleton',
    name: 'Скелет яблока',
    description: 'Высохший до невозможности яблочный огрызок со Склада №2. Заведующий настаивает, что это вещественное доказательство отсутствия Склада №1.',
    effects: [{ type: 'money', amount: 18 }],
  },
  'normal-juice-flask': {
    id: 'normal-juice-flask',
    name: 'Фляга совершенно нормального сока',
    description: 'Берёзовый сок из Озера Нормального. Совершенно нормальный. Чем дольше это повторяешь, тем меньше хочется его пить.',
    effects: [
      { type: 'supplies', amount: 12 },
      { type: 'specimens', amount: 2 },
    ],
  },
  uboynastoyka: {
    id: 'uboynastoyka',
    name: 'Убойнастойка',
    description: 'Настойка из кабинета -260. Этикетка рекомендует принимать внутрь, наружу и по обстоятельствам.',
    effects: [
      { type: 'morale', amount: 8 },
      { type: 'specimens', amount: 1 },
    ],
  },
  'red-radish': {
    id: 'red-radish',
    name: 'Красная редиска',
    description: 'Редиска с секретного этажа физфака. К ней прилагалась очень подробная инструкция о том, как её не раздавить.',
    effects: [
      { type: 'morale', amount: 6 },
      { type: 'specimens', amount: 3 },
    ],
  },
  'vanilla-cartilage': {
    id: 'vanilla-cartilage',
    name: 'Ванильный хрящ',
    description: 'Подобие мяса с пальмы в Неестественных джунглях. Пахнет ванилью, выглядит сомнительно и почему-то считается изыском.',
    effects: [{ type: 'money', amount: 20 }],
  },
  'almost-grass': {
    id: 'almost-grass',
    name: 'Почти-трава',
    description: 'Сувенир из места, где почти нашли Корень. Продавец гарантирует близость материала как минимум к чему-то растительному.',
    effects: [{ type: 'specimens', amount: 4 }],
  },

  'shared-private-key': {
    id: 'shared-private-key',
    name: 'Общий ключ, который не общий',
    description: 'Ключ, который по документам принадлежит всем. Физически он всё время оказывается у одного человека.',
    effects: [{ type: 'specimens', amount: 2 }],
  },
  'last-word-stone': {
    id: 'last-word-stone',
    name: 'Камень с последним словом',
    description: 'Если сказать рядом что-нибудь убедительное, камень повторит это ещё раз чуть громче.',
    effects: [{ type: 'morale', amount: 6 }],
  },
  'econom-spoon': {
    id: 'econom-spoon',
    name: 'Ложка эконома',
    description: 'Алюминиевая ложка неизвестного выпуска. Её размеры заставляют подозревать, что порции раньше были серьёзнее.',
    effects: [{ type: 'supplies', amount: 10 }],
  },
  'clean-towel': {
    id: 'clean-towel',
    name: 'Чистое полотенце',
    description: 'Настолько чистое полотенце, что часть экспедиции считает его главным чудом Орсии.',
    effects: [
      { type: 'supplies', amount: 8 },
      { type: 'morale', amount: 4 },
    ],
  },
  'club-card': {
    id: 'club-card',
    name: 'Членский билет неизвестного клуба',
    description: 'Подтверждает ваше членство. В каком именно клубе — устав запрещает уточнять.',
    effects: [{ type: 'money', amount: 12 }],
  },
  'passage-key': {
    id: 'passage-key',
    name: 'Ключ от прохода',
    description: 'Ключ от двери, за которой, по словам местных, совершенно точно нет никакого прохода.',
    effects: [{ type: 'supplies', amount: 6 }],
  },
  'voluntary-slavery-contract': {
    id: 'voluntary-slavery-contract',
    name: 'Договор добровольного рабства',
    description: 'Подписан мелким шрифтом человеком, который очень хотел не быть отчисленным.',
    effects: [{ type: 'money', amount: 16 }],
  },
  'wall-14b-moss': {
    id: 'wall-14b-moss',
    name: 'Мох сорта «Стена 14-Б»',
    description: 'Редкий выдержанный мох с подтверждённым происхождением и подозрительно уверенным послевкусием.',
    effects: [{ type: 'money', amount: 14 }],
  },
  'permit-for-permit': {
    id: 'permit-for-permit',
    name: 'Разрешение на подачу разрешения',
    description: 'Даёт право подать заявление на получение документа, который позволит запросить настоящее разрешение.',
    effects: [{ type: 'specimens', amount: 2 }],
  },
  'ownerless-gradebook': {
    id: 'ownerless-gradebook',
    name: 'Зачётка без владельца',
    description: 'Владелец неизвестен. Зачёты стоят. Подписи есть. Вопросы лучше не задавать.',
    effects: [{ type: 'specimens', amount: 3 }],
  },
  'root-bark-chip': {
    id: 'root-bark-chip',
    name: 'Осколок корневой коры',
    description: 'Кусок коры неизвестного происхождения. Чем ближе к центру Орсии, тем теплее он становится.',
    effects: [{ type: 'specimens', amount: 4 }],
  },
  'cutlet-seven': {
    id: 'cutlet-seven',
    name: 'Неопознанная котлета №7',
    description: 'Хранилась в стратегическом холодильнике дольше, чем существует часть местных государственных институтов.',
    effects: [
      { type: 'supplies', amount: 10 },
      { type: 'specimens', amount: 1 },
    ],
  },
  'power-plumb': {
    id: 'power-plumb',
    name: 'Отвес вертикали власти',
    description: 'Показывает вертикаль даже в здании, где ни одна стена не согласна с геометрией.',
    effects: [{ type: 'money', amount: 15 }],
  },
  'ceiling-chip': {
    id: 'ceiling-chip',
    name: 'Обломок верхнего потолка',
    description: 'Кусок самого верхнего потолка среди всех нижних потолков. По крайней мере, так утверждает приложенный сертификат.',
    effects: [{ type: 'morale', amount: 5 }],
  },
};
