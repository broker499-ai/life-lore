import { describe, expect, it } from 'vitest';
import { attemptRecruitAtCity, getRecruitmentTerms } from '@/core/cities/recruitmentAttempt';
import { getEffectiveCityRecruitmentOffers } from '@/core/cities/cityTraits';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { prototypeCities } from '@/data/cities/prototypeCities';
import { prototypeBattleRules } from '@/data/battles/prototypeBattleRules';
import { prototypeUnits } from '@/data/units/prototypeUnits';

const offer = getEffectiveCityRecruitmentOffers(prototypeCities['outer-post']).find((item) => item.unitTypeId === 'expedition-infantry');
if (!offer) throw new Error('expected infantry offer');

describe('risk recruitment', () => {
  it('always accepts a safe recruitment amount', () => {
    const state = createPrototypeGameState(10, 'vlados');
    const result = attemptRecruitAtCity(state, {
      armyId: 'player-main', cityId: 'outer-post', offer, amount: offer.amount, moraleRestore: 4, moraleCap: 100,
    }, { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recruited).toBe(true);
    expect(result.state.campaign.recruitmentBlockedUntilTurnByCityId['outer-post']).toBe(state.turn + 3);
    expect(result.riot).toBe(false);
  });


  it('does not consume an unused action and can still be used after another action', () => {
    const fresh = createPrototypeGameState(11, 'vlados');
    const first = attemptRecruitAtCity(fresh, {
      armyId: 'player-main', cityId: 'outer-post', offer, amount: offer.amount, moraleRestore: 4, moraleCap: 100,
    }, { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.factions[first.state.playerFactionId].strategicActionSpent).toBe(false);

    const spent = createPrototypeGameState(12, 'vlados');
    spent.factions[spent.playerFactionId].strategicActionSpent = true;
    const second = attemptRecruitAtCity(spent, {
      armyId: 'player-main', cityId: 'outer-post', offer, amount: offer.amount, moraleRestore: 4, moraleCap: 100,
    }, { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.factions[second.state.playerFactionId].strategicActionSpent).toBe(true);
  });

  it('can trigger a deterministic easy riot beyond the safe limit and lock recruitment', () => {
    const terms = getRecruitmentTerms(offer, 99);
    let riot: Extract<ReturnType<typeof attemptRecruitAtCity>, { ok: true }> | null = null;
    for (let seed = 1; seed <= 120 && !riot; seed += 1) {
      const state = createPrototypeGameState(seed, 'vlados');
      const result = attemptRecruitAtCity(state, {
        armyId: 'player-main', cityId: 'outer-post', offer, amount: terms.maxAmount, moraleRestore: 4, moraleCap: 100,
      }, { unitDefinitions: prototypeUnits, battleRules: prototypeBattleRules });
      if (result.ok && result.riot) riot = result;
    }
    expect(riot).not.toBeNull();
    expect(riot?.battle).not.toBeNull();
    expect(riot?.state.campaign.recruitmentBlockedUntilTurnByCityId['outer-post']).toBe((riot?.state.turn ?? 0) + 5);
  });
});
