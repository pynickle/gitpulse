import { describe, expect, test } from 'bun:test';

import {
  createCollectionFreshnessSignature,
  createFreshnessSignature,
} from '../shared/utils/freshness';

describe('freshness signatures', () => {
  test('sorts object keys', () => {
    expect(createFreshnessSignature({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  test('marks a collection by item identity and update time', () => {
    expect(
      createCollectionFreshnessSignature(
        [
          { id: 1, title: 'ignored', updated_at: '2026-06-15T10:00:00Z' },
          { id: 2, body: 'ignored', updatedAt: '2026-06-15T09:00:00Z' },
        ],
        { totalCount: 2 }
      )
    ).toBe(
      '{"items":[{"id":1,"sha":null,"state":null,"updated":"2026-06-15T10:00:00Z"},{"id":2,"sha":null,"state":null,"updated":"2026-06-15T09:00:00Z"}],"totalCount":2}'
    );
  });
});
