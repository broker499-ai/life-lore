import { getRosterTotalUnits } from '@/core/armies/armyStats';
import { hasUnlimitedStrategicActions, shouldSpendStrategicAction } from '@/core/dev/developerMode';
import type { CommandOutcome } from '@/core/commands/CommandResult';
import type { CityDefinitions } from '@/core/cities/CityDefinition';
import { getRootClaimCitySupplyMultiplier } from '@/core/cities/cityTraits';
import { factionIgnoresSupply, getRootClaimSupplyCostMultiplier, getRootSpecimenRequirementReduction, getSupplyActionCostMultiplier } from '@/core/leaders/LeaderAbility';
import type { GameState } from '@/core/state/GameState';
import type { RootAccessRule, RootObjectiveRules } from '@/data/campaign/prototypeRules';

export type RootRequirementProgress = {
  controlledCities: number;
  requiredCities: number;
  specimensAvailable: number;
  specimensCollected: number;
  requiredSpecimensCollected: number;
  requiredEventResolved: boolean;
  requiredEventId: string | null;
  turn: number;
  requiredTurn: number | null;
  controlsStagingCity: boolean;
  armyAtStagingCity: boolean;
  armyUnits: number;
};

export type RootClaimError =
  | 'campaign_finished'
  | 'army_not_found'
  | 'army_empty'
  | 'not_at_staging_city'
  | 'staging_city_not_controlled'
  | 'requirements_not_met'
  | 'strategic_action_spent'
  | 'insufficient_supplies';

export type RootClaimAvailability =
  | {
      canClaim: true;
      supplyCost: number;
      progress: RootRequirementProgress;
    }
  | {
      canClaim: false;
      reason: RootClaimError;
      supplyCost: number;
      progress: RootRequirementProgress;
    };

export function getRootClaimAvailability(
  state: GameState,
  input: { factionId: string; armyId: string; rules: RootObjectiveRules; cityDefinitions: CityDefinitions },
): RootClaimAvailability {
  const rule = getFactionRootRule(state, input.factionId, input.rules);
  const progress = getRootRequirementProgress(state, input.factionId, input.armyId, input.rules, rule);
  const faction = state.factions[input.factionId];
  const army = state.armies[input.armyId];
  const supplyCost = factionIgnoresSupply(state, input.factionId)
    ? 0
    : Math.max(0, Math.round(
        input.rules.claimSupplyCost *
          getSupplyActionCostMultiplier(state, input.factionId) *
          getRootClaimSupplyCostMultiplier(state, input.factionId) *
          getRootClaimCitySupplyMultiplier(
            state,
            input.cityDefinitions,
            input.factionId,
            input.rules.stagingCityId,
          ),
      ));

  if (state.campaign.status !== 'active' || state.campaign.rootObtainedByFactionId !== null) {
    return { canClaim: false, reason: 'campaign_finished', supplyCost, progress };
  }
  if (!army || army.factionId !== input.factionId) {
    return { canClaim: false, reason: 'army_not_found', supplyCost, progress };
  }
  if (progress.armyUnits <= 0) {
    return { canClaim: false, reason: 'army_empty', supplyCost, progress };
  }
  if (!progress.armyAtStagingCity) {
    return { canClaim: false, reason: 'not_at_staging_city', supplyCost, progress };
  }
  if (!progress.controlsStagingCity) {
    return { canClaim: false, reason: 'staging_city_not_controlled', supplyCost, progress };
  }
  if (!requirementsMet(progress)) {
    return { canClaim: false, reason: 'requirements_not_met', supplyCost, progress };
  }
  if (!faction) {
    return { canClaim: false, reason: 'army_not_found', supplyCost, progress };
  }
  if (faction.strategicActionSpent && !hasUnlimitedStrategicActions(state, input.factionId)) {
    return { canClaim: false, reason: 'strategic_action_spent', supplyCost, progress };
  }
  if (faction.resources.supplies < supplyCost) {
    return { canClaim: false, reason: 'insufficient_supplies', supplyCost, progress };
  }

  return { canClaim: true, supplyCost, progress };
}

export function claimRoot(
  state: GameState,
  input: { factionId: string; armyId: string; rules: RootObjectiveRules; cityDefinitions: CityDefinitions },
): CommandOutcome<
  GameState,
  RootClaimError,
  | { type: 'root_claimed'; factionId: string; nodeId: string }
  | { type: 'campaign_ended'; status: 'victory' | 'defeat'; reason: 'root_claimed' | 'rival_root_claimed'; turn: number }
> {
  const availability = getRootClaimAvailability(state, input);
  if (!availability.canClaim) return { ok: false, state, error: availability.reason };

  const faction = state.factions[input.factionId];
  if (!faction) return { ok: false, state, error: 'army_not_found' };
  const playerWon = input.factionId === state.playerFactionId;
  const status = playerWon ? 'victory' : 'defeat';
  const reason = playerWon ? 'root_claimed' : 'rival_root_claimed';

  const nextState: GameState = {
    ...state,
    factions: {
      ...state.factions,
      [input.factionId]: {
        ...faction,
        resources: {
          ...faction.resources,
          supplies: faction.resources.supplies - availability.supplyCost,
        },
        strategicActionSpent: shouldSpendStrategicAction(state, input.factionId),
        lastStrategicAction: 'claim_root',
      },
    },
    campaign: {
      ...state.campaign,
      rootObtainedByFactionId: input.factionId,
      pendingEventId: null,
      pendingBriefingId: null,
      status,
      endingReason: reason,
      endedTurn: state.turn,
    },
  };

  return {
    ok: true,
    state: nextState,
    events: [
      { type: 'root_claimed', factionId: input.factionId, nodeId: input.rules.nodeId },
      { type: 'campaign_ended', status, reason, turn: state.turn },
    ],
  };
}

export function getRootRequirementProgress(
  state: GameState,
  factionId: string,
  armyId: string,
  rules: RootObjectiveRules,
  rule = getFactionRootRule(state, factionId, rules),
): RootRequirementProgress {
  const faction = state.factions[factionId];
  const army = state.armies[armyId];
  const controlledCities = Object.values(state.cities).filter((city) => city.ownerFactionId === factionId).length;
  const requiredEventId = rule.requiredResolvedEventId ?? null;
  return {
    controlledCities,
    requiredCities: rule.minControlledCities,
    specimensAvailable: faction?.resources.specimens ?? 0,
    specimensCollected: faction?.specimensCollected ?? 0,
    requiredSpecimensCollected: Math.max(0, rule.minSpecimens - getRootSpecimenRequirementReduction(state, factionId)),
    requiredEventResolved: !requiredEventId || state.campaign.resolvedEventIds.includes(requiredEventId),
    requiredEventId,
    turn: state.turn,
    requiredTurn: rule.minTurn ?? null,
    controlsStagingCity: state.cities[rules.stagingCityId]?.ownerFactionId === factionId,
    armyAtStagingCity: army?.nodeId === rules.stagingCityId,
    armyUnits: army ? getRosterTotalUnits(army.roster) : 0,
  };
}

function getFactionRootRule(state: GameState, factionId: string, rules: RootObjectiveRules): RootAccessRule {
  return factionId === state.playerFactionId ? rules.player : rules.rival;
}

function requirementsMet(progress: RootRequirementProgress): boolean {
  if (progress.controlledCities < progress.requiredCities) return false;
  if (progress.specimensCollected < progress.requiredSpecimensCollected) return false;
  if (!progress.requiredEventResolved) return false;
  if (progress.requiredTurn !== null && progress.turn < progress.requiredTurn) return false;
  return true;
}
