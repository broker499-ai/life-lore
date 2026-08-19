# Stage 35 — mobile landscape support

- PWA manifest no longer locks the app to portrait (`orientation: any`).
- Phone landscape campaign uses a two-pane layout: map/content left, location/actions right.
- Header resources are arranged horizontally to preserve vertical space.
- End-turn controls remain pinned to the action pane; section navigation sits directly below it.
- Army/cities/research screens use the same left-content/right-command layout.
- Battle landscape uses the battlefield as the large left pane and commentary/playback as a compact right rail.
- Command overlays remain inside the battlefield and use three columns in landscape.
- Extra compaction for very short landscape viewports (<=400 CSS px high).
- Portrait behavior remains unchanged.
- Save format remains v19.
