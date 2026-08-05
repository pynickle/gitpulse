/**
 * Repository detail payload from the GitHub API.
 */

/** Minimal parent/source repo identity returned by GitHub for forks. */
export interface RepositoryParentSummary {
  id?: number | string;
  name?: string;
  full_name?: string;
  html_url?: string;
  owner?: {
    login?: string;
    id?: number | string;
    avatar_url?: string | null;
  };
}

export interface RepositoryDetailPayload {
  id: number | string;
  name: string;
  full_name?: string;
  description?: string | null;
  html_url?: string;
  default_branch?: string | null;
  language?: string | null;
  stargazers_count?: number;
  watchers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  private?: boolean;
  fork?: boolean;
  archived?: boolean;
  has_wiki?: boolean;
  homepage?: string | null;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
  owner?: {
    login?: string;
    id?: number | string;
    avatar_url?: string | null;
  };
  /** Immediate parent when this repository is a fork. */
  parent?: RepositoryParentSummary | null;
  /** Root repository of the fork network (when different from parent). */
  source?: RepositoryParentSummary | null;

  [key: string]: unknown;
}

/** Latest commit summary for the repository Files panel. */
export interface RepoLatestCommitAuthor {
  login: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/** One entry of the repository Commits panel list. */
export interface RepoCommitListItemPayload {
  sha: string;
  shortSha: string;
  message: string;
  committedAt: string | null;
  author: RepoLatestCommitAuthor;
  htmlUrl: string | null;
}

export interface RepoLatestCommitPayload extends RepoCommitListItemPayload {
  commitsUrl: string;
}

export type RepoLatestCommitResponse = RepoLatestCommitPayload | null;

/** GitHub's list-commits API exposes prev/next via Link header only — no totals. */
export interface RepoCommitListPaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

export interface RepoCommitListResponse {
  items: RepoCommitListItemPayload[];
  pagination: RepoCommitListPaginationMeta;
}

/**
 * Language → byte-count map from GitHub's repository languages endpoint.
 * Values are source-byte totals used to compute percentage shares in the UI.
 */
export type RepoLanguagesPayload = Record<string, number>;

/** One branch from `GET /repos/{owner}/{repo}/branches`. */
export interface RepoBranch {
  name: string;
  sha: string;
  protected: boolean;
}

/** Last-commit author on a branch tip (REST commit payload). */
export interface RepoBranchAuthor {
  login: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/** Compact last-commit summary attached to a branch list row. */
export interface RepoBranchLastCommit {
  sha: string;
  shortSha: string;
  message: string | null;
  committedAt: string | null;
  author: RepoBranchAuthor;
}

/**
 * Pull request whose head branch matches a listed branch.
 * `merged` is true when GitHub reports `merged_at` (closed + merged).
 */
export interface RepoBranchAssociatedPull {
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  htmlUrl: string | null;
}

/**
 * Enriched branch row for `/api/repos/{owner}/{repo}/branches/details`.
 * Ahead/behind are relative to the repository default branch (null when
 * compare is skipped or unavailable — e.g. the default branch itself).
 */
export interface RepoBranchDetail extends RepoBranch {
  isDefault: boolean;
  lastCommit: RepoBranchLastCommit | null;
  aheadBy: number | null;
  behindBy: number | null;
  associatedPulls: RepoBranchAssociatedPull[];
}

export interface RepoBranchesDetailResponse {
  defaultBranch: string;
  items: RepoBranchDetail[];
}

/**
 * One contributor from `GET /repos/{owner}/{repo}/contributors`.
 * Anonymous entries have no login/avatar when `anon=1` is requested.
 */
export interface RepoContributorSummary {
  login: string | null;
  id: number | string | null;
  avatarUrl: string | null;
  htmlUrl: string | null;
  /** Display name for anonymous contributors (GitHub `name` field). */
  name: string | null;
  contributions: number;
  type: string;
  anonymous: boolean;
}

/** GitHub's list-contributors API exposes prev/next via Link header only. */
export interface RepoContributorListPaginationMeta {
  page: number;
  perPage: number;
  hasPrev: boolean;
  hasNext: boolean;
  totalCount: number | null;
  totalPages: number | null;
}

export interface RepoContributorListResponse {
  items: RepoContributorSummary[];
  pagination: RepoContributorListPaginationMeta;
}

/** One week bucket from GitHub's contributor commit-activity stats. */
export interface RepoContributorWeek {
  /** Start of the week as a Unix timestamp (seconds). */
  week: number;
  additions: number;
  deletions: number;
  commits: number;
}

/**
 * One contributor with weekly commit activity from
 * `GET /repos/{owner}/{repo}/stats/contributors`.
 */
export interface RepoContributorStatsItem {
  login: string | null;
  id: number | string | null;
  avatarUrl: string | null;
  htmlUrl: string | null;
  total: number;
  weeks: RepoContributorWeek[];
}

/**
 * Stats endpoints are computed asynchronously. `computing` maps GitHub's 202;
 * `empty` maps 204 / empty body; `ready` is a finished payload.
 */
export type RepoContributorStatsStatus = 'ready' | 'computing' | 'empty';

export interface RepoContributorStatsResponse {
  status: RepoContributorStatsStatus;
  items: RepoContributorStatsItem[];
}
