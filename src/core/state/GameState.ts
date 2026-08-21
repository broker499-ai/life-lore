import type { FactionTrait } from '@/core/leaders/LeaderAbility';
import type { RngStreamsState } from '@/core/rng/RngState';

export type FactionId = string;
export type CityId = string;
export type ArmyId = string;
export type NodeId = string;
export type LeaderId = string;
export type UnitTypeId = string;
export type ArmyRoster = Record<UnitTypeId, number>;
export type ArmyFlankId = 'left' | 'center' | 'right';
export type ArmyGroupState = {
  id: string;
  flank: ArmyFlankId;
  roster: ArmyRoster;
  unique: boolean;
};
export type StrategicActionKind = 'move' | 'attack' | 'recruit' | 'rest' | 'claim_root';

export type TyranidEggClutchState = {
  cityId: CityId;
  tyranidFactionId: FactionId;
  capturedTurn: number;
  deadlineTurn: number;
};


export type PendingReinforcementState = {
  id: string;
  sourceCityId: CityId;
  armyId: ArmyId;
  unitTypeId: UnitTypeId;
  amount: number;
  arrivalTurn: number;
  /** Full recruitment batch, used for multi-unit unique groups such as Greg + spiders. */
  roster?: ArmyRoster;
  groupId?: string;
  unique?: boolean;
};

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
  /** Persistent recruitment groups and their pre-battle flank assignment. */
  groups?: ArmyGroupState[];
};

export type CampaignStatus = 'active' | 'victory' | 'defeat';
export type CampaignEndingReason = 'root_claimed' | 'rival_root_claimed' | 'army_destroyed';

export type CampaignState = {
  developerMode: boolean;
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
  tyranidEggClutches: Record<CityId, TyranidEggClutchState>;
  shortRestUsedNodeIds: NodeId[];
  recruitmentBlockedUntilTurnByCityId: Record<CityId, number>;
  cityRecruitmentUnitIds: Record<CityId, UnitTypeId[]>;
  uniqueUnitCityIds: Record<UnitTypeId, CityId>;
  recruitedUniqueUnitIds: UnitTypeId[];
  siriusBossCityId: CityId;
  siriusDefeated: boolean;
  pendingReinforcements: PendingReinforcementState[];
  homeRecruitmentRecoveryTurnByUnitId: Record<UnitTypeId, number>;
  gregJenkinsVictories: number;
  preRootLayoutId: string;
  preRootLocationOrder: NodeId[];
  extensionLocationOrder: NodeId[];
  factionCapitalCityIds: Record<FactionId, CityId>;
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
