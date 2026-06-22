import type { PullRequestReviewersSummary } from './pr-reviewers';
import type { ReactionSummaryItem } from './reactions';

/**
 * Pull Request types from the GitPulse pull request detail API.
 */

export interface PullRequestUserSummary {
  id?: number | string;
  login: string;
  avatar_url?: string | null;
  html_url?: string | null;
  url?: string | null;
}

export interface PullRequestTeamSummary {
  id?: number | string;
  node_id?: string;
  slug?: string;
  name?: string | null;
  description?: string | null;
  html_url?: string | null;
  url?: string | null;
}

export interface PullRequestDetailLabel {
  id?: number | string;
  name: string;
  color: string;
  description?: string | null;
}

export interface PullRequestRepositorySummary {
  id?: number;
  name?: string;
  full_name?: string;
  url?: string;
  default_branch?: string | null;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  } | null;
  owner?: PullRequestUserSummary;
}

export interface PullRequestBranchSummary {
  ref?: string;
  sha?: string;
  label?: string;
  repo?: PullRequestRepositorySummary | null;
}

export type PullRequestHeadBranchUnavailableReason =
  | 'not_closed_or_merged'
  | 'missing_head'
  | 'missing_repository'
  | 'missing_permission'
  | 'default_branch'
  | 'protected_branch'
  | 'open_pull_request'
  | 'branch_exists'
  | 'branch_missing'
  | 'unknown';

export interface PullRequestHeadBranchState {
  ref: string | null;
  sha: string | null;
  label: string | null;
  repo: PullRequestRepositorySummary | null;
  exists: boolean | null;
  protected: boolean | null;
  default_branch: string | null;
  open_pull_requests_count: number | null;
  can_delete: boolean;
  can_restore: boolean;
  unavailable_reason: PullRequestHeadBranchUnavailableReason | null;
}

export interface PullRequestDetailPayload {
  id: number;
  number: number;
  state: string;
  title: string;
  body?: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  merged_at?: string | null;
  merged_by?: PullRequestUserSummary | null;
  merge_commit_sha?: string | null;
  repository_url?: string;
  html_url?: string;

  // Base and head branches
  base?: PullRequestBranchSummary;
  head?: PullRequestBranchSummary;
  head_branch?: PullRequestHeadBranchState | null;

  // User info
  user?: PullRequestUserSummary;
  assignee?: PullRequestUserSummary | null;

  // Labels
  labels?: PullRequestDetailLabel[];
  reactions?: ReactionSummaryItem[];

  // Reviewers
  requested_reviewers?: PullRequestUserSummary[];
  requested_teams?: PullRequestTeamSummary[];
  reviewers?: PullRequestReviewersSummary;

  // Merge status
  mergeable?: boolean | null;
  mergeable_state?: string;
  merged?: boolean;
  draft?: boolean;

  // Stats
  commits?: number;
  changed_files?: number;
  additions?: number;
  deletions?: number;
}

export type PullRequestDetailResponse = PullRequestDetailPayload;

export interface PullRequestDetailViewModel extends PullRequestDetailPayload {
  repository_url?: string;
}
