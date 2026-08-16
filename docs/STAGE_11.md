# Stage 11 — Tactical formations and three-sector battle view

## Goal

Make continuous dot battles tactically readable without adding a second combat model or external art. The renderer should show where line troops, ranged troops and flank pressure are located while remaining a read-only interpretation of `BattleResult` / `BattleTimeline`.

## Implemented

- three persistent battle sectors: **left flank / center / right flank**;
- front-line and rear-line geometry;
- ranged units are visually kept behind line units;
- exact per-unit-type roster is now reconstructed in every `BattlePresentationFrame` from authoritative casualty events;
- if a casualty event removes ranged units, ranged markers fade specifically instead of all dots shrinking only from aggregate losses;
- tactics produce different presentation trajectories:
  - `assault` pushes the front line and especially the center;
  - `cautious` keeps the line shallower and ranged units deeper;
  - `flank` advances outer sectors more aggressively and leaves the center less committed;
  - `balanced` keeps a compact, even formation;
- each sector has its own pressure marker derived from the existing overall rolls/casualties plus the already-selected tactics;
- ranged units generate SVG volley arcs during advance/contact/steadiness phases;
- line units generate short attack/counterattack vectors during advance/contact;
- line and ranged markers use different SVG styling while remaining abstract dots;
- no external graphical assets are required.

## Architecture

New pure presentation helper:

`src/core/battles/presentation/BattleFormation.ts`

It receives:

- presentation snapshots;
- battle phase;
- selected tactic;
- existing pressure values;
- unit definitions;
- visual playback time.

It returns only marker geometry and visual lane pressure. It cannot modify:

- casualties;
- morale;
- combat rolls;
- winner;
- RNG;
- `GameState`.

The authoritative flow remains:

`BattleSimulator -> BattleTimeline -> BattlePresentation -> BattleFormation/BattlePlayback -> React/SVG`

## Roster accuracy

`BattlePresentationSide` now carries both:

- `initialRoster`;
- current `roster`.

Current roster is reconstructed by subtracting the exact `event.losses` roster emitted by the simulator. This allows presentation to distinguish line losses from ranged losses without inventing combat information.

## Validation targets

- final presentation roster exactly equals `BattleResult.remainingRoster` for both sides;
- ranged markers are behind line markers in a normal advancing formation;
- all three sectors receive units where roster size permits;
- a flanking tactic visibly advances outer lanes more than the center;
- visualization consumes no RNG.

## Next combat stage

The continuous battle renderer is now structurally ready for richer events. The next useful step is to improve the **semantic battle timeline** without splitting the simulator:

- explicit presentation-worthy pressure swings;
- ranged-volley / counterattack / flank-attempt event tags derived during simulation;
- short key-moment log;
- clearer initiative state;
- optional terrain modifiers and terrain visualization.

Pixel-art remains optional and should still wait until the dot-based battle is mechanically readable.
