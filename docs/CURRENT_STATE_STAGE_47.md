# Current state — Stage 47

**Build:** 0.47.0  
**Save format:** v24

Stage 47 completes the outstanding Battle 3.0 UX pass without changing `GameState`.

## Newly completed

- large favorable battle events render green; unfavorable ones render red;
- dramatic overlays are queued and remain readable for ~1.3 seconds of real time even at ×4;
- interrupted rest uses an orange cracked `Z Z Z` glyph;
- assault/Natisk tactical glyphs use transparent PNG arrow assets; the enemy version is mirrored toward the player;
- live commands include lane-scoped `clear_left`, `clear_center`, `clear_right`;
- selecting a friendly lane and tapping the neutral contact strip returns only that lane to cautious fighting;
- the cautious reset has a real simulator effect and a visible `ОСТОРОЖНО` state;
- battle end now places a persistent `ПОБЕДА` / `ПОРАЖЕНИЕ` seal over the battlefield; exit becomes available after the player taps and dismisses it.

## Compatibility

No `GameState` fields changed. Existing v24 saves remain compatible and no migration was added. Legacy `none` battle commands are still accepted.

## Validation notes

- targeted TypeScript check of the modified battle/UI dependency graph passed with local external-module stubs;
- deterministic runtime smoke of `simulateBattle` passed for the new scoped clear command;
- `Math.random()` audit for `src/core`, `src/data`, `src/simulation` is clean;
- full npm dependency installation/build could not be performed in the packaging environment because the npm registry was unavailable/timed out.
