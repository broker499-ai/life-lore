import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type { MapGraph } from '@/core/map/MapGraph';
import type { CityState } from '@/core/state/GameState';
import type { PrototypeMapRegion } from '@/data/map/prototypeMap';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';
import { t } from '@/i18n/t';
import type { TranslationKey } from '@/i18n/ru';

export type SvgWorldMapProps = {
  graph: MapGraph;
  regions: PrototypeMapRegion[];
  cities: Record<string, CityState>;
  playerFactionId: string;
  rivalFactionId: string;
  selectedNodeId: string | null;
  playerNodeId: string;
  rivalNodeId: string | null;
  reachableNodeIds: string[];
  movableNodeIds: string[];
  attackableNodeIds: string[];
  supplyPathNodeIds?: string[];
  onSelectNode: (nodeId: string) => void;
};

type CameraState = { zoom: number; centerX: number; centerY: number };
type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCenterX: number;
  startCenterY: number;
  moved: boolean;
};

const ZOOM_LEVELS = [1, 1.35, 1.75, 2.2] as const;
const WORLD_MIN = -4;
const WORLD_MAX = 104;
const WORLD_SIZE = WORLD_MAX - WORLD_MIN;

export function SvgWorldMap({
  graph,
  regions,
  cities,
  playerFactionId,
  rivalFactionId,
  selectedNodeId,
  playerNodeId,
  rivalNodeId,
  reachableNodeIds,
  movableNodeIds,
  attackableNodeIds,
  supplyPathNodeIds = [],
  onSelectNode,
}: SvgWorldMapProps) {
  const [camera, setCamera] = useState<CameraState>({ zoom: 1, centerX: 50, centerY: 50 });
  const dragRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const reachable = new Set(reachableNodeIds);
  const movable = new Set(movableNodeIds);
  const attackable = new Set(attackableNodeIds);
  const supplyEdges = new Set<string>();
  for (let index = 1; index < supplyPathNodeIds.length; index += 1) {
    supplyEdges.add(edgeKey(supplyPathNodeIds[index - 1], supplyPathNodeIds[index]));
  }

  const viewSize = WORLD_SIZE / camera.zoom;
  const viewBoxX = camera.centerX - viewSize / 2;
  const viewBoxY = camera.centerY - viewSize / 2;
  const zoomIndex = getNearestZoomIndex(camera.zoom);

  function setZoom(nextZoom: number, focusPlayerWhenLeavingFit = false) {
    const playerNode = nodeById.get(playerNodeId);
    setCamera((current) => {
      const center =
        focusPlayerWhenLeavingFit && current.zoom === 1 && nextZoom > 1 && playerNode
          ? { x: playerNode.x, y: playerNode.y }
          : { x: current.centerX, y: current.centerY };
      return clampCamera({ zoom: nextZoom, centerX: center.x, centerY: center.y });
    });
  }

  function zoomIn() {
    const nextIndex = Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1);
    setZoom(ZOOM_LEVELS[nextIndex], true);
  }

  function zoomOut() {
    const nextIndex = Math.max(0, zoomIndex - 1);
    setZoom(ZOOM_LEVELS[nextIndex]);
  }

  function cycleZoom() {
    const nextIndex = (zoomIndex + 1) % ZOOM_LEVELS.length;
    setZoom(ZOOM_LEVELS[nextIndex], nextIndex > 0);
  }

  function focusPlayer() {
    const playerNode = nodeById.get(playerNodeId);
    if (!playerNode) return;
    const zoom = camera.zoom === 1 ? ZOOM_LEVELS[2] : camera.zoom;
    setCamera(clampCamera({ zoom, centerX: playerNode.x, centerY: playerNode.y }));
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    if (event.deltaY < 0) zoomIn();
    else if (event.deltaY > 0) zoomOut();
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (camera.zoom <= 1 || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCenterX: camera.centerX,
      startCenterY: camera.centerY,
      moved: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const currentViewSize = WORLD_SIZE / camera.zoom;
    const next = clampCamera({
      zoom: camera.zoom,
      centerX: drag.startCenterX - (dx / rect.width) * currentViewSize,
      centerY: drag.startCenterY - (dy / rect.height) * currentViewSize,
    });
    setCamera(next);
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressNextClickRef.current = drag.moved;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function selectNode(nodeId: string) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    onSelectNode(nodeId);
  }

  return (
    <div className={`map-frame${camera.zoom > 1 ? ' is-zoomed' : ''}`}>
      <div className="map-camera-controls" aria-label="Масштаб карты">
        <button type="button" onClick={zoomOut} disabled={zoomIndex === 0} aria-label="Уменьшить карту">−</button>
        <button type="button" className="camera-zoom-toggle" onClick={cycleZoom} title="Переключить масштаб">
          {Math.round(camera.zoom * 100)}%
        </button>
        <button type="button" onClick={zoomIn} disabled={zoomIndex === ZOOM_LEVELS.length - 1} aria-label="Увеличить карту">+</button>
        <button type="button" onClick={focusPlayer} title="Центрировать на экспедиции" aria-label="Центрировать на экспедиции">⌖</button>
      </div>

      <svg
        className="world-map"
        viewBox={`${viewBoxX} ${viewBoxY} ${viewSize} ${viewSize}`}
        role="img"
        aria-label="Схематическая карта Орсии"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <radialGradient id="caveGlow" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="rgba(163, 192, 132, 0.12)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        <rect width="100" height="100" rx="6" className="map-bg" />
        <rect width="100" height="100" rx="6" fill="url(#caveGlow)" />

        <g className="map-regions" aria-hidden="true">
          {regions.map((region) => (
            <ellipse
              key={region.id}
              cx={region.cx}
              cy={region.cy}
              rx={region.rx}
              ry={region.ry}
              className={`map-region is-${region.kind}`}
            />
          ))}
          <path className="cave-contour" d="M4 90 C12 75, 8 59, 20 49 S37 31, 49 30 S69 38, 82 48 S88 72, 97 91" />
          <path className="cave-contour is-faint" d="M7 96 C25 83, 38 82, 52 79 S79 80, 95 94" />
          <path className="cave-contour is-faint" d="M21 58 C34 52, 43 39, 52 27 S63 18, 77 15" />
          <g className="fungal-decor">
            <circle cx="45" cy="67" r="1.1" />
            <circle cx="51" cy="62" r="0.7" />
            <circle cx="60" cy="66" r="0.9" />
            <circle cx="66" cy="61" r="0.65" />
          </g>
        </g>

        {graph.edges.map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;
          const touchesPlayer = edge.from === playerNodeId || edge.to === playerNodeId;
          const isSupplyRoute = supplyEdges.has(edgeKey(edge.from, edge.to));
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={`map-edge${touchesPlayer ? ' is-local-route' : ''}${isSupplyRoute ? ' is-supply-route' : ''}`}
            />
          );
        })}

        {graph.nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const isPlayer = node.id === playerNodeId;
          const isReachable = reachable.has(node.id);
          const canMove = movable.has(node.id);
          const canAttack = attackable.has(node.id);
          const city = cities[node.id];
          const isOwned = city?.ownerFactionId === playerFactionId;
          const isRivalOwned = city?.ownerFactionId === rivalFactionId;
          const isNeutral = city?.ownerFactionId === null;
          const orsiaOwner = city?.ownerFactionId ? orsiaSubfactionById[city.ownerFactionId] : null;
          const isRival = node.id === rivalNodeId;
          const isPoi = node.kind === 'poi';
          const garrisonUnits = city ? getRosterTotalUnits(city.garrison.roster) : 0;
          const classes = [
            'map-node',
            isSelected ? 'is-selected' : '',
            node.isCentral ? 'is-central' : '',
            isPoi ? 'is-poi' : '',
            isReachable ? 'is-reachable' : '',
            canMove ? 'is-movable' : '',
            canAttack ? 'is-attackable' : '',
            isReachable && !canMove && !canAttack ? 'is-unavailable' : '',
            isOwned ? 'is-owned' : '',
            isRivalOwned ? 'is-rival-owned' : '',
            isNeutral ? 'is-neutral' : '',
            orsiaOwner ? `is-${orsiaOwner.mapClass}` : '',
          ].filter(Boolean).join(' ');

          return (
            <g
              key={node.id}
              className={classes}
              role="button"
              tabIndex={0}
              aria-label={t(node.nameKey as TranslationKey)}
              onClick={() => selectNode(node.id)}
              onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectNode(node.id);
                }
              }}
            >
              {orsiaOwner ? <title>{`Орсия · ${orsiaOwner.name}`}</title> : null}
              {node.isCentral ? (
                <>
                  <circle cx={node.x} cy={node.y} r="6.4" className="central-glow" filter="url(#softGlow)" />
                  <circle cx={node.x} cy={node.y} r="4.5" className="node-disc" />
                  <path
                    className="root-mark"
                    d={`M ${node.x} ${node.y - 2.1} v 2.8 m 0 -1 l -1.8 2.2 m 1.8 -2.2 l 1.8 2.2 m -1.8 -3.4 c -1.2 -1.5 -2.4 -1.2 -3 -0.4 m 3 0.4 c 1.2 -1.5 2.4 -1.2 3 -0.4`}
                  />
                </>
              ) : isPoi ? (
                <>
                  <circle cx={node.x} cy={node.y} r="3.3" className="node-disc poi-disc" />
                  <path
                    className="poi-mark"
                    d={`M ${node.x} ${node.y - 1.8} L ${node.x + 1.8} ${node.y} L ${node.x} ${node.y + 1.8} L ${node.x - 1.8} ${node.y} Z`}
                  />
                </>
              ) : (
                <>
                  <circle cx={node.x} cy={node.y} r="3.9" className="node-disc" />
                  <path
                    className="city-mark"
                    d={`M ${node.x - 1.9} ${node.y + 1.3} v -2.4 h 3.8 v 2.4 z M ${node.x - 1.25} ${node.y - 1.1} v -1.2 h 1.05 v 1.2 M ${node.x + 0.45} ${node.y - 1.1} v -1.7 h 1 v 1.7`}
                  />
                </>
              )}

              {isOwned ? <circle cx={node.x} cy={node.y} r="5.2" className="ownership-ring" /> : null}
              {garrisonUnits > 0 && !isOwned && !isRivalOwned ? (
                <g className="garrison-badge" transform={`translate(${node.x + 4.1} ${node.y + 3.8})`}>
                  <circle r="2.35" />
                  <text x="0" y="0.8" textAnchor="middle">{garrisonUnits}</text>
                </g>
              ) : null}
              {isPlayer ? (
                <g className="player-token" transform={`translate(${node.x + 5.1} ${node.y - 4.9})`}>
                  <circle r="2.25" className="player-token-bg" />
                  <path d="M -0.7 1 L 0 -1.15 L 0.8 1 Z" />
                </g>
              ) : null}
              {isRival ? (
                <g className="rival-token" transform={`translate(${node.x - 5.1} ${node.y - 4.9})`}>
                  <circle r="2.25" className="rival-token-bg" />
                  <path d="M -1 -0.8 L 1 -0.8 L 0 1.05 Z" />
                </g>
              ) : null}
              <text className="node-label" x={node.x} y={node.y + (isPoi ? 6.1 : 7.2)} textAnchor="middle">
                {splitMapLabel(t(node.nameKey as TranslationKey)).map((line, index) => (
                  <tspan key={`${line}-${index}`} x={node.x} dy={index === 0 ? 0 : 2.4}>{line}</tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function clampCamera(camera: CameraState): CameraState {
  const size = WORLD_SIZE / camera.zoom;
  const half = size / 2;
  return {
    zoom: camera.zoom,
    centerX: Math.min(WORLD_MAX - half, Math.max(WORLD_MIN + half, camera.centerX)),
    centerY: Math.min(WORLD_MAX - half, Math.max(WORLD_MIN + half, camera.centerY)),
  };
}

function getNearestZoomIndex(zoom: number): number {
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  ZOOM_LEVELS.forEach((candidate, index) => {
    const delta = Math.abs(candidate - zoom);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function splitMapLabel(label: string): string[] {
  if (label.length <= 17 || !label.includes(' ')) return [label];
  const words = label.split(' ');
  let bestIndex = 1;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(' ');
    const right = words.slice(index).join(' ');
    const delta = Math.abs(left.length - right.length);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }
  return [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')];
}
