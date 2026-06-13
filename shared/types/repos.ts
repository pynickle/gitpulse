/**
 * Repository detail payload from the GitHub API.
 */

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

  [key: string]: unknown;
}
