import { describe, expect, test } from 'bun:test';

import {
  buildPullRequestCommitUrl,
  mapGitHubCommitToCommitListItem,
} from '../server/utils/repo-latest-commit-utils';

describe('buildPullRequestCommitUrl', () => {
  test('builds a PR-scoped commit URL', () => {
    expect(buildPullRequestCommitUrl('acme', 'widgets', 42, 'abcdef0123456789')).toBe(
      'https://github.com/acme/widgets/pull/42/commits/abcdef0123456789'
    );
  });
});

describe('PR commit list item mapping', () => {
  test('combines list-item mapping with a PR-scoped htmlUrl', () => {
    const item = mapGitHubCommitToCommitListItem({
      sha: 'abcdef0123456789',
      html_url: 'https://github.com/acme/widgets/commit/abcdef0123456789',
      author: {
        login: 'octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      commit: {
        message: 'fix: address review\n\nDetails.',
        author: {
          name: 'The Octocat',
          date: '2024-01-01T10:00:00Z',
        },
        committer: {
          name: 'GitHub',
          date: '2024-01-01T12:00:00Z',
        },
      },
    });

    expect(item).not.toBeNull();
    expect({
      ...item!,
      htmlUrl: buildPullRequestCommitUrl('acme', 'widgets', 42, item!.sha),
    }).toEqual({
      sha: 'abcdef0123456789',
      shortSha: 'abcdef0',
      message: 'fix: address review',
      committedAt: '2024-01-01T12:00:00Z',
      author: {
        login: 'octocat',
        name: 'The Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      htmlUrl: 'https://github.com/acme/widgets/pull/42/commits/abcdef0123456789',
    });
  });
});
