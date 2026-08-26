import { describe, expect, test } from 'bun:test';

import type {
  LinkedPullRequestConnection,
  LinkedPullRequestNode,
} from '../shared/types/linked-pull-requests';
import {
  LINKED_PULL_REQUEST_PICKER_PAGE_SIZE,
  readLinkedPullRequestListSummary,
  toLinkedPullRequestClickIntent,
  toLinkedPullRequestListSummary,
  toLinkedPullRequestPickerModel,
} from '../shared/utils/linked-pull-requests';

const ISSUE = { owner: 'acme', repo: 'widgets' };

const node = (
  overrides: Partial<LinkedPullRequestNode> &
    Pick<LinkedPullRequestNode, 'owner' | 'repo' | 'number'>
): LinkedPullRequestNode => ({
  title: `PR ${overrides.number}`,
  authorLogin: 'octocat',
  updatedAt: '2026-08-01T00:00:00.000Z',
  state: 'open',
  ...overrides,
});

const connection = (
  totalCount: number,
  nodes: LinkedPullRequestNode[]
): LinkedPullRequestConnection => ({
  totalCount,
  nodes,
});

describe('Linked Pull Request list summary', () => {
  test('hides Count 0 and never exposes a routing identity', () => {
    expect(
      toLinkedPullRequestListSummary(
        connection(0, [node({ owner: 'acme', repo: 'widgets', number: 9 })]),
        ISSUE
      )
    ).toEqual({ count: 0, identity: null });
  });

  test('exposes routing identity only when Count is 1 and owner, repository, and number are present', () => {
    expect(
      toLinkedPullRequestListSummary(
        connection(1, [
          node({
            owner: 'acme',
            repo: 'widgets',
            number: 12,
            title: 'Fix login',
            authorLogin: 'hubot',
          }),
        ]),
        ISSUE
      )
    ).toEqual({
      count: 1,
      identity: { owner: 'acme', repo: 'widgets', number: 12 },
    });
  });

  test('omits identity when Count is 1 but owner, repository, or number is missing', () => {
    expect(
      toLinkedPullRequestListSummary(
        connection(1, [node({ owner: null, repo: 'widgets', number: 12 })]),
        ISSUE
      )
    ).toEqual({ count: 1, identity: null });

    expect(
      toLinkedPullRequestListSummary(
        connection(1, [node({ owner: 'acme', repo: null, number: 12 })]),
        ISSUE
      )
    ).toEqual({ count: 1, identity: null });

    expect(
      toLinkedPullRequestListSummary(
        connection(1, [node({ owner: 'acme', repo: 'widgets', number: null })]),
        ISSUE
      )
    ).toEqual({ count: 1, identity: null });
  });

  test('ignores leftover identity nodes when Count is greater than 1', () => {
    expect(
      toLinkedPullRequestListSummary(
        connection(3, [node({ owner: 'acme', repo: 'widgets', number: 1 })]),
        ISSUE
      )
    ).toEqual({ count: 3, identity: null });
  });

  test('treats a missing or invalid totalCount as no summary', () => {
    expect(toLinkedPullRequestListSummary({ totalCount: null, nodes: [] }, ISSUE)).toBeNull();
    expect(toLinkedPullRequestListSummary({ totalCount: Number.NaN, nodes: [] }, ISSUE)).toBeNull();
    expect(toLinkedPullRequestListSummary({ totalCount: -1, nodes: [] }, ISSUE)).toBeNull();
  });

  test('reads stored Count and identity with the same Count=1 identity rule', () => {
    expect(
      readLinkedPullRequestListSummary(undefined, { owner: 'a', repo: 'b', number: 1 })
    ).toBeNull();
    expect(readLinkedPullRequestListSummary(0, { owner: 'a', repo: 'b', number: 1 })).toEqual({
      count: 0,
      identity: null,
    });
    expect(
      readLinkedPullRequestListSummary(1, { owner: 'acme', repo: 'widgets', number: 4 })
    ).toEqual({
      count: 1,
      identity: { owner: 'acme', repo: 'widgets', number: 4 },
    });
    expect(readLinkedPullRequestListSummary(1, { owner: 'acme', repo: 'widgets' })).toEqual({
      count: 1,
      identity: null,
    });
    expect(
      readLinkedPullRequestListSummary(2, { owner: 'acme', repo: 'widgets', number: 4 })
    ).toEqual({
      count: 2,
      identity: null,
    });
  });
});

