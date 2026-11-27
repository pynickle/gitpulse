import { describe, expect, mock, test } from 'bun:test';

import type { Octokit } from '@octokit/core';

import * as githubGraphqlUtils from '../server/utils/github-graphql-utils';
import * as prHeadBranchUtils from '../server/utils/pr-head-branch-utils';
import * as prMergeSettingsUtils from '../server/utils/pr-merge-settings-utils';
import * as zodValidationUtils from '../server/utils/zod-validation-utils';
import * as prChecks from '../shared/utils/pr-checks';
import * as pullRequestConflicts from '../shared/utils/pull-request-conflicts';

mock.module('#server/utils/github-graphql-utils', () => githubGraphqlUtils);
mock.module('#server/utils/zod-validation-utils', () => zodValidationUtils);
mock.module('#shared/utils/pr-checks', () => prChecks);
mock.module('#shared/utils/pull-request-conflicts', () => pullRequestConflicts);

const prCheckRollupGraphql = await import('../server/utils/pr-check-rollup-graphql-utils');
mock.module('#server/utils/pr-check-rollup-graphql-utils', () => prCheckRollupGraphql);
mock.module('#server/utils/pr-head-branch-utils', () => prHeadBranchUtils);
mock.module('#server/utils/pr-merge-settings-utils', () => prMergeSettingsUtils);

const { fetchPRMergeStatus } = await import('../server/utils/pr-merge-status-utils');

interface StubScenario {
  pullRequest?: Record<string, unknown>;
  repository?: Record<string, unknown>;
  branchRules?: unknown[] | Error;
  compare?: Record<string, unknown> | Error;
  headBranchExists?: boolean;
  headBranchProtected?: boolean;
  openPullsForHead?: unknown[];
}

function makeGraphQLPullRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'PR_kwDO_1',
    number: 3853,
    state: 'OPEN',
    merged: false,
    mergedAt: null,
    mergedBy: null,
    mergeCommit: null,
    mergeStateStatus: 'CLEAN',
    mergeable: 'MERGEABLE',
    isDraft: false,
    locked: false,
    viewerCanUpdateBranch: false,
    viewerCanEditFiles: false,
    maintainerCanModify: false,
    reviewDecision: null,
    baseRefName: 'dev',
    baseRefOid: 'stale-base-oid-000',
    headRefName: 'feat/update',
    headRefOid: 'head-oid-111',
    headRepository: {
      name: 'PCL-CE',
      owner: { login: 'PCL-Community' },
      viewerPermission: 'WRITE',
    },
    headRepositoryOwner: { login: 'PCL-Community' },
    baseRef: {
      target: { oid: 'graphql-base-oid-222' },
      branchProtectionRule: null,
    },
    reviewRequests: { totalCount: 0 },
    latestOpinionatedReviews: { nodes: [] },
    reviewThreads: { totalCount: 0, nodes: [] },
    commits: {
      totalCount: 1,
      nodes: [{ commit: { parents: { totalCount: 1 }, signature: { isValid: true } } }],
    },
    autoMergeRequest: null,
    isInMergeQueue: false,
    isMergeQueueEnabled: false,
    mergeQueueEntry: null,
    statusCheckRollup: {
      state: 'SUCCESS',
      contexts: {
        totalCount: 2,
        nodes: [
          {
            __typename: 'CheckRun',
            name: 'build',
            status: 'COMPLETED',
            conclusion: 'SUCCESS',
            detailsUrl: 'https://github.com/PCL-Community/PCL-CE/runs/1',
            startedAt: '2026-11-27T08:00:00Z',
            completedAt: '2026-11-27T08:01:36Z',
            checkSuite: {
              app: { name: 'GitHub Actions', logoUrl: 'https://avatars.example/actions.png' },
            },
          },
          {
            __typename: 'CheckRun',
            name: 'Sourcery review',
            status: 'COMPLETED',
            conclusion: 'SKIPPED',
            title: '⏭️ Auto re-review limit reached',
            startedAt: '2026-11-27T08:00:00Z',
            completedAt: '2026-11-27T08:00:00Z',
            checkSuite: {
              app: { name: 'Sourcery', logoUrl: 'https://avatars.example/sourcery.png' },
            },
          },
        ],
      },
    },
    ...overrides,
  };
}

