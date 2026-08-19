import { describe, expect, it } from 'vitest';
import { resolveMapTapNodeId } from './mapPointerGesture';

describe('map pointer gestures', () => {
  it('keeps a clean touch tap on a city selectable even when the SVG owns pointer capture', () => {
    expect(resolveMapTapNodeId({
      pointerMatches: true,
      moved: false,
      pressedNodeId: 'moss-market',
      activePointerCount: 1,
      pinchActive: false,
      clickSuppressed: false,
    })).toBe('moss-market');
  });

  it('does not turn a pan or pinch into an accidental city selection', () => {
    expect(resolveMapTapNodeId({
      pointerMatches: true,
      moved: true,
      pressedNodeId: 'moss-market',
      activePointerCount: 1,
      pinchActive: false,
      clickSuppressed: false,
    })).toBeNull();
    expect(resolveMapTapNodeId({
      pointerMatches: true,
      moved: false,
      pressedNodeId: 'moss-market',
      activePointerCount: 2,
      pinchActive: true,
      clickSuppressed: true,
    })).toBeNull();
  });
});
