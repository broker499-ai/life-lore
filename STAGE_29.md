# Stage 29 — Headless Campaign Simulator

Version: `0.29.0`  
Save format: `v16` (unchanged)

## Goal

Run complete campaign simulations without React/UI while using the same commands, battle simulator, seeded RNG, events, city mechanics, research, artifacts, rival AI and final Root rules as the game.

## Easiest use on Windows

Double-click:

`SIMULATE_BALANCE.bat`

It installs dependencies if necessary, runs 250 campaigns and opens the summary in Notepad.

Generated files:

- `simulation-results/latest-summary.md` — readable balance summary;
- `simulation-results/latest-runs.csv` — one row per campaign, convenient for Excel/Pivot;
- `simulation-results/latest-runs.json` — full structured results.

## Command line

Default 250 campaigns:

```bash
npm run simulate
```

Quick smoke run:

```bash
npm run simulate:quick
```

Custom run count:

```bash
npm run simulate -- --runs 1000
```

Single leader or strategy:

```bash
npm run simulate -- --runs 500 --leader vlados
npm run simulate -- --runs 500 --strategy research
```

Exact replay of a suspicious run:

```bash
npm run simulate -- --runs 1 --seed 18427 --leader makson --strategy balanced --verbose
```

## Automated player strategies

- `balanced` — mixed sample/artifact play and moderate risk;
- `aggressive` — assault-heavy expansion;
- `research` — prioritises samples and research;
- `artifact` — prioritises artifact choices;
- `rush` — prioritises fast scientific access and forward movement.

The bot can regroup into a controlled city, rest and recruit before retrying a difficult linear-map battle. In the second half it builds a larger army because Linhao and late garrisons require it.

## Metrics

Each run records, among other things:

- outcome and duration;
- leader and strategy;
- false-Root / extension timing;
- controlled cities;
- economy and supplies;
- army size and peak size;
- player battles, wins, losses and casualties;
- tactic usage;
- artifacts and active loadout;
- specimens and research;
- resolved POIs;
- extension order;
- active Orsia factions;
- rival identity/actions;
- stuck turns.

## Important diagnostic already exposed

Initial smoke runs show that artifact/aggressive routes can frequently reach a state where the final scientific requirement cannot be satisfied because too many one-time POIs were resolved without taking samples. This is useful balance information rather than hidden by the simulator; the next balance pass should decide whether that hard trade-off is intentional or should be softened.

The rival AI objective evaluation was also corrected so the false Root remains an enterable intermediate special node while the true Root remains handled by the final-operation layer.
