import {
  appendCustomTabQueryParams,
  buildIssueSearchParts,
  getOneYearAgoSearchDate,
} from '#shared/utils/github-search-query';
import type {
  CustomTabArchived,
  CustomTabDraft,
  CustomTabOrder,
  CustomTabQuery,
  CustomTabReview,
  CustomTabSearchScope,
  CustomTabSearchType,
  CustomTabSort,
  CustomTabSource,
  CustomTabState,
  CustomTabVisibility,
} from '~/composables/useCustomTabs';

type Translate = (key: string, params?: Record<string, string>) => string;

export interface CustomTabSourceOption {
  id: CustomTabSource | 'github-graphql' | 'github-labels';
  labelKey: string;
  captionKey: string;
  disabled?: boolean;
}

export interface CustomTabToggleOption<T extends string> {
  labelKey: string;
  value: T;
}

export const customTabSourceOptions: CustomTabSourceOption[] = [
  {
    id: 'github-search',
    labelKey: 'dashboard.tabsSettings.source.githubSearch',
    captionKey: 'dashboard.tabsSettings.source.githubSearchCaption',
  },
  {
    id: 'github-graphql',
    labelKey: 'dashboard.tabsSettings.source.graphql',
    captionKey: 'dashboard.tabsSettings.source.graphqlCaption',
    disabled: true,
  },
  {
    id: 'github-labels',
    labelKey: 'dashboard.tabsSettings.source.labelsApi',
    captionKey: 'dashboard.tabsSettings.source.labelsApiCaption',
    disabled: true,
  },
];

export const customTabTypeOptions: Array<CustomTabToggleOption<CustomTabSearchType>> = [
  { labelKey: 'dashboard.tabsSettings.options.issues', value: 'issues' },
  { labelKey: 'dashboard.tabsSettings.options.pullRequests', value: 'pulls' },
  { labelKey: 'dashboard.tabsSettings.options.both', value: 'all' },
];

export const customTabStateOptions: Array<CustomTabToggleOption<CustomTabState | 'any'>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.open', value: 'open' },
  { labelKey: 'dashboard.tabsSettings.options.closed', value: 'closed' },
  { labelKey: 'dashboard.tabsSettings.options.all', value: 'all' },
];

export const customTabScopeOptions: Array<CustomTabToggleOption<CustomTabSearchScope>> = [
  { labelKey: 'dashboard.tabsSettings.options.title', value: 'title' },
  { labelKey: 'dashboard.tabsSettings.options.body', value: 'body' },
  { labelKey: 'dashboard.tabsSettings.options.comments', value: 'comments' },
];

export const customTabSortOptions: Array<CustomTabToggleOption<CustomTabSort>> = [
  { labelKey: 'dashboard.tabsSettings.options.best', value: 'best-match' },
  { labelKey: 'dashboard.tabsSettings.options.updated', value: 'updated' },
  { labelKey: 'dashboard.tabsSettings.options.created', value: 'created' },
  { labelKey: 'dashboard.tabsSettings.options.comments', value: 'comments' },
  { labelKey: 'dashboard.tabsSettings.options.reactions', value: 'reactions' },
  { labelKey: 'dashboard.tabsSettings.options.interactions', value: 'interactions' },
];

export const customTabOrderOptions: Array<CustomTabToggleOption<CustomTabOrder>> = [
  { labelKey: 'dashboard.tabsSettings.options.desc', value: 'desc' },
  { labelKey: 'dashboard.tabsSettings.options.asc', value: 'asc' },
];

export const customTabVisibilityOptions: Array<CustomTabToggleOption<CustomTabVisibility>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.public', value: 'public' },
  { labelKey: 'dashboard.tabsSettings.options.private', value: 'private' },
];

export const customTabArchivedOptions: Array<CustomTabToggleOption<CustomTabArchived>> = [
  { labelKey: 'dashboard.tabsSettings.options.excludeArchived', value: 'exclude' },
  { labelKey: 'dashboard.tabsSettings.options.include', value: 'include' },
  { labelKey: 'dashboard.tabsSettings.options.onlyArchived', value: 'only' },
];

export const customTabDraftOptions: Array<CustomTabToggleOption<CustomTabDraft>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.draft', value: 'draft' },
  { labelKey: 'dashboard.tabsSettings.options.ready', value: 'ready' },
];

