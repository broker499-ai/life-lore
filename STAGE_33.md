# Stage 33 — integrated battle scene

- Fixes the collapsed battle-pitch regression that made the scenic background appear as a thin strip.
- The battle field now has an explicit responsive height and a real `<img>` scenic layer with a CSS background fallback.
- Removes the separate sector board above the animation.
- Left/center/right sector counts, morale and reserve state are shown directly on the battlefield beside the animated formations.
- Live round-2/round-4 orders are also presented as an overlay inside the battle scene instead of consuming a separate block above it.
- Keeps the existing animated formations, volleys, melee lunges, impact markers, skip button and Battle 2.0 simulation unchanged.
- Service-worker cache bumped to Stage 33.
