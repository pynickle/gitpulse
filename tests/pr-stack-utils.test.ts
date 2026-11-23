import { describe, expect, mock, test } from 'bun:test';

import type { Octokit } from '@octokit/core';

const compareResults = new Map<string, number | null>();

mock.module('#server/utils/pr-merge-status-utils', () => ({
  fetchBaseBehindCount: async (
    _octokit: Octokit,
    _owner: string,
    _repo: string,
    baseRef: string,
    headOid: string
  ) => compareResults.get(`${baseRef}...${headOid}`) ?? null,
}));

const { fetchPullRequestStack } = await import('../server/utils/pr-stack-utils');

describe('fetchPullRequestStack', () => {
  test('returns null when membership is null or undefined', async () => {
    const octokit = {
      request: mock(() => Promise.resolve({ data: {} })),
      graphql: mock(() => Promise.resolve({})),
    } as unknown as Octokit;

    expect(await fetchPullRequestStack(octokit, 'acme', 'repo', 1, null)).toBeNull();
    expect(await fetchPullRequestStack(octokit, 'acme', 'repo', 1, undefined)).toBeNull();
    expect(octokit.request).not.toHaveBeenCalled();
    expect(octokit.graphql).not.toHaveBeenCalled();
  });

  test('computes linear history when every active layer has behindCount === 0 and never calls GraphQL', async () => {
    compareResults.clear();
    compareResults.set('main...sha-1', 0);
    compareResults.set('feat-1...sha-2', 0);

    const graphql = mock(() => Promise.resolve({}));
    const request = mock(() =>
      Promise.resolve({
        data: {
          base: { ref: 'main' },
          pull_requests: [
            {
              number: 10,
              title: 'Layer 1',
              state: 'open',
              draft: false,
              merged_at: null,
              base: { ref: 'main', sha: 'base-1' },
              head: { sha: 'sha-1' },
            },
            {
              number: 11,
              title: 'Layer 2',
              state: 'open',
              draft: true,
              merged_at: null,
              base: { ref: 'feat-1', sha: 'sha-1' },
              head: { sha: 'sha-2' },
            },
          ],
        },
      })
    );
    const octokit = { request, graphql } as unknown as Octokit;

    const stack = await fetchPullRequestStack(octokit, 'acme', 'repo', 11, {
      number: 4,
      size: 2,
      position: 2,
      base: { ref: 'main' },
    });

    expect(stack).toEqual({
      number: 4,
      trunk: 'main',
      count: 2,
      place: 2,
      history: 'linear',
      layers: [
        {
          number: 10,
          title: 'Layer 1',
          state: 'open',
          baseRef: 'main',
          baseSha: 'base-1',
          headSha: 'sha-1',
        },
        {
          number: 11,
          title: 'Layer 2',
          state: 'draft',
          baseRef: 'feat-1',
          baseSha: 'sha-1',
          headSha: 'sha-2',
        },
      ],
    });
    expect(graphql).not.toHaveBeenCalled();
  });

  test('computes not-linear history when an active layer is behind its base and never calls GraphQL hasConflicts', async () => {
    compareResults.clear();
    compareResults.set('main...sha-1', 0);
    compareResults.set('feat-1...sha-2', 3);

    const graphql = mock(() => Promise.resolve({}));
    const request = mock(() =>
      Promise.resolve({
        data: {
          base: { ref: 'main' },
          pull_requests: [
            {
              number: 10,
              title: 'Layer 1',
              state: 'open',
              base: { ref: 'main', sha: 'base-1' },
              head: { sha: 'sha-1' },
            },
            {
              number: 11,
              title: 'Layer 2',
              state: 'open',
              base: { ref: 'feat-1', sha: 'old-sha-1' },
              head: { sha: 'sha-2' },
            },
          ],
        },
      })
    );
    const octokit = { request, graphql } as unknown as Octokit;

    const stack = await fetchPullRequestStack(octokit, 'acme', 'repo', 10, {
      number: 4,
      size: 2,
      position: 1,
      base: { ref: 'main' },
    });

    expect(stack?.history).toBe('not-linear');
    expect(stack && 'hasConflicts' in stack).toBe(false);
    expect(graphql).not.toHaveBeenCalled();
  });

  test('leaves history as unknown when compare fails (null) and others are 0', async () => {
    compareResults.clear();
    compareResults.set('main...sha-1', 0);
    compareResults.set('feat-1...sha-2', null);

    const octokit = {
      request: mock(() =>
        Promise.resolve({
          data: {
            base: { ref: 'main' },
            pull_requests: [
              {
                number: 10,
                title: 'Layer 1',
                state: 'open',
                base: { ref: 'main' },
                head: { sha: 'sha-1' },
              },
              {
                number: 11,
                title: 'Layer 2',
                state: 'open',
                base: { ref: 'feat-1' },
                head: { sha: 'sha-2' },
              },
            ],
          },
        })
      ),
      graphql: mock(() => Promise.resolve({})),
    } as unknown as Octokit;

    const stack = await fetchPullRequestStack(octokit, 'acme', 'repo', 10, {
      number: 4,
      size: 2,
      position: 1,
      base: { ref: 'main' },
    });

    expect(stack?.history).toBe('unknown');
  });

  test('returns fallback stack with layers: [] and history: unknown when stack resource request fails', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const octokit = {
        request: mock(() => Promise.reject(new Error('GitHub 502'))),
        graphql: mock(() => Promise.resolve({})),
      } as unknown as Octokit;

      const stack = await fetchPullRequestStack(octokit, 'acme', 'repo', 10, {
        number: 7,
        size: 3,
        position: 2,
        base: { ref: 'main' },
      });

      expect(stack).toEqual({
        number: 7,
        trunk: 'main',
        count: 3,
        place: 2,
        layers: [],
        history: 'unknown',
      });
    } finally {
      console.warn = originalWarn;
    }
  });
});
