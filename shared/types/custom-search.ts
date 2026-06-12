export type GitHubSearchItemType = 'issues' | 'pulls';
export type GitHubSearchIssueState = 'open' | 'closed' | 'all';
export type GitHubSearchPullState = 'open' | 'closed' | 'merged' | 'all';
export type GitHubSearchScope = 'title' | 'body' | 'comments';
export type GitHubSearchSort =
  | 'best-match'
  | 'comments'
  | 'reactions'
  | 'interactions'
  | 'created'
  | 'updated';
export type GitHubSearchOrder = 'desc' | 'asc';
export type GitHubSearchVisibilityFilter = 'any' | 'public' | 'private';
export type GitHubSearchArchivedFilter = 'exclude' | 'include' | 'only';
export type GitHubSearchDraftFilter = 'any' | 'draft' | 'ready';
export type GitHubSearchReviewFilter =
  | 'any'
  | 'none'
  | 'required'
  | 'approved'
  | 'changes_requested';

interface GitHubSearchQueryBase {
  text?: string;
  repo?: string;
  org?: string;
  user?: string;
  labels?: string[];
  author?: string;
  assignee?: string;
  mentions?: string;
  commenter?: string;
  involves?: string;
  milestone?: string;
  scopes?: GitHubSearchScope[];
  visibility?: GitHubSearchVisibilityFilter;
  archived?: GitHubSearchArchivedFilter;
  sort?: GitHubSearchSort;
  order?: GitHubSearchOrder;
  perPage?: number;
}

export interface GitHubIssueSearchQuery extends GitHubSearchQueryBase {
  type: 'issues';
  state?: GitHubSearchIssueState;
}

export interface GitHubPullSearchQuery extends GitHubSearchQueryBase {
  type: 'pulls';
  state?: GitHubSearchPullState;
  draft?: GitHubSearchDraftFilter;
  review?: GitHubSearchReviewFilter;
  base?: string;
  head?: string;
}

export type GitHubSearchQuery = GitHubIssueSearchQuery | GitHubPullSearchQuery;

export type CustomTabSource = 'github-search';
export type CustomTabSubtitleMode = 'auto' | 'custom' | 'none';

interface CustomTabBase {
  id: string;
  groupId: string;
  name: string;
  subtitle?: string;
  subtitleMode: CustomTabSubtitleMode;
}

export interface GitHubSearchTab extends CustomTabBase {
  source: 'github-search';
  query: GitHubSearchQuery;
}

export type CustomTab = GitHubSearchTab;
