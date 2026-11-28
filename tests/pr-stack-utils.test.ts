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

const { fetchPullRequestStack, fetchRepositoryStack } =
  await import('../server/utils/pr-stack-utils');
const { isSoleActiveStackLayer, hasMultiActiveStackDependencies } =
  await import('../shared/utils/pr-stack');

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
          behindBy: 0,
        },
        {
          number: 11,
          title: 'Layer 2',
          state: 'draft',
          baseRef: 'feat-1',
          baseSha: 'sha-1',
          headSha: 'sha-2',
          behindBy: 0,
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
    expect(stack?.layers[0]?.behindBy).toBe(0);
    expect(stack?.layers[1]?.behindBy).toBe(3);
    expect(stack && 'hasConflicts' in stack).toBe(false);
    expect(graphql).not.toHaveBeenCalled();
  });

  test('propagates behindBy only to active layers and keeps merged layers without behindBy', async () => {
    compareResults.clear();
    compareResults.set('dev...sha-3853', 2);

    const request = mock(() =>
      Promise.resolve({
        data: {
          base: { ref: 'dev' },
          pull_requests: [
            {
              number: 3848,
              title: 'Lower merged layer',
              state: 'closed',
              merged_at: '2026-11-26T10:00:00Z',
              base: { ref: 'dev', sha: 'base-0' },
              head: { sha: 'sha-3848' },
            },
            {
              number: 3853,
              title: 'Sole remaining active layer',
              state: 'open',
              merged_at: null,
              base: { ref: 'dev', sha: 'base-1' },
              head: { sha: 'sha-3853' },
            },
          ],
        },
      })
    );
    const octokit = { request, graphql: mock(() => Promise.resolve({})) } as unknown as Octokit;

    const stack = await fetchPullRequestStack(octokit, 'PCL-Community', 'PCL-CE', 3853, {
      number: 9,
      size: 2,
      position: 2,
      base: { ref: 'dev' },
    });

    expect(stack?.history).toBe('not-linear');
    expect(stack?.layers[0]?.behindBy).toBeUndefined();
    expect(stack?.layers[1]?.behindBy).toBe(2);
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

describe('fetchRepositoryStack', () => {
  test('uses the pull request GraphQL stack when that stack is the one requested', async () => {
    const request = mock(() => Promise.reject(new Error('REST should not run')));
    const graphql = mock(() =>
      Promise.resolve({
        repository: {
          pullRequest: {
            stack: {
              number: 3855,
              baseRefName: 'dev',
              entries: {
                nodes: [
                  {
                    position: 1,
                    pullRequest: {
                      number: 3848,
                      title: 'Lower',
                      state: 'MERGED',
                      isDraft: false,
                      mergedAt: '2026-11-26T12:44:27Z',
                      baseRefName: 'dev',
                      headRefOid: 'sha-3848',
                    },
                  },
                  {
                    position: 2,
                    pullRequest: {
                      number: 3853,
                      title: 'Open layer',
                      state: 'OPEN',
                      isDraft: false,
                      mergedAt: null,
                      baseRefName: 'dev',
                      headRefOid: 'sha-3853',
                    },
                  },
                ],
              },
            },
          },
        },
      })
    );
    const octokit = { request, graphql } as unknown as Octokit;

    const stack = await fetchRepositoryStack(octokit, 'PCL-Community', 'PCL-CE', 3855, 3853);

    expect(request).not.toHaveBeenCalled();
    expect(stack.trunk).toBe('dev');
    expect(stack.place).toBe(2);
    expect(stack.layers.map((layer) => [layer.number, layer.state])).toEqual([
      [3848, 'merged'],
      [3853, 'open'],
    ]);
  });

  test('returns the layers of a stack the viewer has left, with nothing marked by place', async () => {
    compareResults.clear();
    compareResults.set('dev...sha-3853', 2);

    const request = mock(() =>
      Promise.resolve({
        data: {
          base: { ref: 'dev' },
          pull_requests: [
            {
              number: 3848,
              title: 'Lower merged layer',
              state: 'closed',
              merged_at: '2026-11-26T10:00:00Z',
              base: { ref: 'dev', sha: 'base-0' },
              head: { sha: 'sha-3848' },
            },
            {
              number: 3853,
              title: 'Open layer',
              state: 'open',
              merged_at: null,
              base: { ref: 'dev', sha: 'base-1' },
              head: { sha: 'sha-3853' },
            },
          ],
        },
      })
    );
    const octokit = { request, graphql: mock(() => Promise.resolve({})) } as unknown as Octokit;

    const stack = await fetchRepositoryStack(octokit, 'PCL-Community', 'PCL-CE', 3855, 9999);

    expect(request).toHaveBeenCalledWith('GET /repos/{owner}/{repo}/stacks/{stack_number}', {
      owner: 'PCL-Community',
      repo: 'PCL-CE',
      stack_number: 3855,
    });
    expect(stack.number).toBe(3855);
    expect(stack.trunk).toBe('dev');
    expect(stack.place).toBe(0);
    expect(stack.layers.map((layer) => layer.number)).toEqual([3848, 3853]);
    expect(stack.history).toBe('not-linear');
    expect(stack.layers[1]?.behindBy).toBe(2);
  });

  test('marks the viewer place when that pull request is still a layer', async () => {
    compareResults.clear();
    const request = mock(() =>
      Promise.resolve({
        data: {
          base: { ref: 'dev' },
          pull_requests: [
            {
              number: 3853,
              title: 'Open layer',
              state: 'closed',
              merged_at: '2026-11-26T10:00:00Z',
              base: { ref: 'dev' },
              head: { sha: 'sha-3853' },
            },
          ],
        },
      })
    );
    const octokit = { request, graphql: mock(() => Promise.resolve({})) } as unknown as Octokit;

    const stack = await fetchRepositoryStack(octokit, 'PCL-Community', 'PCL-CE', 3855, 3853);

    expect(stack.place).toBe(1);
    expect(stack.history).toBe('unknown');
  });

  test('returns an empty stack when the stack cannot be loaded', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const octokit = {
        request: mock(() => Promise.reject(new Error('GitHub 404'))),
        graphql: mock(() => Promise.resolve({})),
      } as unknown as Octokit;

      const stack = await fetchRepositoryStack(octokit, 'PCL-Community', 'PCL-CE', 3855);

      expect(stack).toEqual({
        number: 3855,
        trunk: '',
        count: 0,
        place: 0,
        layers: [],
        history: 'unknown',
      });
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe('sole active Stack Layer classification', () => {
  test('classifies a sole remaining open Layer directly targeting the Trunk as sole-active', () => {
    const stack = {
      number: 9,
      trunk: 'dev',
      count: 2,
      place: 2,
      history: 'not-linear' as const,
      layers: [
        { number: 3848, title: 'Layer 1', state: 'merged' as const, baseRef: 'dev' },
        { number: 3853, title: 'Layer 2', state: 'open' as const, baseRef: 'dev', behindBy: 2 },
      ],
    };

    expect(isSoleActiveStackLayer(stack, 3853)).toBe(true);
    expect(hasMultiActiveStackDependencies(stack, 3853)).toBe(false);
    // Viewing the already-merged Layer 1 of the same single-active-layer Stack still has no multi-active dependencies.
    expect(hasMultiActiveStackDependencies(stack, 3848)).toBe(false);
  });

  test('treats a Stack with multiple active Layers or an unmerged lower Layer as multi-active', () => {
    const withUpperDraft = {
      number: 10,
      trunk: 'main',
      count: 3,
      place: 2,
      history: 'linear' as const,
      layers: [
        { number: 101, title: 'L1', state: 'merged' as const, baseRef: 'main' },
        { number: 102, title: 'L2', state: 'open' as const, baseRef: 'main' },
        { number: 103, title: 'L3', state: 'draft' as const, baseRef: 'feat/l2' },
      ],
    };
    const withClosedLower = {
      number: 11,
      trunk: 'main',
      count: 2,
      place: 2,
      history: 'linear' as const,
      layers: [
        { number: 201, title: 'L1', state: 'closed' as const, baseRef: 'main' },
        { number: 202, title: 'L2', state: 'open' as const, baseRef: 'main' },
      ],
    };
    const targetingNonTrunkBranch = {
      number: 12,
      trunk: 'main',
      count: 2,
      place: 2,
      history: 'linear' as const,
      layers: [
        { number: 301, title: 'L1', state: 'merged' as const, baseRef: 'main' },
        { number: 302, title: 'L2', state: 'open' as const, baseRef: 'feat/l1' },
      ],
    };

    expect(isSoleActiveStackLayer(withUpperDraft, 102)).toBe(false);
    expect(hasMultiActiveStackDependencies(withUpperDraft, 102)).toBe(true);
    expect(isSoleActiveStackLayer(withClosedLower, 202)).toBe(false);
    expect(isSoleActiveStackLayer(targetingNonTrunkBranch, 302)).toBe(false);
  });
});
