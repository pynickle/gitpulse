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
