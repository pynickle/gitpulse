import type { Octokit } from '@octokit/core';
import * as z from 'zod';

import { getPartialGraphQLData } from '#server/utils/github-graphql-utils';
import {
  PR_CHECK_ROLLUP_NODE_FIELDS,
  mapPullRequestCheckRollup,
} from '#server/utils/pr-check-rollup-graphql-utils';
import { parseZodRequestBody } from '#server/utils/zod-validation-utils';
import type { CheckStatusTone } from '#shared/types/pr-checks';
import type {
  PRAutoMergeState,
  PRMergeBlocker,
  PRMergeMethod,
  PRMergeQueueState,
  PRMergeStatus,
  PRMergedBy,
  PRReviewDecision,
  PRReviewRequirements,
  PRReviewSummary,
  PRState,
} from '#shared/types/pr-merge';
import { toPullRequestChecksView } from '#shared/utils/pr-checks';

import {
  fetchPullHeadBranchState,
  type GitHubPullRequestForHeadBranch,
} from './pr-head-branch-utils';
import type { RepositoryMergeSettings } from './pr-merge-settings-utils';
import { mapRepositoryMergeSettings, resolveAllowedMergeMethods } from './pr-merge-settings-utils';

type GitHubClient = Octokit;

interface RepositoryPermissions {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
}

interface GraphQLBranchProtectionRule {
  requiredApprovingReviewCount?: number | null;
  requiresCodeOwnerReviews?: boolean | null;
  requireLastPushApproval?: boolean | null;
  requiresConversationResolution?: boolean | null;
  requiresCommitSignatures?: boolean | null;
  requiresLinearHistory?: boolean | null;
  requiresStrictStatusChecks?: boolean | null;
  requiresStatusChecks?: boolean | null;
}

interface GraphQLOpinionatedReviewNode {
  state?: string | null;
  authorAssociation?: string | null;
  author?: { login?: string | null } | null;
}

interface GraphQLReviewThreadNode {
  isResolved?: boolean | null;
  isOutdated?: boolean | null;
}

interface GraphQLPullCommitNode {
  commit?: {
    parents?: { totalCount?: number | null } | null;
    signature?: { isValid?: boolean | null } | null;
  } | null;
}

interface GraphQLPullRequestMergeStatusNode {
  id?: string | null;
  number?: number | null;
  state?: string | null;
  merged?: boolean | null;
  mergedAt?: string | null;
  mergedBy?: {
    login?: string | null;
    avatarUrl?: string | null;
    url?: string | null;
  } | null;
  mergeCommit?: { oid?: string | null } | null;
  mergeStateStatus?: string | null;
  mergeable?: string | null;
  isDraft?: boolean | null;
  locked?: boolean | null;
  viewerCanUpdateBranch?: boolean | null;
  viewerCanEditFiles?: boolean | null;
  maintainerCanModify?: boolean | null;
  reviewDecision?: string | null;
  baseRefName?: string | null;
  baseRefOid?: string | null;
  headRefName?: string | null;
  headRefOid?: string | null;
  headRepository?: {
    name?: string | null;
    owner?: { login?: string | null } | null;
    viewerPermission?: string | null;
  } | null;
  headRepositoryOwner?: { login?: string | null } | null;
  baseRef?: {
    target?: { oid?: string | null } | null;
    branchProtectionRule?: GraphQLBranchProtectionRule | null;
  } | null;
  reviewRequests?: { totalCount?: number | null } | null;
  latestOpinionatedReviews?: { nodes?: (GraphQLOpinionatedReviewNode | null)[] | null } | null;
  reviewThreads?: {
    totalCount?: number | null;
    nodes?: (GraphQLReviewThreadNode | null)[] | null;
  } | null;
  commits?: {
    totalCount?: number | null;
    nodes?: (GraphQLPullCommitNode | null)[] | null;
  } | null;
  autoMergeRequest?: { mergeMethod?: string | null } | null;
  isInMergeQueue?: boolean | null;
  isMergeQueueEnabled?: boolean | null;
  mergeQueueEntry?: { state?: string | null; position?: number | null } | null;
  statusCheckRollup?: Parameters<typeof mapPullRequestCheckRollup>[0];
}

interface GraphQLPullRequestMergeStatusResponse {
  repository?: {
    pullRequest?: GraphQLPullRequestMergeStatusNode | null;
  } | null;
}

