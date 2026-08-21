# Stage 40 — Survival travel, risky recruitment & battle juice

## Travel without supplies
- Movement no longer hard-locks when supplies are below the movement cost.
- The expedition pays whatever supplies are left and records the shortfall.
- At the end of a turn, an army with zero supplies while outside a controlled/allied city suffers deterministic travel attrition: 3% of its current headcount, minimum 1 unit.
- Makson's **Наземный флот** remains fully exempt from the supply system and from this attrition.

## Short rests at POIs
- Every POI offers one **Короткий привал** per campaign.
- It restores up to +8 supplies and +4 morale/panic without spending the strategic action.
- The rest cannot be farmed by leaving and returning to the same POI.

## Recruitment 2.0
- Player-facing recruitment currently offers one troop type: expedition infantry.
- The player chooses headcount with a slider.
- A clearly marked safe limit is guaranteed to work.
- Moving beyond the safe mark becomes a seeded d100 recruitment gamble; the displayed chance declines gradually as the request grows.
- Successful risky recruitment hires the selected amount normally.
- Failure does not take the recruitment money and starts a light skirmish against local residents.
- The residents have no leader portrait/icon in the battle presentation.
- After a failed recruitment attempt, that city cannot recruit for 5 turns.

## Battle presentation
- x1 battle pacing is longer so banners and impacts can be read.
- Dramatic feedback appears more often on meaningful clashes.
- Every battle now has at least one noticeable blood effect; casualty-heavy frames can produce additional sprays.
- Tyranid and Lateki blood is pink; other currently supported factions use red blood.
- Reduced-motion preferences still suppress the most aggressive motion effects.

## Save compatibility
- Save version: v22.
- v21 saves migrate by adding POI short-rest history and per-city recruitment lock state.
