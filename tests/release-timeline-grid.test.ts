import { describe, expect, test } from 'bun:test';

import buildReleaseTimelineGridRows from '../app/utils/buildReleaseTimelineGridRows';
import resolveReleaseTimelineColumnCount, {
  RELEASE_TIMELINE_PHONE_MEDIA,
  RELEASE_TIMELINE_TABLET_MEDIA,
  resolveReleaseTimelineColumnCountFromMedia,
} from '../app/utils/resolveReleaseTimelineColumnCount';
import resolveReleaseTimelineVisibleRange from '../app/utils/resolveReleaseTimelineVisibleRange';
import type { ReleaseTimelineGroup, TimelineRelease } from '../shared/types/release-follows';

const release = (id: number, overrides: Partial<TimelineRelease> = {}): TimelineRelease => ({
  repository: { id: 'R_widgets', owner: 'octo', name: 'widgets' },
  id,
  tagName: `v${id}`,
  title: `Release ${id}`,
  publishedAt: '2026-08-22T12:00:00.000Z',
  changelog: 'notes',
  changelogTruncated: false,
  assetCount: 0,
  isPrerelease: false,
  isOldestShown: false,
  htmlUrl: null,
  ...overrides,
});

const group = (date: string, ids: number[]): ReleaseTimelineGroup => ({
  date,
  items: ids.map((id) => release(id, { publishedAt: `${date}T12:00:00.000Z` })),
});

describe('resolveReleaseTimelineColumnCount', () => {
  test('uses one column at the phone breakpoint and below', () => {
    expect(resolveReleaseTimelineColumnCount(320)).toBe(1);
    expect(resolveReleaseTimelineColumnCount(700)).toBe(1);
  });

  test('uses two columns between the phone and tablet breakpoints', () => {
    expect(resolveReleaseTimelineColumnCount(701)).toBe(2);
    expect(resolveReleaseTimelineColumnCount(1100)).toBe(2);
  });

  test('uses three columns above the tablet breakpoint', () => {
    expect(resolveReleaseTimelineColumnCount(1101)).toBe(3);
    expect(resolveReleaseTimelineColumnCount(1920)).toBe(3);
  });

  test('uses the same 1 / 2 / 3 mapping as CSS max-width media queries', () => {
    const media = (phone: boolean, tablet: boolean) => ({
      matches: (query: string) => {
        if (query === RELEASE_TIMELINE_PHONE_MEDIA) return phone;
        if (query === RELEASE_TIMELINE_TABLET_MEDIA) return tablet;
        return false;
      },
    });

    expect(resolveReleaseTimelineColumnCountFromMedia(media(true, true))).toBe(1);
    expect(resolveReleaseTimelineColumnCountFromMedia(media(false, true))).toBe(2);
    expect(resolveReleaseTimelineColumnCountFromMedia(media(false, false))).toBe(3);
  });
});

describe('buildReleaseTimelineGridRows', () => {
  test('returns no rows for an empty timeline', () => {
    expect(buildReleaseTimelineGridRows([], 3)).toEqual([]);
  });

  test("places each date divider as its own full-width row ahead of that day's cards", () => {
    const rows = buildReleaseTimelineGridRows(
      [group('2026-08-22', [1, 2]), group('2026-08-21', [3])],
      3
    );

    expect(rows.map((row) => row.type)).toEqual(['date', 'cards', 'date', 'cards']);
    expect(rows[0]).toMatchObject({ type: 'date', date: '2026-08-22' });
    expect(rows[2]).toMatchObject({ type: 'date', date: '2026-08-21' });
  });

  test('packs cards into rows of the current column count and leaves a short final row', () => {
    const rows = buildReleaseTimelineGridRows([group('2026-08-22', [1, 2, 3, 4, 5])], 3);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ type: 'date', date: '2026-08-22' });
    expect(rows[1]).toMatchObject({ type: 'cards' });
    expect(rows[2]).toMatchObject({ type: 'cards' });
    if (rows[1]?.type !== 'cards' || rows[2]?.type !== 'cards') {
      throw new Error('expected card rows');
    }
    expect(rows[1].items.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(rows[2].items.map((item) => item.id)).toEqual([4, 5]);
  });

  test('uses one card per row when the timeline is a single column', () => {
    const rows = buildReleaseTimelineGridRows([group('2026-08-22', [1, 2, 3])], 1);

    expect(rows.map((row) => row.type)).toEqual(['date', 'cards', 'cards', 'cards']);
    expect(
      rows.filter((row) => row.type === 'cards').map((row) => row.items.map((item) => item.id))
    ).toEqual([[1], [2], [3]]);
  });

  test('gives every row a unique key', () => {
    const rows = buildReleaseTimelineGridRows(
      [group('2026-08-22', [1, 2, 3, 4]), group('2026-08-21', [5, 6])],
      2
    );
    const keys = rows.map((row) => row.key);

    expect(keys.every((key) => key.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('resolveReleaseTimelineVisibleRange', () => {
  const metrics = Array.from({ length: 10 }, (_, index) => ({
    top: index * 100,
    height: 100,
  }));

  test('returns an empty range when there are no rows', () => {
    expect(
      resolveReleaseTimelineVisibleRange({
        metrics: [],
        viewportTop: 0,
        viewportBottom: 400,
      })
    ).toEqual({ start: 0, end: 0 });
  });

  test('keeps only rows that intersect the viewport', () => {
    expect(
      resolveReleaseTimelineVisibleRange({
        metrics,
        viewportTop: 250,
        viewportBottom: 450,
        overscanPx: 0,
        overscanRows: 0,
        minVisibleRows: 1,
      })
    ).toEqual({ start: 2, end: 5 });
  });

  test('extends the window by overscan so nearby date and card rows stay mounted', () => {
    expect(
      resolveReleaseTimelineVisibleRange({
        metrics,
        viewportTop: 250,
        viewportBottom: 450,
        overscanPx: 0,
        overscanRows: 1,
        minVisibleRows: 1,
      })
    ).toEqual({ start: 1, end: 6 });
  });

  test('returns an empty range when the viewport does not overlap the list', () => {
    expect(
      resolveReleaseTimelineVisibleRange({
        metrics,
        viewportTop: 2000,
        viewportBottom: 2400,
        overscanPx: 0,
        overscanRows: 0,
        minVisibleRows: 1,
      })
    ).toEqual({ start: 0, end: 0 });
  });
});
