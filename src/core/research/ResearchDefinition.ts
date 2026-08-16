import type { FactionTrait } from '@/core/leaders/LeaderAbility';

export type ResearchCategory = 'flora' | 'fauna' | 'anomalies';

export type ResearchDefinition = {
  id: string;
  category: ResearchCategory;
  name: string;
  description: string;
  cost: number;
  prerequisiteIds: string[];
  effects: FactionTrait[];
  effectLabel: string;
};

export type ResearchDefinitions = Record<string, ResearchDefinition>;
