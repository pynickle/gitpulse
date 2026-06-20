import { describe, expect, mock, test } from 'bun:test';

import * as githubPagination from '../server/utils/github-pagination';
import * as customSearchTypes from '../shared/types/custom-search';
import * as githubSearchQuery from '../shared/utils/github-search-query';
import * as githubSearchSyntax from '../shared/utils/github-search-syntax';

mock.module('#shared/types/custom-search', () => customSearchTypes);
mock.module('#shared/utils/github-search-query', () => githubSearchQuery);
mock.module('#shared/utils/github-search-syntax', () => githubSearchSyntax);
mock.module('./github-issue-search-route-utils', () => ({
  getGitHubErrorHeader: () => null,
  normalizeSearchTotalCount: (totalCount: number | null | undefined) =>
    Math.min(totalCount ?? 0, 1000),
}));
mock.module('./github-pagination', () => githubPagination);

type CreateErrorInput = {
  statusCode: number;
  statusMessage: string;
};

type MockEvent = {
  endpoint?: string;
  query?: Record<string, unknown>;
};

(
  globalThis as typeof globalThis & {
    createError: (input: CreateErrorInput) => Error & CreateErrorInput;
    getRouterParam: (event: MockEvent, name: string) => string | undefined;
    getQuery: (event: MockEvent) => Record<string, unknown>;
  }
).createError = (input) => Object.assign(new Error(input.statusMessage), input);

(
  globalThis as typeof globalThis & {
    getRouterParam: (event: MockEvent, name: string) => string | undefined;
  }
).getRouterParam = (event, name) => (name === 'endpoint' ? event.endpoint : undefined);

(
  globalThis as typeof globalThis & {
    getQuery: (event: MockEvent) => Record<string, unknown>;
  }
).getQuery = (event) => event.query ?? {};

const { buildGitHubSearchRequestParams, getGitHubSearchEndpointFromEvent } =
  await import('../server/utils/github-search-route-utils');

describe('GitHub search route utils', () => {
  test('rejects unknown dynamic search endpoints instead of falling back to issues', () => {
    expect(() => getGitHubSearchEndpointFromEvent({ endpoint: 'not-real' })).toThrow(
      'Unknown GitHub search endpoint'
    );
  });

  test('extracts labels repository_id from search syntax before forwarding q', () => {
    expect(
      buildGitHubSearchRequestParams(
        {
          endpoint: 'labels',
          query: {
            q: 'repository_id:12345 bug',
            page: '2',
            per_page: '50',
          },
        },
        'labels'
      )
    ).toEqual({
      endpoint: 'labels',
      q: 'bug',
      page: 2,
      per_page: 50,
      repository_id: 12345,
    });
  });

  test('rejects search operators for non-code endpoints', () => {
    expect(() =>
      buildGitHubSearchRequestParams(
        {
          endpoint: 'issues',
          query: { q: 'bug OR regression' },
        },
        'issues'
      )
    ).toThrow('GitHub search operators are not supported yet');
  });

  test('allows search operators for the code endpoint', () => {
    expect(
      buildGitHubSearchRequestParams(
        {
          endpoint: 'code',
          query: { q: 'bug OR regression' },
        },
        'code'
      )
    ).toEqual({
      endpoint: 'code',
      q: 'bug OR regression',
      page: 1,
      per_page: 20,
    });
  });
});
