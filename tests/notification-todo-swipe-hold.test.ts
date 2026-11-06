import { describe, expect, test } from 'bun:test';

import { resolveNotificationTodoSwipeHold } from '../app/utils/resolveNotificationTodoSwipeHold';

describe('resolveNotificationTodoSwipeHold', () => {
  test('a success whose write returns at once keeps the whole hold', () => {
    expect(resolveNotificationTodoSwipeHold({ failed: false, elapsedMs: 0 })).toBe(600);
  });

  test('a slow success draws down the hold instead of adding its latency to it', () => {
    expect(resolveNotificationTodoSwipeHold({ failed: false, elapsedMs: 300 })).toBe(300);
  });

  test('a success slower than the hold settles as soon as the write lands', () => {
    expect(resolveNotificationTodoSwipeHold({ failed: false, elapsedMs: 1_500 })).toBe(0);
  });

  test('a refusal keeps its full hold, counted from when the refusal appears', () => {
    expect(resolveNotificationTodoSwipeHold({ failed: true, elapsedMs: 0 })).toBe(1_000);
    expect(resolveNotificationTodoSwipeHold({ failed: true, elapsedMs: 1_500 })).toBe(1_000);
  });
});
