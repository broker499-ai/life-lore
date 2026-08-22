# Stage 51 — intro mask, map overscroll and battle response

Version: **v0.51.0**  
Save format: **v25** (unchanged)

## Implemented

- Intro underground mask now follows the rendered source image surface line instead of viewport height. The cut is anchored to Y=352 in the 682×2048 source and recalculates on resize/orientation changes.
- Intro descent scroll is 1.3× faster; the initial 2 s surface hold and reveal timing are unchanged.
- Strategic map camera can pan ~14 world units beyond the drawn graph bounds on every side, making edge/final locations easier to center and tap.
- Investigated reactive battle input latency:
  - the explicit 1 s command cooldown used to allow selecting a new source lane while targets were still disabled, which looked like a delay after selection;
  - source selection is now blocked during that cooldown instead of entering a misleading half-selected state;
  - battlefield target taps use pointer-up and a synchronous lane ref, so touch/mouse target selection no longer waits on a React state render before it can be resolved.
- The initial bookkeeping frames of battle playback are compressed so the first enemy lane postures become visible at ~2.0 real seconds at x1 instead of ~7–8 seconds.

## Compatibility

- `GameState` / save schema unchanged (v25).
- `START_GAME.bat` unchanged.
