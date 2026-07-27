import { getOneYearAgoSearchDate } from '#shared/utils/github-search-query';

export const SEARCH_TOTAL_COUNT_LIMIT = 1000;

export const getGitHubErrorHeader = (error: unknown, headerName: string) => {
  if (typeof error !== 'object' || !error || !('response' in error)) {
    return null;
  }

  const response = error.response;
  if (typeof response !== 'object' || !response || !('headers' in response)) {
    return null;
  }

  const headers = response.headers;
  if (typeof headers !== 'object' || !headers) {
    return null;
  }

  const value = (headers as Record<string, unknown>)[headerName];
  return typeof value === 'string' ? value : null;
};

export const normalizeSearchTotalCount = (totalCount: number | null | undefined) => {
  return Math.min(totalCount ?? 0, SEARCH_TOTAL_COUNT_LIMIT);
};

/**
 * Search query behind the dashboard "involves me" issue/pull lists. The list
 * endpoints and their freshness endpoints MUST query GitHub with the exact
 * same string — the freshness signature bakes `q` in, so any divergence
 * silently breaks freshness polling. Keep this the only place it is built.
 */
export const buildInvolvesSearchQuery = (type: 'issue' | 'pr', userLogin: string) => {
  return [
    `is:${type}`,
    'is:open',
    'archived:false',
    `created:>=${getOneYearAgoSearchDate()}`,
    `involves:${userLogin}`,
    'sort:updated-desc',
  ].join(' ');
};
