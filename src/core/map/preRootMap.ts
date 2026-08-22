import { randomInt } from '@/core/rng/seededRandom';
import type { RngState } from '@/core/rng/RngState';
import type { GameState, NodeId } from '@/core/state/GameState';
import type { MapEdge, MapGraph, MapNode } from '@/core/map/MapGraph';
import { prototypeMap } from '@/data/map/prototypeMap';

export const PRE_ROOT_CLASSIC_LAYOUT_ID = 'classic';

/**
 * Stage 52 replaces the three near-identical campaign layouts with seven
 * topologically distinct maps. The legacy ids stay renderable for existing
 * v25 saves, but new campaigns only roll from this list.
 */
export const PRE_ROOT_LAYOUT_IDS = [
  'ridge',
  'delta',
  'cavern-archipelago',
  'ring',
  'abyss',
  'false-root-orbit',
  'false-root-labyrinth',
] as const;

const LEGACY_PRE_ROOT_LAYOUT_IDS = ['braided', 'terraces', 'broken-ring'] as const;
export type PreRootLayoutId =
  | typeof PRE_ROOT_CLASSIC_LAYOUT_ID
  | (typeof PRE_ROOT_LAYOUT_IDS)[number]
  | (typeof LEGACY_PRE_ROOT_LAYOUT_IDS)[number];

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
 * Expedition starts and the final Root-approach nodes are positioned by each layout.
 */
export const PRE_ROOT_RANDOMIZED_LOCATION_IDS = prototypeMap.nodes
  .map((node) => node.id)
  .filter((nodeId) => !PRE_ROOT_FIXED_NODE_IDS.includes(nodeId as (typeof PRE_ROOT_FIXED_NODE_IDS)[number]));

const nodeTemplateById = Object.fromEntries(
  prototypeMap.nodes.map((node) => [node.id, { ...node }]),
) as Record<string, MapNode>;

const SLOT_IDS = PRE_ROOT_RANDOMIZED_LOCATION_IDS.map((_, index) => `slot-${String(index + 1).padStart(2, '0')}`);

type SlotPoint = { id: string; x: number; y: number };
type FixedPointKey = 'player' | 'rival' | 'almost' | 'limit' | 'root';
type Point = { x: number; y: number };
type LayoutDefinition = {
  id: Exclude<PreRootLayoutId, 'classic'>;
  label: string;
  slots: SlotPoint[];
  edges: Array<[string, string]>;
  fixed?: Partial<Record<FixedPointKey, Point>>;
  /** A side branch used only after the false Root is resolved. */
  extensionExitSlot?: string;
  extensionDirection?: 'left' | 'right';
};

const DEFAULT_FIXED: Record<FixedPointKey, Point> = {
  player: { x: 6, y: 98 },
  rival: { x: 94, y: 98 },
  almost: { x: 50, y: 19 },
  limit: { x: 50, y: 9 },
  root: { x: 50, y: -1 },
};

