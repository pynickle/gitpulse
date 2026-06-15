export const GITHUB_SEARCH_ITEM_TYPES = ['issues', 'pulls'] as const;
export const GITHUB_SEARCH_ISSUE_STATES = ['open', 'closed', 'all'] as const;
export const GITHUB_SEARCH_PULL_STATES = ['open', 'closed', 'merged', 'all'] as const;
export const GITHUB_SEARCH_SCOPES = ['title', 'body', 'comments'] as const;
export const GITHUB_SEARCH_SORTS = [
  'best-match',
  'comments',
  'reactions',
  'interactions',
  'created',
  'updated',
] as const;
export const GITHUB_SEARCH_ORDERS = ['desc', 'asc'] as const;
export const GITHUB_SEARCH_VISIBILITY_FILTERS = ['any', 'public', 'private'] as const;
export const GITHUB_SEARCH_ARCHIVED_FILTERS = ['exclude', 'include', 'only'] as const;
export const GITHUB_SEARCH_DRAFT_FILTERS = ['any', 'draft', 'ready'] as const;
export const GITHUB_SEARCH_REVIEW_FILTERS = [
  'any',
  'none',
  'required',
  'approved',
  'changes_requested',
] as const;
export const CUSTOM_TAB_SOURCES = ['github-search'] as const;
export const CUSTOM_TAB_SUBTITLE_MODES = ['auto', 'custom', 'none'] as const;

export type GitHubSearchItemType = (typeof GITHUB_SEARCH_ITEM_TYPES)[number];
export type GitHubSearchIssueState = (typeof GITHUB_SEARCH_ISSUE_STATES)[number];
export type GitHubSearchPullState = (typeof GITHUB_SEARCH_PULL_STATES)[number];
export type GitHubSearchScope = (typeof GITHUB_SEARCH_SCOPES)[number];
export type GitHubSearchSort = (typeof GITHUB_SEARCH_SORTS)[number];
export type GitHubSearchOrder = (typeof GITHUB_SEARCH_ORDERS)[number];
export type GitHubSearchVisibilityFilter = (typeof GITHUB_SEARCH_VISIBILITY_FILTERS)[number];
export type GitHubSearchArchivedFilter = (typeof GITHUB_SEARCH_ARCHIVED_FILTERS)[number];
export type GitHubSearchDraftFilter = (typeof GITHUB_SEARCH_DRAFT_FILTERS)[number];
export type GitHubSearchReviewFilter = (typeof GITHUB_SEARCH_REVIEW_FILTERS)[number];

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

export type CustomTabSource = (typeof CUSTOM_TAB_SOURCES)[number];
export type CustomTabSubtitleMode = (typeof CUSTOM_TAB_SUBTITLE_MODES)[number];

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