interface GitHubBranchRule {
  type?: string | null;
  parameters?: {
    required_approving_review_count?: number | null;
    require_code_owner_review?: boolean | null;
    require_last_push_approval?: boolean | null;
    required_review_thread_resolution?: boolean | null;
    allowed_merge_methods?: unknown;
    strict_required_status_checks_policy?: boolean | null;
  } | null;
}

interface BaseCompareResult {
  behindBy: number | null;
  baseSha: string | null;
}

export type PRBranchUpdateMethod = 'merge' | 'rebase';

export interface NormalizedUpdatePullRequestBranchBody {
  method: PRBranchUpdateMethod;
  expectedHeadOid: string;
}

export interface NormalizedMergePullRequestBody {
  method: PRMergeMethod;
  commitTitle?: string;
  commitMessage?: string;
}

const VALID_MERGE_METHODS: ReadonlySet<string> = new Set(['merge', 'squash', 'rebase']);
const WRITE_ASSOCIATIONS: ReadonlySet<string> = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

const mergeMethodSchema = z.enum(['merge', 'squash', 'rebase']);
const branchUpdateMethodSchema = z.enum(['merge', 'rebase']);
const optionalTrimmedStringSchema = z.string().trim().min(1).optional();
const mergePullRequestBodySchema = z.strictObject({
  method: mergeMethodSchema,
  commitTitle: optionalTrimmedStringSchema,
  commitMessage: optionalTrimmedStringSchema,
});
const updatePullRequestBranchBodySchema = z.strictObject({
  method: branchUpdateMethodSchema.optional(),
  expectedHeadOid: z.string().trim().min(1),
});

const PULL_REQUEST_MERGE_STATUS_QUERY = `query PullRequestMergeStatus($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      id
      number
      state
      merged
      mergedAt
      mergedBy {
        login
        avatarUrl
        url
      }
      mergeCommit {
        oid
      }
      mergeStateStatus
      mergeable
      isDraft
      locked
      viewerCanUpdateBranch
      viewerCanEditFiles
      maintainerCanModify
      reviewDecision
      baseRefName
      baseRefOid
      headRefName
      headRefOid
      headRepository {
        name
        owner {
          login
        }
        viewerPermission
      }
      headRepositoryOwner {
        login
      }
      baseRef {
        target {
          oid
        }
        branchProtectionRule {
          requiredApprovingReviewCount
          requiresCodeOwnerReviews
          requireLastPushApproval
          requiresConversationResolution
          requiresCommitSignatures
          requiresLinearHistory
          requiresStrictStatusChecks
          requiresStatusChecks
        }
      }
      reviewRequests(first: 20) {
        totalCount
      }
      latestOpinionatedReviews(first: 100) {
        nodes {
          state
          authorAssociation
          author {
            login
          }
        }
      }
      reviewThreads(first: 100) {
        totalCount
        nodes {
          isResolved
          isOutdated
        }
      }
      commits(last: 100) {
        totalCount
        nodes {
          commit {
            parents {
              totalCount
            }
            signature {
              isValid
            }
          }
        }
      }
      autoMergeRequest {
        mergeMethod
      }
      isInMergeQueue
      isMergeQueueEnabled
      mergeQueueEntry {
        state
        position
      }
      ${PR_CHECK_ROLLUP_NODE_FIELDS}
    }
  }
}`;

const UPDATE_PULL_REQUEST_BRANCH_MUTATION = `mutation UpdatePullRequestBranch($input: UpdatePullRequestBranchInput!) {
  updatePullRequestBranch(input: $input) {
    pullRequest {
      number
    }
  }
}`;

const trimString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function mapMergedBy(
  user: GraphQLPullRequestMergeStatusNode['mergedBy'] | undefined
): PRMergedBy | null {
  const login = trimString(user?.login);
  if (!login) return null;

  return {
    login,
    avatarUrl: user?.avatarUrl ?? '',
    htmlUrl: user?.url ?? '',
  };
}

function normalizePullState(pr: GraphQLPullRequestMergeStatusNode): PRState {
  if (pr.merged) return 'merged';
  return trimString(pr.state).toUpperCase() === 'CLOSED' ? 'closed' : 'open';
}

function normalizeMergeable(value: unknown): boolean | null {
  const normalized = trimString(value).toUpperCase();
  if (normalized === 'MERGEABLE') return true;
  if (normalized === 'CONFLICTING') return false;
  return null;
}

