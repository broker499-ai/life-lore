import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import type { GameEvent, CommandSuccess } from '@/core/commands/CommandResult';
import type { CityDefinitions } from '@/core/cities/CityDefinition';
import { collectCityIncome } from '@/core/economy/collectCityIncome';
import { payArmyUpkeep } from '@/core/economy/payArmyUpkeep';
import type { FactionState, GameState } from '@/core/state/GameState';
import { resolveOverdueUnoccupiedTyranidClutches } from '@/core/cities/tyranidEggClutch';
import { addArmyGroup } from '@/core/armies/armyFlanks';

export type EndTurnInput = {
  cityDefinitions: CityDefinitions;
  unitDefinitions: UnitDefinitions;
};

export function endTurn(
  state: GameState,
  input: EndTurnInput,
): CommandSuccess<GameState, GameEvent> {
  const income = collectCityIncome(state, input.cityDefinitions);
  const upkeep = payArmyUpkeep(income.state, input.unitDefinitions, input.cityDefinitions);
  const passive = applyPassiveSupplyProduction(upkeep.state, input.unitDefinitions);
  const factions = Object.fromEntries(
    Object.entries(passive.state.factions).map(([factionId, faction]) => [
      factionId,
      resetFactionAction(faction),
    ]),
  ) as GameState['factions'];

  const advancedState: GameState = {
    ...passive.state,
    turn: state.turn + 1,
    factions,
  };
  const arrivals = resolveReinforcementArrivals(advancedState, input.unitDefinitions);

  return {
    ok: true,
    state: resolveOverdueUnoccupiedTyranidClutches(arrivals.state),
    events: [...income.events, ...upkeep.events, ...passive.events, ...arrivals.events, { type: 'turn_ended', turn: state.turn }],
  };
}

function applyPassiveSupplyProduction(state: GameState, unitDefinitions: UnitDefinitions): { state: GameState; events: GameEvent[] } {
  const producedByFaction: Record<string, number> = {};
  for (const army of Object.values(state.armies)) {
    let produced = 0;
    for (const [unitTypeId, amount] of Object.entries(army.roster)) {
      produced += amount * (unitDefinitions[unitTypeId]?.passiveSuppliesPerTurn ?? 0);
    }
    if (produced > 0) producedByFaction[army.factionId] = (producedByFaction[army.factionId] ?? 0) + produced;
  }
  let factions = state.factions;
  const events: GameEvent[] = [];
  for (const [factionId, raw] of Object.entries(producedByFaction)) {
    const amount = Math.max(1, Math.round(raw));
    const faction = factions[factionId];
    if (!faction) continue;
    factions = {
      ...factions,
      [factionId]: { ...faction, resources: { ...faction.resources, supplies: faction.resources.supplies + amount } },
    };
    events.push({ type: 'passive_supplies_produced', factionId, amount });
  }
  return { state: factions === state.factions ? state : { ...state, factions }, events };
}

function resolveReinforcementArrivals(state: GameState, unitDefinitions: UnitDefinitions): { state: GameState; events: GameEvent[] } {
  const arriving = state.campaign.pendingReinforcements.filter((item) => item.arrivalTurn <= state.turn);
  if (arriving.length === 0) return { state, events: [] };
  const remaining = state.campaign.pendingReinforcements.filter((item) => item.arrivalTurn > state.turn);
  let armies = state.armies;
  const events: GameEvent[] = [];
  for (const item of arriving) {
    const army = armies[item.armyId];
    if (!army) continue;
    const batchRoster = item.roster ?? { [item.unitTypeId]: item.amount };
    armies = {
      ...armies,
      [army.id]: addArmyGroup(army, batchRoster, unitDefinitions, {
        id: item.groupId ?? item.id,
        unique: item.unique ?? Boolean(unitDefinitions[item.unitTypeId]?.isUnique),
      }),
    };
    events.push({ type: 'reinforcements_arrived', armyId: army.id, unitTypeId: item.unitTypeId, amount: item.amount, sourceCityId: item.sourceCityId });
  }
  return {
    state: { ...state, armies, campaign: { ...state.campaign, pendingReinforcements: remaining } },
    events,
  };
}

function resetFactionAction(faction: FactionState): FactionState {
  if (!faction.strategicActionSpent && faction.lastStrategicAction === null) return faction;
  return { ...faction, strategicActionSpent: false, lastStrategicAction: null };
}
