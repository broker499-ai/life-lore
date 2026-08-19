const BACKGROUNDS = {
  lava: '/assets/battle-backgrounds/lava-cavern.webp',
  bunker: '/assets/battle-backgrounds/underground-bunker.webp',
  fungal: '/assets/battle-backgrounds/fungal-lake.webp',
  ruins: '/assets/battle-backgrounds/ancient-ruins.webp',
  root: '/assets/battle-backgrounds/root-temple.webp',
  city: '/assets/battle-backgrounds/underground-city.webp',
} as const;

const BACKGROUND_BY_LOCATION: Record<string, keyof typeof BACKGROUNDS> = {
  'moss-market': 'fungal',
  'normal-lake': 'fungal',
  'temporary-outpost': 'fungal',
  'lower-garden': 'fungal',
  'sweet-corner': 'fungal',
  'reverse-fermentation-cellar': 'fungal',

  'quiet-scream': 'bunker',
  'polyclinic-202-basement': 'bunker',
  'physics-secret-floors': 'bunker',
  'secret-city-7': 'bunker',
  'red-gallery': 'bunker',
  undermoscow: 'bunker',

  'oven-zero': 'lava',
  skovorodsk: 'lava',
  'raw-material': 'lava',

  phalanstery: 'ruins',
  'crooked-chambers': 'ruins',
  'echo-vault': 'ruins',
  'last-decent-inn': 'ruins',
  'mining-kingdom': 'ruins',
  'salt-department': 'ruins',
  'dumpling-mine': 'ruins',

  'root-limit': 'root',
  'root-sanctum': 'root',
  'true-root-sanctum': 'root',
  'pyroral-workshop': 'root',
  'secondary-freshness': 'root',
};

export function getBattleBackgroundSrc(locationId: string): string {
  const mapped = BACKGROUND_BY_LOCATION[locationId];
  if (mapped) return BACKGROUNDS[mapped];
  const keys = Object.keys(BACKGROUNDS) as Array<keyof typeof BACKGROUNDS>;
  const stableIndex = stableHash(locationId) % keys.length;
  return BACKGROUNDS[keys[stableIndex] ?? 'city'];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
