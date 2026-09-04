const MIN_DURATION_MS = 380;
const MAX_DURATION_MS = 720;
const DISTANCE_MS_PER_PX = 0.28;

export function resolveReleaseTimelineBackToTopDurationMs(
  scrollTop: number,
  prefersReducedMotion: boolean
) {
  if (prefersReducedMotion || scrollTop <= 0) {
    return 0;
  }

  return Math.min(
    MAX_DURATION_MS,
    Math.max(MIN_DURATION_MS, Math.round(scrollTop * DISTANCE_MS_PER_PX))
  );
}

export default function resolveReleaseTimelineBackToTopFrame(input: {
  startScrollTop: number;
  elapsedMs: number;
  durationMs: number;
}): { scrollTop: number; done: boolean } {
  if (input.durationMs <= 0 || input.startScrollTop <= 0) {
    return { scrollTop: 0, done: true };
  }

  const t = Math.min(1, input.elapsedMs / input.durationMs);
  const eased = 1 - (1 - t) ** 3;

  return {
    scrollTop: Math.round(input.startScrollTop * (1 - eased)),
    done: t >= 1,
  };
}
