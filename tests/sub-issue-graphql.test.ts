import { describe, expect, mock, test } from 'bun:test';

import * as githubGraphqlUtils from '../server/utils/github-graphql-utils';
import * as subIssues from '../shared/utils/sub-issues';

mock.module('#server/utils/github-graphql-utils', () => githubGraphqlUtils);
mock.module('#shared/utils/sub-issues', () => subIssues);

const {
  fetchIssueParentTarget,
  fetchSubIssueConnection,
  mapSubIssueConnection,
  mapSubIssueDisplayState,
} = await import('../server/utils/sub-issue-graphql-utils');

describe('Sub-issue GraphQL mapping', () => {
  test('maps sub-issue display states for open, completed, and other closed reasons', () => {
    expect(mapSubIssueDisplayState({ state: 'OPEN', stateReason: null })).toBe('open');
    expect(mapSubIssueDisplayState({ state: 'CLOSED', stateReason: 'COMPLETED' })).toBe(
      'completed'
    );
    expect(mapSubIssueDisplayState({ state: 'CLOSED', stateReason: 'NOT_PLANNED' })).toBe(
      'notPlanned'
    );
    expect(mapSubIssueDisplayState({ state: 'CLOSED', stateReason: null })).toBe('closed');
  });

  test('maps GraphQL subIssues connection preserving priority order and nested progress', () => {
    expect(
      mapSubIssueConnection({
        subIssuesSummary: { total: 3, completed: 1 },
        subIssues: {
          totalCount: 3,
          nodes: [
            {
              number: 11,
              title: 'First task',
              state: 'CLOSED',
              stateReason: 'COMPLETED',
              repository: { name: 'widgets', owner: { login: 'acme' } },
              subIssuesSummary: { total: 2, completed: 2 },
            },
            {
              number: 12,
              title: 'Cross-repo task',
              state: 'OPEN',
              stateReason: null,
              repository: { name: 'core', owner: { login: 'acme' } },
              subIssuesSummary: { total: 0, completed: 0 },
            },
            null,
          ],
        },
      })
    ).toEqual({
      totalCount: 3,
      completedCount: 1,
      nodes: [
        {
          owner: 'acme',
          repo: 'widgets',
          number: 11,
          title: 'First task',
          state: 'completed',
          subIssuesSummary: { completed: 2, total: 2 },
        },
        {
          owner: 'acme',
          repo: 'core',
          number: 12,
          title: 'Cross-repo task',
          state: 'open',
          subIssuesSummary: null,
        },
      ],
    });
  });

  test('requests all direct sub-issues in one call', async () => {
    let capturedVariables: Record<string, unknown> | undefined;
    const octokit = {
      graphql: async (query: string, variables?: Record<string, unknown>) => {
        expect(query).toContain('subIssues(first: 100)');
        capturedVariables = variables;
        return {
          repository: {
            issue: {
              subIssuesSummary: { total: 1, completed: 0 },
              subIssues: {
                totalCount: 1,
                nodes: [
                  {
                    number: 5,
                    title: 'Child',
                    state: 'OPEN',
                    stateReason: null,
                    repository: { name: 'widgets', owner: { login: 'acme' } },
                    subIssuesSummary: null,
                  },
                ],
              },
            },
          },
        };
      },
    };

    const result = await fetchSubIssueConnection(octokit, 'acme', 'widgets', 1);
    expect(capturedVariables).toEqual({
      owner: 'acme',
      repo: 'widgets',
      number: 1,
    });
    expect(result.nodes).toHaveLength(1);
    expect(result.completedCount).toBe(0);
  });
});

describe('Parent issue GraphQL lookup', () => {
  test('maps parent issue into reference target shape and returns undefined on failure', async () => {
    const okOctokit = {
      graphql: async () => ({
        repository: {
          issue: {
            parent: {
              number: 42,
              title: 'Parent epic',
              url: 'https://github.com/acme/meta/issues/42',
              state: 'OPEN',
              repository: { name: 'meta', owner: { login: 'acme' } },
            },
          },
        },
      }),
    };

    expect(await fetchIssueParentTarget(okOctokit, 'acme', 'widgets', 7)).toEqual({
      resourceType: 'issue',
      number: 42,
      title: 'Parent epic',
      url: 'https://github.com/acme/meta/issues/42',
      state: 'open',
      repository: { name: 'meta', nameWithOwner: 'acme/meta', owner: { login: 'acme' } },
    });

    const failingOctokit = {
      graphql: async () => {
        throw new Error('Forbidden');
      },
    };

    expect(await fetchIssueParentTarget(failingOctokit, 'acme', 'widgets', 7)).toBeUndefined();
  });
});