export const customTabReviewOptions: Array<CustomTabToggleOption<CustomTabReview>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.none', value: 'none' },
  { labelKey: 'dashboard.tabsSettings.options.required', value: 'required' },
  { labelKey: 'dashboard.tabsSettings.options.approved', value: 'approved' },
  { labelKey: 'dashboard.tabsSettings.options.changesRequested', value: 'changes_requested' },
];

export function buildCustomTabSearchParts(query: CustomTabQuery) {
  return buildIssueSearchParts(query, {
    createdAfter: getOneYearAgoSearchDate(),
  });
}

export function buildCustomTabSearchQuery(query: CustomTabQuery) {
  const parts = buildCustomTabSearchParts(query);
  return parts.length > 0 ? parts.join(' ') : '';
}

export function createCustomTabPreviewSearchParams(
  query: CustomTabQuery,
  page: number,
  perPage: number
) {
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  appendCustomTabQueryParams(searchParams, query);

  return searchParams;
}

export function createGitHubCustomTabPreviewUrl(query: CustomTabQuery) {
  const searchParams = new URLSearchParams({ q: buildCustomTabSearchQuery(query) });
  if (query.type === 'issues') {
    searchParams.set('type', 'issues');
  } else if (query.type === 'pulls') {
    searchParams.set('type', 'pullrequests');
  }
  if (query.sort !== 'best-match') {
    searchParams.set('s', query.sort ?? 'updated');
    searchParams.set('o', query.order ?? 'desc');
  }

  return `https://github.com/search?${searchParams.toString()}`;
}

export function buildCustomTabHumanPreview(query: CustomTabQuery, t: Translate) {
  const chunks = [];
  chunks.push(getCustomTabTypeSummary(query.type ?? 'issues', t));

  if (query.repo?.trim())
    chunks.push(t('dashboard.tabsSettings.summary.inRepo', { value: query.repo.trim() }));
  if (query.author?.trim())
    chunks.push(t('dashboard.tabsSettings.summary.authoredBy', { value: query.author.trim() }));
  if (query.assignee?.trim())
    chunks.push(t('dashboard.tabsSettings.summary.assignedTo', { value: query.assignee.trim() }));
  if (query.involves?.trim())
    chunks.push(t('dashboard.tabsSettings.summary.involving', { value: query.involves.trim() }));
  if (query.labels && query.labels.length > 0)
    chunks.push(t('dashboard.tabsSettings.summary.labeled', { value: query.labels.join(', ') }));
  if (query.state && query.state !== 'any')
    chunks.push(t('dashboard.tabsSettings.summary.state', { value: query.state }));

  return t('dashboard.tabsSettings.summary.showing', { value: chunks.join(', ') });
}

export function buildCustomTabSummary(query: CustomTabQuery, t: Translate) {
  const chunks = [];
  const type = query.type ?? 'issues';
  chunks.push(getCustomTabTypeSummary(type, t));

  if (query.state && query.state !== 'all') {
    chunks.push(t('dashboard.tabsSettings.summary.state', { value: query.state }));
  }
  if (query.repo) chunks.push(t('dashboard.tabsSettings.summary.inRepo', { value: query.repo }));
  if (query.author)
    chunks.push(t('dashboard.tabsSettings.summary.authoredBy', { value: query.author }));
  if (query.assignee)
    chunks.push(t('dashboard.tabsSettings.summary.assignedTo', { value: query.assignee }));
  if (query.involves)
    chunks.push(t('dashboard.tabsSettings.summary.involving', { value: query.involves }));
  if (query.labels && query.labels.length > 0)
    chunks.push(
      t('dashboard.tabsSettings.summary.labeled', { value: query.labels.slice(0, 2).join(', ') })
    );

  return t('dashboard.tabsSettings.summary.showing', { value: chunks.slice(0, 4).join(', ') });
}

function getCustomTabTypeSummary(type: CustomTabSearchType, t: Translate) {
  return type === 'pulls'
    ? t('dashboard.tabsSettings.summary.pullRequests')
    : type === 'all'
      ? t('dashboard.tabsSettings.summary.issuesAndPullRequests')
      : t('dashboard.tabsSettings.summary.issues');
}
