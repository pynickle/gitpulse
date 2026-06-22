import { describe, expect, test } from 'bun:test';

import { buildPullHeadBranchState } from '../server/utils/pr-head-branch-utils';

const createMergedPullRequest = () => ({
  number: 42,
  state: 'closed',
  merged: true,
  merged_at: '2026-06-22T08:00:00Z',
  head: {
    ref: 'feature/delete-after-merge',
    sha: 'abc123',
    label: 'octocat:feature/delete-after-merge',
    repo: {
      name: 'hello-world',
      full_name: 'octocat/hello-world',
      default_branch: 'main',
      owner: { login: 'octocat' },
      permissions: {
        admin: false,
        maintain: false,
        push: true,
        triage: true,
        pull: true,
      },
    },
  },
  base: {
    repo: {
      full_name: 'octocat/hello-world',
    },
  },
});

describe('pull request head branch action state', () => {
  test('allows deleting an existing merged PR head branch when the viewer can push', () => {
    const state = buildPullHeadBranchState({
      pullRequest: createMergedPullRequest(),
      referenceExists: true,
      isProtected: false,
    });

    expect(state).toMatchObject({
      ref: 'feature/delete-after-merge',
      sha: 'abc123',
      exists: true,
      protected: false,
      default_branch: 'main',
      can_delete: true,
      can_restore: false,
      unavailable_reason: null,
    });
  });

  test('allows restoring a deleted merged PR head branch when the original SHA is available', () => {
    const state = buildPullHeadBranchState({
      pullRequest: createMergedPullRequest(),
      referenceExists: false,
      isProtected: false,
    });

    expect(state).toMatchObject({
      exists: false,
      can_delete: false,
      can_restore: true,
      unavailable_reason: null,
    });
  });

  test('allows deleting a closed unmerged PR head branch when GitHub would show the action', () => {
    const pullRequest = createMergedPullRequest();
    pullRequest.merged = false;
    pullRequest.merged_at = null;

    const state = buildPullHeadBranchState({
      pullRequest,
      referenceExists: true,
      isProtected: false,
    });

    expect(state).toMatchObject({
      can_delete: true,
      can_restore: false,
      unavailable_reason: null,
    });
  });

  test('blocks delete and restore when the viewer cannot write to the head repository', () => {
    const pullRequest = createMergedPullRequest();
    pullRequest.head.repo.permissions.push = false;

    const state = buildPullHeadBranchState({
      pullRequest,
      referenceExists: true,
      isProtected: false,
    });

    expect(state).toMatchObject({
      can_delete: false,
      can_restore: false,
      unavailable_reason: 'missing_permission',
    });
  });

  test('blocks default and protected branches even when the viewer can write', () => {
    const defaultBranchPullRequest = createMergedPullRequest();
    defaultBranchPullRequest.head.ref = 'main';

    expect(
      buildPullHeadBranchState({
        pullRequest: defaultBranchPullRequest,
        referenceExists: true,
        isProtected: false,
      })
    ).toMatchObject({
      can_delete: false,
      can_restore: false,
      unavailable_reason: 'default_branch',
    });

    expect(
      buildPullHeadBranchState({
        pullRequest: createMergedPullRequest(),
        referenceExists: true,
        isProtected: true,
      })
    ).toMatchObject({
      can_delete: false,
      can_restore: false,
      unavailable_reason: 'protected_branch',
    });
  });

  test('blocks delete and restore when another open pull request still uses the branch', () => {
    const state = buildPullHeadBranchState({
      pullRequest: createMergedPullRequest(),
      referenceExists: true,
      isProtected: false,
      openPullRequestsReferencingBranch: 1,
    });

    expect(state).toMatchObject({
      can_delete: false,
      can_restore: false,
      unavailable_reason: 'open_pull_request',
      open_pull_requests_count: 1,
    });
  });

  test('does not expose branch actions before the pull request is closed or merged', () => {
    const pullRequest = createMergedPullRequest();
    pullRequest.state = 'open';
    pullRequest.merged = false;
    pullRequest.merged_at = null;

    const state = buildPullHeadBranchState({
      pullRequest,
      referenceExists: true,
      isProtected: false,
    });

    expect(state).toMatchObject({
      can_delete: false,
      can_restore: false,
      unavailable_reason: 'not_closed_or_merged',
    });
  });
});
