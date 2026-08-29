/** Delay before a typed query hits GitHub repository search. */
export const REPOSITORY_SEARCH_DEBOUNCE_MS = 300;

/**
 * Default page size for the configuration search grid (3 columns).
 * Matches the Starred tab so full pages fill every row; GitHub max is 100.
 */
export const REPOSITORY_SEARCH_DEFAULT_PER_PAGE = 30;

export interface RepositorySearchRequest {
  path: string;
  query: string;
  page: number;
  perPage: number;
}

export function normalizeRepositorySearchQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const query = raw.trim();
  return query ? query : null;
}

export function buildRepositorySearchRequest(options: {
  query: unknown;
  page?: number;
  perPage?: number;
}): RepositorySearchRequest | null {
  const query = normalizeRepositorySearchQuery(options.query);
  if (!query) {
    return null;
  }

  const page =
    typeof options.page === 'number' && Number.isSafeInteger(options.page) && options.page > 0
      ? options.page
      : 1;
  const perPage =
    typeof options.perPage === 'number' &&
    Number.isSafeInteger(options.perPage) &&
    options.perPage > 0
      ? options.perPage
      : REPOSITORY_SEARCH_DEFAULT_PER_PAGE;

  const params = new URLSearchParams({
    q: query,
    page: String(page),
    per_page: String(perPage),
  });

  return {
    path: `/api/search/repositories?${params.toString()}`,
    query,
    page,
    perPage,
  };
}
