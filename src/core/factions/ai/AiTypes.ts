import type { BattleTacticId } from '@/core/battles/BattleTypes';
import type { RecruitmentOffer } from '@/core/cities/CityDefinition';

export type AiAttackAction = {
  type: 'attack';
  cityId: string;
  tactic: BattleTacticId;
  score: number;
  strengthRatio: number;
};

export type AiMoveAction = {
  type: 'move';
  toNodeId: string;
  score: number;
};

export type AiRecruitAction = {
  type: 'recruit';
  cityId: string;
  offer: RecruitmentOffer;
  score: number;
};

export type AiHoldAction = {
  type: 'hold';
  score: number;
  reason: 'no_army' | 'action_spent' | 'no_viable_action';
};

export type AiAction = AiAttackAction | AiMoveAction | AiRecruitAction | AiHoldAction;
