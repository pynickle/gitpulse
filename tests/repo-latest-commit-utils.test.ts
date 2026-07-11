import { describe, expect, test } from 'bun:test';

import {
  buildRepoCommitsUrl,
  mapGitHubCommitToLatestCommit,
} from '../server/utils/repo-latest-commit-utils';

describe('buildRepoCommitsUrl', () => {
  test('builds the commits index URL without a ref', () => {
    expect(buildRepoCommitsUrl('acme', 'widgets')).toBe('https://github.com/acme/widgets/commits');
  });

  test('appends a simple branch ref', () => {
    expect(buildRepoCommitsUrl('acme', 'widgets', 'main')).toBe(
      'https://github.com/acme/widgets/commits/main'
    );
  });

  test('encodes each path segment of a namespaced ref', () => {
    expect(buildRepoCommitsUrl('acme', 'widgets', 'feature/foo bar')).toBe(
      'https://github.com/acme/widgets/commits/feature/foo%20bar'
    );
  });
});

describe('mapGitHubCommitToLatestCommit', () => {
  test('maps a full GitHub commit list item', () => {
    const payload = mapGitHubCommitToLatestCommit(
      {
        sha: 'abcdef0123456789',
        html_url: 'https://github.com/acme/widgets/commit/abcdef0123456789',
        author: {
          login: 'octocat',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        },
        commit: {
          message: 'feat: add widgets\n\nLonger body.',
          author: {
            name: 'The Octocat',
            date: '2024-01-01T10:00:00Z',
          },
          committer: {
            name: 'GitHub',
            date: '2024-01-01T12:00:00Z',
          },
        },
      },
      { owner: 'acme', repo: 'widgets', ref: 'main' }
    );

    expect(payload).toEqual({
      sha: 'abcdef0123456789',
      shortSha: 'abcdef0',
      message: 'feat: add widgets',
      committedAt: '2024-01-01T12:00:00Z',
      author: {
        login: 'octocat',
        name: 'The Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      htmlUrl: 'https://github.com/acme/widgets/commit/abcdef0123456789',
      commitsUrl: 'https://github.com/acme/widgets/commits/main',
    });
  });

  test('falls back to author date and name when committer/user are missing', () => {
    const payload = mapGitHubCommitToLatestCommit(
      {
        sha: 'deadbeef',
        author: null,
        commit: {
          message: 'chore: only author metadata',
          author: {
            name: 'Local Dev',
            date: '2024-06-01T08:00:00Z',
          },
          committer: null,
        },
      },
      { owner: 'acme', repo: 'widgets' }
    );

    expect(payload).toMatchObject({
      shortSha: 'deadbee',
      message: 'chore: only author metadata',
      committedAt: '2024-06-01T08:00:00Z',
      author: {
        login: null,
        name: 'Local Dev',
        avatarUrl: null,
      },
      commitsUrl: 'https://github.com/acme/widgets/commits',
    });
  });

  test('returns null for empty or sha-less items', () => {
    expect(mapGitHubCommitToLatestCommit(null, { owner: 'a', repo: 'b' })).toBeNull();
    expect(mapGitHubCommitToLatestCommit(undefined, { owner: 'a', repo: 'b' })).toBeNull();
    expect(mapGitHubCommitToLatestCommit({ sha: '' }, { owner: 'a', repo: 'b' })).toBeNull();
    expect(mapGitHubCommitToLatestCommit({ sha: '   ' }, { owner: 'a', repo: 'b' })).toBeNull();
  });

  test('uses an empty message when commit message is missing', () => {
    const payload = mapGitHubCommitToLatestCommit(
      { sha: '1234567' },
      { owner: 'acme', repo: 'widgets', ref: 'dev' }
    );

    expect(payload).toMatchObject({
      message: '',
      shortSha: '1234567',
      commitsUrl: 'https://github.com/acme/widgets/commits/dev',
    });
  });
});