function normalizeMergeMethod(value: unknown): PRMergeMethod | null {
  const normalized = trimString(value).toLowerCase();
  return VALID_MERGE_METHODS.has(normalized) ? (normalized as PRMergeMethod) : null;
}

/** Write, maintain, or admin on a repository. GitHub REST reports write as `push`. */
function hasRepositoryWriteAccess(permissions?: RepositoryPermissions | null) {
  return Boolean(permissions?.admin || permissions?.maintain || permissions?.push);
}

function hasGraphQLWritePermission(permission?: string | null) {
  const normalized = trimString(permission).toUpperCase();
  return normalized === 'ADMIN' || normalized === 'MAINTAIN' || normalized === 'WRITE';
}

/**
 * Compares `baseRef...headOid`, returning both `behind_by` and Compare's live
 * `base_commit.sha` so the displayed SHA always matches the behind count.
 */
async function fetchBaseCompare(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  baseRef: string,
  headOid: string
): Promise<BaseCompareResult> {
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}', {
      owner,
      repo,
      basehead: `${baseRef}...${headOid}`,
      per_page: 1,
    });
    const payload = data as { behind_by?: unknown; base_commit?: { sha?: unknown } | null };
    return {
      behindBy: typeof payload.behind_by === 'number' ? payload.behind_by : null,
      baseSha: trimString(payload.base_commit?.sha) || null,
    };
  } catch (error) {
    console.warn('Failed to compare pull request head with its base ref:', error);
    return { behindBy: null, baseSha: null };
  }
}

/**
 * Counts commits on `baseRef` that are absent from `headOid`.
 * Compare's `behind_by` is that count when the base ref is the left side.
 */
export async function fetchBaseBehindCount(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  baseRef: string,
  headOid: string
) {
  const result = await fetchBaseCompare(octokit, owner, repo, baseRef, headOid);
  return result.behindBy;
}

async function fetchBranchRules(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubBranchRule[]> {
  if (!branch) return [];
  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/rules/branches/{branch}', {
      owner,
      repo,
      branch,
    });
    return Array.isArray(data) ? (data as GitHubBranchRule[]) : [];
  } catch {
    // 403/404 or unsupported plans degrade silently to GraphQL branchProtectionRule.
    return [];
  }
}

function graphQLMessages(error: unknown) {
  if (!error || typeof error !== 'object') return [];

  const messages: string[] = [];
  if ('message' in error && typeof error.message === 'string' && error.message) {
    messages.push(error.message);
  }
  if ('errors' in error && Array.isArray(error.errors)) {
    for (const entry of error.errors) {
      if (
        entry &&
        typeof entry === 'object' &&
        'message' in entry &&
        typeof entry.message === 'string' &&
        entry.message
      ) {
        messages.push(entry.message);
      }
    }
  }
  return messages;
}

function isHeadOidMismatchMessage(message: string) {
  const normalized = message.replace(/[’‘]/g, "'").toLowerCase();
  return (
    normalized.includes('expected head') &&
    (normalized.includes('did not match') ||
      normalized.includes("didn't match") ||
      normalized.includes('does not match'))
  );
}

interface RepositoryAccess {
  permissions: RepositoryPermissions | null;
  mergeSettings: RepositoryMergeSettings | null;
}

async function fetchRepositoryAccess(
  octokit: GitHubClient,
  owner: string,
  repo: string
): Promise<RepositoryAccess> {
  try {
    const { data: repository } = await octokit.request('GET /repos/{owner}/{repo}', {
      owner,
      repo,
    });
    return {
      permissions: repository.permissions ?? null,
      mergeSettings: mapRepositoryMergeSettings(repository),
    };
  } catch (error) {
    console.error('Failed to fetch repository access for merge status', error);
    return { permissions: null, mergeSettings: null };
  }
}

interface ParsedBranchPolicy {
  requiredApprovingReviewCount: number;
  requireCodeOwnerReview: boolean;
  requireLastPushApproval: boolean;
  requiredReviewThreadResolution: boolean;
  requiredSignatures: boolean;
  requiresLinearHistory: boolean;
  requiresStrictStatusChecks: boolean;
  hasRequiredStatusChecks: boolean;
  allowedMergeMethods: PRMergeMethod[] | null;
}

