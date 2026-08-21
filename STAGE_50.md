# Stage 50 — Reliable unit drag, merge and split

Version: **0.50.0**  
Save format: **v25** (unchanged)

## Fixed direct unit manipulation

Stage 49 used two different drag implementations: native HTML5 drag/drop for mouse and Pointer Events for touch/pen. On mobile the group card also used `touch-action: pan-y`, so the browser could cancel a vertical gesture as scrolling before the game resolved the drop.

Stage 50 replaces unit-group dragging with one custom Pointer Events path for mouse, touch and pen:

- press/touch any ordinary group card and drag it directly;
- a fixed translucent drag ghost follows the pointer;
- the target flank is highlighted while hovering it;
- dropping on another compatible identical group highlights that group green and shows **СЛИТЬ**;
- dropping performs the merge and preserves the army-level roster;
- dropping elsewhere on a flank moves only that persistent group;
- unit cards no longer rely on native HTML5 `draggable`;
- `touch-action: none` on draggable group cards prevents the browser from cancelling the gesture.

Flank-title swapping from Stage 49 remains available.

## Split group actions

Tapping a group now slides out two inline actions:

- **½ На 2**
- **⅓ На 3**

Splitting:

- is deterministic;
- creates 2 or 3 balanced persistent groups on the same flank;
- preserves the exact army roster and total unit count;
- uses collision-safe deterministic group IDs;
- can be reversed by dragging compatible pieces onto one another and merging them.

Named unique groups are not splittable. This prevents duplication of a unique fighter when a unique group also contains attached companions (for example Greg and his spiders). Their split controls are disabled with an explanation.

## State / saves

No GameState fields were added. Save format remains **v25** and no migration is required.
