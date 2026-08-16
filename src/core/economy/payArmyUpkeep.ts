import type { UnitDefinitions } from '@/core/armies/UnitDefinition';
import { getArmySummary } from '@/core/armies/armyStats';
import type { CommandSuccess } from '@/core/commands/CommandResult';
import type { FactionId, GameState } from '@/core/state/GameState';

export type ArmyUpkeepEvent = {
  type: 'army_upkeep_paid';
  factionId: FactionId;
  amount: number;
  unpaid: number;
};

export function getFactionArmyUpkeep(
  state: GameState,
  unitDefinitions: UnitDefinitions,
  factionId: FactionId,
): number {
  const total = Object.values(state.armies).reduce((sum, army) => {
    if (army.factionId !== factionId) return sum;
    return sum + getArmySummary(army, unitDefinitions).upkeep;
  }, 0);
  return roundMoney(total);
}

export function payArmyUpkeep(
  state: GameState,
  unitDefinitions: UnitDefinitions,
): CommandSuccess<GameState, ArmyUpkeepEvent> {
  let nextFactions = state.factions;
  const events: ArmyUpkeepEvent[] = [];

  for (const faction of Object.values(state.factions)) {
    const due = getFactionArmyUpkeep(state, unitDefinitions, faction.id);
    if (due <= 0) continue;

    const amount = Math.min(faction.resources.money, due);
    const unpaid = roundMoney(due - amount);
    nextFactions = {
      ...nextFactions,
      [faction.id]: {
        ...faction,
        resources: {
          ...faction.resources,
          money: roundMoney(faction.resources.money - amount),
        },
      },
    };
    events.push({
      type: 'army_upkeep_paid',
      factionId: faction.id,
      amount: roundMoney(amount),
      unpaid,
    });
  }

  return {
    ok: true,
    state: { ...state, factions: nextFactions },
    events,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
