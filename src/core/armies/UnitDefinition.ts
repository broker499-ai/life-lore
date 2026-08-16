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
  singularFormation?: boolean;
};

export type UnitDefinitions = Record<UnitTypeId, UnitDefinition>;
