import { describe, expect, test } from 'bun:test';

import type { SubIssueNode } from '../shared/types/sub-issues';
import {
  readSubIssueProgress,
  toSubIssueIdentity,
  toSubIssueRows,
} from '../shared/utils/sub-issues';

const ISSUE = { owner: 'acme', repo: 'widgets' };

const node = (
  overrides: Partial<SubIssueNode> & Pick<SubIssueNode, 'owner' | 'repo' | 'number'>
): SubIssueNode => ({
  title: `Sub-issue ${overrides.number}`,
  state: 'open',
  subIssuesSummary: null,
  ...overrides,
});

describe('Sub-issue progress normalization', () => {
  test('returns null when total is zero, negative, missing, or non-integer', () => {
    expect(readSubIssueProgress(null)).toBeNull();
    expect(readSubIssueProgress(undefined)).toBeNull();
    expect(readSubIssueProgress({ total: 0, completed: 0 })).toBeNull();
    expect(readSubIssueProgress({ total: -1, completed: 0 })).toBeNull();
    expect(readSubIssueProgress({ total: 1.5, completed: 1 })).toBeNull();
    expect(readSubIssueProgress({ total: 3, completed: -1 })).toBeNull();
    expect(readSubIssueProgress({ total: 3 })).toBeNull();
  });

  test('normalizes valid progress and clamps completed to total', () => {
    expect(readSubIssueProgress({ total: 5, completed: 2 })).toEqual({
      completed: 2,
      total: 5,
    });
    expect(readSubIssueProgress({ total: 4, completed: 4 })).toEqual({
      completed: 4,
      total: 4,
    });
    expect(readSubIssueProgress({ total: 3, completed: 7 })).toEqual({
      completed: 3,
      total: 3,
    });
  });
});

describe('Sub-issue identity normalization', () => {
  test('accepts valid owner, repo, and positive integer number', () => {
    expect(toSubIssueIdentity({ owner: ' acme ', repo: ' widgets ', number: 12 })).toEqual({
      owner: 'acme',
      repo: 'widgets',
      number: 12,
    });
  });

  test('rejects incomplete or invalid identities', () => {
    expect(toSubIssueIdentity(null)).toBeNull();
    expect(toSubIssueIdentity({ owner: '', repo: 'widgets', number: 12 })).toBeNull();
    expect(toSubIssueIdentity({ owner: 'acme', repo: 'widgets', number: 0 })).toBeNull();
    expect(toSubIssueIdentity({ owner: 'acme', repo: 'widgets', number: 1.2 })).toBeNull();
  });
});

describe('Sub-issue rows', () => {
  test('preserves GitHub priority order across local and cross-repository rows', () => {
    const nodes = [
      node({ owner: 'other', repo: 'core', number: 9, state: 'closed', title: 'First priority' }),
      node({
        owner: 'ACME',
        repo: 'WIDGETS',
        number: 4,
        state: 'open',
        title: 'Second priority',
        subIssuesSummary: { completed: 1, total: 2 },
      }),
      node({
        owner: 'acme',
        repo: 'docs',
        number: 15,
        state: 'completed',
        title: 'Third priority',
      }),
    ];

    expect(toSubIssueRows(nodes, ISSUE)).toEqual([
      {
        owner: 'other',
        repo: 'core',
        number: 9,
        title: 'First priority',
        state: 'closed',
        showRepository: true,
        subIssuesSummary: null,
      },
      {
        owner: 'ACME',
        repo: 'WIDGETS',
        number: 4,
        title: 'Second priority',
        state: 'open',
        showRepository: false,
        subIssuesSummary: { completed: 1, total: 2 },
      },
      {
        owner: 'acme',
        repo: 'docs',
        number: 15,
        title: 'Third priority',
        state: 'completed',
        showRepository: true,
        subIssuesSummary: null,
      },
    ]);
  });

  test('skips incomplete nodes without crashing', () => {
    const nodes = [
      node({ owner: null, repo: 'widgets', number: 1 }),
      node({ owner: 'acme', repo: 'widgets', number: 2, title: null }),
    ];

    expect(toSubIssueRows(nodes, ISSUE)).toEqual([
      {
        owner: 'acme',
        repo: 'widgets',
        number: 2,
        title: '',
        state: 'open',
        showRepository: false,
        subIssuesSummary: null,
      },
    ]);
  });

  test('supports all 100 direct sub-issues', () => {
    const nodes = Array.from({ length: 100 }, (_, index) =>
      node({
        owner: 'acme',
        repo: index === 1 ? 'other' : 'widgets',
        number: index + 10,
      })
    );

    const rows = toSubIssueRows(nodes, ISSUE);
    expect(rows).toHaveLength(100);
    expect(rows[0]?.showRepository).toBe(false);
    expect(rows[1]?.showRepository).toBe(true);
    expect(rows.map((row) => row.number)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 10)
    );
  });
});
