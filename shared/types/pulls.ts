/**
 * Pull Request types from GitHub API
 */

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
  repository_url?: string;

  // Base and head branches
  base?: {
    ref: string;
    sha: string;
    repo?: {
      id: number;
      name: string;
      full_name: string;
      url: string;
      owner?: {
        login: string;
        id: number;
        avatar_url?: string;
      };
    };
  };

  head?: {
    ref: string;
    sha: string;
    repo?: {
      id: number;
      name: string;
      full_name: string;
      url: string;
      owner?: {
        login: string;
        id: number;
        avatar_url?: string;
      };
    };
  };

  // User info
  user?: {
    login: string;
    id: number;
    avatar_url?: string;
  };

  // Labels
  labels?: Array<{
    id: number;
    name: string;
    color: string;
    description?: string | null;
  }>;

  // Reviewers (added by our API)
  reviewers?: {
    requested?: Array<{
      id: number | string;
      login: string;
      avatar_url?: string | null;
    }>;
    teams?: Array<{
      id: number | string;
      slug: string;
      name: string;
    }>;
    approved?: Array<{
      id: number | string;
      login: string;
      avatar_url?: string | null;
    }>;
    changesRequested?: Array<{
      id: number | string;
      login: string;
      avatar_url?: string | null;
    }>;
    commented?: Array<{
      id: number | string;
      login: string;
      avatar_url?: string | null;
    }>;
  };

  // Merge status
  mergeable?: boolean | null;
  mergeable_state?: string;
  merged?: boolean;
  draft?: boolean;

  // Additional fields that may be present
  [key: string]: unknown;
}
