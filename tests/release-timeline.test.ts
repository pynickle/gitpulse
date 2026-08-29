import { describe, expect, test } from 'bun:test';

import type {
  FollowedRepository,
  RepositoryReleaseItem,
  RepositoryReleaseLookup,
} from '../shared/types/release-follows';
import { assembleReleaseTimeline, classifyLookups } from '../shared/utils/release-timeline';

const repo = (
  overrides: Partial<FollowedRepository> & Pick<FollowedRepository, 'id'>
): FollowedRepository => ({
  owner: overrides.owner ?? 'octo',
  name: overrides.name ?? `repo-${overrides.id}`,
  ...overrides,
});

const release = (
  overrides: Partial<RepositoryReleaseItem> & Pick<RepositoryReleaseItem, 'id' | 'publishedAt'>
): RepositoryReleaseItem => ({
  tagName: overrides.tagName ?? `v${overrides.id}`,
  name: overrides.name ?? null,
  description: overrides.description ?? null,
  isDraft: overrides.isDraft ?? false,
  isPrerelease: overrides.isPrerelease ?? false,
  assetCount: overrides.assetCount ?? 0,
  htmlUrl: overrides.htmlUrl ?? null,
  ...overrides,
});

const available = (
  follow: FollowedRepository,
  releases: RepositoryReleaseItem[],
  hasOlderReleases = false
): RepositoryReleaseLookup => ({
  status: 'available',
  owner: follow.owner,
  name: follow.name,
  hasOlderReleases,
  releases,
});

describe('classifyLookups', () => {
  const widgets = repo({ id: 'R_widgets', name: 'widgets' });
  const tools = repo({ id: 'R_tools', name: 'tools' });
  const scripts = repo({ id: 'R_scripts', name: 'scripts' });
  const follows = [widgets, tools, scripts];

  test('maps null and explicit not-found to Unavailable Followed Repositories', () => {
    expect(
      classifyLookups(follows, {
        R_widgets: null,
        R_tools: { status: 'unavailable' },
        R_scripts: available(scripts, []),
      })
    ).toEqual({
      availableIds: ['R_scripts'],
      unavailableIds: ['R_widgets', 'R_tools'],
      transientIds: [],
    });
  });

  test('maps request errors and missing results to transient failures', () => {
    expect(
      classifyLookups(follows, {
        R_widgets: { status: 'transient' },
        R_tools: { status: 'error' },
      })
    ).toEqual({
      availableIds: [],
      unavailableIds: [],
      transientIds: ['R_widgets', 'R_tools', 'R_scripts'],
    });
  });

  test('maps a failed bulk lookup to all-transient with zero Unavailable', () => {
    expect(classifyLookups(follows, null)).toEqual({
      availableIds: [],
      unavailableIds: [],
      transientIds: ['R_widgets', 'R_tools', 'R_scripts'],
    });
    expect(classifyLookups(follows, {})).toEqual({
      availableIds: [],
      unavailableIds: [],
      transientIds: ['R_widgets', 'R_tools', 'R_scripts'],
    });
  });
});

