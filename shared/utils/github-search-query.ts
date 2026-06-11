import type {
  CustomTabOrder,
  CustomTabQuery,
  CustomTabSearchScope,
  CustomTabSearchType,
  CustomTabSort,
} from '#shared/types/custom-search';

export type GitHubIssueSearchSort = Exclude<CustomTabSort, 'best-match'>;

const ISSUE_SEARCH_SORTS: readonly GitHubIssueSearchSort[] = [
  'comments',
  'reactions',
  'interactions',
  'created',
  'updated',
];

const SEARCH_SCOPES: readonly CustomTabSearchScope[] = ['title', 'body', 'comments'];

const TRIMMED_QUERY_PARAM_FIELDS = [
  'text',
  'repo',
  'org',
  'user',
  'author',
  'assignee',
  'mentions',
  'commenter',
  'involves',
  'milestone',
  'base',
  'head',
] as const satisfies readonly (keyof CustomTabQuery)[];

const SIMPLE_QUERY_PARAM_FIELDS = [
  'type',
  'state',
  'visibility',
  'archived',
  'draft',
  'review',
  'merged',
  'order',
] as const satisfies readonly (keyof CustomTabQuery)[];

const SEARCH_QUALIFIER_FIELDS = [
  'repo',
  'org',
  'user',
  'author',
  'assignee',
  'mentions',
  'commenter',
  'involves',
  'milestone',
] as const satisfies readonly (keyof CustomTabQuery)[];

const PULL_SEARCH_QUALIFIER_FIELDS = [
  'base',
  'head',
] as const satisfies readonly (keyof CustomTabQuery)[];

export const getOneYearAgoSearchDate = () => {
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  return oneYearAgo.toISOString().slice(0, 10);
};

export const quoteSearchValue = (value: string) => {
  return /[\s"]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
};

export const normalizeIssueSearchType = (value: string): CustomTabSearchType => {
  return value === 'pulls' ? 'pulls' : 'issues';
};

export const normalizeIssueSearchSort = (value: string): GitHubIssueSearchSort | '' => {
  return ISSUE_SEARCH_SORTS.includes(value as GitHubIssueSearchSort)
    ? (value as GitHubIssueSearchSort)
    : '';
};

export const normalizeIssueSearchOrder = (value: string): CustomTabOrder => {
  return value === 'asc' ? 'asc' : 'desc';
};

export const normalizeIssueSearchScopes = (values: string[]) => {
  return values.filter((scope): scope is CustomTabSearchScope => {
    return SEARCH_SCOPES.includes(scope as CustomTabSearchScope);
  });
};

export const createGitHubIssueSearchUrl = (query: CustomTabQuery, searchQuery: string) => {
  const searchParams = new URLSearchParams({ q: searchQuery });

  if (query.sort && query.sort !== 'best-match') {
    searchParams.set('s', query.sort);
    searchParams.set('o', query.order ?? 'desc');
  }

  return `https://github.com/search?${searchParams.toString()}`;
};

const cleanList = (values: string[] | undefined) => {
  return values?.map((value) => value.trim()).filter((value) => value.length > 0) ?? [];
};

const appendTrimmedParam = (params: URLSearchParams, key: string, value: string | undefined) => {
  const trimmedValue = value?.trim();
  if (trimmedValue) {
    params.set(key, trimmedValue);
  }
};

export const appendCustomTabQueryParams = (params: URLSearchParams, query: CustomTabQuery) => {
  for (const field of TRIMMED_QUERY_PARAM_FIELDS) {
    appendTrimmedParam(params, field, query[field]);
  }

  const labels = cleanList(query.labels);
  if (labels.length > 0) {
    params.set('labels', labels.join(','));
  }

  const scopes = cleanList(query.scopes);
  if (scopes.length > 0) {
    params.set('scopes', scopes.join(','));
  }

  for (const field of SIMPLE_QUERY_PARAM_FIELDS) {
    const value = query[field];
    if (value) params.set(field, value);
  }

  if (query.sort && query.sort !== 'best-match') params.set('sort', query.sort);
};

const appendSearchQualifier = (parts: string[], qualifier: string, value: string | undefined) => {
  const trimmedValue = value?.trim();
  if (trimmedValue) {
    parts.push(`${qualifier}:${quoteSearchValue(trimmedValue)}`);
  }
};

export const buildIssueSearchParts = (
  query: CustomTabQuery,
  options: { createdAfter?: string } = {}
) => {
  const text = query.text?.trim();
  const parts = text ? [text] : [];

  if (options.createdAfter) {
    parts.push(`created:>=${options.createdAfter}`);
  }

  if (query.type === 'pulls') {
    parts.push('is:pr');
  } else {
    parts.push('is:issue');
  }

  if (query.archived === 'only') {
    parts.push('archived:true');
  } else if (query.archived !== 'include') {
    parts.push('archived:false');
  }

  if (query.state === 'open' || query.state === 'closed') {
    parts.push(`state:${query.state}`);
  }

  const scopes = normalizeIssueSearchScopes(cleanList(query.scopes));
  if (scopes.length > 0) {
    parts.push(`in:${scopes.join(',')}`);
  }

  if (query.visibility === 'public' || query.visibility === 'private') {
    parts.push(`is:${query.visibility}`);
  }

  for (const field of SEARCH_QUALIFIER_FIELDS) {
    appendSearchQualifier(parts, field, query[field]);
  }

  for (const label of cleanList(query.labels)) {
    parts.push(`label:${quoteSearchValue(label)}`);
  }

  if (query.type === 'pulls') {
    if (query.draft === 'draft') {
      parts.push('draft:true');
    } else if (query.draft === 'ready') {
      parts.push('draft:false');
    }

    if (
      query.review === 'none' ||
      query.review === 'required' ||
      query.review === 'approved' ||
      query.review === 'changes_requested'
    ) {
      parts.push(`review:${query.review}`);
    }

    if (query.merged === 'merged') {
      parts.push('is:merged');
    } else if (query.merged === 'unmerged') {
      parts.push('-is:merged');
    }

    for (const field of PULL_SEARCH_QUALIFIER_FIELDS) {
      appendSearchQualifier(parts, field, query[field]);
    }
  }

  return parts;
};