const newLayouts: LayoutDefinition[] = [
  // 1. Ridge — a readable main spine with short lateral pockets.
  {
    id: 'ridge',
    label: 'Хребет',
    fixed: {
      player: { x: 10, y: 96 }, rival: { x: 90, y: 96 },
      almost: { x: 50, y: 22 }, limit: { x: 50, y: 12 }, root: { x: 50, y: 2 },
    },
    slots: [
      { id: 'slot-01', x: 18, y: 86 }, { id: 'slot-02', x: 34, y: 84 },
      { id: 'slot-03', x: 66, y: 84 }, { id: 'slot-04', x: 82, y: 86 },
      { id: 'slot-05', x: 30, y: 74 }, { id: 'slot-06', x: 50, y: 74 },
      { id: 'slot-07', x: 70, y: 74 }, { id: 'slot-08', x: 22, y: 62 },
      { id: 'slot-09', x: 42, y: 62 }, { id: 'slot-10', x: 58, y: 62 },
      { id: 'slot-11', x: 78, y: 62 }, { id: 'slot-12', x: 34, y: 50 },
      { id: 'slot-13', x: 50, y: 50 }, { id: 'slot-14', x: 66, y: 50 },
      { id: 'slot-15', x: 42, y: 37 }, { id: 'slot-16', x: 58, y: 37 },
    ],
    edges: [
      ['player', 'slot-01'], ['player', 'slot-02'], ['rival', 'slot-03'], ['rival', 'slot-04'],
      ['slot-01', 'slot-05'], ['slot-02', 'slot-05'], ['slot-02', 'slot-06'],
      ['slot-03', 'slot-06'], ['slot-03', 'slot-07'], ['slot-04', 'slot-07'],
      ['slot-05', 'slot-08'], ['slot-05', 'slot-09'], ['slot-06', 'slot-09'], ['slot-06', 'slot-10'],
      ['slot-07', 'slot-10'], ['slot-07', 'slot-11'], ['slot-08', 'slot-12'], ['slot-09', 'slot-12'],
      ['slot-09', 'slot-13'], ['slot-10', 'slot-13'], ['slot-10', 'slot-14'], ['slot-11', 'slot-14'],
      ['slot-12', 'slot-15'], ['slot-13', 'slot-15'], ['slot-13', 'slot-16'], ['slot-14', 'slot-16'],
      ['slot-15', 'almost'], ['slot-16', 'almost'], ['almost', 'limit'], ['limit', 'root'],
    ],
  },

  // 2. Delta — two broad routes repeatedly split and rejoin before the Root.
  {
    id: 'delta',
    label: 'Дельта',
    fixed: {
      player: { x: 8, y: 94 }, rival: { x: 92, y: 94 },
      almost: { x: 50, y: 20 }, limit: { x: 50, y: 11 }, root: { x: 50, y: 2 },
    },
    slots: [
      { id: 'slot-01', x: 18, y: 84 }, { id: 'slot-02', x: 34, y: 82 },
      { id: 'slot-03', x: 66, y: 82 }, { id: 'slot-04', x: 82, y: 84 },
      { id: 'slot-05', x: 18, y: 70 }, { id: 'slot-06', x: 34, y: 68 },
      { id: 'slot-07', x: 50, y: 70 }, { id: 'slot-08', x: 66, y: 68 },
      { id: 'slot-09', x: 82, y: 70 }, { id: 'slot-10', x: 26, y: 56 },
      { id: 'slot-11', x: 42, y: 54 }, { id: 'slot-12', x: 58, y: 54 },
      { id: 'slot-13', x: 74, y: 56 }, { id: 'slot-14', x: 36, y: 42 },
      { id: 'slot-15', x: 64, y: 42 }, { id: 'slot-16', x: 50, y: 30 },
    ],
    edges: [
      ['player', 'slot-01'], ['player', 'slot-02'], ['rival', 'slot-03'], ['rival', 'slot-04'],
      ['slot-01', 'slot-05'], ['slot-02', 'slot-06'], ['slot-02', 'slot-07'],
      ['slot-03', 'slot-07'], ['slot-03', 'slot-08'], ['slot-04', 'slot-09'],
      ['slot-05', 'slot-10'], ['slot-06', 'slot-10'], ['slot-06', 'slot-11'],
      ['slot-07', 'slot-11'], ['slot-07', 'slot-12'], ['slot-08', 'slot-12'],
      ['slot-08', 'slot-13'], ['slot-09', 'slot-13'],
      ['slot-10', 'slot-14'], ['slot-11', 'slot-14'], ['slot-12', 'slot-15'], ['slot-13', 'slot-15'],
      ['slot-14', 'slot-16'], ['slot-15', 'slot-16'], ['slot-16', 'almost'], ['almost', 'limit'], ['limit', 'root'],
    ],
  },

  // 4. Cavern archipelago — obvious local clusters connected by sparse long tunnels.
  {
    id: 'cavern-archipelago',
    label: 'Архипелаг пещер',
    fixed: {
      player: { x: 8, y: 95 }, rival: { x: 92, y: 95 },
      almost: { x: 52, y: 20 }, limit: { x: 52, y: 10 }, root: { x: 52, y: 0 },
    },
    slots: [
      { id: 'slot-01', x: 16, y: 85 }, { id: 'slot-02', x: 30, y: 88 },
      { id: 'slot-03', x: 70, y: 88 }, { id: 'slot-04', x: 84, y: 85 },
      { id: 'slot-05', x: 20, y: 73 }, { id: 'slot-06', x: 34, y: 70 },
      { id: 'slot-07', x: 66, y: 70 }, { id: 'slot-08', x: 80, y: 73 },
      { id: 'slot-09', x: 40, y: 56 }, { id: 'slot-10', x: 52, y: 58 },
      { id: 'slot-11', x: 66, y: 54 }, { id: 'slot-12', x: 35, y: 41 },
      { id: 'slot-13', x: 50, y: 43 }, { id: 'slot-14', x: 65, y: 40 },
      { id: 'slot-15', x: 43, y: 29 }, { id: 'slot-16', x: 60, y: 29 },
    ],
    edges: [
      ['player', 'slot-01'], ['player', 'slot-02'], ['rival', 'slot-03'], ['rival', 'slot-04'],
      ['slot-01', 'slot-05'], ['slot-02', 'slot-05'], ['slot-02', 'slot-06'],
      ['slot-03', 'slot-07'], ['slot-04', 'slot-07'], ['slot-04', 'slot-08'],
      ['slot-05', 'slot-06'], ['slot-07', 'slot-08'],
      ['slot-06', 'slot-09'], ['slot-07', 'slot-11'], ['slot-09', 'slot-10'], ['slot-10', 'slot-11'],
      ['slot-09', 'slot-12'], ['slot-10', 'slot-13'], ['slot-11', 'slot-14'],
      ['slot-12', 'slot-13'], ['slot-13', 'slot-14'], ['slot-12', 'slot-15'],
      ['slot-13', 'slot-15'], ['slot-13', 'slot-16'], ['slot-14', 'slot-16'],
      ['slot-15', 'almost'], ['slot-16', 'almost'], ['almost', 'limit'], ['limit', 'root'],
    ],
  },

  // 5. Ring — a conspicuous empty center; clockwise and counter-clockwise routes stay readable.
  {
    id: 'ring',
    label: 'Кольцо',
    fixed: {
      player: { x: 40, y: 98 }, rival: { x: 60, y: 98 },
      almost: { x: 50, y: 20 }, limit: { x: 50, y: 12 }, root: { x: 50, y: 4 },
    },
    slots: [
      { id: 'slot-01', x: 30, y: 88 }, { id: 'slot-02', x: 70, y: 88 },
      { id: 'slot-03', x: 18, y: 78 }, { id: 'slot-04', x: 82, y: 78 },
      { id: 'slot-05', x: 12, y: 62 }, { id: 'slot-06', x: 88, y: 62 },
      { id: 'slot-07', x: 16, y: 46 }, { id: 'slot-08', x: 84, y: 46 },
      { id: 'slot-09', x: 27, y: 34 }, { id: 'slot-10', x: 73, y: 34 },
      { id: 'slot-11', x: 40, y: 28 }, { id: 'slot-12', x: 60, y: 28 },
      { id: 'slot-13', x: 5, y: 70 }, { id: 'slot-14', x: 95, y: 70 },
      { id: 'slot-15', x: 8, y: 38 }, { id: 'slot-16', x: 92, y: 38 },
    ],
    edges: [
      ['player', 'slot-01'], ['rival', 'slot-02'], ['slot-01', 'slot-02'],
      ['slot-01', 'slot-03'], ['slot-02', 'slot-04'], ['slot-03', 'slot-05'], ['slot-04', 'slot-06'],
      ['slot-05', 'slot-07'], ['slot-06', 'slot-08'], ['slot-07', 'slot-09'], ['slot-08', 'slot-10'],
      ['slot-09', 'slot-11'], ['slot-10', 'slot-12'], ['slot-11', 'slot-12'],
      ['slot-11', 'almost'], ['slot-12', 'almost'], ['almost', 'limit'], ['limit', 'root'],
      ['slot-03', 'slot-13'], ['slot-13', 'slot-05'], ['slot-04', 'slot-14'], ['slot-14', 'slot-06'],
      ['slot-07', 'slot-15'], ['slot-15', 'slot-09'], ['slot-08', 'slot-16'], ['slot-16', 'slot-10'],
    ],
  },

  // 6. Abyss — routes visibly skirt a large blank central chasm and meet only above it.
  {
    id: 'abyss',
    label: 'Провал',
    fixed: {
      player: { x: 10, y: 94 }, rival: { x: 90, y: 94 },
      almost: { x: 72, y: 28 }, limit: { x: 81, y: 22 }, root: { x: 90, y: 15 },
    },
    slots: [
      { id: 'slot-01', x: 16, y: 84 }, { id: 'slot-02', x: 30, y: 86 },
      { id: 'slot-03', x: 70, y: 86 }, { id: 'slot-04', x: 84, y: 84 },
      { id: 'slot-05', x: 14, y: 68 }, { id: 'slot-06', x: 28, y: 70 },
      { id: 'slot-07', x: 72, y: 70 }, { id: 'slot-08', x: 88, y: 68 },
      { id: 'slot-09', x: 12, y: 50 }, { id: 'slot-10', x: 28, y: 52 },
      { id: 'slot-11', x: 72, y: 52 }, { id: 'slot-12', x: 90, y: 50 },
      { id: 'slot-13', x: 20, y: 34 }, { id: 'slot-14', x: 38, y: 34 },
      { id: 'slot-15', x: 62, y: 34 }, { id: 'slot-16', x: 78, y: 34 },
    ],
    edges: [
      ['player', 'slot-01'], ['player', 'slot-02'], ['rival', 'slot-03'], ['rival', 'slot-04'],
      ['slot-01', 'slot-05'], ['slot-02', 'slot-06'], ['slot-05', 'slot-06'],
      ['slot-03', 'slot-07'], ['slot-04', 'slot-08'], ['slot-07', 'slot-08'],
      ['slot-05', 'slot-09'], ['slot-06', 'slot-10'], ['slot-09', 'slot-10'],
      ['slot-07', 'slot-11'], ['slot-08', 'slot-12'], ['slot-11', 'slot-12'],
      ['slot-09', 'slot-13'], ['slot-10', 'slot-14'], ['slot-11', 'slot-15'],
      ['slot-13', 'slot-14'], ['slot-14', 'slot-15'], ['slot-15', 'slot-16'],
      ['slot-16', 'almost'], ['almost', 'limit'], ['limit', 'root'],
    ],
  },

  // Central false Root A — ring/spokes make the false objective the visual gravity well.
  // After the revelation a new tunnel opens from the upper-right branch, not from the Root itself.
  {
    id: 'false-root-orbit',
    label: 'Ложный центр: Орбита',
    fixed: {
      player: { x: 50, y: 98 }, rival: { x: 92, y: 90 },
      almost: { x: 50, y: 66 }, limit: { x: 50, y: 57 }, root: { x: 50, y: 49 },
    },
    extensionExitSlot: 'slot-08',
    extensionDirection: 'right',
    slots: [
      { id: 'slot-01', x: 28, y: 90 }, { id: 'slot-02', x: 72, y: 90 },
      { id: 'slot-03', x: 14, y: 78 }, { id: 'slot-04', x: 86, y: 76 },
      { id: 'slot-05', x: 10, y: 60 }, { id: 'slot-06', x: 90, y: 58 },
      { id: 'slot-07', x: 16, y: 42 }, { id: 'slot-08', x: 84, y: 40 },
      { id: 'slot-09', x: 30, y: 28 }, { id: 'slot-10', x: 70, y: 28 },
      { id: 'slot-11', x: 50, y: 22 }, { id: 'slot-12', x: 32, y: 68 },
      { id: 'slot-13', x: 68, y: 68 }, { id: 'slot-14', x: 30, y: 52 },
      { id: 'slot-15', x: 70, y: 52 }, { id: 'slot-16', x: 50, y: 75 },
    ],
    edges: [
      ['player', 'slot-01'], ['player', 'slot-02'], ['rival', 'slot-04'],
      ['slot-01', 'slot-03'], ['slot-02', 'slot-04'], ['slot-03', 'slot-05'], ['slot-04', 'slot-06'],
      ['slot-05', 'slot-07'], ['slot-06', 'slot-08'], ['slot-07', 'slot-09'], ['slot-08', 'slot-10'],
      ['slot-09', 'slot-11'], ['slot-10', 'slot-11'],
      ['slot-03', 'slot-12'], ['slot-12', 'slot-14'], ['slot-13', 'slot-15'],
      ['slot-14', 'slot-16'], ['slot-15', 'slot-16'], ['slot-16', 'almost'],
      ['slot-07', 'slot-14'], ['slot-08', 'slot-15'],
      ['almost', 'limit'], ['limit', 'root'],
    ],
  },

  // Central false Root B — a serpentine maze wraps around the central objective.
  // The real continuation later tears open from the opposite (upper-left) branch.
  {
    id: 'false-root-labyrinth',
    label: 'Ложный центр: Лабиринт',
    fixed: {
      player: { x: 12, y: 92 }, rival: { x: 88, y: 92 },
      almost: { x: 50, y: 64 }, limit: { x: 50, y: 56 }, root: { x: 50, y: 48 },
    },
    extensionExitSlot: 'slot-13',
    extensionDirection: 'left',
    slots: [
      { id: 'slot-01', x: 24, y: 88 }, { id: 'slot-02', x: 40, y: 86 },
      { id: 'slot-03', x: 60, y: 86 }, { id: 'slot-04', x: 76, y: 88 },
      { id: 'slot-05', x: 18, y: 72 }, { id: 'slot-06', x: 34, y: 72 },
      { id: 'slot-07', x: 66, y: 72 }, { id: 'slot-08', x: 82, y: 72 },
      { id: 'slot-09', x: 16, y: 54 }, { id: 'slot-10', x: 32, y: 56 },
      { id: 'slot-11', x: 68, y: 56 }, { id: 'slot-12', x: 84, y: 54 },
      { id: 'slot-13', x: 20, y: 36 }, { id: 'slot-14', x: 36, y: 38 },
      { id: 'slot-15', x: 64, y: 38 }, { id: 'slot-16', x: 80, y: 36 },
    ],
    edges: [
      ['player', 'slot-01'], ['rival', 'slot-04'],
      ['slot-01', 'slot-05'], ['slot-05', 'slot-09'], ['slot-09', 'slot-13'],
      ['slot-13', 'slot-14'], ['slot-14', 'slot-10'], ['slot-10', 'slot-06'], ['slot-06', 'slot-02'],
      ['slot-02', 'slot-03'], ['slot-03', 'slot-07'], ['slot-07', 'slot-11'],
      ['slot-11', 'slot-15'], ['slot-15', 'slot-16'], ['slot-16', 'slot-12'],
      ['slot-12', 'slot-08'], ['slot-08', 'slot-04'],
      ['slot-14', 'slot-15'], ['slot-06', 'slot-07'],
      ['slot-10', 'almost'], ['slot-11', 'almost'], ['almost', 'limit'], ['limit', 'root'],
    ],
  },
];

