import { describe, expect, test } from 'bun:test';

import resolveReleaseTimelineBackToTopFrame, {
  resolveReleaseTimelineBackToTopDurationMs,
} from '../app/utils/resolveReleaseTimelineBackToTopFrame';
import shouldShowReleaseTimelineBackToTop from '../app/utils/shouldShowReleaseTimelineBackToTop';

describe('shouldShowReleaseTimelineBackToTop', () => {
  test('hides the control until the timeline has scrolled about one viewport', () => {
    expect(shouldShowReleaseTimelineBackToTop(0, 800)).toBe(false);
    expect(shouldShowReleaseTimelineBackToTop(799, 800)).toBe(false);
  });

  test('shows the control after roughly one viewport of scroll', () => {
    expect(shouldShowReleaseTimelineBackToTop(800, 800)).toBe(true);
    expect(shouldShowReleaseTimelineBackToTop(1600, 800)).toBe(true);
  });

  test('hides the control when the viewport height is not yet known', () => {
    expect(shouldShowReleaseTimelineBackToTop(0, 0)).toBe(false);
    expect(shouldShowReleaseTimelineBackToTop(400, 0)).toBe(false);
  });
});

describe('resolveReleaseTimelineBackToTopDurationMs', () => {
  test('jumps instantly when the user prefers reduced motion', () => {
    expect(resolveReleaseTimelineBackToTopDurationMs(2400, true)).toBe(0);
  });

  test('uses a capped ease duration for long timelines', () => {
    expect(resolveReleaseTimelineBackToTopDurationMs(800, false)).toBe(380);
    expect(resolveReleaseTimelineBackToTopDurationMs(4000, false)).toBe(720);
  });
});

describe('resolveReleaseTimelineBackToTopFrame', () => {
  test('jumps to the top in one frame when duration is 0', () => {
    expect(
      resolveReleaseTimelineBackToTopFrame({
        startScrollTop: 1600,
        elapsedMs: 0,
        durationMs: 0,
      })
    ).toEqual({ scrollTop: 0, done: true });
  });

  test('eases out toward the top and finishes at the duration', () => {
    expect(
      resolveReleaseTimelineBackToTopFrame({
        startScrollTop: 800,
        elapsedMs: 0,
        durationMs: 400,
      })
    ).toEqual({ scrollTop: 800, done: false });

    expect(
      resolveReleaseTimelineBackToTopFrame({
        startScrollTop: 800,
        elapsedMs: 200,
        durationMs: 400,
      })
    ).toEqual({ scrollTop: 100, done: false });

    expect(
      resolveReleaseTimelineBackToTopFrame({
        startScrollTop: 800,
        elapsedMs: 400,
        durationMs: 400,
      })
    ).toEqual({ scrollTop: 0, done: true });
  });
});
