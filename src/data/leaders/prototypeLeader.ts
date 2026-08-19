import type { FactionTrait } from '@/core/leaders/LeaderAbility';

export type LeaderDefinition = {
  id: string;
  name: string;
  abilityName: string;
  abilityDescription: string;
  portraitSrc: string;
  walkFrameSrcs: readonly string[];
  traits: FactionTrait[];
};

export const prototypeLeaders: LeaderDefinition[] = [
  {
    id: 'artemios',
    name: 'Артемиос',
    abilityName: 'Артем есть Артем',
    portraitSrc: '/assets/leaders/artemios.png',
    walkFrameSrcs: [
      '/assets/leaders/walk/artemios/frame-1.png',
      '/assets/leaders/walk/artemios/frame-2.png',
      '/assets/leaders/walk/artemios/frame-3.png',
    ],
    abilityDescription: 'Войска игнорируют систему морали: мораль экспедиции всегда равна 100 и не снижается от боёв, событий или разрыва снабжения.',
    traits: [{ type: 'ignore_morale' }],
  },
  {
    id: 'vlados',
    name: 'Владос',
    abilityName: 'Исследователь заброшек',
    portraitSrc: '/assets/leaders/vlados.png',
    walkFrameSrcs: [
      '/assets/leaders/walk/vlados/frame-1.png',
      '/assets/leaders/walk/vlados/frame-2.png',
      '/assets/leaders/walk/vlados/frame-3.png',
    ],
    abilityDescription: 'Эффекты найденных артефактов усилены на 50%. Система артефактов будет подключена позднее; бонус уже заложен в правила.',
    traits: [{ type: 'artifact_effect_multiplier', multiplier: 1.5 }],
  },
  {
    id: 'iliesh',
    name: 'Илиеш',
    abilityName: 'Картограф',
    portraitSrc: '/assets/leaders/iliesh.png',
    walkFrameSrcs: [
      '/assets/leaders/walk/iliesh/frame-1.png',
      '/assets/leaders/walk/iliesh/frame-2.png',
      '/assets/leaders/walk/iliesh/frame-3.png',
    ],
    abilityDescription: 'Сразу знает всю карту Орсии: туман войны не скрывает узлы, владельцев, гарнизоны и положение замеченных сил на стратегической карте.',
    traits: [{ type: 'map_revealed' }],
  },
  {
    id: 'layosh',
    name: 'Лайош',
    abilityName: 'Гребец хлебец',
    portraitSrc: '/assets/leaders/layosh.png',
    walkFrameSrcs: [
      '/assets/leaders/walk/layosh/frame-1.png',
      '/assets/leaders/walk/layosh/frame-2.png',
      '/assets/leaders/walk/layosh/frame-3.png',
    ],
    abilityDescription: 'Каждый третий ход после первого перемещения может выполнить ещё одно перемещение, используя подземные реки.',
    traits: [{ type: 'river_double_move', everyTurns: 3 }],
  },
  {
    id: 'makson',
    name: 'Максон',
    abilityName: 'Наземный флот',
    portraitSrc: '/assets/leaders/makson.png',
    walkFrameSrcs: [
      '/assets/leaders/walk/makson/frame-1.png',
      '/assets/leaders/walk/makson/frame-2.png',
      '/assets/leaders/walk/makson/frame-3.png',
    ],
    abilityDescription: 'Экспедиция полностью игнорирует систему припасов: переходы, штурмы и финальная операция не требуют припасов, а снабжение считается обеспеченным.',
    traits: [{ type: 'ignore_supply' }],
  },
];

export const prototypeLeaderById = Object.fromEntries(
  prototypeLeaders.map((leader) => [leader.id, leader]),
) as Record<string, LeaderDefinition>;

export const DEFAULT_LEADER_ID = 'vlados';