function parseBranchPolicy(
  rules: GitHubBranchRule[],
  protection: GraphQLBranchProtectionRule | null | undefined
): ParsedBranchPolicy {
  let requiredApprovingReviewCount =
    typeof protection?.requiredApprovingReviewCount === 'number' &&
    protection.requiredApprovingReviewCount > 0
      ? Math.trunc(protection.requiredApprovingReviewCount)
      : 0;
  let requireCodeOwnerReview = Boolean(protection?.requiresCodeOwnerReviews);
  let requireLastPushApproval = Boolean(protection?.requireLastPushApproval);
  let requiredReviewThreadResolution = Boolean(protection?.requiresConversationResolution);
  let requiredSignatures = Boolean(protection?.requiresCommitSignatures);
  let requiresLinearHistory = Boolean(protection?.requiresLinearHistory);
  let requiresStrictStatusChecks = Boolean(protection?.requiresStrictStatusChecks);
  let hasRequiredStatusChecks = Boolean(protection?.requiresStatusChecks);
  let allowedMergeMethods: PRMergeMethod[] | null = null;

  for (const rule of rules) {
    const type = trimString(rule?.type);
    const params = rule?.parameters;

    if (type === 'pull_request' && params) {
      if (
        typeof params.required_approving_review_count === 'number' &&
        params.required_approving_review_count > requiredApprovingReviewCount
      ) {
        requiredApprovingReviewCount = Math.trunc(params.required_approving_review_count);
      }
      if (params.require_code_owner_review) requireCodeOwnerReview = true;
      if (params.require_last_push_approval) requireLastPushApproval = true;
      if (params.required_review_thread_resolution) requiredReviewThreadResolution = true;

      if (Array.isArray(params.allowed_merge_methods)) {
        const parsed = params.allowed_merge_methods
          .map((item) => normalizeMergeMethod(item))
          .filter((item): item is PRMergeMethod => item !== null);
        if (parsed.length > 0) {
          if (allowedMergeMethods === null) {
            allowedMergeMethods = parsed;
          } else {
            const nextSet = new Set(parsed);
            allowedMergeMethods = allowedMergeMethods.filter((method) => nextSet.has(method));
          }
        }
      }
    } else if (type === 'required_signatures') {
      requiredSignatures = true;
    } else if (type === 'required_linear_history') {
      requiresLinearHistory = true;
    } else if (type === 'required_status_checks') {
      hasRequiredStatusChecks = true;
      if (params?.strict_required_status_checks_policy) {
        requiresStrictStatusChecks = true;
      }
    }
  }

  return {
    requiredApprovingReviewCount,
    requireCodeOwnerReview,
    requireLastPushApproval,
    requiredReviewThreadResolution,
    requiredSignatures,
    requiresLinearHistory,
    requiresStrictStatusChecks,
    hasRequiredStatusChecks,
    allowedMergeMethods,
  };
}

function computeAuthoritativeReview(params: {
  graphQLReviewDecision: string | null | undefined;
  opinionatedReviews: (GraphQLOpinionatedReviewNode | null)[];
  requestedReviewerCount: number;
  policy: ParsedBranchPolicy;
}): {
  decision: PRReviewDecision;
  summary: PRReviewSummary;
  requirements: PRReviewRequirements;
} {
  let approved = 0;
  let changesRequested = 0;
  let qualifyingApprovalCount = 0;

  for (const review of params.opinionatedReviews) {
    if (!review) continue;
    const state = trimString(review.state).toUpperCase();
    if (state === 'APPROVED') {
      approved += 1;
      const assoc = trimString(review.authorAssociation).toUpperCase();
      if (WRITE_ASSOCIATIONS.has(assoc)) {
        qualifyingApprovalCount += 1;
      }
    } else if (state === 'CHANGES_REQUESTED') {
      changesRequested += 1;
    }
  }

  const summary: PRReviewSummary = { approved, changesRequested };
  const requirements: PRReviewRequirements = {
    requiredApprovingReviewCount: params.policy.requiredApprovingReviewCount,
    qualifyingApprovalCount,
    requireCodeOwnerReview: params.policy.requireCodeOwnerReview,
    requireLastPushApproval: params.policy.requireLastPushApproval,
    requiredReviewThreadResolution: params.policy.requiredReviewThreadResolution,
  };

  const graphQLDecision = trimString(params.graphQLReviewDecision).toUpperCase();
  if (graphQLDecision === 'CHANGES_REQUESTED' || changesRequested > 0) {
    return { decision: 'changes_requested', summary, requirements };
  }
  if (graphQLDecision === 'APPROVED') {
    return { decision: 'approved', summary, requirements };
  }
  if (graphQLDecision === 'REVIEW_REQUIRED') {
    return { decision: 'review_required', summary, requirements };
  }

  // GraphQL `reviewDecision` can be null on fork PRs even when a branch ruleset requires approvals.
  if (params.policy.requiredApprovingReviewCount > 0) {
    const satisfied = qualifyingApprovalCount >= params.policy.requiredApprovingReviewCount;
    return {
      decision: satisfied ? 'approved' : 'review_required',
      summary,
      requirements,
    };
  }
  if (params.policy.requireCodeOwnerReview) {
    return {
      decision: approved > 0 ? 'approved' : 'review_required',
      summary,
      requirements,
    };
  }
  if (approved > 0) {
    return { decision: 'approved', summary, requirements };
  }
  if (params.requestedReviewerCount > 0) {
    return { decision: 'review_required', summary, requirements };
  }

  return { decision: 'none', summary, requirements };
}

