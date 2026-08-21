import { randomInt } from '@/core/rng/seededRandom';
import type { RngState } from '@/core/rng/RngState';
import type { GameState, NodeId } from '@/core/state/GameState';
import type { MapGraph, MapNode } from '@/core/map/MapGraph';
import { getPreRootMap } from '@/core/map/preRootMap';

export const FALSE_ROOT_EVENT_ID = 'false-root-revelation';
export const FALSE_ROOT_NODE_ID = 'root-sanctum';
export const TRUE_ROOT_NODE_ID = 'true-root-sanctum';

export const extensionCityIds = [
  'mining-kingdom',
  'lower-garden',
  'secret-city-7',
  'red-gallery',
  'undermoscow',
  'skovorodsk',
  'raw-material',
  'secondary-freshness',
] as const;

export const extensionPoiIds = [
  'oven-zero',
  'salt-department',
  'reverse-fermentation-cellar',
  'dumpling-mine',
  'sweet-corner',
  'deep-freezer',
  'pyroral-workshop',
] as const;

export const extensionLocationIds = [...extensionCityIds, ...extensionPoiIds] as const;

const extensionCitySet = new Set<string>(extensionCityIds);

const extensionNodeTemplates: Record<string, Omit<MapNode, 'x' | 'y'>> = {
  'mining-kingdom': { id: 'mining-kingdom', nameKey: 'map.miningKingdom', descriptionKey: 'map.miningKingdom.description', kind: 'city' },
  'lower-garden': { id: 'lower-garden', nameKey: 'map.lowerGarden', descriptionKey: 'map.lowerGarden.description', kind: 'city' },
  'secret-city-7': { id: 'secret-city-7', nameKey: 'map.secretCity7', descriptionKey: 'map.secretCity7.description', kind: 'city' },
  'red-gallery': { id: 'red-gallery', nameKey: 'map.redGallery', descriptionKey: 'map.redGallery.description', kind: 'city' },
  undermoscow: { id: 'undermoscow', nameKey: 'map.undermoscow', descriptionKey: 'map.undermoscow.description', kind: 'city' },
  skovorodsk: { id: 'skovorodsk', nameKey: 'map.skovorodsk', descriptionKey: 'map.skovorodsk.description', kind: 'city' },
  'raw-material': { id: 'raw-material', nameKey: 'map.rawMaterial', descriptionKey: 'map.rawMaterial.description', kind: 'city' },
  'secondary-freshness': { id: 'secondary-freshness', nameKey: 'map.secondaryFreshness', descriptionKey: 'map.secondaryFreshness.description', kind: 'city' },
  'oven-zero': { id: 'oven-zero', nameKey: 'map.ovenZero', descriptionKey: 'map.ovenZero.description', kind: 'poi' },
  'salt-department': { id: 'salt-department', nameKey: 'map.saltDepartment', descriptionKey: 'map.saltDepartment.description', kind: 'poi' },
  'reverse-fermentation-cellar': { id: 'reverse-fermentation-cellar', nameKey: 'map.reverseFermentationCellar', descriptionKey: 'map.reverseFermentationCellar.description', kind: 'poi' },
  'dumpling-mine': { id: 'dumpling-mine', nameKey: 'map.dumplingMine', descriptionKey: 'map.dumplingMine.description', kind: 'poi' },
  'sweet-corner': { id: 'sweet-corner', nameKey: 'map.sweetCorner', descriptionKey: 'map.sweetCorner.description', kind: 'poi' },
  'deep-freezer': { id: 'deep-freezer', nameKey: 'map.deepFreezer', descriptionKey: 'map.deepFreezer.description', kind: 'poi' },
  'pyroral-workshop': { id: 'pyroral-workshop', nameKey: 'map.pyroralWorkshop', descriptionKey: 'map.pyroralWorkshop.description', kind: 'poi' },
};

