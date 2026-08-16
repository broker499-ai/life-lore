import type { BattleResult, BattleTacticId } from '@/core/battles/BattleTypes';

export type BattleReport = {
  cityId: string;
  result: BattleResult;
  attackerTactic: BattleTacticId;
  defenderTactic: BattleTacticId;
};
