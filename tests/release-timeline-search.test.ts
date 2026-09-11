import { describe, expect, test } from 'bun:test';

import filterReleaseTimelineGroupsByTitle from '../app/utils/filterReleaseTimelineGroupsByTitle';
import type { ReleaseTimelineGroup, TimelineRelease } from '../shared/types/release-follows';

const release = (id: number, overrides: Partial<TimelineRelease> = {}): TimelineRelease => ({
  repository: { id: 'R_widgets', owner: 'octo', name: 'widgets' },
  id,
  tagName: `v${id}.0.0`,
  title: `Release ${id}`,
  publishedAt: '2026-08-22T12:00:00.000Z',
  changelog: 'notes about widgets',
  changelogTruncated: false,
  assetCount: 0,
  isPrerelease: false,
  isOldestShown: false,
  htmlUrl: null,
  reactions: [],
  ...overrides,
});

const group = (date: string, items: TimelineRelease[]): ReleaseTimelineGroup => ({
  date,
  items,
});

describe('filterReleaseTimelineGroupsByTitle', () => {
  const first = release(1, { title: 'v1.4.200' });
  const second = release(2, { title: 'v0.10.1 — context bar default' });
  const third = release(3, { title: 'v0.1.5-rc.2' });
  const groups: ReleaseTimelineGroup[] = [
    group('2026-08-22', [first, second]),
    group('2026-08-21', [third]),
  ];

  test('returns the original groups for an empty or whitespace query', () => {
    expect(filterReleaseTimelineGroupsByTitle(groups, '')).toBe(groups);
    expect(filterReleaseTimelineGroupsByTitle(groups, '   ')).toBe(groups);
  });

  test('filters releases by title with case-insensitive partial matches', () => {
    expect(filterReleaseTimelineGroupsByTitle(groups, 'CONTEXT BAR')).toEqual([
      group('2026-08-22', [second]),
    ]);
    expect(filterReleaseTimelineGroupsByTitle(groups, 'rc.2')).toEqual([
      group('2026-08-21', [third]),
    ]);
  });

  test('drops date groups that have no remaining title matches', () => {
    expect(filterReleaseTimelineGroupsByTitle(groups, 'v1.4')).toEqual([
      group('2026-08-22', [first]),
    ]);
  });

  test('does not match repository names, tags, or changelog text', () => {
    expect(filterReleaseTimelineGroupsByTitle(groups, 'widgets')).toEqual([]);
    expect(filterReleaseTimelineGroupsByTitle(groups, 'v2.0.0')).toEqual([]);
    expect(filterReleaseTimelineGroupsByTitle(groups, 'notes')).toEqual([]);
  });
});
