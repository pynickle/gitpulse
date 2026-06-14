import { afterEach, describe, expect, mock, test } from 'bun:test';

const fetchPaginatedArray = mock(async () => [
  {
    login: 'octocat',
    name: 'The Octocat',
    avatar_url: 'https://avatars.githubusercontent.com/u/583231',
    html_url: 'https://github.com/octocat',
  },
  {
    login: 'hubot',
    name: null,
    avatar_url: null,
    html_url: 'https://github.com/hubot',
  },
]);

mock.module('../server/utils/github-timeline-utils', () => ({
  fetchPaginatedArray,
}));

mock.module('#shared/types/mention-suggestions', () => ({}));
mock.module('#shared/utils/markdown-mentions', () => ({
  GITHUB_MENTION_LOGIN_PATTERN: '[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?',
  buildGitHubMentionUrl: (login: string) => `https://github.com/${login}`,
  isValidGitHubMentionLogin: (login: string) =>
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login),
}));

const { fetchRepositoryMentionSuggestions } = await import('../server/utils/github-mention-utils');

describe('fetchRepositoryMentionSuggestions', () => {
  afterEach(() => {
    fetchPaginatedArray.mockClear();
  });

  test('reuses repository collaborators for repeated queries in the same token scope', async () => {
    const octokit = {} as any;

    await fetchRepositoryMentionSuggestions(octokit, 'OWNER', 'Repo', {
      accessTokenCacheKey: 'token-a',
      query: 'octo',
    });
    await fetchRepositoryMentionSuggestions(octokit, 'owner', 'repo', {
      accessTokenCacheKey: 'token-a',
      query: 'hub',
    });

    expect(fetchPaginatedArray).toHaveBeenCalledTimes(1);
  });

  test('keeps collaborator caches isolated by access token', async () => {
    const octokit = {} as any;

    await fetchRepositoryMentionSuggestions(octokit, 'owner', 'repo-two', {
      accessTokenCacheKey: 'token-c',
      query: '',
    });
    await fetchRepositoryMentionSuggestions(octokit, 'owner', 'repo-two', {
      accessTokenCacheKey: 'token-d',
      query: '',
    });

    expect(fetchPaginatedArray).toHaveBeenCalledTimes(2);
  });
});