function createStubOctokit(scenario: StubScenario = {}) {
  const routes: string[] = [];
  const graphqlQueries: string[] = [];

  const repository = {
    name: 'PCL-CE',
    full_name: 'PCL-Community/PCL-CE',
    default_branch: 'main',
    owner: { login: 'PCL-Community' },
    permissions: { admin: false, maintain: true, push: true, pull: true },
    allow_merge_commit: true,
    allow_squash_merge: true,
    allow_rebase_merge: true,
    ...scenario.repository,
  };

  const octokit = {
    graphql: mock(async (query: string) => {
      graphqlQueries.push(query);
      return {
        repository: {
          pullRequest: makeGraphQLPullRequest(scenario.pullRequest),
        },
      };
    }),
    request: mock(async (route: string) => {
      routes.push(route);
      if (route === 'GET /repos/{owner}/{repo}') {
        return { data: repository };
      }
      if (route === 'GET /repos/{owner}/{repo}/rules/branches/{branch}') {
        if (scenario.branchRules instanceof Error) throw scenario.branchRules;
        return { data: scenario.branchRules ?? [] };
      }
      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') {
        if (scenario.compare instanceof Error) throw scenario.compare;
        return {
          data: {
            behind_by: 0,
            base_commit: { sha: 'live-compare-base-sha-999' },
            ...scenario.compare,
          },
        };
      }
      if (route === 'GET /repos/{owner}/{repo}/git/ref/{ref}') {
        if (scenario.headBranchExists === false) {
          throw Object.assign(new Error('Not Found'), { status: 404 });
        }
        return { data: {} };
      }
      if (route === 'GET /repos/{owner}/{repo}/branches/{branch}') {
        return { data: { protected: scenario.headBranchProtected ?? false } };
      }
      if (route === 'GET /repos/{owner}/{repo}/pulls') {
        return { data: scenario.openPullsForHead ?? [], headers: {} };
      }
      throw new Error(`Unexpected REST route: ${route}`);
    }),
  };

  return {
    octokit: octokit as unknown as Octokit,
    routes,
    graphqlQueries,
  };
}

