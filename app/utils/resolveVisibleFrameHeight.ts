const PINCH_SCALE_MIN = 0.99;
const PINCH_SCALE_MAX = 1.01;

/**
 * Height of the currently visible layout frame, in CSS pixels.
 *
 * Mobile browsers overlay toolbar chrome on top of `100vh` (and often `100dvh`).
 * `visualViewport.height` matches what the user can actually see, but it also
 * shrinks during pinch-zoom — those frames should keep the layout viewport.
 */
export default function resolveVisibleFrameHeight(input: {
  visualViewportHeight: number | null;
  visualViewportScale: number | null;
  innerHeight: number;
}): number {
  const innerHeight = Math.max(0, input.innerHeight);
  const visualHeight = input.visualViewportHeight;
  const scale = input.visualViewportScale;

  if (
    visualHeight != null &&
    visualHeight > 0 &&
    (scale == null || (scale >= PINCH_SCALE_MIN && scale <= PINCH_SCALE_MAX))
  ) {
    return Math.round(visualHeight);
  }

  return Math.round(innerHeight);
}
