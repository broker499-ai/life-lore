export const MODIFIER_TARGETS = [
  'city.income',
  'recruitment.cost',
  'army.upkeep',
  'supplies.consumption',
  'specimens.yield',
  'unit.infantry.power',
  'battle.moraleLoss',
] as const;

export type ModifierTarget = (typeof MODIFIER_TARGETS)[number];

export type Modifier = {
  target: ModifierTarget;
  op: 'add' | 'mul';
  value: number;
  source: string;
};
