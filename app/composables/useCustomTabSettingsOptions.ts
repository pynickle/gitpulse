import {
  appendCustomTabQueryParams,
  buildIssueSearchParts,
  createGitHubIssueSearchUrl,
  getOneYearAgoSearchDate,
} from '#shared/utils/github-search-query';
import type {
  CustomTab,
  CustomTabSource,
  CustomTabSubtitleMode,
  GitHubSearchArchivedFilter,
  GitHubSearchDraftFilter,
  GitHubSearchIssueState,
  GitHubSearchItemType,
  GitHubSearchOrder,
  GitHubSearchPullState,
  GitHubSearchQuery,
  GitHubSearchReviewFilter,
  GitHubSearchScope,
  GitHubSearchSort,
  GitHubSearchVisibilityFilter,
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

export const customTabTypeOptions: Array<CustomTabToggleOption<GitHubSearchItemType>> = [
  { labelKey: 'dashboard.tabsSettings.options.issues', value: 'issues' },
  { labelKey: 'dashboard.tabsSettings.options.pullRequests', value: 'pulls' },
];

export const customTabSubtitleModeOptions: Array<CustomTabToggleOption<CustomTabSubtitleMode>> = [
  { labelKey: 'dashboard.tabsSettings.subtitleMode.auto', value: 'auto' },
  { labelKey: 'dashboard.tabsSettings.subtitleMode.custom', value: 'custom' },
  { labelKey: 'dashboard.tabsSettings.subtitleMode.none', value: 'none' },
];

export const customTabIssueStateOptions: Array<CustomTabToggleOption<GitHubSearchIssueState>> = [
  { labelKey: 'dashboard.tabsSettings.options.open', value: 'open' },
  { labelKey: 'dashboard.tabsSettings.options.closed', value: 'closed' },
  { labelKey: 'dashboard.tabsSettings.options.allStates', value: 'all' },
];

export const customTabPullStateOptions: Array<CustomTabToggleOption<GitHubSearchPullState>> = [
  { labelKey: 'dashboard.tabsSettings.options.open', value: 'open' },
  { labelKey: 'dashboard.tabsSettings.options.closed', value: 'closed' },
  { labelKey: 'dashboard.tabsSettings.options.merged', value: 'merged' },
  { labelKey: 'dashboard.tabsSettings.options.allStates', value: 'all' },
];

export const customTabScopeOptions: Array<CustomTabToggleOption<GitHubSearchScope>> = [
  { labelKey: 'dashboard.tabsSettings.options.title', value: 'title' },
  { labelKey: 'dashboard.tabsSettings.options.body', value: 'body' },
  { labelKey: 'dashboard.tabsSettings.options.comments', value: 'comments' },
];

export const customTabSortOptions: Array<CustomTabToggleOption<GitHubSearchSort>> = [
  { labelKey: 'dashboard.tabsSettings.options.best', value: 'best-match' },
  { labelKey: 'dashboard.tabsSettings.options.updated', value: 'updated' },
  { labelKey: 'dashboard.tabsSettings.options.created', value: 'created' },
  { labelKey: 'dashboard.tabsSettings.options.comments', value: 'comments' },
  { labelKey: 'dashboard.tabsSettings.options.reactions', value: 'reactions' },
  { labelKey: 'dashboard.tabsSettings.options.interactions', value: 'interactions' },
];

export const customTabOrderOptions: Array<CustomTabToggleOption<GitHubSearchOrder>> = [
  { labelKey: 'dashboard.tabsSettings.options.desc', value: 'desc' },
  { labelKey: 'dashboard.tabsSettings.options.asc', value: 'asc' },
];

export const customTabVisibilityOptions: Array<
  CustomTabToggleOption<GitHubSearchVisibilityFilter>
> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.public', value: 'public' },
  { labelKey: 'dashboard.tabsSettings.options.private', value: 'private' },
];

