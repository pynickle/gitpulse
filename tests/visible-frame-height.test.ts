import { describe, expect, test } from 'bun:test';

import resolveVisibleFrameHeight from '../app/utils/resolveVisibleFrameHeight';

describe('resolveVisibleFrameHeight', () => {
  test('uses the visual viewport when the page is not pinch-zoomed', () => {
    expect(
      resolveVisibleFrameHeight({
        visualViewportHeight: 640,
        visualViewportScale: 1,
        innerHeight: 800,
      })
    ).toBe(640);
  });

  test('uses the visual viewport when scale is unknown', () => {
    expect(
      resolveVisibleFrameHeight({
        visualViewportHeight: 612.4,
        visualViewportScale: null,
        innerHeight: 800,
      })
    ).toBe(612);
  });

  test('keeps the layout viewport while pinch-zooming', () => {
    expect(
      resolveVisibleFrameHeight({
        visualViewportHeight: 400,
        visualViewportScale: 2,
        innerHeight: 800,
      })
    ).toBe(800);
  });

  test('falls back to innerHeight when the visual viewport is missing', () => {
    expect(
      resolveVisibleFrameHeight({
        visualViewportHeight: null,
        visualViewportScale: 1,
        innerHeight: 780.6,
      })
    ).toBe(781);
  });

  test('ignores a zero visual viewport height', () => {
    expect(
      resolveVisibleFrameHeight({
        visualViewportHeight: 0,
        visualViewportScale: 1,
        innerHeight: 800,
      })
    ).toBe(800);
  });
});
