# Stage 43 — recruitment modal + new intro art

## Recruitment UX
- Recruitment no longer renders inside the clipped campaign command deck.
- `StrategicActionBar` portals recruitment UI directly to `document.body`.
- Opening **Набор** creates a tall modal sheet over the map.
- Unit type selection is always the first visible control.
- The quantity slider is a large native range control with a clearly marked safe limit.
- Confirmation participates in normal document flow and can never cover the slider.
- The sheet opens scrolled to its top every time and supports Escape/backdrop/close-button dismissal.
- Portrait phone layout uses up to 84dvh; low landscape phones use a tall right-side sheet.

## Intro
- Replaced `/assets/intro/orsia-descent.webp` with the new supplied 682×2048 artwork.
- Existing intro timing, underground reveal, descent, centered final text and two-stage skip behavior are preserved.
- Service worker cache key bumped so installed PWA builds fetch the new image/UI.