/** Legacy Stage 34 layouts are kept solely so old v25 saves do not change map mid-campaign. */
const legacyLayouts: LayoutDefinition[] = [
  {
    id: 'braided', label: 'Переплетение',
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
    id: 'terraces', label: 'Террасы',
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
    id: 'broken-ring', label: 'Разорванное кольцо',
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

const allLayouts = [...newLayouts, ...legacyLayouts];
const layoutById = Object.fromEntries(allLayouts.map((layout) => [layout.id, layout])) as Record<string, LayoutDefinition>;

export type PreRootMapRoll = {
  layoutId: (typeof PRE_ROOT_LAYOUT_IDS)[number];
  locationOrder: NodeId[];
  rngState: RngState;
};

export type PreRootExtensionRoute = {
  entryNodeId: NodeId;
  direction: 'standard' | 'left' | 'right';
  anchor: Point;
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
  const layout = layoutById[state.campaign.preRootLayoutId] ?? newLayouts[0];
  const order = normalizeLocationOrder(state.campaign.preRootLocationOrder);
  const locationBySlot = Object.fromEntries(SLOT_IDS.map((slotId, index) => [slotId, order[index]]));
  const fixed = resolveFixedPoints(layout);

  const nodes: MapNode[] = [];
  const outer = nodeTemplateById['outer-post'];
  const rival = nodeTemplateById['rival-post'];
  const almost = nodeTemplateById['almost-root'];
  const limit = nodeTemplateById['root-limit'];
  const root = nodeTemplateById['root-sanctum'];
  if (!outer || !rival || !almost || !limit || !root) throw new Error('Missing fixed pre-root node templates');

  nodes.push({ ...outer, ...fixed.player });
  nodes.push({ ...rival, ...fixed.rival });
  for (const slot of layout.slots) {
    const locationId = locationBySlot[slot.id];
    const template = locationId ? nodeTemplateById[locationId] : null;
    if (!template) throw new Error(`Missing randomized pre-root node template for ${slot.id}`);
    nodes.push({ ...template, x: slot.x, y: slot.y });
  }
  nodes.push({ ...almost, ...fixed.almost });
  nodes.push({ ...limit, ...fixed.limit });
  nodes.push({ ...root, ...fixed.root });

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

/**
 * Most layouts continue from the false Root as before. The two central-false-root
 * maps instead open a new tunnel from a peripheral branch, making the revelation
 * a genuine reversal rather than a straight continuation through the centre.
 */
export function getPreRootExtensionRoute(state: GameState): PreRootExtensionRoute {
  const layout = layoutById[state.campaign.preRootLayoutId];
  if (!layout?.extensionExitSlot || !layout.extensionDirection) {
    const root = getPreRootMap(state).nodes.find((node) => node.id === 'root-sanctum');
    return { entryNodeId: 'root-sanctum', direction: 'standard', anchor: { x: root?.x ?? 50, y: root?.y ?? -1 } };
  }

  const order = normalizeLocationOrder(state.campaign.preRootLocationOrder);
  const slotIndex = SLOT_IDS.indexOf(layout.extensionExitSlot);
  const entryNodeId = order[slotIndex];
  const anchor = layout.slots.find((slot) => slot.id === layout.extensionExitSlot);
  if (!entryNodeId || !anchor) {
    return { entryNodeId: 'root-sanctum', direction: 'standard', anchor: resolveFixedPoints(layout).root };
  }
  return { entryNodeId, direction: layout.extensionDirection, anchor: { x: anchor.x, y: anchor.y } };
}

export function getPreRootLayoutLabel(layoutId: string): string {
  if (layoutId === PRE_ROOT_CLASSIC_LAYOUT_ID) return 'Классическая карта';
  return layoutById[layoutId]?.label ?? 'Карта Орсии';
}

function resolveFixedPoints(layout: LayoutDefinition): Record<FixedPointKey, Point> {
  return {
    player: layout.fixed?.player ?? DEFAULT_FIXED.player,
    rival: layout.fixed?.rival ?? DEFAULT_FIXED.rival,
    almost: layout.fixed?.almost ?? DEFAULT_FIXED.almost,
    limit: layout.fixed?.limit ?? DEFAULT_FIXED.limit,
    root: layout.fixed?.root ?? DEFAULT_FIXED.root,
  };
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
