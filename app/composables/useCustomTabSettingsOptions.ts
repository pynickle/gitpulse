import {
  appendCustomTabQueryParams,
  buildCustomTabSearchParts as buildStoredCustomTabSearchParts,
  buildCustomTabSearchQuery as buildStoredCustomTabSearchQuery,
  createGitHubSearchUrl,
  getCustomTabEffectiveSearchQuery,
  getGitHubSearchEndpoint,
} from '#shared/utils/github-search-query';
import type {
  CustomTab,
  CustomTabSubtitleMode,
  GitHubSearchEndpoint,
  GitHubSearchQuery,
} from '~/composables/useCustomTabs';

type Translate = (key: string, params?: Record<string, string>) => string;

export interface CustomTabToggleOption<T extends string> {
  labelKey: string;
  value: T;
}

export interface CustomTabEndpointOption {
  value: GitHubSearchEndpoint;
  labelKey: string;
  captionKey: string;
  path: `/search/${GitHubSearchEndpoint}`;
}

export const customTabEndpointOptions: CustomTabEndpointOption[] = [
  {
    value: 'issues',
    labelKey: 'dashboard.tabsSettings.endpoint.issues',
    captionKey: 'dashboard.tabsSettings.endpoint.issuesCaption',
    path: '/search/issues',
  },
  {
    value: 'repositories',
    labelKey: 'dashboard.tabsSettings.endpoint.repositories',
    captionKey: 'dashboard.tabsSettings.endpoint.repositoriesCaption',
    path: '/search/repositories',
  },
];

export const customTabSubtitleModeOptions: Array<CustomTabToggleOption<CustomTabSubtitleMode>> = [
  { labelKey: 'dashboard.tabsSettings.subtitleMode.custom', value: 'custom' },
  { labelKey: 'dashboard.tabsSettings.subtitleMode.none', value: 'none' },
];

export function buildCustomTabSearchParts(query: GitHubSearchQuery) {
  return buildStoredCustomTabSearchParts(query);
}

export function buildCustomTabSearchQuery(query: GitHubSearchQuery) {
  return buildStoredCustomTabSearchQuery(query);
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
  return createGitHubSearchUrl(query, getCustomTabEffectiveSearchQuery(query));
}

export function getCustomTabEndpointPath(query: GitHubSearchQuery) {
  return `/api/search/${getGitHubSearchEndpoint(query)}`;
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
  const chunks = [getCustomTabEndpointSummary(query, t)];

  const syntax = query.syntax?.trim();
  if (syntax) {
    chunks.push(
      t('dashboard.tabsSettings.summary.query', {
        value: syntax.length > 80 ? `${syntax.slice(0, 77)}...` : syntax,
      })
    );
    return chunks;
  }

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

function getCustomTabEndpointSummary(query: GitHubSearchQuery, t: Translate) {
  return t(`dashboard.tabsSettings.endpoint.${getGitHubSearchEndpoint(query)}`);
}

export function resolveCustomTabSubtitle(tab: CustomTab, t: Translate) {
  if (tab.subtitleMode === 'none') {
    return undefined;
  }

  return tab.subtitle?.trim() || undefined;
}
