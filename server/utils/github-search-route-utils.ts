import type { H3Event } from 'h3';

import { GITHUB_SEARCH_ENDPOINTS, type GitHubSearchEndpoint } from '#shared/types/custom-search';
import {
  getFirstGitHubSearchQualifierValue,
  parseGitHubSearchSyntax,
  removeGitHubSearchQualifiers,
} from '#shared/utils/github-search-syntax';

import { getGitHubErrorStatusCode } from './github-auth-utils';
import { getGitHubErrorHeader, normalizeSearchTotalCount } from './github-issue-search-route-utils';
import { parsePaginationNumber } from './github-pagination';

export interface GenericGitHubSearchRequestParams {
  endpoint: GitHubSearchEndpoint;
  q: string;
  page: number;
  per_page: number;
  repository_id?: number;
}

const getQueryValue = (value: unknown) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' ? rawValue.trim() : '';
};

const isGitHubSearchEndpoint = (value: string): value is GitHubSearchEndpoint => {
  return GITHUB_SEARCH_ENDPOINTS.includes(value as GitHubSearchEndpoint);
};

export const getGitHubSearchEndpointFromEvent = (event: H3Event) => {
  const endpoint = getRouterParam(event, 'endpoint') ?? 'issues';
  if (isGitHubSearchEndpoint(endpoint)) {
    return endpoint;
  }

  throw createError({
    statusCode: 404,
    statusMessage: 'Unknown GitHub search endpoint',
  });
};

export const buildGitHubSearchRequestParams = (
  event: H3Event,
  endpoint: GitHubSearchEndpoint,
  options: { defaultPerPage?: number; maxPerPage?: number } = {}
): GenericGitHubSearchRequestParams => {
  const query = getQuery(event);
  const page = parsePaginationNumber(query.page, 1);
  const perPage = parsePaginationNumber(
    query.per_page,
    options.defaultPerPage ?? 20,
    options.maxPerPage ?? 100
  );
  const rawQ = getQueryValue(query.q);

  const ast = parseGitHubSearchSyntax(rawQ, {
    allowOperators: endpoint === 'code',
  });
  if (ast.diagnostics.some((diagnostic) => diagnostic.code === 'unsupported-operator')) {
    throw createError({
      statusCode: 422,
      statusMessage: 'GitHub search operators are not supported yet',
    });
  }

  if (ast.diagnostics.length > 0) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Invalid GitHub search syntax',
    });
  }

  const requestParams: GenericGitHubSearchRequestParams = {
    endpoint,
    q: endpoint === 'labels' ? removeGitHubSearchQualifiers(rawQ, ['repository_id']) : rawQ,
    page,
    per_page: perPage,
  };

  if (endpoint === 'labels') {
    const repositoryId = Number.parseInt(
      getQueryValue(query.repository_id) ||
        getFirstGitHubSearchQualifierValue(ast, 'repository_id'),
      10
    );
    if (Number.isSafeInteger(repositoryId) && repositoryId > 0) {
      requestParams.repository_id = repositoryId;
    }
  }

  return requestParams;
};

export const createEmptyGitHubSearchResponse = (
  requestParams: GenericGitHubSearchRequestParams
) => {
  return {
    total_count: 0,
    incomplete_results: false,
    request: requestParams,
    items: [],
    pagination: {
      page: requestParams.page,
      perPage: requestParams.per_page,
      hasPrev: false,
      hasNext: false,
      totalCount: 0,
      totalPages: 1,
    },
  };
};

export const normalizeGenericSearchTotalCount = normalizeSearchTotalCount;

export const translateGitHubSearchError = (error: unknown, fallbackMessage: string): never => {
  const status = getGitHubErrorStatusCode(error);

  if (status === 400 || status === 422) {
    throw createError({
      statusCode: status,
      statusMessage: 'Invalid GitHub search query',
    });
  }

  const remainingSearchRequests = getGitHubErrorHeader(error, 'x-ratelimit-remaining');
  const rateLimitResource = getGitHubErrorHeader(error, 'x-ratelimit-resource');

  if (status === 403 && remainingSearchRequests === '0' && rateLimitResource === 'search') {
    throw createError({
      statusCode: 429,
      statusMessage: 'GitHub search rate limit exceeded',
    });
  }

  if (status === 403) {
    throw createError({
      statusCode: 403,
      statusMessage: 'GitHub search request forbidden',
    });
  }

  throw createError({
    statusCode: 500,
    statusMessage: fallbackMessage,
  });
};
