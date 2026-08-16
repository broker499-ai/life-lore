export type GameEvent =
  | { type: 'city_captured'; cityId: string; factionId: string }
  | { type: 'income_collected'; factionId: string; amount: number }
  | { type: 'army_upkeep_paid'; factionId: string; amount: number; unpaid: number }
  | {
      type: 'army_moved';
      armyId: string;
      fromNodeId: string;
      toNodeId: string;
      supplyCost: number;
      leaderAbilityId?: 'river_double_move';
    }
  | {
      type: 'army_retreated';
      armyId: string;
      fromNodeId: string;
      toNodeId: string | null;
    }
  | {
      type: 'army_rested';
      armyId: string;
      cityId: string;
      suppliesRestored: number;
      moraleRestored: number;
    }
  | {
      type: 'units_recruited';
      armyId: string;
      cityId: string;
      unitTypeId: string;
      amount: number;
      cost: number;
      moraleRestored: number;
    }
  | { type: 'battle_fought'; battleId: string; winnerFactionId: string | null }
  | { type: 'faction_defeat_event_triggered'; eventId: string; factionId: string; beneficiaryFactionId: string }
  | { type: 'faction_defeat_event_resolved'; eventId: string; factionId: string; beneficiaryFactionId: string; transferredCityIds: string[] }
  | { type: 'research_completed'; factionId: string; researchId: string; specimensSpent: number }
  | {
      type: 'ai_action_taken';
      factionId: string;
      action: 'attack' | 'move' | 'recruit' | 'hold';
      targetId?: string;
      score?: number;
    }
  | {
      type: 'supply_pressure_applied';
      armyId: string;
      factionId: string;
      supplyPercent: number;
      moraleLost: number;
    }
  | { type: 'location_event_triggered'; eventId: string; nodeId: string }
  | { type: 'location_event_resolved'; eventId: string; choiceId: string }
  | { type: 'artifact_acquired'; artifactId: string; multiplier: number; activated: boolean }
  | { type: 'artifact_loadout_changed'; artifactId: string; active: boolean }
  | { type: 'root_claimed'; factionId: string; nodeId: string }
  | {
      type: 'campaign_ended';
      status: 'victory' | 'defeat';
      reason: 'root_claimed' | 'rival_root_claimed' | 'army_destroyed';
      turn: number;
    }
  | { type: 'turn_ended'; turn: number };

export type CommandResult<TState, TEvent extends GameEvent = GameEvent> = {
  state: TState;
  events: TEvent[];
};

export type CommandFailure<TState, TError extends string> = {
  ok: false;
  state: TState;
  error: TError;
};

export type CommandSuccess<TState, TEvent extends GameEvent = GameEvent> =
  CommandResult<TState, TEvent> & {
    ok: true;
  };

export type CommandOutcome<
  TState,
  TError extends string,
  TEvent extends GameEvent = GameEvent,
> = CommandSuccess<TState, TEvent> | CommandFailure<TState, TError>;
