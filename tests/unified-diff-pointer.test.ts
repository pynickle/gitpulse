import { describe, expect, test } from 'bun:test';

import {
  beginUnifiedDiffPointer,
  endUnifiedDiffPointer,
  holdUnifiedDiffPointer,
  moveUnifiedDiffPointer,
  UNIFIED_DIFF_LONG_PRESS_MS,
  UNIFIED_DIFF_POINTER_SLOP_PX,
} from '../shared/utils/unified-diff-pointer';

describe('unified diff pointer classification', () => {
  test('a tap inside the slop is a tap', () => {
    const started = beginUnifiedDiffPointer({ x: 12, y: 30, timeMs: 0 });
    const moved = moveUnifiedDiffPointer(started, {
      x: 12 + UNIFIED_DIFF_POINTER_SLOP_PX,
      y: 30,
      timeMs: 80,
    });
    const ended = endUnifiedDiffPointer(moved, {
      x: 12 + UNIFIED_DIFF_POINTER_SLOP_PX,
      y: 30,
      timeMs: 140,
    });

    expect(ended.classification).toBe('tap');
  });

  test('a horizontal pan past the slop stays a pan when the finger releases', () => {
    const started = beginUnifiedDiffPointer({ x: 12, y: 30, timeMs: 0 });
    const moved = moveUnifiedDiffPointer(started, {
      x: 12 + UNIFIED_DIFF_POINTER_SLOP_PX + 1,
      y: 30,
      timeMs: 90,
    });
    const ended = endUnifiedDiffPointer(moved, {
      x: 12 + UNIFIED_DIFF_POINTER_SLOP_PX + 24,
      y: 31,
      timeMs: UNIFIED_DIFF_LONG_PRESS_MS + 40,
    });

    expect(moved.classification).toBe('pan');
    expect(ended.classification).toBe('pan');
  });

  test('a long-press followed by a drag stays a long-press', () => {
    const started = beginUnifiedDiffPointer({ x: 12, y: 30, timeMs: 0 });
    const held = holdUnifiedDiffPointer(started, UNIFIED_DIFF_LONG_PRESS_MS);
    const dragged = moveUnifiedDiffPointer(held, {
      x: 12 + UNIFIED_DIFF_POINTER_SLOP_PX + 28,
      y: 36,
      timeMs: UNIFIED_DIFF_LONG_PRESS_MS + 70,
    });
    const ended = endUnifiedDiffPointer(dragged, {
      x: 12 + UNIFIED_DIFF_POINTER_SLOP_PX + 36,
      y: 40,
      timeMs: UNIFIED_DIFF_LONG_PRESS_MS + 130,
    });

    expect(held.classification).toBe('long-press');
    expect(dragged.classification).toBe('long-press');
    expect(ended.classification).toBe('long-press');
  });
});
