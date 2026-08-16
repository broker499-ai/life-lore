export type CampaignRules = {
  moveSupplyCost: number;
  attackSupplyCost: number;
  supplyCap: number;
  moraleCap: number;
};

export const prototypeCampaignRules: CampaignRules = {
  moveSupplyCost: 6,
  attackSupplyCost: 8,
  supplyCap: 100,
  moraleCap: 100,
};
