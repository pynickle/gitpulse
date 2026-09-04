import { describe, expect, test } from 'bun:test';

import resolveReleaseTimelineSessionLoad from '../app/utils/resolveReleaseTimelineSessionLoad';
import type { ReleaseTimeline, TimelineRelease } from '../shared/types/release-follows';

const release = (title: string): TimelineRelease => ({
  repository: { id: 'R_widgets', owner: 'octo', name: 'widgets' },
  id: 1,
  tagName: 'v1',
  title,
  publishedAt: '2026-08-22T12:00:00.000Z',
  changelog: 'notes',
  changelogTruncated: false,
  assetCount: 0,
  isPrerelease: false,
  isOldestShown: false,
  htmlUrl: null,
  reactions: [],
});

const timeline = (title: string): ReleaseTimeline => ({
  groups: [{ date: '2026-08-22', items: [release(title)] }],
  unavailableIds: ['R_missing'],
  transientIds: ['R_flaky'],
});

const emptyTimeline: ReleaseTimeline = {
  groups: [],
  unavailableIds: [],
  transientIds: [],
};

describe('resolveReleaseTimelineSessionLoad', () => {
  test('reuses the last successful timeline when Followed Repositories have not changed', () => {
    const cached = timeline('cached v1');

    expect(
      resolveReleaseTimelineSessionLoad({
        hasFollows: true,
        followKey: 'R_widgets',
        cache: { followKey: 'R_widgets', timeline: cached },
      })
    ).toEqual({
      timeline: cached,
      shouldFetch: false,
    });
  });

  test('keeps the last successful cards and refetches when Followed Repositories change', () => {
    const cached = timeline('cached v1');

    expect(
      resolveReleaseTimelineSessionLoad({
        hasFollows: true,
        followKey: 'R_widgets\0R_tools',
        cache: { followKey: 'R_widgets', timeline: cached },
      })
    ).toEqual({
      timeline: cached,
      shouldFetch: true,
    });
  });

  test('fetches with no cards when the session has no last successful timeline', () => {
    expect(
      resolveReleaseTimelineSessionLoad({
        hasFollows: true,
        followKey: 'R_widgets',
        cache: null,
      })
    ).toEqual({
      timeline: emptyTimeline,
      shouldFetch: true,
    });
  });

  test('shows the empty Followed Repositories state without fetching even if cards are cached', () => {
    expect(
      resolveReleaseTimelineSessionLoad({
        hasFollows: false,
        followKey: '',
        cache: { followKey: 'R_widgets', timeline: timeline('cached v1') },
      })
    ).toEqual({
      timeline: emptyTimeline,
      shouldFetch: false,
    });
  });
});
