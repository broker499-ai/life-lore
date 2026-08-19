import { randomInt } from '@/core/rng/seededRandom';
import type { RngState } from '@/core/rng/RngState';
import type { GameState, NodeId } from '@/core/state/GameState';
import type { MapEdge, MapGraph, MapNode } from '@/core/map/MapGraph';
import { prototypeMap } from '@/data/map/prototypeMap';

export const PRE_ROOT_CLASSIC_LAYOUT_ID = 'classic';
export const PRE_ROOT_LAYOUT_IDS = ['braided', 'terraces', 'broken-ring'] as const;
export type PreRootLayoutId = typeof PRE_ROOT_CLASSIC_LAYOUT_ID | (typeof PRE_ROOT_LAYOUT_IDS)[number];

export const PRE_ROOT_FIXED_NODE_IDS = [
  'outer-post',
  'rival-post',
  'almost-root',
  'root-limit',
  'root-sanctum',
] as const;

/**
 * These locations keep their content, city owner, events and mechanics, but their
 * positions in the first half of the campaign are shuffled into abstract map slots.
 * The two expedition starts and the final three thematic Root-approach nodes stay fixed.
 */
export const PRE_ROOT_RANDOMIZED_LOCATION_IDS = prototypeMap.nodes
  .map((node) => node.id)
  .filter((nodeId) => !PRE_ROOT_FIXED_NODE_IDS.includes(nodeId as (typeof PRE_ROOT_FIXED_NODE_IDS)[number]));

const nodeTemplateById = Object.fromEntries(
  prototypeMap.nodes.map((node) => [node.id, { ...node }]),
) as Record<string, MapNode>;

const SLOT_IDS = PRE_ROOT_RANDOMIZED_LOCATION_IDS.map((_, index) => `slot-${String(index + 1).padStart(2, '0')}`);

type SlotPoint = { id: string; x: number; y: number };
type LayoutDefinition = {
  id: Exclude<PreRootLayoutId, 'classic'>;
  slots: SlotPoint[];
  edges: Array<[string, string]>;
};

/**
 * All three layouts deliberately have a 9-edge shortest path from either starting
 * expedition to the false Root. Stage 33's classic graph was 7/6 edges respectively.
 */
