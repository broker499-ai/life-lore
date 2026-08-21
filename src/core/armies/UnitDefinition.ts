import type { UnitTypeId } from '@/core/state/GameState';

export type UnitRole = 'line' | 'ranged';

export type UnitDefinition = {
  id: UnitTypeId;
  name: string;
  shortName: string;
  role: UnitRole;
  attack: number;
  defense: number;
  upkeepPerUnit: number;
  description: string;
  /** Unique named unit; all unique recruitment groups share one flank. */
  isUnique?: boolean;
  /** Number of enemy flanks forced into Rest for the whole battle while this unit participates. */
  enemyForcedRestLanes?: number;
  singularFormation?: boolean;
  /** Occupies the whole center sector alone; other regular units deploy to the side flanks. */
  replacesEntireLane?: boolean;
  /** Locks the local sector morale while this unit survives there. */
  laneMoraleLockedAt?: number;
  /** Supplies generated passively at the end of each turn per surviving unit. */
  passiveSuppliesPerTurn?: number;
  /** Extra enemy casualties caused when one of these units dies. */
  deathRetaliationFactor?: number;
  /** Unit stays out of the line until the final third of the battle, then strikes. */
  lateFlankDestroyer?: boolean;
  /** Fraction of the side's battle losses returned after the fight while this unit survives. */
  casualtyRecoveryFraction?: number;
};

export type UnitDefinitions = Record<UnitTypeId, UnitDefinition>;
