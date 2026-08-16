import type { FactionTrait } from '@/core/leaders/LeaderAbility';
import type { RngStreamsState } from '@/core/rng/RngState';

export type FactionId = string;
export type CityId = string;
export type ArmyId = string;
export type NodeId = string;
export type LeaderId = string;
export type UnitTypeId = string;
export type StrategicActionKind = 'move' | 'attack' | 'recruit' | 'rest' | 'claim_root';

export type PendingFactionEventState = {
  eventId: string;
  factionId: FactionId;
  beneficiaryFactionId: FactionId;
};

export type ResourcesState = {
  money: number;
  supplies: number;
  specimens: number;
};

export type FactionState = {
  id: FactionId;
  superFactionId: string | null;
  resources: ResourcesState;
  specimensCollected: number;
  strategicActionSpent: boolean;
  lastStrategicAction: StrategicActionKind | null;
  leaderAbilityLastUsedTurn: number | null;
  traits: FactionTrait[];
};

export type ArmyRoster = Record<UnitTypeId, number>;

export type CityGarrisonState = {
  roster: ArmyRoster;
  morale: number;
};

export type CityState = {
  id: CityId;
  ownerFactionId: FactionId | null;
  garrison: CityGarrisonState;
  incomeMultiplier?: number;
};

export type ArmyState = {
  id: ArmyId;
  factionId: FactionId;
  nodeId: NodeId;
  morale: number;
  roster: ArmyRoster;
};

export type CampaignStatus = 'active' | 'victory' | 'defeat';
export type CampaignEndingReason = 'root_claimed' | 'rival_root_claimed' | 'army_destroyed';

export type CampaignState = {
  rootObtainedByFactionId: FactionId | null;
  pendingEventId: string | null;
  resolvedEventIds: string[];
  artifactIds: string[];
  activeArtifactIds: string[];
  cityArtifactClaimedIds: CityId[];
  pendingBriefingId: string | null;
  resolvedBriefingIds: string[];
  discoveredNodeIds: NodeId[];
  completedResearchIds: string[];
  pendingFactionEvent: PendingFactionEventState | null;
  resolvedFactionEventIds: string[];
  extensionLocationOrder: NodeId[];
  rivalOrganizationId: string;
  rivalLeaderId: LeaderId;
  status: CampaignStatus;
  endingReason: CampaignEndingReason | null;
  endedTurn: number | null;
};

export type GameState = {
  turn: number;
  playerFactionId: FactionId;
  selectedLeaderId: LeaderId;
  factions: Record<FactionId, FactionState>;
  cities: Record<CityId, CityState>;
  armies: Record<ArmyId, ArmyState>;
  campaign: CampaignState;
  rng: RngStreamsState;
};