function computeMergeBlockers(params: {
  state: PRState;
  draft: boolean;
  locked: boolean;
  mergeable: boolean | null;
  mergeableState: string | null;
  behindBy: number | null;
  reviewDecision: PRReviewDecision;
  checksTone: CheckStatusTone | null;
  unresolvedReviewThreadCount: number;
  unsignedCommitCount: number;
  hasMergeCommit: boolean;
  policy: ParsedBranchPolicy;
}): PRMergeBlocker[] {
  if (params.state !== 'open') return [];

  const blockers: PRMergeBlocker[] = [];
  if (params.draft) {
    blockers.push({ code: 'draft' });
  }
  if (params.mergeable === false || params.mergeableState === 'dirty') {
    blockers.push({ code: 'conflicts' });
  }
  if (params.locked) {
    blockers.push({ code: 'locked' });
  }
  if (params.policy.requiredReviewThreadResolution && params.unresolvedReviewThreadCount > 0) {
    blockers.push({
      code: 'unresolved_conversations',
      count: params.unresolvedReviewThreadCount,
    });
  }
  if (params.policy.requiredSignatures && params.unsignedCommitCount > 0) {
    blockers.push({
      code: 'unsigned_commits',
      count: params.unsignedCommitCount,
    });
  }
  if (
    params.mergeableState === 'behind' ||
    (params.policy.requiresStrictStatusChecks && params.behindBy !== null && params.behindBy > 0)
  ) {
    blockers.push({ code: 'strict_branch_currency' });
  }

  const reviewIsBlocking =
    params.reviewDecision === 'review_required' || params.reviewDecision === 'changes_requested';
  const checksAreBlocking = params.checksTone === 'danger' || params.checksTone === 'warning';

  if (
    params.policy.requiresLinearHistory &&
    (params.hasMergeCommit ||
      (params.mergeableState === 'blocked' &&
        blockers.length === 0 &&
        !reviewIsBlocking &&
        !checksAreBlocking))
  ) {
    blockers.push({ code: 'linear_history_required' });
  }

  if (
    params.mergeableState === 'blocked' &&
    params.policy.hasRequiredStatusChecks &&
    blockers.length === 0 &&
    !reviewIsBlocking &&
    !checksAreBlocking
  ) {
    blockers.push({ code: 'required_status_checks' });
  }

  if (
    params.mergeableState === 'blocked' &&
    blockers.length === 0 &&
    !reviewIsBlocking &&
    !checksAreBlocking
  ) {
    blockers.push({ code: 'ruleset_or_protection_blocked' });
  }

  return blockers;
}

function buildHeadBranchPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  pr: GraphQLPullRequestMergeStatusNode
): GitHubPullRequestForHeadBranch {
  const headOwner =
    trimString(pr.headRepository?.owner?.login) || trimString(pr.headRepositoryOwner?.login);
  const headRepoName = trimString(pr.headRepository?.name);
  const headRef = trimString(pr.headRefName);
  const headLabel = headOwner && headRef ? `${headOwner}:${headRef}` : headRef || null;

  return {
    number: pullNumber,
    state: trimString(pr.state).toLowerCase() || 'closed',
    merged: Boolean(pr.merged),
    merged_at: pr.mergedAt ?? null,
    head: {
      ref: headRef || null,
      sha: trimString(pr.headRefOid) || null,
      label: headLabel,
      repo:
        headOwner && headRepoName
          ? {
              name: headRepoName,
              full_name: `${headOwner}/${headRepoName}`,
              owner: { login: headOwner },
            }
          : null,
    },
    base: {
      repo: {
        name: repo,
        full_name: `${owner}/${repo}`,
        owner: { login: owner },
      },
    },
  };
}