export const customTabArchivedOptions: Array<CustomTabToggleOption<GitHubSearchArchivedFilter>> = [
  { labelKey: 'dashboard.tabsSettings.options.excludeArchived', value: 'exclude' },
  { labelKey: 'dashboard.tabsSettings.options.include', value: 'include' },
  { labelKey: 'dashboard.tabsSettings.options.onlyArchived', value: 'only' },
];

export const customTabDraftOptions: Array<CustomTabToggleOption<GitHubSearchDraftFilter>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.draft', value: 'draft' },
  { labelKey: 'dashboard.tabsSettings.options.ready', value: 'ready' },
];

export const customTabReviewOptions: Array<CustomTabToggleOption<GitHubSearchReviewFilter>> = [
  { labelKey: 'dashboard.tabsSettings.options.any', value: 'any' },
  { labelKey: 'dashboard.tabsSettings.options.none', value: 'none' },
  { labelKey: 'dashboard.tabsSettings.options.required', value: 'required' },
  { labelKey: 'dashboard.tabsSettings.options.approved', value: 'approved' },
  { labelKey: 'dashboard.tabsSettings.options.changesRequested', value: 'changes_requested' },
];

export function buildCustomTabSearchParts(query: GitHubSearchQuery) {
  return buildIssueSearchParts(query, {
    createdAfter: getOneYearAgoSearchDate(),
  });
}

export function buildCustomTabSearchQuery(query: GitHubSearchQuery) {
  return buildCustomTabSearchParts(query).join(' ');
}

export function createCustomTabPreviewSearchParams(
  query: GitHubSearchQuery,
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

export function createGitHubCustomTabPreviewUrl(query: GitHubSearchQuery) {
  return createGitHubIssueSearchUrl(query, buildCustomTabSearchQuery(query));
}

function getCustomTabStateSummary(query: GitHubSearchQuery, t: Translate) {
  const state = query.state ?? 'all';

  if (state === 'all') {
    return '';
  }

  return t(`dashboard.tabsSettings.options.${state}`);
}

function buildCustomTabSummaryChunks(
  query: GitHubSearchQuery,
  t: Translate,
  options: { maxLabels?: number } = {}
) {
  const chunks = [getCustomTabTypeSummary(query.type, t)];

  const stateSummary = getCustomTabStateSummary(query, t);
  if (stateSummary) chunks.push(t('dashboard.tabsSettings.summary.state', { value: stateSummary }));

  const fields = [
    ['repo', 'inRepo'],
    ['author', 'authoredBy'],
    ['assignee', 'assignedTo'],
    ['involves', 'involving'],
  ] as const;

  for (const [key, labelKey] of fields) {
    const value = query[key]?.trim();
    if (value) chunks.push(t(`dashboard.tabsSettings.summary.${labelKey}`, { value }));
  }

  const labels = options.maxLabels ? query.labels?.slice(0, options.maxLabels) : query.labels;
  if (labels && labels.length > 0)
    chunks.push(t('dashboard.tabsSettings.summary.labeled', { value: labels.join(', ') }));

  return chunks;
}

export function buildCustomTabHumanPreview(query: GitHubSearchQuery, t: Translate) {
  const chunks = buildCustomTabSummaryChunks(query, t);

  return t('dashboard.tabsSettings.summary.showing', { value: chunks.join(', ') });
}

export function buildCustomTabSummary(query: GitHubSearchQuery, t: Translate) {
  const chunks = buildCustomTabSummaryChunks(query, t, { maxLabels: 2 });

  return t('dashboard.tabsSettings.summary.showing', { value: chunks.slice(0, 4).join(', ') });
}

function getCustomTabTypeSummary(type: GitHubSearchItemType, t: Translate) {
  return type === 'pulls'
    ? t('dashboard.tabsSettings.summary.pullRequests')
    : t('dashboard.tabsSettings.summary.issues');
}

export function resolveCustomTabSubtitle(tab: CustomTab, t: Translate) {
  if (tab.subtitleMode === 'none') {
    return undefined;
  }

  if (tab.subtitleMode === 'custom' && tab.subtitle?.trim()) {
    return tab.subtitle.trim();
  }

  return buildCustomTabSummary(tab.query, t);
}
