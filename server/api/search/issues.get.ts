import type {
  GitHubSearchArchivedFilter,
  GitHubSearchQuery,
  GitHubSearchVisibilityFilter,
} from '#shared/types/custom-search';
import {
  buildIssueSearchParts,
  getOneYearAgoSearchDate,
  normalizeIssueSearchOrder,
  normalizeIssueSearchScopes,
  normalizeIssueSearchSort,
  normalizeIssueSearchType,
  type GitHubIssueSearchSort,
} from '#shared/utils/github-search-query';

import { getGitHubErrorStatusCode } from '../../utils/github-auth-utils';
import { buildLinkedPaginationMeta, parsePaginationNumber } from '../../utils/github-pagination';

const SEARCH_TOTAL_COUNT_LIMIT = 1000;

const getQueryValue = (value: unknown) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' ? rawValue.trim() : '';
};

const parseList = (value: unknown) => {
  return getQueryValue(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const getGitHubErrorHeader = (error: unknown, headerName: string) => {
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

export default definePrivateApiCoalescedEventHandler(async (event) => {
  try {
    const { octokit } = await getGitHubSessionContext(event);
    const query = getQuery(event);
    const page = parsePaginationNumber(query.page, 1);
    const perPage = parsePaginationNumber(query.per_page, 20, 100);
    const createdDate = getOneYearAgoSearchDate();
    const text = getQueryValue(query.text);
    const type = normalizeIssueSearchType(getQueryValue(query.type));
    const repo = getQueryValue(query.repo);
    const org = getQueryValue(query.org);
    const userScope = getQueryValue(query.user);
    const author = getQueryValue(query.author);
    const assignee = getQueryValue(query.assignee);
    const mentions = getQueryValue(query.mentions);
    const commenter = getQueryValue(query.commenter);
    const involves = getQueryValue(query.involves);
    const milestone = getQueryValue(query.milestone);
    const state = getQueryValue(query.state);
    const labels = parseList(query.labels);
    const scopes = normalizeIssueSearchScopes(parseList(query.scopes));
    const visibility = getQueryValue(query.visibility);
    const archived = getQueryValue(query.archived);
    const draft = getQueryValue(query.draft);
    const review = getQueryValue(query.review);
    const base = getQueryValue(query.base);
    const head = getQueryValue(query.head);
    const sort = normalizeIssueSearchSort(getQueryValue(query.sort));
    const order = normalizeIssueSearchOrder(getQueryValue(query.order));

    const normalizedVisibility: GitHubSearchVisibilityFilter | undefined =
      visibility === 'public' || visibility === 'private' ? visibility : undefined;
    const normalizedArchived: GitHubSearchArchivedFilter =
      archived === 'include' || archived === 'only' ? archived : 'exclude';

    const sharedQuery = {
      text,
      repo,
      org,
      user: userScope,
      author,
      assignee,
      mentions,
      commenter,
      involves,
      milestone,
      scopes,
      labels,
      visibility: normalizedVisibility,
      archived: normalizedArchived,
    };

    const customQuery: GitHubSearchQuery =
      type === 'pulls'
        ? {
            ...sharedQuery,
            type,
            state:
              state === 'open' || state === 'closed' || state === 'merged' || state === 'all'
                ? state
                : undefined,
            draft: draft === 'draft' || draft === 'ready' ? draft : undefined,
            review:
              review === 'none' ||
              review === 'required' ||
              review === 'approved' ||
              review === 'changes_requested'
                ? review
                : undefined,
            base,
            head,
          }
        : {
            ...sharedQuery,
            type,
            state: state === 'open' || state === 'closed' || state === 'all' ? state : undefined,
          };

    const searchParts = buildIssueSearchParts(customQuery, {
      createdAfter: createdDate,
    });

    const requestParams: {
      q: string;
      sort?: GitHubIssueSearchSort;
      order?: 'asc' | 'desc';
      page: number;
      per_page: number;
    } = {
      q: searchParts.join(' '),
      ...(sort ? { sort, order } : {}),
      page,
      per_page: perPage,
    };

    const { data, headers } = await octokit.request('GET /search/issues', requestParams);

    const totalCount = Math.min(data.total_count ?? 0, SEARCH_TOTAL_COUNT_LIMIT);

    return {
      total_count: totalCount,
      incomplete_results: data.incomplete_results ?? false,
      request: requestParams,
      items: data.items,
      pagination: buildLinkedPaginationMeta({
        page,
        perPage,
        linkHeader: headers.link,
        totalCount,
      }),
    };
  } catch (error) {
    console.error('Error fetching GitHub issue search results:', error);

    const status = getGitHubErrorStatusCode(error);

    if (status === 422) {
      throw createError({
        statusCode: 422,
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
      statusMessage: 'Failed to fetch GitHub search results',
    });
  }
});
