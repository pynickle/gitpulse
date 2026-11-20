import { describe, expect, test } from 'bun:test';

import {
  pullRequestHasConflicts,
  readPullRequestMergeability,
} from '../shared/utils/pull-request-conflicts';

describe('pull request conflict marker', () => {
  test('reads GitHub mergeability in either case', () => {
    expect(readPullRequestMergeability('CONFLICTING')).toBe('conflicting');
    expect(readPullRequestMergeability(' mergeable ')).toBe('mergeable');
    expect(readPullRequestMergeability('UNKNOWN')).toBe('unknown');
    expect(readPullRequestMergeability('dirty')).toBeNull();
    expect(readPullRequestMergeability(null)).toBeNull();
  });

  test('marks an open pull request only when it has conflicts to resolve', () => {
    expect(pullRequestHasConflicts({ mergeable: 'CONFLICTING', state: 'open' })).toBe(true);
    expect(pullRequestHasConflicts({ mergeable: 'conflicting', state: 'OPEN', draft: true })).toBe(
      true
    );

    expect(pullRequestHasConflicts({ mergeable: 'MERGEABLE', state: 'open' })).toBe(false);
    expect(pullRequestHasConflicts({ mergeable: 'UNKNOWN', state: 'open' })).toBe(false);
    expect(pullRequestHasConflicts({ mergeable: null, state: 'open' })).toBe(false);
    expect(pullRequestHasConflicts({ mergeable: 'CONFLICTING', state: 'closed' })).toBe(false);
    expect(pullRequestHasConflicts({ mergeable: 'CONFLICTING', state: 'merged' })).toBe(false);
    expect(pullRequestHasConflicts(null)).toBe(false);
  });
});
