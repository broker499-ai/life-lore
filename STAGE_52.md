# Stage 52 — distinct campaign maps + landscape battle rebuild

Version: **v0.52.0**  
Save format: **v25** (unchanged)

## First-section campaign layouts

New campaigns now seed one of seven deliberately different topologies:

1. `ridge` — «Хребет»: readable main spine with lateral pockets.
2. `delta` — «Дельта»: broad routes repeatedly split and reconverge.
3. `cavern-archipelago` — «Архипелаг пещер»: visible local clusters joined by sparse long tunnels.
4. `ring` — «Кольцо»: clockwise/counter-clockwise travel around a large empty middle.
5. `abyss` — «Провал»: paths skirt an obvious central void and meet only above it.
6. `false-root-orbit` — «Ложный центр: Орбита»: false Root is the geometric centre and the whole first map visually collapses toward it.
7. `false-root-labyrinth` — «Ложный центр: Лабиринт»: false Root is central but approached through a long serpentine maze.

The old `braided`, `terraces`, and `broken-ring` layouts remain in code only to keep existing v25 saves stable. They are no longer selected for new campaigns.

### Central false-root reveal

For both central layouts the deep-Orsia route no longer grows directly out of `root-sanctum`.
After resolving the false-root revelation, a new linear deep route opens from a peripheral branch:

- Orbit: upper-right branch, continuing outward/right and deeper.
- Labyrinth: upper-left branch, continuing outward/left and deeper.

This preserves the intended narrative reversal: the expedition was wrong to treat the map centre as the true continuation.

## Landscape battle

Short/wide battle viewports now use a purpose-built layout:

- the campaign resource strip is hidden while combat is open;
- the compact leader/menu bar remains available;
- scoreboard occupies one shallow row;
- battlefield receives the full remaining height and most of the width;
- commentary, scrubber, playback and speed controls live in one narrow right rail;
- a second compact breakpoint handles very short 16:9 phones;
- tactical flank tap zones, morale rails, event banners and the post-battle map button remain inside the battlefield.

Portrait battle flow is unchanged.
