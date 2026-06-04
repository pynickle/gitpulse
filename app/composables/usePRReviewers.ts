export type PRReviewerKind = 'user' | 'team';

export type PRReviewerStatus =
  | 'requested'
  | 'approved'
  | 'changes_requested'
  | 'commented'
  | 'dismissed'
  | 'pending'
  | 'unknown';

export interface PRReviewerSummaryItem {
  key: string;
  kind: PRReviewerKind;
  id?: string;
  nodeId?: string;
  login?: string;
  slug?: string;
  name: string;
  avatarUrl?: string | null;
  url?: string | null;
  status: PRReviewerStatus;
  rawState?: string;
  latestSubmittedAt?: string | null;
  latestCommentedAt?: string | null;
  latestReviewUrl?: string | null;
  reviewCount: number;
  commentCount: number;
  requested: boolean;
  removable: boolean;
}

export interface PRReviewerRequestedUser {
  id?: number | string;
  node_id?: string;
  login?: string;
  avatar_url?: string | null;
  html_url?: string | null;
  url?: string | null;
}

export interface PRReviewerRequestedTeam {
  id?: number | string;
  node_id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  html_url?: string | null;
  url?: string | null;
}

export interface PRReviewersSummary {
  items: PRReviewerSummaryItem[];
  requestedUsers: PRReviewerRequestedUser[];
  requestedTeams: PRReviewerRequestedTeam[];
  counts: Record<PRReviewerStatus, number> & {
    total: number;
    users: number;
    teams: number;
  };
  warnings?: PRReviewerSummaryWarning[];
}

export interface PRReviewerCandidate {
  key: string;
  kind: PRReviewerKind;
  id?: string;
  nodeId?: string;
  login?: string;
  slug?: string;
  name: string;
  avatarUrl?: string | null;
  url?: string | null;
  requested: boolean;
}

export interface PRReviewerCandidatesResponse {
  query: string;
  items: PRReviewerCandidate[];
  users: PRReviewerCandidate[];
  teams: PRReviewerCandidate[];
  warnings: PRReviewerCandidateWarning[];
  canRequestReviewers: boolean;
}

export interface PRReviewerSummaryWarning {
  source: 'reviewer-summary';
  message: string;
}

export interface PRReviewerCandidateWarning {
  source: 'requested-reviewers' | 'collaborators' | 'teams';
  message: string;
}

export interface PRReviewerMutationPayload {
  reviewers?: string[];
  teamReviewers?: string[];
}

export interface PRReviewerMutationResponse {
  pullRequest?: Record<string, unknown>;
  reviewers?: PRReviewersSummary;
}

export const createEmptyPRReviewersSummary = (
  warnings: PRReviewerSummaryWarning[] = []
): PRReviewersSummary => ({
  items: [],
  requestedUsers: [],
  requestedTeams: [],
  counts: {
    requested: 0,
    approved: 0,
    changes_requested: 0,
    commented: 0,
    dismissed: 0,
    pending: 0,
    unknown: 0,
    total: 0,
    users: 0,
    teams: 0,
  },
  warnings,
});

export function usePRReviewers() {
  const apiFetch = useGitPulseApiFetch();

  const fetchReviewerSummary = (owner: string, repo: string, pullNumber: number) =>
    apiFetch<PRReviewersSummary>(`/api/pulls/${owner}/${repo}/${pullNumber}/reviewers`, {
      method: 'GET',
    });

  const fetchReviewerCandidates = (owner: string, repo: string, pullNumber: number, query = '') =>
    apiFetch<PRReviewerCandidatesResponse>(
      `/api/pulls/${owner}/${repo}/${pullNumber}/reviewers/candidates`,
      {
        method: 'GET',
        query: query ? { q: query } : undefined,
      }
    );

  const requestReviewers = (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRReviewerMutationPayload
  ) =>
    apiFetch<PRReviewerMutationResponse>(
      `/api/repos/${owner}/${repo}/pulls/${pullNumber}/reviewers`,
      {
        method: 'POST',
        body: payload,
      }
    );

  const removeReviewers = (
    owner: string,
    repo: string,
    pullNumber: number,
    payload: PRReviewerMutationPayload
  ) =>
    apiFetch<PRReviewerMutationResponse>(
      `/api/repos/${owner}/${repo}/pulls/${pullNumber}/reviewers`,
      {
        method: 'DELETE',
        body: payload,
      }
    );

  return {
    fetchReviewerSummary,
    fetchReviewerCandidates,
    requestReviewers,
    removeReviewers,
  };
}
