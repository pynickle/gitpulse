import { describe, expect, test } from 'bun:test';

import withPendingPaginationPage from '../app/utils/withPendingPaginationPage';

const pagination = (
  page: number,
  options: {
    hasPrev?: boolean;
    hasNext?: boolean;
    totalPages?: number | null;
  } = {}
) => ({
  page,
  perPage: 20,
  hasPrev: options.hasPrev ?? page > 1,
  hasNext: options.hasNext ?? false,
  totalCount: 40,
  totalPages: options.totalPages === undefined ? 2 : options.totalPages,
});

describe('withPendingPaginationPage', () => {
  test('returns the same object when the requested page is already current', () => {
    const current = pagination(2, { hasPrev: true, hasNext: false, totalPages: 2 });

    expect(withPendingPaginationPage(current, 2)).toBe(current);
  });

  test('jumps to a later known page before the response arrives', () => {
    expect(withPendingPaginationPage(pagination(1, { hasNext: true, totalPages: 4 }), 3)).toEqual(
      pagination(3, { hasPrev: true, hasNext: true, totalPages: 4 })
    );
  });

  test('jumps back to an earlier page and keeps later pages reachable', () => {
    expect(
      withPendingPaginationPage(
        pagination(3, { hasPrev: true, hasNext: false, totalPages: null }),
        1
      )
    ).toEqual(pagination(1, { hasPrev: false, hasNext: true, totalPages: null }));
  });

  test('keeps next available when the total is unknown and the current page has more', () => {
    expect(
      withPendingPaginationPage(pagination(1, { hasNext: true, totalPages: null }), 2)
    ).toEqual(pagination(2, { hasPrev: true, hasNext: true, totalPages: null }));
  });
});
