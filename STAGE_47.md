# Stage 47 — Battle event readability and result seal

Version: **0.47.0**  
Save format: **v24**

## Battle event readability

- Large tactical events are now explicitly favorable (**green**) or unfavorable (**red**) for the player.
- Their overlay lifetime is managed in real UI time rather than playback time: ×2/×4 can accelerate the simulation without shrinking an important message below roughly 1.3 seconds.
- Fast consecutive dramatic events are queued, so a later event cannot immediately overwrite an earlier one.
- The ordinary commentary strip also receives positive/danger coloring when the frame outcome is unambiguous.

## Tactical icons

- Assault/Natisk uses dedicated transparent PNG UI assets for the player and enemy instead of the old crossed SVG mark.
- Enemy assault art is mirrored toward the player's side.
- `rest_broken` is now an orange `Z Z Z` sleep mark cut by a large crack instead of `!`.

## Scoped cautious reset

New live battle commands:

- `clear_left`
- `clear_center`
- `clear_right`

They affect one lane only and return that lane to the default cautious local behavior. The old global `none` command remains accepted for backward compatibility.

Interaction:

1. tap a friendly lane;
2. tap the neutral strip around the contact line on the same lane;
3. that lane leaves Assault/Deep Defense and visibly becomes **ОСТОРОЖНО**.

The simulator applies a real cautious command profile rather than treating the UI state as cosmetic.

## Final result seal

At battle end the battlefield receives a large gothic stamp:

- **ПОБЕДА** — green/gold;
- **ПОРАЖЕНИЕ** — dark red.

It lands with impact/ring effects, stays until tapped, then fades. The normal map exit control becomes available only after the seal is dismissed.

## Save compatibility

`GameState` is unchanged, so the save format stays **v24** and no migration is required.
