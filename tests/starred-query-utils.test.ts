import { describe, expect, mock, test } from 'bun:test';

import * as starredShared from '../shared/utils/starred';

mock.module('#shared/utils/starred', () => starredShared);

const { STARRED_DEFAULT_PER_PAGE } = starredShared;
const { parseStarredDirection, parseStarredSort } =
  await import('../server/utils/starred-query-utils');

describe('starred query utils', () => {
  test('default per_page is divisible by 3 for the starred grid', () => {
    expect(STARRED_DEFAULT_PER_PAGE % 3).toBe(0);
    expect(STARRED_DEFAULT_PER_PAGE).toBeGreaterThan(0);
    expect(STARRED_DEFAULT_PER_PAGE).toBeLessThanOrEqual(100);
  });

  test('parseStarredSort accepts created and updated, falls back otherwise', () => {
    expect(parseStarredSort('created')).toBe('created');
    expect(parseStarredSort('updated')).toBe('updated');
    expect(parseStarredSort('updated', 'created')).toBe('updated');
    expect(parseStarredSort(undefined)).toBe('created');
    expect(parseStarredSort('stars')).toBe('created');
    expect(parseStarredSort(['updated', 'created'])).toBe('updated');
    expect(parseStarredSort(null, 'updated')).toBe('updated');
  });

  test('parseStarredDirection accepts asc and desc, falls back otherwise', () => {
    expect(parseStarredDirection('asc')).toBe('asc');
    expect(parseStarredDirection('desc')).toBe('desc');
    expect(parseStarredDirection(undefined)).toBe('desc');
    expect(parseStarredDirection('up')).toBe('desc');
    expect(parseStarredDirection(['asc'])).toBe('asc');
    expect(parseStarredDirection('', 'asc')).toBe('asc');
  });
});
