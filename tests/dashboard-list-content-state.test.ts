import { describe, expect, test } from 'bun:test';

import resolveDashboardListContentState from '../app/utils/resolveDashboardListContentState';

describe('resolveDashboardListContentState', () => {
  test('never reports an empty list while the request is in flight', () => {
    expect(resolveDashboardListContentState({ loading: true, rowCount: 0 })).toBe('loading');
  });

  test('keeps the skeleton while a request is in flight even if rows are still cached', () => {
    // A tab switch keeps the previous tab's rows in the shared list ref, so a
    // settled-looking count must not turn the skeleton into an "empty" claim.
    expect(resolveDashboardListContentState({ loading: true, rowCount: 12 })).toBe('loading');
  });

  test('reports the empty state once a settled request returned no rows', () => {
    expect(resolveDashboardListContentState({ loading: false, rowCount: 0 })).toBe('empty');
  });

  test('reports rows once a settled request returned rows', () => {
    expect(resolveDashboardListContentState({ loading: false, rowCount: 3 })).toBe('items');
  });
});
