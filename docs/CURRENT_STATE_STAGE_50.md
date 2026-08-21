# Current state — Stage 50

Current app version: **0.50.0**  
Save format: **v25**

Stage 50 fixes Stage 49 unit manipulation by replacing the mixed native/pointer drag implementation with one Pointer Events implementation for mouse, touch and pen. Army groups can be dragged between flanks and merged by dropping directly on a compatible identical group with explicit green `СЛИТЬ` highlighting. Tapping a normal group opens animated controls to split it into 2 or 3 balanced persistent groups without changing the army roster. Unique named groups remain indivisible.

No GameState schema change was required. `START_GAME.bat` remains unchanged.
