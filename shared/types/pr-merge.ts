import type { PullRequestCheckRollup } from './pr-checks';
import type { PullRequestHeadBranchState } from './pulls';

export type PRState = 'open' | 'closed' | 'merged';
export type PRReviewDecision = 'approved' | 'changes_requested' | 'review_required' | 'none';
export type PRMergeMethod = 'merge' | 'squash' | 'rebase';

export interface PRMergedBy {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface PRReviewSummary {
  approved: number;
  changesRequested: number;
}

export interface PRReviewRequirements {
  requiredApprovingReviewCount: number;
  qualifyingApprovalCount: number;
  requireCodeOwnerReview: boolean;
  requireLastPushApproval: boolean;
  requiredReviewThreadResolution: boolean;
}

export type PRMergeBlockerCode =
  | 'unresolved_conversations'
  | 'unsigned_commits'
  | 'linear_history_required'
  | 'strict_branch_currency'
  | 'conflicts'
  | 'draft'
  | 'locked'
  | 'required_status_checks'
  | 'ruleset_or_protection_blocked';

export interface PRMergeBlocker {
  code: PRMergeBlockerCode;
  count?: number;
}

export interface PRAutoMergeState {
  enabled: boolean;
  mergeMethod: PRMergeMethod | null;
}

export interface PRMergeQueueState {
  inMergeQueue: boolean;
  state: string | null;
  position: number | null;
  enabled: boolean;
}

export interface PRMergeStatus {
  state: PRState;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: PRMergedBy | null;
  mergeCommitSha: string | null;
  mergeableState: string | null;
  mergeable: boolean | null;
  autoMerge: boolean;
  autoMergeState?: PRAutoMergeState | null;
  mergeQueue?: PRMergeQueueState | null;
  draft: boolean;
  reviewDecision: PRReviewDecision;
  reviewSummary: PRReviewSummary;
  reviewRequirements?: PRReviewRequirements;
  mergeBlockers?: PRMergeBlocker[];
  /**
   * GitHub's own Check Rollup for the head commit. Null when GitHub reports
   * none or the rollup could not be read; every surface then hides its checks.
   */
  checkRollup: PullRequestCheckRollup | null;
  headSha: string | null;
  headBranch: PullRequestHeadBranchState | null;
  viewerCanMerge: boolean;
  /**
   * Commits on the base ref that are absent from the head.
   * Null when that comparison could not be read. Zero is current, including a head that is only ahead.
   */
  behindBy: number | null;
  /** The pull request's base ref, the ref currency is measured against. */
  baseRef: string;
  /** The pull request's base tip, not the merge base. Matches `behindBy` when compare succeeds. */
  baseSha: string | null;
  /** The viewer can update the PR branch (via viewerCanUpdateBranch, write access, edit files, or maintainerCanModify). */
  viewerCanWriteHead: boolean;
  /** The merge methods both the repository and target branch rulesets allow, in canonical order. */
  allowedMergeMethods?: PRMergeMethod[];
}
