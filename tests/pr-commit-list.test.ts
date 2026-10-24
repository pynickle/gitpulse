import { describe, expect, test } from 'bun:test';

import { buildPullRequestCommitUrl } from '../server/utils/repo-latest-commit-utils';

describe('buildPullRequestCommitUrl', () => {
  test('builds a PR-scoped commit URL', () => {
    expect(buildPullRequestCommitUrl('acme', 'widgets', 42, 'abcdef0123456789')).toBe(
      'https://github.com/acme/widgets/pull/42/commits/abcdef0123456789'
    );
  });
});
