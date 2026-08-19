import type { UnitRole, UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { RngState } from '@/core/rng/RngState';
import type { ArmyRoster, FactionId } from '@/core/state/GameState';

export type BattleSideId = 'A' | 'B';
export type BattleScale = 'skirmish' | 'battle';
export type BattleTacticId = 'assault' | 'balanced' | 'cautious' | 'flank';
export type BattleOutcome = 'victory' | 'pyrrhic_victory' | 'retreat' | 'rout';
export type BattleLane = 'left' | 'center' | 'right';
export type BattleFormationId = 'line' | 'strong_center' | 'crescent';
export type BattleReservePercent = 0 | 15 | 30;
export type BattleCommandId = 'press_left' | 'press_center' | 'press_right' | 'general_assault' | 'hold_line' | 'none';

export type BattlePlan = {
  formation: BattleFormationId;
  reservePercent: BattleReservePercent;
  reserveTarget: BattleLane;
  /** The first command fires in round 2, the second in round 4. */
  commands: BattleCommandId[];
  /** If set, the side attempts an organized retreat at or below this morale. */
  retreatMoraleThreshold: number | null;
};

export const DEFAULT_BATTLE_PLAN: BattlePlan = {
  formation: 'line',
  reservePercent: 15,
  reserveTarget: 'center',
  commands: [],
  retreatMoraleThreshold: null,
};

export type BattleSectorSnapshot = {
  units: number;
  morale: number;
  broken: boolean;
};

export type BattleSideSectorSnapshot = {
  sectors: Record<BattleLane, BattleSectorSnapshot>;
  reserveUnits: number;
  reserveCommitted: boolean;
};

export type BattleSideInput = {
  factionId: FactionId;
  roster: ArmyRoster;
  morale: number;
  tactic: BattleTacticId;
  plan?: Partial<BattlePlan>;
  moraleDamageInflictedMultiplier?: number;
  moraleLossTakenMultiplier?: number;
  /** Locks all surviving sectors and the side's aggregate morale to this value. */
  moraleLockedAt?: number;
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
  plan: BattlePlan;
  sectorState: BattleSideSectorSnapshot;
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
      type: 'formation_set';
      side: BattleSideId;
      plan: BattlePlan;
      snapshot: BattleSideSectorSnapshot;
    }
  | {
      at: number;
      type: 'round_start';
      round: number;
    }
  | {
      at: number;
      type: 'command_order';
      round: number;
      side: BattleSideId;
      command: BattleCommandId;
    }
  | {
      at: number;
      type: 'reserve_committed';
      round: number;
      side: BattleSideId;
      lane: BattleLane;
      units: number;
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
      type: 'sector_status';
      round: number;
      side: BattleSideId;
      snapshot: BattleSideSectorSnapshot;
    }
  | {
      at: number;
      type: 'sector_break';
      round: number;
      side: BattleSideId;
      lane: BattleLane;
    }
  | {
      at: number;
      type: 'encirclement';
      round: number;
      side: BattleSideId;
    }
  | {
      at: number;
      type: 'organized_retreat';
      round: number;
      side: BattleSideId;
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
