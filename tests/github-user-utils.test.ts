import { describe, expect, mock, test } from 'bun:test';

type CreateErrorInput = {
  statusCode: number;
  statusMessage: string;
  data?: unknown;
};

(
  globalThis as typeof globalThis & {
    createError: (input: CreateErrorInput) => Error & CreateErrorInput;
  }
).createError = (input) => Object.assign(new Error(input.statusMessage), input);

const githubPagination = await import('../server/utils/github-pagination');

mock.module('#server/utils/github-auth-utils', () => ({
  getGitHubClient: async () => {
    throw new Error('getGitHubClient must not be called in this test');
  },
}));
mock.module('#server/utils/github-pagination', () => githubPagination);

const { mapGitHubOrganizationToSummary, mapGitHubRepositoryToSummary } =
  await import('../server/utils/github-user-utils');

describe('mapGitHubOrganizationToSummary', () => {
  test('maps a full organization payload and derives the org page URL', () => {
    expect(
      mapGitHubOrganizationToSummary({
        login: 'octo-org',
        id: 9919,
        avatar_url: 'https://avatars.githubusercontent.com/u/9919',
        description: 'How people build software.',
      })
    ).toEqual({
      login: 'octo-org',
      id: 9919,
      avatarUrl: 'https://avatars.githubusercontent.com/u/9919',
      htmlUrl: 'https://github.com/octo-org',
      description: 'How people build software.',
    });
  });

  test('normalizes blank optional fields to null and falls back to login as id', () => {
    expect(
      mapGitHubOrganizationToSummary({
        login: 'octo-org',
        avatar_url: '',
        description: '   ',
      })
    ).toEqual({
      login: 'octo-org',
      id: 'octo-org',
      avatarUrl: null,
      htmlUrl: 'https://github.com/octo-org',
      description: null,
    });
  });

  test('returns null when the organization has no usable login', () => {
    expect(mapGitHubOrganizationToSummary({})).toBeNull();
    expect(mapGitHubOrganizationToSummary({ login: '   ' })).toBeNull();
  });
});

describe('mapGitHubRepositoryToSummary', () => {
  test('maps a full repository payload', () => {
    expect(
      mapGitHubRepositoryToSummary({
        id: 1296269,
        name: 'Hello-World',
        full_name: 'octocat/Hello-World',
        description: 'My first repository!',
        language: 'TypeScript',
        stargazers_count: 80,
        watchers_count: 80,
        forks_count: 9,
        private: false,
        fork: true,
        archived: false,
        owner: { login: 'octocat' },
      })
    ).toEqual({
      id: 1296269,
      name: 'Hello-World',
      full_name: 'octocat/Hello-World',
      description: 'My first repository!',
      language: 'TypeScript',
      stargazers_count: 80,
      watchers_count: 80,
      forks_count: 9,
      private: false,
      fork: true,
      archived: false,
      owner: { login: 'octocat' },
    });
  });

  test('fills gaps: derives full_name and id, zeroes counts, nulls blank strings', () => {
    expect(
      mapGitHubRepositoryToSummary({
        name: 'tools',
        description: '   ',
        owner: { login: 'octo-org' },
      })
    ).toEqual({
      id: 'octo-org/tools',
      name: 'tools',
      full_name: 'octo-org/tools',
      description: null,
      language: null,
      stargazers_count: 0,
      watchers_count: 0,
      forks_count: 0,
      private: false,
      fork: false,
      archived: false,
      owner: { login: 'octo-org' },
    });
  });

  test('returns null when the repository has no usable name', () => {
    expect(mapGitHubRepositoryToSummary({})).toBeNull();
    expect(mapGitHubRepositoryToSummary({ name: '  ' })).toBeNull();
  });
});
