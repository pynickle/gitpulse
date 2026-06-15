import { describe, expect, test } from 'bun:test';

import {
  createCollectionFreshnessSignature,
  createFreshnessSignature,
} from '../shared/utils/freshness';

describe('freshness signatures', () => {
  test('normalizes object key order', () => {
    expect(createFreshnessSignature({ b: 2, a: 1 })).toBe(createFreshnessSignature({ a: 1, b: 2 }));
  });

  test('builds collection signatures from stable item markers', () => {
    const first = createCollectionFreshnessSignature(
      [
        { id: 1, title: 'ignored', updated_at: '2026-06-15T10:00:00Z' },
        { id: 2, body: 'ignored', updated_at: '2026-06-15T09:00:00Z' },
      ],
      { totalCount: 2 }
    );
    const second = createCollectionFreshnessSignature(
      [
        { id: 1, title: 'changed but ignored', updated_at: '2026-06-15T10:00:00Z' },
        { id: 2, body: 'changed but ignored', updated_at: '2026-06-15T09:00:00Z' },
      ],
      { totalCount: 2 }
    );

    expect(first).toBe(second);
  });
});
