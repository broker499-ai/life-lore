# Stage 29.1 — Windows simulator launcher fix

## Fixed

`tsx` previously started from the root `tsconfig.json`, which did not expose the `@/*` path alias at runtime. On Windows this caused `ERR_MODULE_NOT_FOUND` for imports such as `@/simulation/simulateCampaign`.

The simulator now:

- explicitly starts `tsx` with `tsconfig.simulation.json`;
- also exposes the `@/* -> src/*` alias in the root `tsconfig.json` as a fallback;
- sets `TSX_TSCONFIG_PATH` in `SIMULATE_BALANCE.bat` as an additional Windows-safe fallback;
- keeps `npm run simulate` and `npm run simulate:quick` simple for manual use.

Version: `0.29.1`.
