/** Movement at or under this distance is still a tap. Past it, the gesture is a pan. */
export const UNIFIED_DIFF_POINTER_SLOP_PX = 10;

/** A hold of this length, still inside the slop, becomes a long-press. */
export const UNIFIED_DIFF_LONG_PRESS_MS = 500;

export type UnifiedDiffPointerClassification = 'pending' | 'tap' | 'pan' | 'long-press';

export interface UnifiedDiffPointerSample {
  x: number;
  y: number;
  timeMs: number;
}

export interface UnifiedDiffPointerGesture {
  origin: UnifiedDiffPointerSample;
  classification: UnifiedDiffPointerClassification;
}

export function beginUnifiedDiffPointer(
  origin: UnifiedDiffPointerSample
): UnifiedDiffPointerGesture {
  return { origin, classification: 'pending' };
}

const distanceFromOrigin = (gesture: UnifiedDiffPointerGesture, point: UnifiedDiffPointerSample) =>
  Math.hypot(point.x - gesture.origin.x, point.y - gesture.origin.y);

export function moveUnifiedDiffPointer(
  gesture: UnifiedDiffPointerGesture,
  point: UnifiedDiffPointerSample
): UnifiedDiffPointerGesture {
  if (gesture.classification === 'pan' || gesture.classification === 'long-press') {
    return gesture;
  }

  if (distanceFromOrigin(gesture, point) > UNIFIED_DIFF_POINTER_SLOP_PX) {
    return { ...gesture, classification: 'pan' };
  }

  return holdUnifiedDiffPointer(gesture, point.timeMs);
}

export function holdUnifiedDiffPointer(
  gesture: UnifiedDiffPointerGesture,
  timeMs: number
): UnifiedDiffPointerGesture {
  if (gesture.classification !== 'pending') {
    return gesture;
  }

  if (timeMs - gesture.origin.timeMs >= UNIFIED_DIFF_LONG_PRESS_MS) {
    return { ...gesture, classification: 'long-press' };
  }

  return gesture;
}

export function cancelUnifiedDiffPointer(
  gesture: UnifiedDiffPointerGesture
): UnifiedDiffPointerGesture {
  if (gesture.classification === 'pending') {
    return { ...gesture, classification: 'pan' };
  }

  return gesture;
}

export function endUnifiedDiffPointer(
  gesture: UnifiedDiffPointerGesture,
  point: UnifiedDiffPointerSample
): UnifiedDiffPointerGesture {
  const moved = moveUnifiedDiffPointer(gesture, point);

  if (moved.classification === 'pending') {
    return { ...moved, classification: 'tap' };
  }

  return moved;
}
