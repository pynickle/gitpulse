import type { CopilotReviewEffort } from '#shared/utils/copilot-review';

export type PullRequestReviewerKind = 'user' | 'team';

export type PullRequestReviewerStatus =
  | 'requested'
  | 'approved'
  | 'changes_requested'
  | 'commented'
  | 'dismissed'
  | 'pending'
  | 'unknown';

export interface PullRequestReviewerSummaryItem {
  key: string;
  kind: PullRequestReviewerKind;
  id?: string;
  nodeId?: string;
  login?: string;
  slug?: string;
  name: string;
  avatarUrl?: string | null;
  url?: string | null;
  status: PullRequestReviewerStatus;
  rawState?: string;
  latestSubmittedAt?: string | null;
  latestCommentedAt?: string | null;
  latestReviewUrl?: string | null;
  reviewCount: number;
  commentCount: number;
  requested: boolean;
  removable: boolean;
  copilotReviewEffort?: CopilotReviewEffort;
}

export interface PullRequestReviewerRequestedUser {
  id?: number | string;
  node_id?: string;
  login?: string;
  avatar_url?: string | null;
  html_url?: string | null;
  url?: string | null;
}

export interface PullRequestReviewerRequestedTeam {
  id?: number | string;
  node_id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  html_url?: string | null;
  url?: string | null;
}

export interface PullRequestReviewerSummaryWarning {
  source: 'reviewer-summary';
  message: string;
}

export interface PullRequestReviewersSummary {
  canRequestCopilot?: boolean;
  items: PullRequestReviewerSummaryItem[];
  requestedUsers: PullRequestReviewerRequestedUser[];
  requestedTeams: PullRequestReviewerRequestedTeam[];
  counts: Record<PullRequestReviewerStatus, number> & {
    total: number;
    users: number;
    teams: number;
  };
  warnings?: PullRequestReviewerSummaryWarning[];
}

export interface PullRequestReviewerCandidate {
  key: string;
  kind: PullRequestReviewerKind;
  id?: string;
  nodeId?: string;
  login?: string;
  slug?: string;
  name: string;
  avatarUrl?: string | null;
  url?: string | null;
  requested: boolean;
}

export interface PullRequestReviewerCandidateWarning {
  source: 'requested-reviewers' | 'collaborators' | 'teams' | 'copilot';
  message: string;
}

export interface PullRequestReviewerCandidatesResponse {
  query: string;
  items: PullRequestReviewerCandidate[];
  users: PullRequestReviewerCandidate[];
  teams: PullRequestReviewerCandidate[];
  warnings: PullRequestReviewerCandidateWarning[];
  canRequestReviewers: boolean;
  canRequestCopilot?: boolean;
  copilotReviewEfforts?: CopilotReviewEffort[];
}

export interface PullRequestReviewerMutationPayload {
  reviewers?: string[];
  teamReviewers?: string[];
  copilotReviewEffort?: CopilotReviewEffort;
}

export interface PullRequestReviewerMutationResponse {
  pullRequest?: Record<string, unknown>;
  reviewers?: PullRequestReviewersSummary;
}
