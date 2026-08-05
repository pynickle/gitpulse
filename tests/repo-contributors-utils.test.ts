import { describe, expect, test } from 'bun:test';

import {
  emptyContributorListResponse,
  mapGitHubContributorListItem,
  mapGitHubContributorStatsItem,
  normalizeContributorStatsResponse,
} from '../server/utils/repo-contributors-utils';

describe('mapGitHubContributorListItem', () => {
  test('maps a standard user contributor', () => {
    const item = mapGitHubContributorListItem({
      login: 'octocat',
      id: 1,
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
      html_url: 'https://github.com/octocat',
      type: 'User',
      contributions: 42,
    });

    expect(item).toEqual({
      login: 'octocat',
      id: 1,
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      htmlUrl: 'https://github.com/octocat',
      name: null,
      contributions: 42,
      type: 'User',
      anonymous: false,
    });
  });

  test('maps anonymous contributors that only have a name', () => {
    const item = mapGitHubContributorListItem({
      type: 'Anonymous',
      name: 'Patch Bot',
      email: 'bot@example.com',
      contributions: 3,
    });

    expect(item).toMatchObject({
      login: null,
      name: 'Patch Bot',
      contributions: 3,
      anonymous: true,
      type: 'Anonymous',
    });
  });

  test('drops entries without login or name', () => {
    expect(mapGitHubContributorListItem({ contributions: 1 })).toBeNull();
    expect(mapGitHubContributorListItem(null)).toBeNull();
  });
});

describe('mapGitHubContributorStatsItem', () => {
  test('maps weekly commit activity and author fields', () => {
    const item = mapGitHubContributorStatsItem({
      total: 10,
      author: {
        login: 'octocat',
        id: 1,
        avatar_url: 'https://avatars.githubusercontent.com/u/1',
        html_url: 'https://github.com/octocat',
      },
      weeks: [
        { w: 1704067200, a: 5, d: 1, c: 2 },
        { w: 1704672000, a: 0, d: 0, c: 0 },
      ],
    });

    expect(item).toEqual({
      login: 'octocat',
      id: 1,
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      htmlUrl: 'https://github.com/octocat',
      total: 10,
      weeks: [
        { week: 1704067200, additions: 5, deletions: 1, commits: 2 },
        { week: 1704672000, additions: 0, deletions: 0, commits: 0 },
      ],
    });
  });

  test('keeps rows without an author (deleted accounts)', () => {
    const item = mapGitHubContributorStatsItem({
      total: 4,
      author: null,
      weeks: [{ w: 1704067200, a: 1, d: 0, c: 1 }],
    });

    expect(item?.login).toBeNull();
    expect(item?.total).toBe(4);
    expect(item?.weeks).toHaveLength(1);
  });
});

describe('normalizeContributorStatsResponse', () => {
  test('maps 202 to computing', () => {
    expect(normalizeContributorStatsResponse({ status: 202, data: {} })).toEqual({
      status: 'computing',
      items: [],
    });
  });

  test('maps 204 and empty arrays to empty', () => {
    expect(normalizeContributorStatsResponse({ status: 204, data: '' })).toEqual({
      status: 'empty',
      items: [],
    });
    expect(normalizeContributorStatsResponse({ status: 200, data: [] })).toEqual({
      status: 'empty',
      items: [],
    });
  });

  test('sorts ready items by total commits descending', () => {
    const result = normalizeContributorStatsResponse({
      status: 200,
      data: [
        {
          total: 2,
          author: { login: 'low' },
          weeks: [{ w: 1, a: 0, d: 0, c: 2 }],
        },
        {
          total: 9,
          author: { login: 'high' },
          weeks: [{ w: 1, a: 0, d: 0, c: 9 }],
        },
      ],
    });

    expect(result.status).toBe('ready');
    expect(result.items.map((item) => item.login)).toEqual(['high', 'low']);
  });
});

describe('emptyContributorListResponse', () => {
  test('returns a stable empty pagination shape', () => {
    expect(emptyContributorListResponse(3, 14)).toEqual({
      items: [],
      pagination: {
        page: 1,
        perPage: 14,
        hasPrev: false,
        hasNext: false,
        totalCount: 0,
        totalPages: 1,
      },
    });
  });
});