export function normalizeMergePullRequestBody(body: unknown): NormalizedMergePullRequestBody {
  const requestBody = parseZodRequestBody(
    mergePullRequestBodySchema,
    body,
    'Invalid pull request merge request body'
  );

  const normalizedBody: NormalizedMergePullRequestBody = {
    method: requestBody.method,
  };

  if (requestBody.commitTitle) {
    normalizedBody.commitTitle = requestBody.commitTitle;
  }

  if (requestBody.commitMessage) {
    normalizedBody.commitMessage = requestBody.commitMessage;
  }

  return normalizedBody;
}

export function normalizeUpdatePullRequestBranchBody(
  body: unknown
): NormalizedUpdatePullRequestBranchBody {
  const requestBody = parseZodRequestBody(
    updatePullRequestBranchBodySchema,
    body,
    'Invalid pull request branch update'
  );

  return {
    method: requestBody.method ?? 'merge',
    expectedHeadOid: requestBody.expectedHeadOid,
  };
}

function headOidMismatchFrom(error: unknown) {
  const messages = graphQLMessages(error);
  const message = messages.find((entry) => isHeadOidMismatchMessage(entry));
  if (!message) return null;

  return createError({
    statusCode: 409,
    statusMessage: message,
    data: { code: 'head_oid_mismatch' },
  });
}

export async function updatePullRequestBranch(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  body: NormalizedUpdatePullRequestBranchBody
) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
  });
  const pullRequestId = trimString((data as { node_id?: string | null }).node_id);
  if (!pullRequestId) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Pull request is missing a node id',
    });
  }

  try {
    await octokit.graphql(UPDATE_PULL_REQUEST_BRANCH_MUTATION, {
      input: {
        pullRequestId,
        expectedHeadOid: body.expectedHeadOid,
        updateMethod: body.method === 'rebase' ? 'REBASE' : 'MERGE',
      },
    });
  } catch (error) {
    const mismatch = headOidMismatchFrom(error);
    if (mismatch) throw mismatch;
    throw error;
  }

  return { updated: true };
}

