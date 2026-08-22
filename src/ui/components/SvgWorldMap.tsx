import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { getRosterTotalUnits } from '@/core/armies/armyStats';
import type { MapGraph } from '@/core/map/MapGraph';
import type { MapNodeVisibility } from '@/core/map/MapVisibility';
import type { CityState } from '@/core/state/GameState';
import type { PrototypeMapRegion } from '@/data/map/prototypeMap';
import { orsiaSubfactionById } from '@/data/factions/orsiaSubfactions';
import { t } from '@/i18n/t';
import type { TranslationKey } from '@/i18n/ru';
import { resolveMapTapNodeId } from '@/ui/map/mapPointerGesture';

export type PlayerMovementAnimation = {
  id: number;
  fromNodeId: string;
  toNodeId: string;
  durationMs: number;
};

export type MapCameraSnapshot = {
  zoom: number;
  centerX: number;
  centerY: number;
};

export type SvgWorldMapProps = {
  graph: MapGraph;
  nodeVisibilityById: Record<string, MapNodeVisibility>;
  regions: PrototypeMapRegion[];
  cities: Record<string, CityState>;
  capitalFactionIdByCityId?: Record<string, string>;
  playerFactionId: string;
  rivalFactionId: string;
  rivalPortraitSrc?: string;
  selectedNodeId: string | null;
  playerNodeId: string;
  playerPortraitSrc?: string;
  playerWalkFrameSrcs?: readonly string[];
  playerMovement?: PlayerMovementAnimation | null;
  onPlayerMovementComplete?: (movementId: number) => void;
  initialCamera?: MapCameraSnapshot | null;
  onCameraChange?: (camera: MapCameraSnapshot) => void;
  rivalNodeId: string | null;
  reachableNodeIds: string[];
  movableNodeIds: string[];
  attackableNodeIds: string[];
  supplyPathNodeIds?: string[];
  onSelectNode: (nodeId: string) => void;
};

