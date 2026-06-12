export type CustomTabState = 'open' | 'closed' | 'all';
export type CustomTabSource = 'github-search';
export type CustomTabSearchType = 'issues' | 'pulls';
export type CustomTabSearchScope = 'title' | 'body' | 'comments';
export type CustomTabSort =
  | 'best-match'
  | 'comments'
  | 'reactions'
  | 'interactions'
  | 'created'
  | 'updated';
export type CustomTabOrder = 'desc' | 'asc';
export type CustomTabVisibility = 'any' | 'public' | 'private';
export type CustomTabArchived = 'exclude' | 'include' | 'only';
export type CustomTabDraft = 'any' | 'draft' | 'ready';
export type CustomTabReview = 'any' | 'none' | 'required' | 'approved' | 'changes_requested';
export type CustomTabMerged = 'merged' | 'unmerged';
export type CustomTabSubtitleMode = 'auto' | 'custom' | 'none';

export interface CustomTabQuery {
  text?: string;
  type?: CustomTabSearchType;
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
  state?: CustomTabState;
  scopes?: CustomTabSearchScope[];
  visibility?: CustomTabVisibility;
  archived?: CustomTabArchived;
  draft?: CustomTabDraft;
  review?: CustomTabReview;
  merged?: CustomTabMerged;
  base?: string;
  head?: string;
  sort?: CustomTabSort;
  order?: CustomTabOrder;
  perPage?: number;
}

export interface CustomTab {
  id: string;
  groupId: string;
  name: string;
  subtitle?: string;
  subtitleMode: CustomTabSubtitleMode;
  source: CustomTabSource;
  query: CustomTabQuery;
}