const extensionSlots = [
  { x: 50, y: -15 },
  { x: 43, y: -27 },
  { x: 55, y: -39 },
  { x: 46, y: -51 },
  { x: 57, y: -63 },
  { x: 44, y: -75 },
  { x: 54, y: -87 },
  { x: 47, y: -99 },
  { x: 58, y: -111 },
  { x: 45, y: -123 },
  { x: 55, y: -135 },
  { x: 43, y: -147 },
  { x: 56, y: -159 },
  { x: 46, y: -171 },
  { x: 52, y: -183 },
] as const;

export type ExtensionOrderResult = { order: NodeId[]; rngState: RngState };

/**
 * Creates a seeded linear route. The final slot is constrained to a city so the
 * existing final-operation staging rule remains meaningful, but which city it is
 * and the order of every other city/POI remain random per campaign.
 */
export function chooseExtensionLocationOrder(initialRng: RngState): ExtensionOrderResult {
  const shuffled = shuffleWithRng([...extensionLocationIds], initialRng);
  let order = shuffled.items;
  let rng = shuffled.rngState;

  if (!extensionCitySet.has(order[order.length - 1] ?? '')) {
    const cityIndexes = order
      .map((id, index) => extensionCitySet.has(id) ? index : -1)
      .filter((index) => index >= 0 && index < order.length - 1);
    const pick = randomInt(rng, 0, cityIndexes.length - 1);
    rng = pick.state;
    const cityIndex = cityIndexes[pick.value];
    const lastIndex = order.length - 1;
    [order[cityIndex], order[lastIndex]] = [order[lastIndex], order[cityIndex]];
  }

  return { order, rngState: rng };
}

export function isExtensionUnlocked(state: GameState): boolean {
  return state.campaign.resolvedEventIds.includes(FALSE_ROOT_EVENT_ID);
}

export function getExtensionStagingCityId(state: GameState): string {
  const candidate = state.campaign.extensionLocationOrder.at(-1);
  return candidate && extensionCitySet.has(candidate) ? candidate : 'secondary-freshness';
}

export function getCampaignMap(state: GameState): MapGraph {
  const preRootMap = getPreRootMap(state);
  if (!isExtensionUnlocked(state) && !state.campaign.developerMode) return preRootMap;

  const order = normalizeExtensionOrder(state.campaign.extensionLocationOrder);
  const extensionNodes: MapNode[] = order.map((nodeId, index) => {
    const template = extensionNodeTemplates[nodeId];
    const slot = extensionSlots[index];
    if (!template || !slot) throw new Error(`Missing extension map data for ${nodeId}`);
    return { ...template, x: slot.x, y: slot.y };
  });
  const trueRoot: MapNode = {
    id: TRUE_ROOT_NODE_ID,
    nameKey: 'map.trueRootSanctum',
    descriptionKey: 'map.trueRootSanctum.description',
    kind: 'special',
    x: 50,
    y: -198,
    isCentral: true,
  };

  const extensionEdges = [
    { from: FALSE_ROOT_NODE_ID, to: order[0] },
    ...order.slice(1).map((nodeId, index) => ({ from: order[index], to: nodeId })),
    { from: order[order.length - 1], to: TRUE_ROOT_NODE_ID },
  ];

  return {
    nodes: [...preRootMap.nodes, ...extensionNodes, trueRoot],
    edges: [...preRootMap.edges, ...extensionEdges],
  };
}

export function getAllExtensionDiscoveryNodeIds(state: GameState): NodeId[] {
  return [...normalizeExtensionOrder(state.campaign.extensionLocationOrder), TRUE_ROOT_NODE_ID];
}

function normalizeExtensionOrder(order: readonly NodeId[]): NodeId[] {
  const valid = order.filter((id) => extensionLocationIds.includes(id as (typeof extensionLocationIds)[number]));
  const missing = extensionLocationIds.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

function shuffleWithRng<T>(items: T[], initialRng: RngState): { items: T[]; rngState: RngState } {
  const result = [...items];
  let rng = initialRng;
  for (let index = result.length - 1; index > 0; index -= 1) {
    const pick = randomInt(rng, 0, index);
    rng = pick.state;
    [result[index], result[pick.value]] = [result[pick.value], result[index]];
  }
  return { items: result, rngState: rng };
}
