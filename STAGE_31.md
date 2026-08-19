# Stage 31 — movement tap fix + Battle 2.0

## Map interaction regression

Stage 30 captured pointer events on the SVG to support one-finger panning and two-finger pinch zoom. On touch devices the browser-generated `click` could then be retargeted away from the original city node, so a visible adjacent city sometimes never became selected.

Stage 31 resolves a clean tap directly from the original pointer-down node on pointer-up. A pan or pinch is still treated purely as a camera gesture. Neighbor-list memoization also now depends on the active campaign graph, so unlocking the deep route cannot leave stale movement targets behind.

## Battle 2.0

Battles remain deterministic auto-battles, but the player now makes a small number of meaningful tactical decisions.

- Three real sectors: left flank, centre, right flank.
- Formations: line, strong centre, crescent.
- 0/15/30% reserve, committed in round 3 to a chosen sector.
- Ranged units are better on flanks; line units are better in the centre.
- The existing Flank tactic now changes sector pressure rather than being only a global multiplier.
- Breaking a flank lets its pressure support the centre; breaking both flanks creates encirclement with morale/defence penalties.
- Two live command pauses, before rounds 2 and 4. The player can press a sector, order a general assault, hold the line, or decline to intervene.
- Live commands are not cosmetic: the battle is deterministically re-simulated from the exact pre-battle GameState/RNG seed with the new command inserted, so everything before that decision remains unchanged and later consequences can change.
- Optional organized-retreat doctrine: retreat at morale 30 instead of waiting for a rout.
- Battle viewer shows sector unit counts, sector morale state, breaks, reserve status, commands and encirclement events.

Save format stays v17 because campaign GameState did not change.
