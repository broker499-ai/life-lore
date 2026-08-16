import type { BattleRules } from '@/core/battles/BattleTypes';

export const prototypeBattleRules: BattleRules = {
  scale: {
    skirmish: {
      maxRounds: 4,
      baseCasualtyRate: 0.075,
      timelineStepSeconds: 4,
    },
    battle: {
      maxRounds: 6,
      baseCasualtyRate: 0.055,
      timelineStepSeconds: 18,
    },
  },
  tactics: {
    assault: {
      attackMultiplier: 1.14,
      defenseMultiplier: 0.9,
      moraleLossMultiplier: 1.08,
      casualtyInflictedMultiplier: 1.08,
    },
    balanced: {
      attackMultiplier: 1,
      defenseMultiplier: 1,
      moraleLossMultiplier: 1,
      casualtyInflictedMultiplier: 1,
    },
    cautious: {
      attackMultiplier: 0.9,
      defenseMultiplier: 1.16,
      moraleLossMultiplier: 0.82,
      casualtyInflictedMultiplier: 0.9,
    },
    flank: {
      attackMultiplier: 1,
      defenseMultiplier: 0.94,
      moraleLossMultiplier: 1,
      casualtyInflictedMultiplier: 1.03,
      roleAttackMultipliers: {
        ranged: 1.18,
      },
    },
  },
  breakMoraleThreshold: 22,
  routRemainingRatio: 0.35,
  pyrrhicLossRatio: 0.38,
  pyrrhicMoraleThreshold: 30,
};
