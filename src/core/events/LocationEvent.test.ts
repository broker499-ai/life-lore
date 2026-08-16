import { describe, expect, it } from 'vitest';
import { moveArmy } from '@/core/map/moveArmy';
import { resolveLocationEvent, triggerLocationEvent } from '@/core/events/LocationEvent';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeArtifacts } from '@/data/artifacts/prototypeArtifacts';
import { prototypeCampaignRules } from '@/data/campaign/prototypeRules';
import { prototypeEvents } from '@/data/events/prototypeEvents';
import { prototypeMap } from '@/data/map/prototypeMap';

function reachWarehouse(leaderId = 'artemios') {
  const state = createPrototypeGameState(42, leaderId);
  state.cities['moss-market'].ownerFactionId = 'expedition';
  const first = moveArmy(state, prototypeMap, { armyId: 'player-main', toNodeId: 'moss-market', supplyCost: 6 });
  if (!first.ok) throw new Error('expected first move');
  first.state.factions.expedition.strategicActionSpent = false;
  first.state.factions.expedition.lastStrategicAction = null;
  const second = moveArmy(first.state, prototypeMap, { armyId: 'player-main', toNodeId: 'warehouse-2', supplyCost: 6 });
  if (!second.ok) throw new Error('expected second move');
  return second.state;
}

describe('location events and artifacts', () => {
  it('triggers a POI event once and persists its resolution', () => {
    const arrived = reachWarehouse();
    const triggered = triggerLocationEvent(arrived, 'warehouse-2', prototypeEvents);
    expect(triggered.state.campaign.pendingEventId).toBe('warehouse-inventory');

    const resolved = resolveLocationEvent(
      triggered.state,
      {
        eventId: 'warehouse-inventory',
        choiceId: 'sign-act',
        factionId: 'expedition',
        armyId: 'player-main',
        supplyCap: prototypeCampaignRules.supplyCap,
        moraleCap: prototypeCampaignRules.moraleCap,
      },
      prototypeEvents,
      prototypeArtifacts,
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.campaign.resolvedEventIds).toContain('warehouse-inventory');
    expect(resolved.state.factions.expedition.resources.specimens).toBe(2);
    expect(triggerLocationEvent(resolved.state, 'warehouse-2', prototypeEvents).events).toHaveLength(0);
  });

  it('Vlados applies x1.5 to artifact acquisition effects', () => {
    const normal = triggerLocationEvent(reachWarehouse('artemios'), 'warehouse-2', prototypeEvents).state;
    const vlados = triggerLocationEvent(reachWarehouse('vlados'), 'warehouse-2', prototypeEvents).state;

    const resolve = (state: typeof normal) => resolveLocationEvent(
      state,
      {
        eventId: 'warehouse-inventory',
        choiceId: 'demand-bribe',
        factionId: 'expedition',
        armyId: 'player-main',
        supplyCap: prototypeCampaignRules.supplyCap,
        moraleCap: prototypeCampaignRules.moraleCap,
      },
      prototypeEvents,
      prototypeArtifacts,
    );

    const normalResult = resolve(normal);
    const vladosResult = resolve(vlados);
    if (!normalResult.ok || !vladosResult.ok) throw new Error('expected event resolution');
    expect(normalResult.state.factions.expedition.resources.money).toBe(138);
    expect(vladosResult.state.factions.expedition.resources.money).toBe(147);
    expect(vladosResult.state.campaign.artifactIds).toContain('apple-skeleton');
  });
});
