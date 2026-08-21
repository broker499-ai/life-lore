# Stage 49 — Direct flank management

Version: **0.49.0**  
Save format: **v25** (unchanged)

## Army flank UX

- Added **Автораспределение**. It deterministically balances persistent recruitment groups by summed combat power.
- If unique groups exist, auto distribution keeps all unique groups together on their current unique flank and keeps ordinary groups on the other two flanks.
- Any persistent group can be manually moved to any flank.
- Desktop: groups use native drag-and-drop; touch/pen uses pointer dragging, with a dedicated grip that also supports vertical drags without sacrificing normal page scrolling elsewhere.
- Tap fallback: tap a group, then tap a flank title to move it there.
- Compatible groups can be merged by dragging one directly onto the other. A merge target turns green and displays `СЛИТЬ` before drop.
- A merge is allowed only for groups with the same unit-type composition and the same unique/non-unique class. The army-level roster is unchanged.

## Flank position switching

The old three swap buttons are removed.

- Tap one flank title and then another to swap the complete flank contents.
- Flank title zones are draggable on pointer/desktop devices; dropping one title on another swaps the two flanks.
- The active first title and valid swap destination are visually highlighted.

## Post-battle navigation

- The small result-toolbar `К карте` button is removed.
- After the victory/defeat seal has been dismissed, a larger **К КАРТЕ** control appears directly on the battlefield in the enemy-side lower-right flank.
- The button remains above battlefield overlays and has a mobile-specific minimum size.

## State / saves

No new persistent fields were added. `ArmyState.groups` from Stage 48 is reused, so save format remains **v25** and no migration is required.