async function fetchGraphQLPullRequestMergeStatus(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<GraphQLPullRequestMergeStatusNode | null> {
  try {
    const payload = await octokit.graphql<GraphQLPullRequestMergeStatusResponse>(
      PULL_REQUEST_MERGE_STATUS_QUERY,
      { owner, repo, number: pullNumber }
    );
    return payload.repository?.pullRequest ?? null;
  } catch (error: unknown) {
    const partial = getPartialGraphQLData<GraphQLPullRequestMergeStatusResponse>(error);
    if (partial?.repository?.pullRequest) {
      return partial.repository.pullRequest;
    }
    throw error;
  }
}

export async function fetchPRMergeStatus(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PRMergeStatus> {
  const [pr, repositoryAccess] = await Promise.all([
    fetchGraphQLPullRequestMergeStatus(octokit, owner, repo, pullNumber),
    fetchRepositoryAccess(octokit, owner, repo),
  ]);

  if (!pr) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pull request not found',
    });
  }

  const state = normalizePullState(pr);
  const headSha = trimString(pr.headRefOid) || null;
  const baseRef = trimString(pr.baseRefName);
  const fallbackBaseSha = trimString(pr.baseRef?.target?.oid) || trimString(pr.baseRefOid) || null;
  const headOwner =
    trimString(pr.headRepository?.owner?.login) || trimString(pr.headRepositoryOwner?.login);
  const headRepoName = trimString(pr.headRepository?.name);
  const headMatchesBase =
    headOwner.toLowerCase() === owner.toLowerCase() &&
    headRepoName.toLowerCase() === repo.toLowerCase();

  let branchRules: GitHubBranchRule[] = [];
  let compareResult: BaseCompareResult = { behindBy: null, baseSha: null };
  let headBranch = null;

  if (state === 'open') {
    const [rules, compare] = await Promise.all([
      fetchBranchRules(octokit, owner, repo, baseRef),
      baseRef && headSha
        ? fetchBaseCompare(octokit, owner, repo, baseRef, headSha)
        : Promise.resolve<BaseCompareResult>({ behindBy: null, baseSha: null }),
    ]);
    branchRules = rules;
    compareResult = compare;
  } else {
    headBranch = await fetchPullHeadBranchState(
      octokit,
      buildHeadBranchPullRequest(owner, repo, pullNumber, pr)
    ).catch((error: unknown) => {
      console.warn('Failed to fetch pull request head branch action state:', error);
      return null;
    });
  }

  const policy = parseBranchPolicy(branchRules, pr.baseRef?.branchProtectionRule);
  const review = computeAuthoritativeReview({
    graphQLReviewDecision: pr.reviewDecision,
    opinionatedReviews: pr.latestOpinionatedReviews?.nodes ?? [],
    requestedReviewerCount: pr.reviewRequests?.totalCount ?? 0,
    policy,
  });

  const checkRollup = mapPullRequestCheckRollup(pr.statusCheckRollup);
  const checksView = toPullRequestChecksView(checkRollup);

  const reviewThreads = pr.reviewThreads?.nodes ?? [];
  const unresolvedReviewThreadCount = reviewThreads.filter(
    (thread) => thread && thread.isResolved === false
  ).length;

  const commitNodes = (pr.commits?.nodes ?? []).filter((node): node is GraphQLPullCommitNode =>
    Boolean(node?.commit)
  );
  const unsignedCommitCount = commitNodes.filter(
    (node) => node.commit?.signature?.isValid !== true
  ).length;
  const hasMergeCommit = commitNodes.some((node) => (node.commit?.parents?.totalCount ?? 0) > 1);

  const mergeableState = trimString(pr.mergeStateStatus).toLowerCase() || null;
  const mergeable = normalizeMergeable(pr.mergeable);
  const draft = Boolean(pr.isDraft);
  const viewerCanMerge = hasRepositoryWriteAccess(repositoryAccess.permissions);
  const headRepoWritable =
    hasGraphQLWritePermission(pr.headRepository?.viewerPermission) ||
    (headMatchesBase && hasRepositoryWriteAccess(repositoryAccess.permissions));
  const viewerCanWriteHead =
    Boolean(pr.viewerCanUpdateBranch) ||
    headRepoWritable ||
    Boolean(pr.viewerCanEditFiles) ||
    (Boolean(pr.maintainerCanModify) && viewerCanMerge);

  const mergeBlockers = computeMergeBlockers({
    state,
    draft,
    locked: Boolean(pr.locked),
    mergeable,
    mergeableState,
    behindBy: compareResult.behindBy,
    reviewDecision: review.decision,
    checksTone: checksView.isVisible ? checksView.tone : null,
    unresolvedReviewThreadCount,
    unsignedCommitCount,
    hasMergeCommit,
    policy,
  });

  const autoMergeState: PRAutoMergeState | null = pr.autoMergeRequest
    ? {
        enabled: true,
        mergeMethod: normalizeMergeMethod(pr.autoMergeRequest.mergeMethod),
      }
    : null;

  const inMergeQueue = Boolean(pr.isInMergeQueue || pr.mergeQueueEntry);
  const mergeQueue: PRMergeQueueState | null =
    inMergeQueue || pr.isMergeQueueEnabled
      ? {
          inMergeQueue,
          state: trimString(pr.mergeQueueEntry?.state) || null,
          position:
            typeof pr.mergeQueueEntry?.position === 'number' ? pr.mergeQueueEntry.position : null,
          enabled: Boolean(pr.isMergeQueueEnabled),
        }
      : null;

  return {
    state,
    merged: Boolean(pr.merged),
    mergedAt: pr.mergedAt ?? null,
    mergedBy: mapMergedBy(pr.mergedBy),
    mergeCommitSha: trimString(pr.mergeCommit?.oid) || null,
    mergeableState,
    mergeable,
    autoMerge: Boolean(autoMergeState?.enabled),
    autoMergeState,
    mergeQueue,
    draft,
    reviewDecision: review.decision,
    reviewSummary: review.summary,
    reviewRequirements: review.requirements,
    mergeBlockers,
    checkRollup,
    headSha,
    headBranch,
    viewerCanMerge,
    behindBy: compareResult.behindBy,
    baseRef,
    baseSha: compareResult.baseSha ?? fallbackBaseSha,
    viewerCanWriteHead,
    allowedMergeMethods: resolveAllowedMergeMethods(
      repositoryAccess.mergeSettings,
      policy.allowedMergeMethods
    ),
  };
}
