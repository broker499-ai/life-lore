# Stage 10 — Continuous battle playback

## Goal

Replace Stage 9's discrete timeout-driven frame stepping with a continuous animation clock while keeping `BattleSimulator` as the only source of combat results.

## Implemented

- one continuous visual battle clock built from the existing `BattlePresentationFrame[]`;
- `requestAnimationFrame` playback instead of one `setTimeout` per presentation frame;
- interpolation between every pair of presentation frames;
- smooth formation movement at browser refresh rate;
- continuous pressure-line movement;
- continuous low-amplitude deterministic unit motion between combat events;
- units fade/shrink progressively as casualties are reached rather than disappearing at a frame boundary;
- morale, unit count and accumulated losses interpolate continuously in the scoreboard;
- casualty markers are synchronized to the approach to a casualty event;
- ×1 / ×2 / ×4 advance the same clock at different rates;
- Pause resumes from the exact fractional position without jumping;
- the scrubber now seeks to any point in visual battle time, not just event indices;
- previous/next buttons seek to exact event boundaries;
- Skip still jumps directly to the authoritative final frame;
- `prefers-reduced-motion` still disables autoplay.

## Architecture

The flow remains:

`BattleSimulator -> BattleResult/Timeline -> BattlePresentation -> BattlePlaybackTrack -> renderer`

`BattlePlaybackTrack` contains presentation timing only. It cannot modify casualties, morale, winner, campaign state or RNG.

## Important distinction

There are now two times:

- **simulation time** (`BattleTimelineEvent.at`) — semantic time emitted by the combat simulator;
- **visual playback time** (`BattlePlaybackTrack.durationMs`) — compressed viewing duration used by the renderer.

The renderer interpolates simulation time across visual time. This allows a 60-second simulated gap to remain watchable without changing any battle result.

## Validation target

At visual playback end:

- unit totals equal `BattleResult.remainingUnits`;
- morale equals `BattleResult.moraleAfter`;
- total losses equal `BattleResult.totalLosses`;
- winner/outcomes remain unchanged;
- no RNG is consumed by visualization.

## Next combat stage

Stage 11 should add meaningful tactical geometry on top of the continuous clock:

- left / center / right sectors;
- front and rear lines;
- ranged units behind melee units;
- visible flank pressure;
- assault / cautious / flanking tactics represented by different formation trajectories;
- projectile/volley indicators generated in SVG, still without external assets.
