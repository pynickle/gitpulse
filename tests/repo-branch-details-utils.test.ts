import { describe, expect, test } from 'bun:test';

import {
  mapCommitToBranchLastCommit,
  mapGitHubPullToAssociatedPull,
  mapWithConcurrency,
} from '../server/utils/repo-branch-details-utils';

describe('mapWithConcurrency', () => {
  test('preserves input order under concurrent workers', async () => {
    const items = [1, 2, 3, 4, 5];
    const seenActive = { max: 0, current: 0 };

    const results = await mapWithConcurrency(items, 2, async (item) => {
      seenActive.current += 1;
      seenActive.max = Math.max(seenActive.max, seenActive.current);
      await Bun.sleep(5);
      seenActive.current -= 1;
      return item * 10;
    });

    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(seenActive.max).toBeLessThanOrEqual(2);
  });

  test('returns an empty array for empty input', async () => {
    expect(await mapWithConcurrency([], 4, async (item) => item)).toEqual([]);
  });
});

describe('mapCommitToBranchLastCommit', () => {
  test('maps a commit tip payload', () => {
    expect(
      mapCommitToBranchLastCommit({
        sha: 'abcdef0123456789',
        author: {
          login: 'octocat',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        },
        commit: {
          message: 'fix: flaky test\n\nDetails.',
          author: {
            name: 'The Octocat',
            date: '2024-01-01T10:00:00Z',
          },
          committer: {
            name: 'GitHub',
            date: '2024-01-01T12:00:00Z',
          },
        },
      })
    ).toEqual({
      sha: 'abcdef0123456789',
      shortSha: 'abcdef0',
      message: 'fix: flaky test',
      committedAt: '2024-01-01T12:00:00Z',
      author: {
        login: 'octocat',
        name: 'The Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
    });
  });

  test('returns null without a sha', () => {
    expect(mapCommitToBranchLastCommit({ sha: '' })).toBeNull();
    expect(mapCommitToBranchLastCommit(null)).toBeNull();
  });
});

describe('mapGitHubPullToAssociatedPull', () => {
  test('maps an open draft pull request', () => {
    expect(
      mapGitHubPullToAssociatedPull({
        number: 42,
        title: 'Add widgets',
        state: 'open',
        draft: true,
        merged_at: null,
        html_url: 'https://github.com/acme/widgets/pull/42',
      })
    ).toEqual({
      number: 42,
      title: 'Add widgets',
      state: 'open',
      merged: false,
      draft: true,
      htmlUrl: 'https://github.com/acme/widgets/pull/42',
    });
  });

  test('marks merged pulls closed + merged', () => {
    expect(
      mapGitHubPullToAssociatedPull({
        number: 7,
        title: 'Ship it',
        state: 'closed',
        draft: false,
        merged_at: '2024-02-01T00:00:00Z',
        html_url: 'https://github.com/acme/widgets/pull/7',
      })
    ).toEqual({
      number: 7,
      title: 'Ship it',
      state: 'closed',
      merged: true,
      draft: false,
      htmlUrl: 'https://github.com/acme/widgets/pull/7',
    });
  });

  test('returns null for invalid numbers', () => {
    expect(mapGitHubPullToAssociatedPull({ number: 0, title: 'x' })).toBeNull();
    expect(mapGitHubPullToAssociatedPull(null)).toBeNull();
  });
});
