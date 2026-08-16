import type { UnitRole, UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { RngState } from '@/core/rng/RngState';
import type { ArmyRoster, FactionId } from '@/core/state/GameState';

export type BattleSideId = 'A' | 'B';
export type BattleScale = 'skirmish' | 'battle';
export type BattleTacticId = 'assault' | 'balanced' | 'cautious' | 'flank';
export type BattleOutcome = 'victory' | 'pyrrhic_victory' | 'retreat' | 'rout';

export type BattleSideInput = {
  factionId: FactionId;
  roster: ArmyRoster;
  morale: number;
  tactic: BattleTacticId;
  moraleDamageInflictedMultiplier?: number;
  moraleLossTakenMultiplier?: number;
  casualtyTakenMultiplier?: number;
  unitPowerMultiplier?: number;
  randomMoraleGain?: { chancePercent: number; minGain: number; maxGain: number };
};

export type BattleInput = {
  battleId: string;
  scale: BattleScale;
  sideA: BattleSideInput;
  sideB: BattleSideInput;
};

export type BattleScaleRule = {
  maxRounds: number;
  baseCasualtyRate: number;
  timelineStepSeconds: number;
};

export type BattleTacticRule = {
  attackMultiplier: number;
  defenseMultiplier: number;
  moraleLossMultiplier: number;
  casualtyInflictedMultiplier: number;
  casualtyTakenAtParityMultiplier: number;
  casualtyTakenAtSuperiorMultiplier: number;
  prolongedMoraleLossStartRound?: number;
  prolongedMoraleLossMultiplier?: number;
  roleAttackMultipliers?: Partial<Record<UnitRole, number>>;
};

export type BattleRules = {
  scale: Record<BattleScale, BattleScaleRule>;
  tactics: Record<BattleTacticId, BattleTacticRule>;
  superiorityFullEffectRatio: number;
  breakMoraleThreshold: number;
  routRemainingRatio: number;
  pyrrhicLossRatio: number;
  pyrrhicMoraleThreshold: number;
};

export type BattleSideResult = {
  factionId: FactionId;
  outcome: BattleOutcome;
  initialRoster: ArmyRoster;
  remainingRoster: ArmyRoster;
  losses: ArmyRoster;
  initialUnits: number;
  remainingUnits: number;
  totalLosses: number;
  moraleBefore: number;
  moraleAfter: number;
};

export type BattleResult = {
  battleId: string;
  scale: BattleScale;
  winnerSide: BattleSideId | null;
  winnerFactionId: FactionId | null;
  roundsFought: number;
  sides: Record<BattleSideId, BattleSideResult>;
  timeline: BattleTimelineEvent[];
  rngState: RngState;
};

export type BattleTimelineEvent =
  | {
      at: number;
      type: 'battle_start';
      battleId: string;
      scale: BattleScale;
    }
  | {
      at: number;
      type: 'round_start';
      round: number;
    }
  | {
      at: number;
      type: 'combat_roll';
      round: number;
      side: BattleSideId;
      roll: number;
    }
  | {
      at: number;
      type: 'casualties';
      round: number;
      side: BattleSideId;
      losses: ArmyRoster;
      totalLosses: number;
    }
  | {
      at: number;
      type: 'morale_change';
      round: number;
      side: BattleSideId;
      before: number;
      after: number;
    }
  | {
      at: number;
      type: 'line_break';
      round: number;
      side: BattleSideId;
    }
  | {
      at: number;
      type: 'battle_end';
      winnerSide: BattleSideId | null;
      winnerFactionId: FactionId | null;
    };

export type BattleSimulationDependencies = {
  unitDefinitions: UnitDefinitions;
  rules: BattleRules;
};
