# Stage 45 — Reactive Battle 3.0

Version: 0.45.0  
Save format: v23 (unchanged)

## Reactive combat

- Removed the old finite battle command-buttons workflow from the battle screen.
- Live commands are now issued directly on the battlefield and are unlimited.
- Command cooldown is one real-time second.
- Tap one of your living lanes to select it:
  - tap the same lane again to order deep defense;
  - tap the matching or adjacent living enemy lane to order a concentrated attack there.
- Deep defense strongly counters an enemy lane currently using reinforced assault.
- Concentrated attacks are especially effective against resting enemy lanes and lanes below 40 morale.
- A player lane whose opposite enemy lane has broken rests automatically and regains local morale until redirected against a surviving adjacent lane.

## Enemy lane behavior

Each living non-Orc defender lane deterministically rolls a visible behavior every round:
- reinforced assault;
- rest;
- cautious combat.

Enemy forces and starting local morale are seeded-randomly distributed between lanes while total roster size and approximate aggregate morale remain unchanged. Orcs keep their center-only formation.

## Visual communication

- Removed the old separate numeric lane panels from the battle scene.
- Narrow vertical morale bars sit at the outer edge of each lane.
- Enemy behavior is telegraphed beside its morale bar.
- Unit-circle count/visibility represents lane health: proportional casualties fade circles out.
- Weakened and broken lanes darken; their circle outlines become dashed, and routed circles stop their normal fighting motion.
- Redirected attacks physically bend the selected formation toward the chosen adjacent lane.

## Deferred intentionally

Player pre-battle lane composition/custom allocation is NOT added in this stage. That is the next logical Battle 3.x step, after the reactive system has been tested in real play.
