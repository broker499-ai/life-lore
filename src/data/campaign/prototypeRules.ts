export type RootAccessRule = {
  minControlledCities: number;
  minSpecimens: number;
  requiredResolvedEventId?: string;
  minTurn?: number;
};

export type RootObjectiveRules = {
  nodeId: string;
  stagingCityId: string;
  claimSupplyCost: number;
  player: RootAccessRule;
  rival: RootAccessRule;
};

export type CampaignRules = {
  moveSupplyCost: number;
  attackSupplyCost: number;
  supplyCap: number;
  moraleCap: number;
  recruitMoraleRestore: number;
  rootObjective: RootObjectiveRules;
};

export const prototypeCampaignRules: CampaignRules = {
  moveSupplyCost: 6,
  attackSupplyCost: 8,
  supplyCap: 100,
  moraleCap: 100,
  recruitMoraleRestore: 4,
  rootObjective: {
    nodeId: 'root-sanctum',
    stagingCityId: 'root-limit',
    claimSupplyCost: 12,
    player: {
      minControlledCities: 4,
      minSpecimens: 5,
      requiredResolvedEventId: 'almost-root-shop',
    },
    rival: {
      minControlledCities: 4,
      minSpecimens: 0,
      minTurn: 8,
    },
  },
};
