# Stage 48 — Four-stage battles, persistent flanks and turn flow

Version: **0.48.0**  
Save format: **v25**

## Battle: four stages

- Every battle scale is divided into exactly four ordered stages.
- At every stage boundary all surviving normal lanes are reset to `engage`; live attack/defence/cautious directives from the previous stage no longer apply.
- Enemy reactive postures are rolled again only at the beginning of a new stage instead of every round.
- The reset is emitted into the battle timeline, so BattleViewer clears the previous tactical symbols visually as well as mechanically.
- Stage transition messages are presentation events and use the Stage 47 real-time readability floor.
- Xiang's late flank strike now fires at the beginning of stage 4: directly after stage 3 has ended.

## Sirius Morpheus Nan

`UnitDefinition.enemyForcedRestLanes` is a data-driven special-unit property.

Sirius Morpheus Nan sets it to **2**. At battle creation two active enemy lanes are placed in `rest` and remain forced to rest for the whole battle. Pressure cannot convert those lanes to `rest_broken`, and every stage reset restores the forced rest state.

## Persistent pre-battle flank groups

`ArmyState.groups` stores persistent recruitment groups with:

- stable group id;
- assigned flank (`left`, `center`, `right`);
- the group's own roster;
- unique/non-unique marker.

New campaigns begin with 24 freshmen as three groups of **8 / 8 / 8**.

Every later normal recruitment confirmation creates one group and sends it to the weakest eligible flank by summed combat characteristics (`(attack + defense) × amount`).

The first unique group claims the weakest flank and regular groups are moved out of it. Later unique groups join the same unique flank. Normal recruits avoid that flank while it contains uniques.

The Army tab now shows all three flanks, group composition and total flank power. The player can swap **Left ↔ Center** or **Center ↔ Right** without spending a strategic action. Battle simulation consumes these lane rosters directly.

Unique combat dots are yellow.

## Artifacts tab

Artifacts are now a separate main campaign tab beside Map, Army and Cities. The Army screen is reserved for formation and troop composition.

## Recruitment cooldown

- Any successful safe or risky recruitment closes recruitment in that city for **3 turns**.
- A failed risky recruitment/riot keeps the existing **5-turn** lock.
- DEV unlimited recruitment ignores these cooldowns.
- Unique recruitment uses the same 3-turn successful lock.

## Automatic turn completion

- Normal movement automatically advances the turn after movement/event resolution.
- City rest and POI short rest automatically advance the turn.
- Lajos keeps his double-move exception: when the second move is available, the first move leaves the turn open; the second then auto-completes it.
- DEV mode does not auto-complete these actions.

## Save migration

Save format is bumped from **v24 → v25** because flank groups are persistent state.

Legacy armies without groups are deterministically converted into three-flank groups from their current roster. Current v25 saves round-trip without transformation.