describe('fetchPRMergeStatus (consolidated GraphQL + Rulesets + Compare)', () => {
  test('reads review requirements, ruleset-restricted merge methods, live compare baseSha, and rich rollup in one GraphQL call while skipping head-branch probes on open PRs', async () => {
    const { octokit, routes, graphqlQueries } = createStubOctokit({
      pullRequest: {
        mergeStateStatus: 'BLOCKED',
        reviewDecision: 'REVIEW_REQUIRED',
        commits: {
          totalCount: 2,
          nodes: [
            { commit: { parents: { totalCount: 1 }, signature: { isValid: true } } },
            { commit: { parents: { totalCount: 1 }, signature: { isValid: false } } },
          ],
        },
      },
      branchRules: [
        {
          type: 'pull_request',
          parameters: {
            required_approving_review_count: 2,
            required_review_thread_resolution: true,
            allowed_merge_methods: ['squash'],
          },
        },
        { type: 'required_signatures' },
      ],
      compare: {
        behind_by: 3,
        base_commit: { sha: 'live-dev-tip-abcdef123' },
      },
    });

    const status = await fetchPRMergeStatus(octokit, 'PCL-Community', 'PCL-CE', 3853);

    expect(graphqlQueries).toHaveLength(1);
    expect(status.reviewDecision).toBe('review_required');
    expect(status.reviewRequirements).toEqual({
      requiredApprovingReviewCount: 2,
      qualifyingApprovalCount: 0,
      requireCodeOwnerReview: false,
      requireLastPushApproval: false,
      requiredReviewThreadResolution: true,
    });
    expect(status.allowedMergeMethods).toEqual(['squash']);
    expect(status.behindBy).toBe(3);
    expect(status.baseSha).toBe('live-dev-tip-abcdef123');
    expect(status.mergeBlockers).toEqual([{ code: 'unsigned_commits', count: 1 }]);
    expect(status.headBranch).toBeNull();
    expect(status.checkRollup?.contexts?.nodes?.[1]).toMatchObject({
      name: 'Sourcery review',
      conclusion: 'SKIPPED',
      title: '⏭️ Auto re-review limit reached',
    });
    // Open PR must NOT probe head-branch refs, branch protection, or open PRs for head.
    expect(routes).not.toContain('GET /repos/{owner}/{repo}/git/ref/{ref}');
    expect(routes).not.toContain('GET /repos/{owner}/{repo}/branches/{branch}');
    expect(routes).not.toContain('GET /repos/{owner}/{repo}/pulls');
  });

  test('falls back to branch ruleset review count when GraphQL reviewDecision is null on a fork PR, honors viewerCanUpdateBranch, and reports unresolved conversations', async () => {
    const { octokit } = createStubOctokit({
      pullRequest: {
        number: 3897,
        mergeStateStatus: 'BLOCKED',
        reviewDecision: null,
        viewerCanUpdateBranch: true,
        viewerCanEditFiles: false,
        maintainerCanModify: true,
        headRepository: {
          name: 'PCL-CE',
          owner: { login: 'contributor-fork' },
          viewerPermission: 'READ',
        },
        headRepositoryOwner: { login: 'contributor-fork' },
        latestOpinionatedReviews: {
          nodes: [
            { state: 'APPROVED', authorAssociation: 'CONTRIBUTOR', author: { login: 'fan' } },
            { state: 'APPROVED', authorAssociation: 'MEMBER', author: { login: 'maintainer1' } },
          ],
        },
        reviewThreads: {
          totalCount: 3,
          nodes: [{ isResolved: true }, { isResolved: false }, { isResolved: false }],
        },
      },
      branchRules: [
        {
          type: 'pull_request',
          parameters: {
            required_approving_review_count: 2,
            required_review_thread_resolution: true,
            require_code_owner_review: true,
            require_last_push_approval: true,
          },
        },
      ],
      compare: {
        behind_by: 4,
        base_commit: { sha: 'dev-tip-444' },
      },
    });

    const status = await fetchPRMergeStatus(octokit, 'PCL-Community', 'PCL-CE', 3897);

    expect(status.reviewDecision).toBe('review_required');
    expect(status.reviewSummary).toEqual({ approved: 2, changesRequested: 0 });
    expect(status.reviewRequirements).toEqual({
      requiredApprovingReviewCount: 2,
      qualifyingApprovalCount: 1,
      requireCodeOwnerReview: true,
      requireLastPushApproval: true,
      requiredReviewThreadResolution: true,
    });
    expect(status.viewerCanWriteHead).toBe(true);
    expect(status.mergeBlockers).toEqual([{ code: 'unresolved_conversations', count: 2 }]);
  });

  test('marks fork PR eligible for Branch Update when maintainerCanModify and viewerCanMerge hold even if viewerCanUpdateBranch and viewerCanEditFiles are false', async () => {
    const { octokit } = createStubOctokit({
      pullRequest: {
        viewerCanUpdateBranch: false,
        viewerCanEditFiles: false,
        maintainerCanModify: true,
        headRepository: {
          name: 'PCL-CE',
          owner: { login: 'external-fork' },
          viewerPermission: 'READ',
        },
      },
    });

    const status = await fetchPRMergeStatus(octokit, 'PCL-Community', 'PCL-CE', 3897);
    expect(status.viewerCanWriteHead).toBe(true);
  });

  test('reports strict_branch_currency, linear_history_required, conflicts, and ruleset fallback accurately', async () => {
    const behindScenario = createStubOctokit({
      pullRequest: { mergeStateStatus: 'BEHIND', mergeable: 'MERGEABLE' },
      compare: { behind_by: 2, base_commit: { sha: 'abc1234' } },
    });
    const behindStatus = await fetchPRMergeStatus(behindScenario.octokit, 'octo', 'app', 1);
    expect(behindStatus.mergeableState).toBe('behind');
    expect(behindStatus.mergeBlockers).toEqual([{ code: 'strict_branch_currency' }]);

    const linearScenario = createStubOctokit({
      pullRequest: {
        mergeStateStatus: 'BLOCKED',
        reviewDecision: 'APPROVED',
        commits: {
          totalCount: 1,
          nodes: [{ commit: { parents: { totalCount: 2 }, signature: { isValid: true } } }],
        },
      },
      branchRules: [{ type: 'required_linear_history' }],
    });
    const linearStatus = await fetchPRMergeStatus(linearScenario.octokit, 'octo', 'app', 2);
    expect(linearStatus.mergeBlockers).toEqual([{ code: 'linear_history_required' }]);

    const unknownBlockScenario = createStubOctokit({
      pullRequest: { mergeStateStatus: 'BLOCKED', reviewDecision: 'APPROVED' },
      branchRules: Object.assign(new Error('Forbidden'), { status: 403 }),
    });
    const unknownBlockStatus = await fetchPRMergeStatus(
      unknownBlockScenario.octokit,
      'octo',
      'app',
      3
    );
    expect(unknownBlockStatus.mergeBlockers).toEqual([{ code: 'ruleset_or_protection_blocked' }]);
  });

  test('exposes read-only Auto-merge and Merge Queue states', async () => {
    const { octokit } = createStubOctokit({
      pullRequest: {
        autoMergeRequest: { mergeMethod: 'SQUASH' },
        isInMergeQueue: true,
        isMergeQueueEnabled: true,
        mergeQueueEntry: { state: 'QUEUED', position: 2 },
      },
    });

    const status = await fetchPRMergeStatus(octokit, 'octo', 'app', 10);

    expect(status.autoMerge).toBe(true);
    expect(status.autoMergeState).toEqual({ enabled: true, mergeMethod: 'squash' });
    expect(status.mergeQueue).toEqual({
      inMergeQueue: true,
      state: 'QUEUED',
      position: 2,
      enabled: true,
    });
  });

  test('fetches headBranch delete/restore availability and skips rulesets/compare on closed or merged PRs', async () => {
    const { octokit, routes } = createStubOctokit({
      pullRequest: {
        state: 'MERGED',
        merged: true,
        mergedAt: '2026-11-27T08:30:00Z',
        mergedBy: {
          login: 'octocat',
          avatarUrl: 'https://avatars.example/octo.png',
          url: 'https://github.com/octocat',
        },
        mergeCommit: { oid: 'merged-commit-sha-777' },
      },
      headBranchExists: true,
      headBranchProtected: false,
      openPullsForHead: [],
    });

    const status = await fetchPRMergeStatus(octokit, 'PCL-Community', 'PCL-CE', 3848);

    expect(status.state).toBe('merged');
    expect(status.merged).toBe(true);
    expect(status.mergeCommitSha).toBe('merged-commit-sha-777');
    expect(status.headBranch?.can_delete).toBe(true);
    expect(routes).not.toContain('GET /repos/{owner}/{repo}/rules/branches/{branch}');
    expect(routes).not.toContain('GET /repos/{owner}/{repo}/compare/{basehead}');
  });
});