const layouts: LayoutDefinition[] = [
  {
    id: 'braided',
    slots: [
      { id: 'slot-01', x: 15, y: 86 }, { id: 'slot-02', x: 34, y: 86 },
      { id: 'slot-03', x: 66, y: 86 }, { id: 'slot-04', x: 85, y: 86 },
      { id: 'slot-05', x: 12, y: 72 }, { id: 'slot-06', x: 31, y: 72 },
      { id: 'slot-07', x: 50, y: 72 }, { id: 'slot-08', x: 69, y: 72 },
      { id: 'slot-09', x: 88, y: 72 }, { id: 'slot-10', x: 22, y: 58 },
      { id: 'slot-11', x: 41, y: 58 }, { id: 'slot-12', x: 59, y: 58 },
      { id: 'slot-13', x: 78, y: 58 }, { id: 'slot-14', x: 34, y: 44 },
      { id: 'slot-15', x: 66, y: 44 }, { id: 'slot-16', x: 50, y: 30 },
    ],
    edges: [
      ['player', 'slot-01'], ['player', 'slot-02'], ['rival', 'slot-03'], ['rival', 'slot-04'],
      ['slot-01', 'slot-05'], ['slot-02', 'slot-06'], ['slot-03', 'slot-08'], ['slot-04', 'slot-09'],
      ['slot-05', 'slot-06'], ['slot-06', 'slot-07'], ['slot-07', 'slot-08'], ['slot-08', 'slot-09'],
      ['slot-05', 'slot-10'], ['slot-06', 'slot-10'], ['slot-07', 'slot-11'], ['slot-07', 'slot-12'],
      ['slot-08', 'slot-13'], ['slot-09', 'slot-13'], ['slot-10', 'slot-14'], ['slot-11', 'slot-14'],
      ['slot-12', 'slot-15'], ['slot-13', 'slot-15'], ['slot-14', 'slot-16'], ['slot-15', 'slot-16'],
      ['slot-16', 'almost'], ['almost', 'limit'], ['limit', 'root'],
    ],
  },
  {
    id: 'terraces',
    slots: [
      { id: 'slot-01', x: 10, y: 84 }, { id: 'slot-02', x: 28, y: 88 },
      { id: 'slot-03', x: 72, y: 88 }, { id: 'slot-04', x: 90, y: 84 },
      { id: 'slot-05', x: 18, y: 72 }, { id: 'slot-06', x: 38, y: 74 },
      { id: 'slot-07', x: 62, y: 74 }, { id: 'slot-08', x: 82, y: 72 },
      { id: 'slot-09', x: 9, y: 58 }, { id: 'slot-10', x: 29, y: 60 },
      { id: 'slot-11', x: 50, y: 59 }, { id: 'slot-12', x: 71, y: 60 },
      { id: 'slot-13', x: 91, y: 58 }, { id: 'slot-14', x: 31, y: 45 },
      { id: 'slot-15', x: 69, y: 45 }, { id: 'slot-16', x: 50, y: 31 },
    ],
    edges: [
      ['player', 'slot-01'], ['player', 'slot-02'], ['rival', 'slot-03'], ['rival', 'slot-04'],
      ['slot-01', 'slot-05'], ['slot-02', 'slot-06'], ['slot-03', 'slot-07'], ['slot-04', 'slot-08'],
      ['slot-05', 'slot-09'], ['slot-05', 'slot-10'], ['slot-06', 'slot-10'], ['slot-06', 'slot-11'],
      ['slot-07', 'slot-11'], ['slot-07', 'slot-12'], ['slot-08', 'slot-12'], ['slot-08', 'slot-13'],
      ['slot-09', 'slot-10'], ['slot-10', 'slot-14'], ['slot-11', 'slot-14'], ['slot-11', 'slot-15'],
      ['slot-12', 'slot-15'], ['slot-13', 'slot-12'], ['slot-14', 'slot-16'], ['slot-15', 'slot-16'],
      ['slot-16', 'almost'], ['almost', 'limit'], ['limit', 'root'],
    ],
  },
  {
    id: 'broken-ring',
    slots: [
      { id: 'slot-01', x: 18, y: 88 }, { id: 'slot-02', x: 38, y: 91 },
      { id: 'slot-03', x: 62, y: 91 }, { id: 'slot-04', x: 82, y: 88 },
      { id: 'slot-05', x: 10, y: 73 }, { id: 'slot-06', x: 31, y: 75 },
      { id: 'slot-07', x: 69, y: 75 }, { id: 'slot-08', x: 90, y: 73 },
      { id: 'slot-09', x: 16, y: 57 }, { id: 'slot-10', x: 37, y: 61 },
      { id: 'slot-11', x: 63, y: 61 }, { id: 'slot-12', x: 84, y: 57 },
      { id: 'slot-13', x: 27, y: 45 }, { id: 'slot-14', x: 50, y: 48 },
      { id: 'slot-15', x: 73, y: 45 }, { id: 'slot-16', x: 50, y: 31 },
    ],
    edges: [
      ['player', 'slot-01'], ['player', 'slot-02'], ['rival', 'slot-03'], ['rival', 'slot-04'],
      ['slot-01', 'slot-05'], ['slot-02', 'slot-06'], ['slot-03', 'slot-07'], ['slot-04', 'slot-08'],
      ['slot-05', 'slot-09'], ['slot-06', 'slot-10'], ['slot-07', 'slot-11'], ['slot-08', 'slot-12'],
      ['slot-09', 'slot-13'], ['slot-10', 'slot-13'], ['slot-10', 'slot-14'],
      ['slot-11', 'slot-14'], ['slot-11', 'slot-15'], ['slot-12', 'slot-15'],
      ['slot-13', 'slot-14'], ['slot-14', 'slot-15'], ['slot-13', 'slot-16'], ['slot-15', 'slot-16'],
      ['slot-16', 'almost'], ['almost', 'limit'], ['limit', 'root'],
    ],
  },
];

