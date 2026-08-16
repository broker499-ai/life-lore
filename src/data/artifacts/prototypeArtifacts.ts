import type { ArtifactDefinitions } from '@/core/artifacts/ArtifactDefinition';

export const prototypeArtifacts: ArtifactDefinitions = {
  'apple-skeleton': {
    id: 'apple-skeleton', name: 'Скелет яблока', rarity: 'rare',
    description: 'Высохший до невозможности яблочный огрызок со Склада №2. Заведующий настаивает, что это вещественное доказательство отсутствия Склада №1.',
    effects: [{ type: 'city_income_multiplier', multiplier: 1.18 }],
    effectLabel: 'Доход всех ваших городов +18%.',
  },
  'normal-juice-flask': {
    id: 'normal-juice-flask', name: 'Фляга совершенно нормального сока', rarity: 'rare',
    description: 'Берёзовый сок из Озера Нормального. Совершенно нормальный. Чем дольше это повторяешь, тем меньше хочется его пить.',
    effects: [{ type: 'supply_action_cost_multiplier', multiplier: 0.82 }],
    effectLabel: 'Расход припасов на движение, штурм и финальную операцию −18%.',
  },
  uboynastoyka: {
    id: 'uboynastoyka', name: 'Убойнастойка', rarity: 'rare',
    description: 'Настойка из кабинета -260. Этикетка рекомендует принимать внутрь, наружу и по обстоятельствам.',
    effects: [
      { type: 'battle_morale_loss_taken_multiplier', multiplier: 0.84 },
      { type: 'morale_damage_inflicted_multiplier', multiplier: 1.08 },
    ],
    effectLabel: 'Потери морали в бою −16%; урон морали противника +8%.',
  },
  'red-radish': {
    id: 'red-radish', name: 'Красная редиска', rarity: 'rare',
    description: 'Редиска с секретного этажа физфака. К ней прилагалась очень подробная инструкция о том, как её не раздавить.',
    effects: [{ type: 'battle_unit_power_multiplier', multiplier: 1.14 }],
    effectLabel: 'Боевая сила армии +14%.',
  },
  'vanilla-cartilage': {
    id: 'vanilla-cartilage', name: 'Ванильный хрящ', rarity: 'rare',
    description: 'Подобие мяса с пальмы в Неестественных джунглях. Пахнет ванилью, выглядит сомнительно и почему-то считается изыском.',
    effects: [
      { type: 'battle_unit_power_multiplier', multiplier: 1.09 },
      { type: 'army_upkeep_multiplier', multiplier: 0.92 },
    ],
    effectLabel: 'Боевая сила +9%; содержание армии −8%.',
  },
  'almost-grass': {
    id: 'almost-grass', name: 'Почти-трава', rarity: 'rare',
    description: 'Сувенир из места, где почти нашли Корень. Продавец гарантирует близость материала как минимум к чему-то растительному.',
    effects: [{ type: 'root_claim_supply_cost_multiplier', multiplier: 0.75 }],
    effectLabel: 'Стоимость финальной операции у Корня −25%.',
  },

  'shared-private-key': {
    id: 'shared-private-key', name: 'Общий ключ, который не общий', rarity: 'city',
    description: 'Ключ, который по документам принадлежит всем. Физически он всё время оказывается у одного человека.',
    effects: [{ type: 'supply_action_cost_multiplier', multiplier: 0.94 }],
    effectLabel: 'Расход припасов на стратегические действия −6%.',
  },
  'last-word-stone': {
    id: 'last-word-stone', name: 'Камень с последним словом', rarity: 'city',
    description: 'Если сказать рядом что-нибудь убедительное, камень повторит это ещё раз чуть громче.',
    effects: [{ type: 'morale_damage_inflicted_multiplier', multiplier: 1.08 }],
    effectLabel: 'Урон морали противника +8%.',
  },
  'econom-spoon': {
    id: 'econom-spoon', name: 'Ложка эконома', rarity: 'city',
    description: 'Алюминиевая ложка неизвестного выпуска. Её размеры заставляют подозревать, что порции раньше были серьёзнее.',
    effects: [{ type: 'army_upkeep_multiplier', multiplier: 0.93 }],
    effectLabel: 'Содержание армии −7%.',
  },
  'clean-towel': {
    id: 'clean-towel', name: 'Чистое полотенце', rarity: 'city',
    description: 'Настолько чистое полотенце, что часть экспедиции считает его главным чудом Орсии.',
    effects: [{ type: 'battle_morale_loss_taken_multiplier', multiplier: 0.94 }],
    effectLabel: 'Потери морали в бою −6%.',
  },
  'club-card': {
    id: 'club-card', name: 'Членский билет неизвестного клуба', rarity: 'city',
    description: 'Подтверждает ваше членство. В каком именно клубе — устав запрещает уточнять.',
    effects: [{ type: 'city_income_multiplier', multiplier: 1.08 }],
    effectLabel: 'Доход городов +8%.',
  },
  'passage-key': {
    id: 'passage-key', name: 'Ключ от прохода', rarity: 'city',
    description: 'Ключ от двери, за которой, по словам местных, совершенно точно нет никакого прохода.',
    effects: [{ type: 'supply_action_cost_multiplier', multiplier: 0.93 }],
    effectLabel: 'Расход припасов на стратегические действия −7%.',
  },
  'voluntary-slavery-contract': {
    id: 'voluntary-slavery-contract', name: 'Договор добровольного рабства', rarity: 'city',
    description: 'Подписан мелким шрифтом человеком, который очень хотел не быть отчисленным.',
    effects: [{ type: 'army_upkeep_multiplier', multiplier: 0.92 }],
    effectLabel: 'Содержание армии −8%.',
  },
  'wall-14b-moss': {
    id: 'wall-14b-moss', name: 'Мох сорта «Стена 14-Б»', rarity: 'city',
    description: 'Редкий выдержанный мох с подтверждённым происхождением и подозрительно уверенным послевкусием.',
    effects: [{ type: 'city_income_multiplier', multiplier: 1.10 }],
    effectLabel: 'Доход городов +10%.',
  },
  'permit-for-permit': {
    id: 'permit-for-permit', name: 'Разрешение на подачу разрешения', rarity: 'city',
    description: 'Даёт право подать заявление на получение документа, который позволит запросить настоящее разрешение.',
    effects: [{ type: 'city_income_multiplier', multiplier: 1.06 }],
    effectLabel: 'Доход городов +6%.',
  },
  'ownerless-gradebook': {
    id: 'ownerless-gradebook', name: 'Зачётка без владельца', rarity: 'city',
    description: 'Владелец неизвестен. Зачёты стоят. Подписи есть. Вопросы лучше не задавать.',
    effects: [{ type: 'battle_unit_power_multiplier', multiplier: 1.06 }],
    effectLabel: 'Боевая сила армии +6%.',
  },
  'root-bark-chip': {
    id: 'root-bark-chip', name: 'Осколок корневой коры', rarity: 'city',
    description: 'Кусок коры неизвестного происхождения. Чем ближе к центру Орсии, тем теплее он становится.',
    effects: [{ type: 'root_claim_supply_cost_multiplier', multiplier: 0.90 }],
    effectLabel: 'Стоимость финальной операции у Корня −10%.',
  },
  'cutlet-seven': {
    id: 'cutlet-seven', name: 'Неопознанная котлета №7', rarity: 'city',
    description: 'Хранилась в стратегическом холодильнике дольше, чем существует часть местных государственных институтов.',
    effects: [{ type: 'battle_morale_loss_taken_multiplier', multiplier: 0.92 }],
    effectLabel: 'Потери морали в бою −8%.',
  },
  'power-plumb': {
    id: 'power-plumb', name: 'Отвес вертикали власти', rarity: 'city',
    description: 'Показывает вертикаль даже в здании, где ни одна стена не согласна с геометрией.',
    effects: [{ type: 'morale_damage_inflicted_multiplier', multiplier: 1.07 }],
    effectLabel: 'Урон морали противника +7%.',
  },
  'ceiling-chip': {
    id: 'ceiling-chip', name: 'Обломок верхнего потолка', rarity: 'city',
    description: 'Кусок самого верхнего потолка среди всех нижних потолков. По крайней мере, так утверждает приложенный сертификат.',
    effects: [{ type: 'battle_unit_power_multiplier', multiplier: 1.05 }],
    effectLabel: 'Боевая сила армии +5%.',
  },

  'permanent-raw-cutlet': {
    id: 'permanent-raw-cutlet', name: 'Котлета постоянной сырости', rarity: 'rare',
    description: 'Котлета, которая провела в Печи №0 не меньше 63 лет и принципиально не считает это достаточной термообработкой.',
    effects: [{ type: 'battle_unit_power_multiplier', multiplier: 1.12 }],
    effectLabel: 'Боевая сила армии +12%.',
  },
  'dancing-cow': {
    id: 'dancing-cow', name: 'Танцующая корова', rarity: 'rare',
    description: 'Небольшая фигурка из Соляной кафедры. Если долго смотреть, корова меняет позу. Если отвернуться — ещё быстрее.',
    effects: [{ type: 'morale_damage_inflicted_multiplier', multiplier: 1.14 }],
    effectLabel: 'Урон морали противника +14%.',
  },
  'young-ancient-wine': {
    id: 'young-ancient-wine', name: 'Молодое древнее вино', rarity: 'rare',
    description: 'Бутылка из Погреба Обратного Брожения. Чем дольше её хранить, тем ближе она становится к виноградному соку.',
    effects: [{ type: 'battle_morale_loss_taken_multiplier', multiplier: 0.84 }],
    effectLabel: 'Потери морали в бою −16%.',
  },
  'meat-geology-matryoshka': {
    id: 'meat-geology-matryoshka', name: 'Матрёшка мясной геологии', rarity: 'rare',
    description: 'Пельмень, внутри которого пельмень, внутри которого пельмень. Геологи просят не задавать вопрос о мантии.',
    effects: [{ type: 'army_upkeep_multiplier', multiplier: 0.84 }],
    effectLabel: 'Содержание армии −16%.',
  },
  'still-hot-tea': {
    id: 'still-hot-tea', name: 'Чай, который ещё горячий', rarity: 'rare',
    description: 'Чашка, в которой чай не остывает ни при каких обстоятельствах. Вопрос о транспортировке решён хуже.',
    effects: [{ type: 'supply_action_cost_multiplier', multiplier: 0.84 }],
    effectLabel: 'Расход припасов на стратегические действия −16%.',
  },
  'yesterdays-soup': {
    id: 'yesterdays-soup', name: 'Вчерашний суп', rarity: 'rare',
    description: 'Кастрюля из Глубокого морозильника. Записка «НЕ ЕШЬ, ЭТО НА ЗАВТРА» старше нескольких династий.',
    effects: [
      { type: 'battle_unit_power_multiplier', multiplier: 1.08 },
      { type: 'battle_morale_loss_taken_multiplier', multiplier: 0.92 },
    ],
    effectLabel: 'Боевая сила +8%; потери морали в бою −8%.',
  },
  'oppressed-mandrake': {
    id: 'oppressed-mandrake', name: 'Угнетенная мандрагора', rarity: 'rare',
    description: 'Мандрагора, которой не дали высказаться. Она сохраняет крайне неодобрительное выражение корня.',
    effects: [
      { type: 'morale_damage_inflicted_multiplier', multiplier: 1.1 },
      { type: 'city_income_multiplier', multiplier: 1.08 },
    ],
    effectLabel: 'Урон морали противника +10%; доход городов +8%.',
  },
};
