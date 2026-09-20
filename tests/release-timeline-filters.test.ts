import { describe, expect, test } from 'bun:test';

import { EMPTY_DATE_RANGE } from '../app/utils/filterDateRange';
import {
  hasActiveTimelineFilter,
  toFollowedRepositoryKey,
} from '../app/utils/filterReleaseTimelineGroups';
import filterReleaseTimelineGroups from '../app/utils/filterReleaseTimelineGroups';
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

const noFilters = {
  repositories: [] as string[],
  dateRange: EMPTY_DATE_RANGE,
  query: '',
};

const widgets = release(1, { title: 'v1.4.200' });
const api = release(2, {
  repository: { id: 'R_api', owner: 'acme', name: 'api' },
  title: 'v0.10.1 — context bar default',
});
const docs = release(3, {
  repository: { id: 'R_docs', owner: 'acme', name: 'docs' },
  title: 'v0.1.5-rc.2',
  publishedAt: '2026-08-21T12:00:00.000Z',
});

const groups: ReleaseTimelineGroup[] = [
  group('2026-08-22', [widgets, api]),
  group('2026-08-21', [docs]),
];

describe('toFollowedRepositoryKey', () => {
  test('builds the canonical owner/name identity', () => {
    expect(toFollowedRepositoryKey({ id: 'R_1', owner: 'Acme', name: 'API' })).toBe('Acme/API');
  });
});

describe('hasActiveTimelineFilter', () => {
  test('is false when repositories and the date range are both empty', () => {
    expect(hasActiveTimelineFilter({ repositories: [], dateRange: EMPTY_DATE_RANGE })).toBe(false);
  });

  test('is true when repositories or either date bound is set', () => {
    expect(
      hasActiveTimelineFilter({ repositories: ['octo/widgets'], dateRange: EMPTY_DATE_RANGE })
    ).toBe(true);
    expect(
      hasActiveTimelineFilter({ repositories: [], dateRange: { from: '2026-08-01', to: null } })
    ).toBe(true);
    expect(
      hasActiveTimelineFilter({ repositories: [], dateRange: { from: null, to: '2026-08-01' } })
    ).toBe(true);
  });
});

describe('filterReleaseTimelineGroups', () => {
  test('returns the original groups when every condition is empty', () => {
    expect(filterReleaseTimelineGroups(groups, noFilters)).toBe(groups);
    expect(filterReleaseTimelineGroups(groups, { ...noFilters, query: '   ' })).toBe(groups);
  });

  test('returns an empty list for empty group lists', () => {
    expect(
      filterReleaseTimelineGroups([], {
        repositories: ['octo/widgets'],
        dateRange: { from: '2026-08-01', to: null },
        query: 'release',
      })
    ).toEqual([]);
  });

  describe('title query', () => {
    test('filters releases by title with case-insensitive partial matches', () => {
      expect(filterReleaseTimelineGroups(groups, { ...noFilters, query: 'CONTEXT BAR' })).toEqual([
        group('2026-08-22', [api]),
      ]);
      expect(filterReleaseTimelineGroups(groups, { ...noFilters, query: 'rc.2' })).toEqual([
        group('2026-08-21', [docs]),
      ]);
    });

    test('drops date groups that have no remaining title matches', () => {
      expect(filterReleaseTimelineGroups(groups, { ...noFilters, query: 'v1.4' })).toEqual([
        group('2026-08-22', [widgets]),
      ]);
    });

    test('does not match repository names, tags, or changelog text', () => {
      expect(filterReleaseTimelineGroups(groups, { ...noFilters, query: 'widgets' })).toEqual([]);
      expect(filterReleaseTimelineGroups(groups, { ...noFilters, query: 'v2.0.0' })).toEqual([]);
      expect(filterReleaseTimelineGroups(groups, { ...noFilters, query: 'notes' })).toEqual([]);
    });
  });

  describe('repositories', () => {
    test('keeps only releases from the selected repository and drops emptied groups', () => {
      expect(
        filterReleaseTimelineGroups(groups, { ...noFilters, repositories: ['acme/docs'] })
      ).toEqual([group('2026-08-21', [docs])]);
    });

    test('treats multiple selected repositories as OR within the dimension', () => {
      expect(
        filterReleaseTimelineGroups(groups, {
          ...noFilters,
          repositories: ['acme/docs', 'octo/widgets'],
        })
      ).toEqual([group('2026-08-22', [widgets]), group('2026-08-21', [docs])]);
    });

    test('drops groups whose releases belong to no selected repository', () => {
      expect(
        filterReleaseTimelineGroups(groups, { ...noFilters, repositories: ['acme/unknown'] })
      ).toEqual([]);
    });

    test('matches repository selection case-insensitively', () => {
      expect(
        filterReleaseTimelineGroups(groups, { ...noFilters, repositories: ['ACME/Docs'] })
      ).toEqual([group('2026-08-21', [docs])]);
    });
  });

  describe('date range', () => {
    test('keeps groups whose local date key falls inside the inclusive range', () => {
      expect(
        filterReleaseTimelineGroups(groups, {
          ...noFilters,
          dateRange: { from: '2026-08-21', to: '2026-08-22' },
        })
      ).toEqual(groups);
    });

    test('excludes groups outside the inclusive bounds on either end', () => {
      expect(
        filterReleaseTimelineGroups(groups, {
          ...noFilters,
          dateRange: { from: '2026-08-22', to: null },
        })
      ).toEqual([group('2026-08-22', [widgets, api])]);
      expect(
        filterReleaseTimelineGroups(groups, {
          ...noFilters,
          dateRange: { from: null, to: '2026-08-21' },
        })
      ).toEqual([group('2026-08-21', [docs])]);
      expect(
        filterReleaseTimelineGroups(groups, {
          ...noFilters,
          dateRange: { from: '2026-08-20', to: '2026-08-20' },
        })
      ).toEqual([]);
    });

    test('compares group date keys, not the published-at timestamp', () => {
      const localNextDay: ReleaseTimelineGroup[] = [
        group('2026-08-23', [
          release(9, { publishedAt: '2026-08-22T23:30:00.000Z' }),
          release(10, { publishedAt: '2026-08-23T00:30:00.000Z' }),
        ]),
      ];

      expect(
        filterReleaseTimelineGroups(localNextDay, {
          ...noFilters,
          dateRange: { from: '2026-08-23', to: '2026-08-23' },
        })
      ).toEqual(localNextDay);
    });
  });

  test('ANDs repository, date range, and title query together', () => {
    expect(
      filterReleaseTimelineGroups(groups, {
        repositories: ['acme/api', 'octo/widgets'],
        dateRange: { from: '2026-08-22', to: null },
        query: 'context bar',
      })
    ).toEqual([group('2026-08-22', [api])]);

    expect(
      filterReleaseTimelineGroups(groups, {
        repositories: ['acme/api'],
        dateRange: { from: '2026-08-01', to: '2026-08-21' },
        query: '',
      })
    ).toEqual([]);
  });
});