const layoutById = Object.fromEntries(layouts.map((layout) => [layout.id, layout])) as Record<string, LayoutDefinition>;

export type PreRootMapRoll = {
  layoutId: (typeof PRE_ROOT_LAYOUT_IDS)[number];
  locationOrder: NodeId[];
  rngState: RngState;
};

export function choosePreRootMap(initialRng: RngState): PreRootMapRoll {
  const layoutPick = randomInt(initialRng, 0, PRE_ROOT_LAYOUT_IDS.length - 1);
  const shuffled = shuffleWithRng([...PRE_ROOT_RANDOMIZED_LOCATION_IDS], layoutPick.state);
  return {
    layoutId: PRE_ROOT_LAYOUT_IDS[layoutPick.value],
    locationOrder: shuffled.items,
    rngState: shuffled.rngState,
  };
}

export function getPreRootMap(state: GameState): MapGraph {
  if (state.campaign.preRootLayoutId === PRE_ROOT_CLASSIC_LAYOUT_ID) return prototypeMap;
  const layout = layoutById[state.campaign.preRootLayoutId] ?? layouts[0];
  const order = normalizeLocationOrder(state.campaign.preRootLocationOrder);
  const locationBySlot = Object.fromEntries(SLOT_IDS.map((slotId, index) => [slotId, order[index]]));

  const nodes: MapNode[] = [];
  const outer = nodeTemplateById['outer-post'];
  const rival = nodeTemplateById['rival-post'];
  const almost = nodeTemplateById['almost-root'];
  const limit = nodeTemplateById['root-limit'];
  const root = nodeTemplateById['root-sanctum'];
  if (!outer || !rival || !almost || !limit || !root) throw new Error('Missing fixed pre-root node templates');

  nodes.push({ ...outer, x: 6, y: 98 });
  nodes.push({ ...rival, x: 94, y: 98 });
  for (const slot of layout.slots) {
    const locationId = locationBySlot[slot.id];
    const template = locationId ? nodeTemplateById[locationId] : null;
    if (!template) throw new Error(`Missing randomized pre-root node template for ${slot.id}`);
    nodes.push({ ...template, x: slot.x, y: slot.y });
  }
  nodes.push({ ...almost, x: 50, y: 19 });
  nodes.push({ ...limit, x: 50, y: 9 });
  nodes.push({ ...root, x: 50, y: -1 });

  const idForEndpoint = (endpoint: string): string => {
    if (endpoint === 'player') return 'outer-post';
    if (endpoint === 'rival') return 'rival-post';
    if (endpoint === 'almost') return 'almost-root';
    if (endpoint === 'limit') return 'root-limit';
    if (endpoint === 'root') return 'root-sanctum';
    const locationId = locationBySlot[endpoint];
    if (!locationId) throw new Error(`Unknown pre-root layout endpoint ${endpoint}`);
    return locationId;
  };
  const edges: MapEdge[] = layout.edges.map(([from, to]) => ({ from: idForEndpoint(from), to: idForEndpoint(to) }));

  return { nodes, edges: dedupeEdges(edges) };
}

export function getPreRootLayoutLabel(layoutId: string): string {
  if (layoutId === 'braided') return 'Переплетение';
  if (layoutId === 'terraces') return 'Террасы';
  if (layoutId === 'broken-ring') return 'Разорванное кольцо';
  return 'Классическая карта';
}

function normalizeLocationOrder(order: readonly NodeId[]): NodeId[] {
  const valid = order.filter((id) => PRE_ROOT_RANDOMIZED_LOCATION_IDS.includes(id));
  const unique = [...new Set(valid)];
  const missing = PRE_ROOT_RANDOMIZED_LOCATION_IDS.filter((id) => !unique.includes(id));
  return [...unique, ...missing];
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

function dedupeEdges(edges: MapEdge[]): MapEdge[] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = edge.from < edge.to ? `${edge.from}|${edge.to}` : `${edge.to}|${edge.from}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