describe('Linked Pull Request click intent', () => {
  test('hides when there is no summary or Count is 0', () => {
    expect(toLinkedPullRequestClickIntent(null)).toEqual({ kind: 'hide' });
    expect(toLinkedPullRequestClickIntent({ count: 0, identity: null })).toEqual({ kind: 'hide' });
  });

  test('opens the single pull request when Count is 1 and identity is complete', () => {
    expect(
      toLinkedPullRequestClickIntent({
        count: 1,
        identity: { owner: 'acme', repo: 'widgets', number: 12 },
      })
    ).toEqual({
      kind: 'open',
      identity: { owner: 'acme', repo: 'widgets', number: 12 },
    });
  });

  test('opens the Picker when Count is 1 without identity or Count is greater than 1', () => {
    expect(toLinkedPullRequestClickIntent({ count: 1, identity: null })).toEqual({ kind: 'pick' });
    expect(
      toLinkedPullRequestClickIntent({
        count: 2,
        identity: { owner: 'acme', repo: 'widgets', number: 1 },
      })
    ).toEqual({ kind: 'pick' });
  });
});

describe('Linked Pull Request Picker model', () => {
  test('omits empty groups and hides group headers when only one group has rows', () => {
    const sameOnly = toLinkedPullRequestPickerModel(
      connection(2, [
        node({ owner: 'acme', repo: 'widgets', number: 2, updatedAt: '2026-08-02T00:00:00.000Z' }),
        node({ owner: 'Acme', repo: 'Widgets', number: 1, updatedAt: '2026-08-01T00:00:00.000Z' }),
      ]),
      ISSUE
    );

    expect(sameOnly).toEqual({
      groups: [
        {
          kind: 'same-repository',
          showHeader: false,
          rows: [
            {
              owner: 'acme',
              repo: 'widgets',
              number: 2,
              title: 'PR 2',
              authorLogin: 'octocat',
              updatedAt: '2026-08-02T00:00:00.000Z',
              state: 'open',
              showRepository: false,
            },
            {
              owner: 'Acme',
              repo: 'Widgets',
              number: 1,
              title: 'PR 1',
              authorLogin: 'octocat',
              updatedAt: '2026-08-01T00:00:00.000Z',
              state: 'open',
              showRepository: false,
            },
          ],
        },
      ],
      remainder: 0,
    });

    const otherOnly = toLinkedPullRequestPickerModel(
      connection(1, [
        node({
          owner: 'other',
          repo: 'tools',
          number: 8,
          title: 'Cross-repo fix',
          authorLogin: 'hubot',
          updatedAt: '2026-07-01T00:00:00.000Z',
          state: 'merged',
        }),
      ]),
      ISSUE
    );

    expect(otherOnly.groups).toEqual([
      {
        kind: 'other-repositories',
        showHeader: false,
        rows: [
          {
            owner: 'other',
            repo: 'tools',
            number: 8,
            title: 'Cross-repo fix',
            authorLogin: 'hubot',
            updatedAt: '2026-07-01T00:00:00.000Z',
            state: 'merged',
            showRepository: true,
          },
        ],
      },
    ]);
  });

  test('shows both group headers, same-repository first, when both groups have rows', () => {
    const model = toLinkedPullRequestPickerModel(
      connection(2, [
        node({ owner: 'foreign', repo: 'lib', number: 4, title: 'Foreign' }),
        node({ owner: 'acme', repo: 'widgets', number: 5, title: 'Local' }),
      ]),
      ISSUE
    );

    expect(model.groups.map((group) => group.kind)).toEqual([
      'same-repository',
      'other-repositories',
    ]);
    expect(model.groups.map((group) => group.showHeader)).toEqual([true, true]);
    expect(model.groups[0]?.rows[0]).toMatchObject({
      number: 5,
      title: 'Local',
      showRepository: false,
    });
    expect(model.groups[1]?.rows[0]).toMatchObject({
      number: 4,
      title: 'Foreign',
      owner: 'foreign',
      repo: 'lib',
      showRepository: true,
    });
  });

  test('sorts open including draft, then merged, then closed, newest updated first within a state', () => {
    const model = toLinkedPullRequestPickerModel(
      connection(6, [
        node({
          owner: 'acme',
          repo: 'widgets',
          number: 1,
          title: 'Old open',
          state: 'open',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
        node({
          owner: 'acme',
          repo: 'widgets',
          number: 2,
          title: 'Closed new',
          state: 'closed',
          updatedAt: '2026-08-20T00:00:00.000Z',
        }),
        node({
          owner: 'acme',
          repo: 'widgets',
          number: 3,
          title: 'Merged old',
          state: 'merged',
          updatedAt: '2026-02-01T00:00:00.000Z',
        }),
        node({
          owner: 'acme',
          repo: 'widgets',
          number: 4,
          title: 'Draft new',
          state: 'draft',
          updatedAt: '2026-08-10T00:00:00.000Z',
        }),
        node({
          owner: 'acme',
          repo: 'widgets',
          number: 5,
          title: 'Merged new',
          state: 'merged',
          updatedAt: '2026-08-15T00:00:00.000Z',
        }),
        node({
          owner: 'acme',
          repo: 'widgets',
          number: 6,
          title: 'Closed old',
          state: 'closed',
          updatedAt: '2026-01-02T00:00:00.000Z',
        }),
      ]),
      ISSUE
    );

    expect(model.groups[0]?.rows.map((row) => row.title)).toEqual([
      'Draft new',
      'Old open',
      'Merged new',
      'Merged old',
      'Closed new',
      'Closed old',
    ]);
  });

  test('caps Picker rows at 20 and reports remainder from totalCount', () => {
    expect(LINKED_PULL_REQUEST_PICKER_PAGE_SIZE).toBe(20);

    const nodes = Array.from({ length: 22 }, (_, index) =>
      node({
        owner: 'acme',
        repo: 'widgets',
        number: index + 1,
        title: `PR ${index + 1}`,
        updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      })
    );

    const model = toLinkedPullRequestPickerModel(connection(25, nodes), ISSUE);

    expect(model.groups[0]?.rows).toHaveLength(20);
    expect(model.groups[0]?.rows[0]?.number).toBe(20);
    expect(model.groups[0]?.rows[19]?.number).toBe(1);
    expect(model.remainder).toBe(5);
  });

  test('reports remainder 0 when totalCount does not exceed 20', () => {
    const nodes = Array.from({ length: 3 }, (_, index) =>
      node({ owner: 'acme', repo: 'widgets', number: index + 1 })
    );
    expect(toLinkedPullRequestPickerModel(connection(3, nodes), ISSUE).remainder).toBe(0);
  });

  test('skips nodes without a usable routing identity and still reports remainder from totalCount', () => {
    const model = toLinkedPullRequestPickerModel(
      connection(21, [
        node({ owner: null, repo: 'widgets', number: 1, title: 'Broken' }),
        node({ owner: 'acme', repo: 'widgets', number: 2, title: 'Usable' }),
      ]),
      ISSUE
    );

    expect(model.groups[0]?.rows).toEqual([
      {
        owner: 'acme',
        repo: 'widgets',
        number: 2,
        title: 'Usable',
        authorLogin: 'octocat',
        updatedAt: '2026-08-01T00:00:00.000Z',
        state: 'open',
        showRepository: false,
      },
    ]);
    expect(model.remainder).toBe(1);
  });

  test('shows an empty Picker model when the connection has no usable rows', () => {
    expect(toLinkedPullRequestPickerModel(connection(0, []), ISSUE)).toEqual({
      groups: [],
      remainder: 0,
    });
    expect(
      toLinkedPullRequestPickerModel(
        connection(2, [node({ owner: null, repo: null, number: null, title: 'Gone' })]),
        ISSUE
      )
    ).toEqual({
      groups: [],
      remainder: 0,
    });
  });
});
