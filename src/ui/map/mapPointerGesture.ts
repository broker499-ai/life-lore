export type MapTapGestureInput = {
  pointerMatches: boolean;
  moved: boolean;
  pressedNodeId: string | null;
  activePointerCount: number;
  pinchActive: boolean;
  clickSuppressed: boolean;
};

/**
 * A node tap must be resolved from the original pointer-down target because
 * SVG pointer capture can retarget the browser-generated click on touch devices.
 */
export function resolveMapTapNodeId(input: MapTapGestureInput): string | null {
  if (!input.pointerMatches) return null;
  if (input.moved) return null;
  if (!input.pressedNodeId) return null;
  if (input.activePointerCount !== 1) return null;
  if (input.pinchActive || input.clickSuppressed) return null;
  return input.pressedNodeId;
}