describe('assembleReleaseTimeline', () => {
  test('returns empty groups and does not invent failures when there are no Followed Repositories', () => {
    expect(assembleReleaseTimeline([], {}, { timeZone: 'UTC' })).toEqual({
      groups: [],
      unavailableIds: [],
      transientIds: [],
    });
  });

  test('merges published releases by publishedAt, newest first, across repositories', () => {
    const widgets = repo({ id: 'R_widgets', name: 'widgets' });
    const tools = repo({ id: 'R_tools', name: 'tools' });

    const timeline = assembleReleaseTimeline(
      [widgets, tools],
      {
        R_widgets: available(widgets, [
          release({
            id: 1,
            publishedAt: '2026-08-20T12:00:00.000Z',
            name: 'Widgets older',
          }),
          release({
            id: 3,
            publishedAt: '2026-08-22T12:00:00.000Z',
            name: 'Widgets newest',
          }),
        ]),
        R_tools: available(tools, [
          release({
            id: 2,
            publishedAt: '2026-08-21T12:00:00.000Z',
            name: 'Tools middle',
          }),
        ]),
      },
      { timeZone: 'UTC' }
    );

    expect(timeline.groups).toHaveLength(3);
    expect(timeline.groups.map((group) => group.items.map((item) => item.title))).toEqual([
      ['Widgets newest'],
      ['Tools middle'],
      ['Widgets older'],
    ]);
  });

  test('drops drafts and items without publishedAt, and keeps prereleases', () => {
    const widgets = repo({ id: 'R_widgets', name: 'widgets' });

    const timeline = assembleReleaseTimeline(
      [widgets],
      {
        R_widgets: available(widgets, [
          release({
            id: 1,
            publishedAt: '2026-08-22T12:00:00.000Z',
            name: 'Stable',
          }),
          release({
            id: 2,
            publishedAt: '2026-08-21T12:00:00.000Z',
            name: 'Draft',
            isDraft: true,
          }),
          release({
            id: 3,
            publishedAt: null,
            name: 'Unpublished',
          }),
          release({
            id: 4,
            publishedAt: '2026-08-20T12:00:00.000Z',
            name: 'Beta',
            isPrerelease: true,
          }),
        ]),
      },
      { timeZone: 'UTC' }
    );

    expect(timeline.groups.flatMap((group) => group.items.map((item) => item.title))).toEqual([
      'Stable',
      'Beta',
    ]);
    expect(
      timeline.groups.flatMap((group) => group.items.map((item) => item.isPrerelease))
    ).toEqual([false, true]);
  });

  test('gives a Followed Repository with no published releases no cards', () => {
    const empty = repo({ id: 'R_empty', name: 'empty' });
    const live = repo({ id: 'R_live', name: 'live' });

    const timeline = assembleReleaseTimeline(
      [empty, live],
      {
        R_empty: available(empty, [
          release({ id: 1, publishedAt: '2026-08-21T12:00:00.000Z', isDraft: true, name: 'Draft' }),
        ]),
        R_live: available(live, [
          release({ id: 2, publishedAt: '2026-08-22T12:00:00.000Z', name: 'Live' }),
        ]),
      },
      { timeZone: 'UTC' }
    );

    expect(timeline.groups).toEqual([
      {
        date: '2026-08-22',
        items: [
          expect.objectContaining({
            title: 'Live',
            repository: { id: 'R_live', owner: 'octo', name: 'live' },
          }),
        ],
      },
    ]);
  });

  test('groups by the viewer local calendar date from publishedAt', () => {
    const widgets = repo({ id: 'R_widgets', name: 'widgets' });
    const publishedAt = '2026-08-29T03:00:00.000Z';

    const utc = assembleReleaseTimeline(
      [widgets],
      {
        R_widgets: available(widgets, [release({ id: 1, publishedAt, name: 'Near midnight' })]),
      },
      { timeZone: 'UTC' }
    );
    const newYork = assembleReleaseTimeline(
      [widgets],
      {
        R_widgets: available(widgets, [release({ id: 1, publishedAt, name: 'Near midnight' })]),
      },
      { timeZone: 'America/New_York' }
    );

    expect(utc.groups.map((group) => group.date)).toEqual(['2026-08-29']);
    expect(newYork.groups.map((group) => group.date)).toEqual(['2026-08-28']);
  });

  test('marks Oldest Shown Release only when older releases remain unloaded', () => {
    const truncated = repo({ id: 'R_truncated', name: 'truncated' });
    const complete = repo({ id: 'R_complete', name: 'complete' });

    const timeline = assembleReleaseTimeline(
      [truncated, complete],
      {
        R_truncated: available(
          truncated,
          [
            release({ id: 10, publishedAt: '2026-08-22T12:00:00.000Z', name: 'Truncated newest' }),
            release({ id: 9, publishedAt: '2026-08-10T12:00:00.000Z', name: 'Truncated oldest' }),
          ],
          true
        ),
        R_complete: available(
          complete,
          [
            release({ id: 2, publishedAt: '2026-08-21T12:00:00.000Z', name: 'Complete newest' }),
            release({ id: 1, publishedAt: '2026-08-01T12:00:00.000Z', name: 'Complete oldest' }),
          ],
          false
        ),
      },
      { timeZone: 'UTC' }
    );

    const flags = Object.fromEntries(
      timeline.groups.flatMap((group) =>
        group.items.map((item) => [item.title, item.isOldestShown])
      )
    );

    expect(flags).toEqual({
      'Truncated newest': false,
      'Complete newest': false,
      'Truncated oldest': true,
      'Complete oldest': false,
    });
  });

  test('truncates changelog text at 500 characters and flags when more text exists', () => {
    const widgets = repo({ id: 'R_widgets', name: 'widgets' });
    const longBody = `${'A'.repeat(500)}B`;
    const exactBody = 'C'.repeat(500);
    const shortBody = 'Short notes';

    const timeline = assembleReleaseTimeline(
      [widgets],
      {
        R_widgets: available(widgets, [
          release({
            id: 3,
            publishedAt: '2026-08-22T12:00:00.000Z',
            name: 'Long',
            description: longBody,
          }),
          release({
            id: 2,
            publishedAt: '2026-08-21T12:00:00.000Z',
            name: 'Exact',
            description: exactBody,
          }),
          release({
            id: 1,
            publishedAt: '2026-08-20T12:00:00.000Z',
            name: 'Short',
            description: shortBody,
          }),
        ]),
      },
      { timeZone: 'UTC' }
    );

    const [longItem, exactItem, shortItem] = timeline.groups.flatMap((group) => group.items);

    expect(longItem?.changelog).toBe('A'.repeat(500));
    expect(longItem?.changelogTruncated).toBe(true);
    expect(exactItem?.changelog).toBe(exactBody);
    expect(exactItem?.changelogTruncated).toBe(false);
    expect(shortItem?.changelog).toBe(shortBody);
    expect(shortItem?.changelogTruncated).toBe(false);
  });

  test('keeps successful repositories when others are unavailable or transient', () => {
    const live = repo({ id: 'R_live', name: 'live' });
    const gone = repo({ id: 'R_gone', name: 'gone' });
    const flaky = repo({ id: 'R_flaky', name: 'flaky' });
    const missing = repo({ id: 'R_missing', name: 'missing' });

    const timeline = assembleReleaseTimeline(
      [live, gone, flaky, missing],
      {
        R_live: available(live, [
          release({ id: 1, publishedAt: '2026-08-22T12:00:00.000Z', name: 'Live' }),
        ]),
        R_gone: null,
        R_flaky: { status: 'transient' },
      },
      { timeZone: 'UTC' }
    );

    expect(timeline.groups.flatMap((group) => group.items.map((item) => item.title))).toEqual([
      'Live',
    ]);
    expect(timeline.unavailableIds).toEqual(['R_gone']);
    expect(timeline.transientIds).toEqual(['R_flaky', 'R_missing']);
  });

  test('uses the fetched owner and name when a Followed Repository was renamed', () => {
    const follow = repo({ id: 'R_moved', owner: 'old-org', name: 'old-name' });

    const timeline = assembleReleaseTimeline(
      [follow],
      {
        R_moved: {
          status: 'available',
          owner: 'new-org',
          name: 'new-name',
          hasOlderReleases: false,
          releases: [
            release({
              id: 1,
              publishedAt: '2026-08-22T12:00:00.000Z',
              name: 'Moved',
              tagName: 'v1',
            }),
          ],
        },
      },
      { timeZone: 'UTC' }
    );

    expect(timeline.groups[0]?.items[0]?.repository).toEqual({
      id: 'R_moved',
      owner: 'new-org',
      name: 'new-name',
    });
    expect(timeline.groups[0]?.items[0]?.tagName).toBe('v1');
    expect(timeline.groups[0]?.items[0]?.assetCount).toBe(0);
  });
});
