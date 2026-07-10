import { describe, expect, test } from 'bun:test';

import {
  buildRepoIssuePrSearchQuery,
  normalizeRepoIssuePrState,
} from '../app/utils/repoIssuePrSearchQuery';

describe('repo issue/PR list search query', () => {
  test('defaults to open items scoped to the repository', () => {
    expect(buildRepoIssuePrSearchQuery('acme', 'widgets', 'issues')).toBe(
      'is:issue archived:false repo:acme/widgets state:open sort:updated-desc'
    );

    expect(buildRepoIssuePrSearchQuery('acme', 'widgets', 'pulls', 'open')).toBe(
      'is:pr archived:false repo:acme/widgets state:open sort:updated-desc'
    );
  });

  test('keeps closed and merged pull request searches mutually exclusive', () => {
    expect(buildRepoIssuePrSearchQuery('acme', 'widgets', 'pulls', 'closed')).toBe(
      'is:pr archived:false repo:acme/widgets state:closed -is:merged sort:updated-desc'
    );

    expect(buildRepoIssuePrSearchQuery('acme', 'widgets', 'pulls', 'merged')).toBe(
      'is:pr archived:false repo:acme/widgets is:merged sort:updated-desc'
    );
  });

  test('omits state qualifiers when showing all items', () => {
    expect(buildRepoIssuePrSearchQuery('acme', 'widgets', 'issues', 'all')).toBe(
      'is:issue archived:false repo:acme/widgets sort:updated-desc'
    );
  });

  test('normalizes merged state away for issues', () => {
    expect(normalizeRepoIssuePrState('issues', 'merged')).toBe('open');
    expect(normalizeRepoIssuePrState('pulls', 'merged')).toBe('merged');
    expect(buildRepoIssuePrSearchQuery('acme', 'widgets', 'issues', 'merged')).toBe(
      'is:issue archived:false repo:acme/widgets state:open sort:updated-desc'
    );
  });
});
