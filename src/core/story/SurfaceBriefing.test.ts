import { describe, expect, it } from 'vitest';
import { acknowledgeSurfaceBriefing, triggerAvailableSurfaceBriefing, triggerSurfaceBriefingById } from '@/core/story/SurfaceBriefing';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { ROOT_PRIORITY_BRIEFING_ID, prototypeSurfaceBriefings } from '@/data/story/prototypeSurfaceBriefings';

describe('surface briefings', () => {
  it('triggers the first directive only after the first artifact exists', () => {
    const state = createPrototypeGameState(42);
    expect(triggerAvailableSurfaceBriefing(state, prototypeSurfaceBriefings).campaign.pendingBriefingId).toBeNull();
    state.campaign.artifactIds.push('apple-skeleton');
    const triggered = triggerAvailableSurfaceBriefing(state, prototypeSurfaceBriefings);
    expect(triggered.campaign.pendingBriefingId).toBe('surface-artifact-directive');
  });

  it('persists acknowledgement and supports the manual Root message', () => {
    const state = createPrototypeGameState(42);
    const root = triggerSurfaceBriefingById(state, ROOT_PRIORITY_BRIEFING_ID, prototypeSurfaceBriefings);
    expect(root.campaign.pendingBriefingId).toBe(ROOT_PRIORITY_BRIEFING_ID);
    const resolved = acknowledgeSurfaceBriefing(root, ROOT_PRIORITY_BRIEFING_ID);
    expect(resolved.campaign.pendingBriefingId).toBeNull();
    expect(resolved.campaign.resolvedBriefingIds).toContain(ROOT_PRIORITY_BRIEFING_ID);
    expect(triggerSurfaceBriefingById(resolved, ROOT_PRIORITY_BRIEFING_ID, prototypeSurfaceBriefings)).toBe(resolved);
  });
});
