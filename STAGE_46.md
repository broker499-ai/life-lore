# Stage 46 — Rest telegraph, free recruitment, Gleb Khleb

Version: **0.46.0**  
Save format: **v24**

## Reactive battle readability

- Enemy `rest` is now a real visible retreat: the corresponding dots fall deep into their own half and recover local morale.
- If a player directs pressure into a resting enemy lane, it immediately becomes `rest_broken` / **ОТДЫХ НАРУШЕН** and returns toward the combat line.
- Large tactical glyphs are drawn directly over each lane:
  - assault / intensified pressure;
  - cautious combat;
  - deep defense;
  - rest / interrupted rest.
- Assault and cautious modes also use thick direction arrows so the active intention can be read without opening panels.

## Recruitment

Recruitment no longer spends or requires the faction's strategic action. A player may recruit and then move, attack or rest in the same turn. If the action was already spent, recruitment is still available and does not reset it.

Cities with an unrecruited unique unit now make the **Набор** button pulse with expanding light rings. The glow is stronger when the artifact requirement is already satisfied.

## Gleb Khleb

New unique recruit: **Глеб Хлеб**.

- seeded-randomly assigned to one city in new campaigns;
- old v23 campaigns receive a deterministic assignment through save migration;
- requires the normal unique-unit artifact prerequisite;
- combat power is approximately equivalent to 50 basic soldiers;
- `replacesEntireLane`: Gleb occupies the central lane alone while ordinary soldiers are distributed to the side lanes;
- his lane morale is locked at **100** while he survives.

## Save migration

v23 → v24 adds Gleb to campaigns that did not already have him, while avoiding cities already assigned to another unique unit, the Sirius boss city and the initial city when possible.
