import type { FactionTrait } from '@/core/leaders/LeaderAbility';

export type LeaderDefinition = {
  id: string;
  name: string;
  abilityName: string;
  abilityDescription: string;
  traits: FactionTrait[];
};

export const prototypeLeaders: LeaderDefinition[] = [
  {
    id: 'artemios',
    name: 'Артемиос',
    abilityName: 'Артем есть Артем',
    abilityDescription: 'Войска полностью игнорируют систему припасов: перемещение и штурмы не тратят припасы, а разрыв снабжения не снижает мораль.',
    traits: [{ type: 'ignore_supply' }],
  },
  {
    id: 'vlados',
    name: 'Владос',
    abilityName: 'Исследователь заброшек',
    abilityDescription: 'Эффекты найденных артефактов усилены на 50%. Система артефактов будет подключена позднее; бонус уже заложен в правила.',
    traits: [{ type: 'artifact_effect_multiplier', multiplier: 1.5 }],
  },
  {
    id: 'iliesh',
    name: 'Илиеш',
    abilityName: 'Картограф',
    abilityDescription: 'Сразу знает всю карту Орсии. Пока тумана войны нет, эффект визуально нейтрален; при его появлении карта останется открытой.',
    traits: [{ type: 'map_revealed' }],
  },
  {
    id: 'layosh',
    name: 'Лайош',
    abilityName: 'Гребец хлебец',
    abilityDescription: 'Каждый третий ход после первого перемещения может выполнить ещё одно перемещение, используя подземные реки.',
    traits: [{ type: 'river_double_move', everyTurns: 3 }],
  },
  {
    id: 'makson',
    name: 'Максон',
    abilityName: 'Бассбустед',
    abilityDescription: 'Противник получает на 25% больше урона по морали от атак армии Максона.',
    traits: [{ type: 'morale_damage_inflicted_multiplier', multiplier: 1.25 }],
  },
];

export const prototypeLeaderById = Object.fromEntries(
  prototypeLeaders.map((leader) => [leader.id, leader]),
) as Record<string, LeaderDefinition>;

export const DEFAULT_LEADER_ID = 'vlados';
