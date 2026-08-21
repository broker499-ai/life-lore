import type { BattleResult, BattleSideId, BattleTacticId } from '@/core/battles/BattleTypes';

export type BattleIdentityOverride = {
  name: string;
  leaderName?: string | null;
  portraitSrc?: string | null;
  hidePortrait?: boolean;
};

export type BattleReport = {
  cityId: string;
  result: BattleResult;
  attackerTactic: BattleTacticId;
  defenderTactic: BattleTacticId;
  kind?: 'standard' | 'recruitment_riot';
  identityOverrides?: Partial<Record<BattleSideId, BattleIdentityOverride>>;
};
