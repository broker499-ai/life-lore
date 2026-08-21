import type { UnitRole, UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { RngState } from '@/core/rng/RngState';
import type { ArmyRoster, FactionId } from '@/core/state/GameState';

export type BattleSideId = 'A' | 'B';
export type BattleScale = 'skirmish' | 'battle';
export type BattleTacticId = 'assault' | 'balanced' | 'cautious' | 'flank';
export type BattleOutcome = 'victory' | 'pyrrhic_victory' | 'retreat' | 'rout';
export type BattleLane = 'left' | 'center' | 'right';
export type BattleLanePosture = 'engage' | 'assault' | 'rest' | 'rest_broken' | 'cautious';
export type BattleFormationId = 'line' | 'strong_center' | 'crescent';
export type BattleReservePercent = 0 | 15 | 30;
export type BattleCommandId =
  | 'press_left'
  | 'press_center'
  | 'press_right'
  | 'general_assault'
  | 'hold_line'
  | 'flank_left_to_left'
  | 'flank_left_to_center'
  | 'flank_center_to_left'
  | 'flank_center_to_center'
  | 'flank_center_to_right'
  | 'flank_right_to_center'
  | 'flank_right_to_right'
  | 'defend_left'
  | 'defend_center'
  | 'defend_right'
  | 'clear_left'
  | 'clear_center'
  | 'clear_right'
  | 'none';

export type BattlePlan = {
  formation: BattleFormationId;
  reservePercent: BattleReservePercent;
  reserveTarget: BattleLane;
  /** Ordered live battle commands. By default legacy saves map the first two to rounds 2 and 4. */
  commands: BattleCommandId[];
  /** Optional actual rounds for live-issued commands. Legacy plans fall back to rounds 2 and 4. */
  commandRounds?: number[];
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
  /** Current local behavior. Enemy sectors visibly telegraph this to the player. */
  posture: BattleLanePosture;
};

export type BattleSideSectorSnapshot = {
  sectors: Record<BattleLane, BattleSectorSnapshot>;
  reserveUnits: number;
  reserveCommitted: boolean;
};

export type BattleSideInput = {
  factionId: FactionId;
  roster: ArmyRoster;
  /** Optional persistent pre-battle deployment. When present it overrides formation splitting for active troops. */
  laneRosters?: Partial<Record<BattleLane, ArmyRoster>>;
  morale: number;
  tactic: BattleTacticId;
  plan?: Partial<BattlePlan>;
  moraleDamageInflictedMultiplier?: number;
  moraleLossTakenMultiplier?: number;
  /** Locks all surviving sectors and the side's aggregate morale to this value. */
  moraleLockedAt?: number;
  casualtyTakenMultiplier?: number;
  unitPowerMultiplier?: number;
  unitTypePowerMultipliers?: Record<string, number>;
  randomMoraleGain?: { chancePercent: number; minGain: number; maxGain: number };
  /** Orc-style formation: all active units occupy the center; enemy flanks wrap around it. */
  centerOnlyFormation?: boolean;
  /** Seeded uneven force/morale distribution across the three sectors. */
  randomizeFlanks?: boolean;
  /** Each active lane chooses assault/rest/cautious behavior at the start of each battle stage. */
  reactiveLanePostures?: boolean;
  /** A lane that has already beaten its opposite number rests until redirected. */
  autoRestVictoriousLanes?: boolean;
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
  initialLaneRosters?: Record<BattleLane, ArmyRoster>;
  /** Units intentionally absent from the field until a stage-boundary arrival effect. */
  lateArrivalRoster?: ArmyRoster;
  remainingRoster: ArmyRoster;
  losses: ArmyRoster;
  initialUnits: number;
  remainingUnits: number;
  totalLosses: number;
  moraleBefore: number;
  moraleAfter: number;
  plan: BattlePlan;
  sectorState: BattleSideSectorSnapshot;
  centerOnlyFormation?: boolean;
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
      type: 'stage_transition';
      round: number;
      stage: 1 | 2 | 3 | 4;
    }
  | {
      at: number;
      type: 'lane_posture';
      round: number;
      side: BattleSideId;
      lane: BattleLane;
      posture: BattleLanePosture;
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
      cause?: 'destroyed' | 'morale' | 'panic_roll' | 'special';
      roll?: number;
      chance?: number;
    }
  | {
      at: number;
      type: 'late_flank_strike';
      round: number;
      side: BattleSideId;
      targetSide: BattleSideId;
      lane: BattleLane;
      unitTypeId: string;
      destroyedUnits: number;
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
