import { describe, expect, mock, test } from 'bun:test';

import * as linkedPullRequestTypes from '../shared/types/linked-pull-requests';
import * as linkedPullRequests from '../shared/utils/linked-pull-requests';

mock.module('#shared/types/linked-pull-requests', () => linkedPullRequestTypes);
mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);

const {
  LINKED_PULL_REQUEST_LIST_NODE_FIELDS,
  LINKED_PULL_REQUEST_PICKER_NODE_FIELDS,
  attachLinkedPullRequestSummaries,
  mapLinkedPullRequestConnection,
  mapLinkedPullRequestDisplayState,
} = await import('../server/utils/linked-pull-request-graphql-utils');
const { toLinkedPullRequestPickerModel } = linkedPullRequests;

describe('Linked Pull Request GraphQL mapping', () => {
  test('maps includeClosedPrs connection nodes onto list-model fields', () => {
    expect(
      mapLinkedPullRequestConnection({
        totalCount: 2,
        nodes: [
          {
            number: 7,
            title: 'Fix login',
            updatedAt: '2026-08-12T00:00:00.000Z',
            state: 'OPEN',
            isDraft: true,
            author: { login: 'octocat' },
            repository: { name: 'widgets', owner: { login: 'acme' } },
          },
          {
            number: 8,
            state: 'CLOSED',
            mergedAt: '2026-08-13T00:00:00.000Z',
            repository: { name: 'tools', owner: { login: 'other' } },
          },
          null,
        ],
      })
    ).toEqual({
      totalCount: 2,
      nodes: [
        {
          owner: 'acme',
          repo: 'widgets',
          number: 7,
          title: 'Fix login',
          authorLogin: 'octocat',
          updatedAt: '2026-08-12T00:00:00.000Z',
          state: 'draft',
        },
        {
          owner: 'other',
          repo: 'tools',
          number: 8,
          title: null,
          authorLogin: null,
          updatedAt: null,
          state: 'merged',
        },
      ],
    });
  });

  test('resolves pull request display state with merged, closed, draft, then open', () => {
    expect(mapLinkedPullRequestDisplayState({ merged: true, state: 'OPEN', isDraft: true })).toBe(
      'merged'
    );
    expect(
      mapLinkedPullRequestDisplayState({
        mergedAt: '2026-01-01T00:00:00.000Z',
        state: 'CLOSED',
      })
    ).toBe('merged');
    expect(mapLinkedPullRequestDisplayState({ state: 'CLOSED', isDraft: true })).toBe('closed');
    expect(mapLinkedPullRequestDisplayState({ state: 'OPEN', isDraft: true })).toBe('draft');
    expect(mapLinkedPullRequestDisplayState({ state: 'OPEN' })).toBe('open');
  });

  test('list and picker GraphQL field sets ask for includeClosedPrs references', () => {
    expect(LINKED_PULL_REQUEST_LIST_NODE_FIELDS).toContain('includeClosedPrs: true');
    expect(LINKED_PULL_REQUEST_LIST_NODE_FIELDS).toContain('first: 1');
    expect(LINKED_PULL_REQUEST_PICKER_NODE_FIELDS).toContain('includeClosedPrs: true');
    expect(LINKED_PULL_REQUEST_PICKER_NODE_FIELDS).toContain('first: 20');
    expect(LINKED_PULL_REQUEST_PICKER_NODE_FIELDS).toContain('title');
    expect(LINKED_PULL_REQUEST_PICKER_NODE_FIELDS).toContain('updatedAt');
    expect(LINKED_PULL_REQUEST_PICKER_NODE_FIELDS).toContain('author { login }');
  });

  test('picker JSON from GraphQL yields the grouped Picker model', () => {
    const mapped = mapLinkedPullRequestConnection({
      totalCount: 2,
      nodes: [
        {
          number: 4,
          title: 'Foreign',
          state: 'OPEN',
          repository: { name: 'lib', owner: { login: 'foreign' } },
        },
        {
          number: 5,
          title: 'Local',
          state: 'MERGED',
          merged: true,
          repository: { name: 'widgets', owner: { login: 'acme' } },
        },
      ],
    });

    expect(toLinkedPullRequestPickerModel(mapped, { owner: 'acme', repo: 'widgets' })).toEqual({
      groups: [
        {
          kind: 'same-repository',
          showHeader: true,
          rows: [
            {
              owner: 'acme',
              repo: 'widgets',
              number: 5,
              title: 'Local',
              authorLogin: '',
              updatedAt: null,
              state: 'merged',
              showRepository: false,
            },
          ],
        },
        {
          kind: 'other-repositories',
          showHeader: true,
          rows: [
            {
              owner: 'foreign',
              repo: 'lib',
              number: 4,
              title: 'Foreign',
              authorLogin: '',
              updatedAt: null,
              state: 'open',
              showRepository: true,
            },
          ],
        },
      ],
      remainder: 0,
    });
  });
});

describe('attach Linked Pull Request summaries to Search items', () => {
  test('attaches Count and identity only to Issue items, not pull request items', async () => {
    const items = [
      {
        id: 1,
        number: 10,
        title: 'Issue',
        repository_url: 'https://api.github.com/repos/acme/widgets',
      },
      {
        id: 2,
        number: 11,
        title: 'Pull',
        repository_url: 'https://api.github.com/repos/acme/widgets',
        pull_request: { url: 'https://api.github.com/repos/acme/widgets/pulls/11' },
      },
      {
        id: 3,
        number: 12,
        title: 'Other issue',
        repository_url: 'https://api.github.com/repos/acme/widgets',
      },
    ];

    const octokit = {
      graphql: async (query: string, variables: Record<string, unknown>) => {
        expect(query).toContain('closedByPullRequestsReferences');
        expect(query).toContain('includeClosedPrs: true');
        expect(query).not.toContain('pullRequest(');
        expect(variables).toMatchObject({
          owner0: 'acme',
          repo0: 'widgets',
          number0: 10,
          number1: 12,
        });

        return {
          subject0: {
            issue: {
              closedByPullRequestsReferences: {
                totalCount: 1,
                nodes: [
                  {
                    number: 99,
                    repository: { name: 'widgets', owner: { login: 'acme' } },
                  },
                ],
              },
            },
          },
          subject1: {
            issue: {
              closedByPullRequestsReferences: {
                totalCount: 2,
                nodes: [
                  {
                    number: 1,
                    repository: { name: 'widgets', owner: { login: 'acme' } },
                  },
                ],
              },
            },
          },
        };
      },
    };

    const next = await attachLinkedPullRequestSummaries(octokit, items);

    expect(next[0]).toMatchObject({
      id: 1,
      linkedPullRequestCount: 1,
      linkedPullRequest: { owner: 'acme', repo: 'widgets', number: 99 },
    });
    expect(next[1]).toEqual(items[1]);
    expect(next[1]).not.toHaveProperty('linkedPullRequestCount');
    expect(next[2]).toMatchObject({
      id: 3,
      linkedPullRequestCount: 2,
      linkedPullRequest: undefined,
    });
  });

  test('leaves Search items unchanged when the extra GraphQL pass fails', async () => {
    const items = [
      {
        id: 1,
        number: 10,
        repository_url: 'https://api.github.com/repos/acme/widgets',
      },
    ];

    const octokit = {
      graphql: async () => {
        throw new Error('GraphQL 502');
      },
    };

    const original = structuredClone(items);
    expect(await attachLinkedPullRequestSummaries(octokit, items)).toEqual(original);
  });
});
