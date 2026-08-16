import type { RngState, RngStreamsState } from '@/core/rng/RngState';

const UINT32_MAX_PLUS_ONE = 4_294_967_296;

function normalizeSeed(seed: number): number {
  return seed >>> 0;
}

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function createRngState(seed: number): RngState {
  return { seed: normalizeSeed(seed), cursor: 0 };
}

export function createRngStreams(seed: number): RngStreamsState {
  const root = normalizeSeed(seed);
  return {
    campaign: createRngState(mix32(root ^ 0x43414d50)),
    battles: createRngState(mix32(root ^ 0x42415454)),
    events: createRngState(mix32(root ^ 0x45564e54)),
  };
}

export function nextRandom(state: RngState): { value: number; state: RngState } {
  const mixed = mix32((state.seed + Math.imul(state.cursor + 1, 0x9e3779b9)) >>> 0);
  return {
    value: mixed / UINT32_MAX_PLUS_ONE,
    state: {
      seed: state.seed,
      cursor: state.cursor + 1,
    },
  };
}

export function randomInt(
  state: RngState,
  minInclusive: number,
  maxInclusive: number,
): { value: number; state: RngState } {
  if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive)) {
    throw new Error('randomInt bounds must be integers');
  }
  if (maxInclusive < minInclusive) {
    throw new Error('randomInt max must be >= min');
  }

  const result = nextRandom(state);
  const span = maxInclusive - minInclusive + 1;
  return {
    value: minInclusive + Math.floor(result.value * span),
    state: result.state,
  };
}