type CameraState = { zoom: number; centerX: number; centerY: number };
type WorldBounds = { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
type PointerPosition = { x: number; y: number };
type PinchState = {
  startDistance: number;
  startZoom: number;
  anchorWorldX: number;
  anchorWorldY: number;
  screenXFraction: number;
  screenYFraction: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCenterX: number;
  startCenterY: number;
  moved: boolean;
  pressedNodeId: string | null;
};

const ZOOM_LEVELS = [0.78, 1, 1.4, 2, 2.8, 3.8] as const;
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
const BASE_VIEW_HEIGHT = 116;
const BASE_WORLD_MIN = -8;
const BASE_WORLD_MAX = 108;
const WORLD_PADDING = 8;
const CAMERA_OVERSCROLL = 14;

export function SvgWorldMap({
  graph,
  nodeVisibilityById,
  regions,
  cities,
  capitalFactionIdByCityId = {},
  playerFactionId,
  rivalFactionId,
  rivalPortraitSrc,
  selectedNodeId,
  playerNodeId,
  playerPortraitSrc,
  playerWalkFrameSrcs = [],
  playerMovement = null,
  onPlayerMovementComplete,
  initialCamera = null,
  onCameraChange,
  rivalNodeId,
  reachableNodeIds,
  movableNodeIds,
  attackableNodeIds,
  supplyPathNodeIds = [],
  onSelectNode,
}: SvgWorldMapProps) {
  const worldBounds = getWorldBounds(graph);
  const initialPlayerNode = graph.nodes.find((node) => node.id === playerNodeId) ?? null;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewportAspect, setViewportAspect] = useState(1);
  const [camera, setCamera] = useState<CameraState>(() =>
    clampCamera(
      initialCamera ?? {
        zoom: 1,
        centerX: initialPlayerNode?.x ?? 50,
        centerY: initialPlayerNode?.y ?? 50,
      },
      worldBounds,
      1,
    ),
  );
  const dragRef = useRef<DragState | null>(null);
  const pointerPositionsRef = useRef(new Map<number, PointerPosition>());
  const pinchRef = useRef<PinchState | null>(null);
  const suppressNextClickRef = useRef(false);
  const movementCompleteRef = useRef(onPlayerMovementComplete);
  movementCompleteRef.current = onPlayerMovementComplete;
  const cameraChangeRef = useRef(onCameraChange);
  cameraChangeRef.current = onCameraChange;
  const [movementProgress, setMovementProgress] = useState(0);
  const movementId = playerMovement?.id ?? null;
  const movementDurationMs = playerMovement?.durationMs ?? 0;
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const reachable = new Set(reachableNodeIds);
  const movable = new Set(movableNodeIds);
  const attackable = new Set(attackableNodeIds);
  const discoveredNodeIds = graph.nodes
    .filter((node) => (nodeVisibilityById[node.id] ?? 'unknown') !== 'unknown')
    .map((node) => node.id);
  const allNodesVisible = graph.nodes.every((node) => nodeVisibilityById[node.id] === 'visible');
  const movementFromNode = playerMovement ? nodeById.get(playerMovement.fromNodeId) ?? null : null;
  const movementToNode = playerMovement ? nodeById.get(playerMovement.toNodeId) ?? null : null;
  const movementFrameIndex =
    playerWalkFrameSrcs.length > 0 && movementDurationMs > 0
      ? Math.floor((movementProgress * movementDurationMs) / 165) % playerWalkFrameSrcs.length
      : 0;
  const movementFrameSrc = playerWalkFrameSrcs[movementFrameIndex] ?? null;
  const easedMovementProgress = smoothStep(movementProgress);
  const movementX = movementFromNode && movementToNode
    ? movementFromNode.x + (movementToNode.x - movementFromNode.x) * easedMovementProgress
    : 0;
  const movementY = movementFromNode && movementToNode
    ? movementFromNode.y + (movementToNode.y - movementFromNode.y) * easedMovementProgress
    : 0;
  const movementFacesRight = !movementFromNode || !movementToNode || movementToNode.x >= movementFromNode.x;
  const supplyEdges = new Set<string>();
  for (let index = 1; index < supplyPathNodeIds.length; index += 1) {
    supplyEdges.add(edgeKey(supplyPathNodeIds[index - 1], supplyPathNodeIds[index]));
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return undefined;
    const updateAspect = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setViewportAspect(rect.width / rect.height);
    };
    updateAspect();
    const observer = new ResizeObserver(updateAspect);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCamera((current) => clampCamera(current, worldBounds, viewportAspect));
  }, [viewportAspect, worldBounds.minX, worldBounds.maxX, worldBounds.minY, worldBounds.maxY]);

  useEffect(() => {
    if (movementId === null || movementDurationMs <= 0) {
      setMovementProgress(0);
      return;
    }

    let animationFrame = 0;
    const startedAt = performance.now();
    setMovementProgress(0);

    const tick = (now: number) => {
      const nextProgress = Math.min(1, (now - startedAt) / movementDurationMs);
      setMovementProgress(nextProgress);
      if (nextProgress < 1) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        movementCompleteRef.current?.(movementId);
      }
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [movementDurationMs, movementId]);

  useEffect(() => {
    cameraChangeRef.current?.(camera);
  }, [camera]);

  const { width: viewWidth, height: viewHeight } = getViewDimensions(camera.zoom, viewportAspect);
  const viewBoxX = camera.centerX - viewWidth / 2;
  const viewBoxY = camera.centerY - viewHeight / 2;
  const zoomIndex = getNearestZoomIndex(camera.zoom);

  function setZoom(nextZoom: number, focusPlayerWhenLeavingFit = false) {
    const playerNode = nodeById.get(playerNodeId);
    setCamera((current) => {
      const center =
        focusPlayerWhenLeavingFit && current.zoom === 1 && nextZoom > 1 && playerNode
          ? { x: playerNode.x, y: playerNode.y }
          : { x: current.centerX, y: current.centerY };
      return clampCamera({ zoom: nextZoom, centerX: center.x, centerY: center.y }, worldBounds, viewportAspect);
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
    setCamera(clampCamera({ zoom, centerX: playerNode.x, centerY: playerNode.y }, worldBounds, viewportAspect));
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    zoomAroundScreenPoint(event.currentTarget, event.clientX, event.clientY, camera.zoom * (direction > 0 ? 1.16 : 0.86));
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    pointerPositionsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointerPositionsRef.current.size >= 2) {
      beginPinch(event.currentTarget);
      dragRef.current = null;
      suppressNextClickRef.current = true;
      return;
    }

    const target = event.target as Element | null;
    const pressedNodeId = target?.closest?.('.map-node')?.getAttribute('data-node-id') ?? null;
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCenterX: camera.centerX,
      startCenterY: camera.centerY,
      moved: false,
      pressedNodeId,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointerPositionsRef.current.has(event.pointerId)) return;
    pointerPositionsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointerPositionsRef.current.size >= 2) {
      if (!pinchRef.current) beginPinch(event.currentTarget);
      const pinch = pinchRef.current;
      const [a, b] = [...pointerPositionsRef.current.values()];
      if (!pinch || !a || !b) return;
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const nextZoom = clampZoom(pinch.startZoom * (distance / pinch.startDistance));
      const { width: nextViewWidth, height: nextViewHeight } = getViewDimensions(nextZoom, viewportAspect);
      setCamera(clampCamera({
        zoom: nextZoom,
        centerX: pinch.anchorWorldX - (pinch.screenXFraction - 0.5) * nextViewWidth,
        centerY: pinch.anchorWorldY - (pinch.screenYFraction - 0.5) * nextViewHeight,
      }, worldBounds, viewportAspect));
      suppressNextClickRef.current = true;
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const { width: currentViewWidth, height: currentViewHeight } = getViewDimensions(camera.zoom, viewportAspect);
    const next = clampCamera({
      zoom: camera.zoom,
      centerX: drag.startCenterX - (dx / rect.width) * currentViewWidth,
      centerY: drag.startCenterY - (dy / rect.height) * currentViewHeight,
    }, worldBounds, viewportAspect);
    setCamera(next);
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const tappedNodeId = drag
      ? resolveMapTapNodeId({
          pointerMatches: drag.pointerId === event.pointerId,
          moved: drag.moved,
          pressedNodeId: drag.pressedNodeId,
          activePointerCount: pointerPositionsRef.current.size,
          pinchActive: Boolean(pinchRef.current),
          clickSuppressed: suppressNextClickRef.current,
        })
      : null;

    if (drag && drag.pointerId === event.pointerId) {
      if (drag.moved) suppressNextClickRef.current = true;
      dragRef.current = null;
    }
    pointerPositionsRef.current.delete(event.pointerId);
    pinchRef.current = null;
    if (pointerPositionsRef.current.size === 1) {
      const [remainingId, remaining] = [...pointerPositionsRef.current.entries()][0] ?? [];
      if (remainingId !== undefined && remaining) {
        dragRef.current = {
          pointerId: remainingId,
          startClientX: remaining.x,
          startClientY: remaining.y,
          startCenterX: camera.centerX,
          startCenterY: camera.centerY,
          moved: true,
          pressedNodeId: null,
        };
      }
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (tappedNodeId) {
      // Pointer capture makes browser-generated click targeting inconsistent on touch.
      // Resolve a clean tap here instead of relying on the synthetic click event.
      onSelectNode(tappedNodeId);
      suppressNextClickRef.current = false;
    } else if (pointerPositionsRef.current.size === 0) {
      // A finished pan/pinch should suppress only the browser click belonging to that gesture,
      // not the next independent tap on a node.
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    }
  }

  function handlePointerCancel(event: ReactPointerEvent<SVGSVGElement>) {
    pointerPositionsRef.current.delete(event.pointerId);
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    pinchRef.current = null;
    suppressNextClickRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }


  function beginPinch(svg: SVGSVGElement) {
    const [a, b] = [...pointerPositionsRef.current.values()];
    if (!a || !b) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const midpointX = (a.x + b.x) / 2;
    const midpointY = (a.y + b.y) / 2;
    const screenXFraction = clamp01((midpointX - rect.left) / rect.width);
    const screenYFraction = clamp01((midpointY - rect.top) / rect.height);
    const { width: currentViewWidth, height: currentViewHeight } = getViewDimensions(camera.zoom, viewportAspect);
    pinchRef.current = {
      startDistance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startZoom: camera.zoom,
      anchorWorldX: camera.centerX + (screenXFraction - 0.5) * currentViewWidth,
      anchorWorldY: camera.centerY + (screenYFraction - 0.5) * currentViewHeight,
      screenXFraction,
      screenYFraction,
    };
  }

  function zoomAroundScreenPoint(svg: SVGSVGElement, clientX: number, clientY: number, requestedZoom: number) {
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const fx = clamp01((clientX - rect.left) / rect.width);
    const fy = clamp01((clientY - rect.top) / rect.height);
    setCamera((current) => {
      const nextZoom = clampZoom(requestedZoom);
      const { width: currentViewWidth, height: currentViewHeight } = getViewDimensions(current.zoom, viewportAspect);
      const anchorWorldX = current.centerX + (fx - 0.5) * currentViewWidth;
      const anchorWorldY = current.centerY + (fy - 0.5) * currentViewHeight;
      const { width: nextViewWidth, height: nextViewHeight } = getViewDimensions(nextZoom, viewportAspect);
      return clampCamera({
        zoom: nextZoom,
        centerX: anchorWorldX - (fx - 0.5) * nextViewWidth,
        centerY: anchorWorldY - (fy - 0.5) * nextViewHeight,
      }, worldBounds, viewportAspect);
    });
  }

  return (
    <div className={`map-frame${camera.zoom > 1 ? ' is-zoomed' : ''}`}>
      <div className="map-camera-controls" aria-label="Масштаб карты">
        <button type="button" onClick={zoomOut} disabled={camera.zoom <= MIN_ZOOM + 0.01} aria-label="Уменьшить карту">−</button>
        <button type="button" className="camera-zoom-toggle" onClick={cycleZoom} title="Переключить масштаб">
          {Math.round(camera.zoom * 100)}%
        </button>
        <button type="button" onClick={zoomIn} disabled={camera.zoom >= MAX_ZOOM - 0.01} aria-label="Увеличить карту">+</button>
        <button type="button" onClick={focusPlayer} title="Центрировать на экспедиции" aria-label="Центрировать на экспедиции">⌖</button>
      </div>

      <svg
        ref={svgRef}
        className="world-map"
        viewBox={`${viewBoxX} ${viewBoxY} ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label="Схематическая карта Орсии"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <defs>
          <clipPath id="playerPortraitClip" clipPathUnits="userSpaceOnUse">
            <circle cx="0" cy="0" r="3.15" />
          </clipPath>
          <clipPath id="cityOwnerPortraitClip" clipPathUnits="objectBoundingBox">
            <circle cx="0.5" cy="0.5" r="0.5" />
          </clipPath>
          <mask id="mapFogMask" maskUnits="userSpaceOnUse" x={worldBounds.minX} y={worldBounds.minY} width={worldBounds.width} height={worldBounds.height}>
            <rect x={worldBounds.minX} y={worldBounds.minY} width={worldBounds.width} height={worldBounds.height} fill="white" />
            {discoveredNodeIds.map((nodeId) => {
              const node = nodeById.get(nodeId);
              if (!node) return null;
              const visibility = nodeVisibilityById[nodeId] ?? 'unknown';
              return (
                <circle
                  key={`fog-hole-${nodeId}`}
                  cx={node.x}
                  cy={node.y}
                  r={visibility === 'visible' ? 15 : 10.5}
                  fill="black"
                />
              );
            })}
          </mask>
          <radialGradient id="caveGlow" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="rgba(163, 192, 132, 0.12)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        <rect x={worldBounds.minX} y={worldBounds.minY} width={worldBounds.width} height={worldBounds.height} rx="6" className="map-bg" />
        <rect x={worldBounds.minX} y={worldBounds.minY} width={worldBounds.width} height={worldBounds.height} rx="6" fill="url(#caveGlow)" />

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

        {!allNodesVisible ? (
          <rect
            x={worldBounds.minX}
            y={worldBounds.minY}
            width={worldBounds.width}
            height={worldBounds.height}
            className="map-fog-unknown"
            mask="url(#mapFogMask)"
            aria-hidden="true"
          />
        ) : null}

        {graph.edges.map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;
          const fromVisibility = nodeVisibilityById[from.id] ?? 'unknown';
          const toVisibility = nodeVisibilityById[to.id] ?? 'unknown';
          if (fromVisibility === 'unknown' || toVisibility === 'unknown') return null;
          const touchesPlayer = edge.from === playerNodeId || edge.to === playerNodeId;
          const isSupplyRoute = supplyEdges.has(edgeKey(edge.from, edge.to));
          const isExploredRoute = fromVisibility !== 'visible' && toVisibility !== 'visible';
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={`map-edge${touchesPlayer ? ' is-local-route' : ''}${isSupplyRoute ? ' is-supply-route' : ''}${isExploredRoute ? ' is-explored' : ''}`}
            />
          );
        })}

        {graph.nodes.map((node) => {
          const visibility = nodeVisibilityById[node.id] ?? 'unknown';
          const isChartedSettlement = visibility === 'unknown' && node.kind === 'city';
          if (visibility === 'unknown' && !isChartedSettlement) return null;
          const isVisible = visibility === 'visible';
          const isSelected = node.id === selectedNodeId;
          const isPlayer = node.id === playerNodeId && !playerMovement;
          const isReachable = isVisible && reachable.has(node.id);
          const canMove = isVisible && movable.has(node.id);
          const canAttack = isVisible && attackable.has(node.id);
          const city = cities[node.id];
          const capitalFactionId = capitalFactionIdByCityId[node.id] ?? null;
          const capitalOrsiaOwner = capitalFactionId ? orsiaSubfactionById[capitalFactionId] ?? null : null;
          const isKnownCapital = Boolean(capitalFactionId);
          const isOwned = isVisible && city?.ownerFactionId === playerFactionId;
          const isRivalOwned = isVisible && city?.ownerFactionId === rivalFactionId;
          const isNeutral = isVisible && city?.ownerFactionId === null;
          const orsiaOwner = isVisible && city?.ownerFactionId ? orsiaSubfactionById[city.ownerFactionId] : null;
          const knownCapitalPortraitSrc = capitalFactionId === playerFactionId
            ? playerPortraitSrc ?? null
            : capitalFactionId === rivalFactionId
              ? rivalPortraitSrc ?? null
              : capitalOrsiaOwner?.portraitSrc ?? null;
          const cityOwnerPortraitSrc = isVisible && city
            ? city.ownerFactionId === playerFactionId
              ? playerPortraitSrc ?? null
              : city.ownerFactionId === rivalFactionId
                ? rivalPortraitSrc ?? null
                : orsiaOwner?.portraitSrc ?? null
            : isKnownCapital
              ? knownCapitalPortraitSrc
              : null;
          const isRival = isVisible && node.id === rivalNodeId;
          const isPoi = node.kind === 'poi';
          const garrisonUnits = isVisible && city ? getRosterTotalUnits(city.garrison.roster) : 0;
          const classes = [
            'map-node',
            visibility === 'explored' ? 'is-explored' : '',
            isChartedSettlement ? 'is-charted-settlement' : '',
            isKnownCapital ? 'is-known-capital' : '',
            capitalFactionId === playerFactionId ? 'is-capital-player' : '',
            capitalFactionId === rivalFactionId ? 'is-capital-rival' : '',
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
            orsiaOwner ? `is-${orsiaOwner.mapClass}` : capitalOrsiaOwner ? `is-${capitalOrsiaOwner.mapClass}` : '',
          ].filter(Boolean).join(' ');

          return (
            <g
              key={node.id}
              className={classes}
              data-node-id={node.id}
              role="button"
              tabIndex={0}
              aria-label={t(node.nameKey as TranslationKey)}
              onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectNode(node.id);
                }
              }}
            >
              {isChartedSettlement && capitalFactionId ? <title>{`Известная столица · ${getFactionCapitalLabel(capitalFactionId)}`}</title> : isChartedSettlement ? <title>Поселение отмечено на карте · разведданных нет</title> : orsiaOwner ? <title>{`Орсия · ${orsiaOwner.name}`}</title> : visibility === 'explored' ? <title>Разведано ранее · текущая обстановка неизвестна</title> : null}
              <circle cx={node.x} cy={node.y} r={8.2} className="node-hit-target" aria-hidden="true" />
              {(canMove || canAttack) && !isPlayer ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.isCentral ? 6.4 : isPoi ? 5.1 : 5.8}
                  className={`reachability-pulse${canAttack ? ' is-attack' : ''}`}
                  aria-hidden="true"
                />
              ) : null}
              {isPlayer ? (
                <g className="player-location-highlight" aria-hidden="true">
                  <circle cx={node.x} cy={node.y} r="7.4" className="player-location-halo" />
                  <circle cx={node.x} cy={node.y} r="5.9" className="player-location-ring" />
                  <g className="player-here-badge" transform={`translate(${node.x} ${node.y - 8.3})`}>
                    <rect x="-4.9" y="-1.55" width="9.8" height="3.1" rx="1.25" />
                    <text x="0" y="0.7" textAnchor="middle">ВЫ ЗДЕСЬ</text>
                  </g>
                </g>
              ) : null}
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
                  <circle cx={node.x} cy={node.y} r="4.25" className="node-disc" />
                  {cityOwnerPortraitSrc ? (
                    <>
                      <image
                        href={cityOwnerPortraitSrc}
                        x={node.x - 3.45}
                        y={node.y - 3.45}
                        width="6.9"
                        height="6.9"
                        preserveAspectRatio="xMidYMid slice"
                        clipPath="url(#cityOwnerPortraitClip)"
                        className="city-owner-portrait"
                      />
                      <circle cx={node.x} cy={node.y} r="3.55" className="city-owner-portrait-border" />
                    </>
                  ) : (
                    <path
                      className="city-mark"
                      d={`M ${node.x - 1.9} ${node.y + 1.3} v -2.4 h 3.8 v 2.4 z M ${node.x - 1.25} ${node.y - 1.1} v -1.2 h 1.05 v 1.2 M ${node.x + 0.45} ${node.y - 1.1} v -1.7 h 1 v 1.7`}
                    />
                  )}
                </>
              )}

              {isKnownCapital && node.kind === 'city' ? (
                <g className="capital-badge" transform={`translate(${node.x - 4.7} ${node.y - 4.4})`} aria-hidden="true">
                  <path d="M -1.6 0.8 L -1.25 -1.25 L 0 -0.2 L 1.25 -1.25 L 1.6 0.8 Z" />
                </g>
              ) : null}
              {isOwned ? <circle cx={node.x} cy={node.y} r="5.2" className="ownership-ring" /> : null}
              {garrisonUnits > 0 && !isOwned && !isRivalOwned ? (
                <g className="garrison-badge" transform={`translate(${node.x + 4.1} ${node.y + 3.8})`}>
                  <circle r="2.35" />
                  <text x="0" y="0.8" textAnchor="middle">{garrisonUnits}</text>
                </g>
              ) : null}
              {isPlayer ? (
                <g className="player-token player-portrait-token" transform={`translate(${node.x + 5.6} ${node.y - 5.4})`}>
                  <circle r="3.65" className="player-token-bg player-portrait-bg" />
                  {playerPortraitSrc ? (
                    <image
                      href={playerPortraitSrc}
                      x="-3.35"
                      y="-3.35"
                      width="6.7"
                      height="6.7"
                      preserveAspectRatio="xMidYMid meet"
                      clipPath="url(#playerPortraitClip)"
                      className="player-portrait-image"
                    />
                  ) : (
                    <path d="M -0.7 1 L 0 -1.15 L 0.8 1 Z" />
                  )}
                  <circle r="3.3" className="player-portrait-border" />
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

        {movementFromNode && movementToNode && movementFrameSrc ? (
          <g
            className="player-movement-sprite"
            transform={`translate(${movementX} ${movementY})`}
            aria-hidden="true"
          >
            <ellipse cx="0" cy="1.15" rx="2.55" ry="0.72" className="player-movement-shadow" />
            <g transform={movementFacesRight ? undefined : 'scale(-1 1)'}>
              <image
                href={movementFrameSrc}
                x="-4.25"
                y="-10.55"
                width="8.5"
                height="11.9"
                preserveAspectRatio="xMidYMax meet"
                className="player-walk-frame"
              />
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  );
}


function getFactionCapitalLabel(factionId: string): string {
  const orsia = orsiaSubfactionById[factionId];
  if (orsia) return orsia.name;
  if (factionId === 'expedition') return 'Экспедиция';
  if (factionId === 'rival-expedition') return 'Конкурирующая экспедиция';
  return factionId;
}

function smoothStep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function clampCamera(camera: CameraState, bounds: WorldBounds, viewportAspect: number): CameraState {
  const zoom = clampZoom(camera.zoom);
  const { width: viewWidth, height: viewHeight } = getViewDimensions(zoom, viewportAspect);
  const halfWidth = viewWidth / 2;
  const halfHeight = viewHeight / 2;
  // Camera bounds are deliberately wider than the drawn world. This small
  // overscroll lets edge locations move away from the screen bezel / command deck
  // instead of becoming awkward to tap simply because they sit at the graph edge.
  const minCenterX = bounds.minX - CAMERA_OVERSCROLL + halfWidth;
  const maxCenterX = bounds.maxX + CAMERA_OVERSCROLL - halfWidth;
  const minCenterY = bounds.minY - CAMERA_OVERSCROLL + halfHeight;
  const maxCenterY = bounds.maxY + CAMERA_OVERSCROLL - halfHeight;
  return {
    zoom,
    centerX: minCenterX > maxCenterX ? (bounds.minX + bounds.maxX) / 2 : Math.min(maxCenterX, Math.max(minCenterX, camera.centerX)),
    centerY: minCenterY > maxCenterY ? (bounds.minY + bounds.maxY) / 2 : Math.min(maxCenterY, Math.max(minCenterY, camera.centerY)),
  };
}

function getViewDimensions(zoom: number, viewportAspect: number): { width: number; height: number } {
  const height = BASE_VIEW_HEIGHT / clampZoom(zoom);
  const safeAspect = Number.isFinite(viewportAspect) && viewportAspect > 0.2 ? viewportAspect : 1;
  return { width: height * safeAspect, height };
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function getWorldBounds(graph: MapGraph): WorldBounds {
  const xs = graph.nodes.map((node) => node.x);
  const ys = graph.nodes.map((node) => node.y);
  const minX = Math.min(BASE_WORLD_MIN, ...xs.map((value) => value - WORLD_PADDING));
  const maxX = Math.max(BASE_WORLD_MAX, ...xs.map((value) => value + WORLD_PADDING));
  const minY = Math.min(BASE_WORLD_MIN, ...ys.map((value) => value - WORLD_PADDING));
  const maxY = Math.max(BASE_WORLD_MAX, ...ys.map((value) => value + WORLD_PADDING));
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
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
