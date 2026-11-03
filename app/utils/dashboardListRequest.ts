import type { GitHubSearchQuery } from '#shared/types/custom-search';
import {
  appendCustomTabQueryParams,
  getGitHubSearchEndpoint,
} from '#shared/utils/github-search-query';

export const dashboardListPageSize = 20;

export const buildPaginationUrl = (
  path: string,
  page: number,
  perPage = dashboardListPageSize,
  params: Record<string, boolean | string | undefined> = {}
) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  return `${path}?${searchParams.toString()}`;
};

export const buildCustomTabUrl = (
  page: number,
  query: GitHubSearchQuery,
  perPage = dashboardListPageSize
) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    per_page: String(query.perPage ?? perPage),
  });
  appendCustomTabQueryParams(searchParams, query);

  return `/api/search/${getGitHubSearchEndpoint(query)}?${searchParams.toString()}`;
};
