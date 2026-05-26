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

export const getOneYearAgoSearchDate = () => {
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  return oneYearAgo.toISOString().slice(0, 10);
};

export const quoteSearchValue = (value: string) => {
  return /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
};

export const normalizeIssueSearchType = (value: string): CustomTabSearchType => {
  return value === 'pulls' || value === 'all' ? value : 'issues';
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
  appendTrimmedParam(params, 'text', query.text);
  appendTrimmedParam(params, 'repo', query.repo);
  appendTrimmedParam(params, 'org', query.org);
  appendTrimmedParam(params, 'user', query.user);
  appendTrimmedParam(params, 'author', query.author);
  appendTrimmedParam(params, 'assignee', query.assignee);
  appendTrimmedParam(params, 'mentions', query.mentions);
  appendTrimmedParam(params, 'commenter', query.commenter);
  appendTrimmedParam(params, 'involves', query.involves);
  appendTrimmedParam(params, 'milestone', query.milestone);
  appendTrimmedParam(params, 'base', query.base);
  appendTrimmedParam(params, 'head', query.head);

  const labels = cleanList(query.labels);
  if (labels.length > 0) {
    params.set('labels', labels.join(','));
  }

  const scopes = cleanList(query.scopes);
  if (scopes.length > 0) {
    params.set('scopes', scopes.join(','));
  }

  if (query.type) params.set('type', query.type);
  if (query.state) params.set('state', query.state);
  if (query.visibility) params.set('visibility', query.visibility);
  if (query.archived) params.set('archived', query.archived);
  if (query.draft) params.set('draft', query.draft);
  if (query.review) params.set('review', query.review);
  if (query.sort && query.sort !== 'best-match') params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
};

const appendSearchQualifier = (parts: string[], qualifier: string, value: string | undefined) => {
  const trimmedValue = value?.trim();
  if (trimmedValue) {
    parts.push(`${qualifier}:${quoteSearchValue(trimmedValue)}`);
  }
};

export const buildIssueSearchParts = (
  query: CustomTabQuery,
  options: { createdAfter?: string; fallbackInvolves?: string } = {}
) => {
  const text = query.text?.trim();
  const parts = text ? [text] : [];

  if (options.createdAfter) {
    parts.push(`created:>=${options.createdAfter}`);
  }

  if (query.type === 'pulls') {
    parts.push('is:pr');
  } else if (query.type !== 'all') {
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

  appendSearchQualifier(parts, 'repo', query.repo);
  appendSearchQualifier(parts, 'org', query.org);
  appendSearchQualifier(parts, 'user', query.user);
  appendSearchQualifier(parts, 'author', query.author);
  appendSearchQualifier(parts, 'assignee', query.assignee);
  appendSearchQualifier(parts, 'mentions', query.mentions);
  appendSearchQualifier(parts, 'commenter', query.commenter);
  appendSearchQualifier(parts, 'involves', query.involves);
  appendSearchQualifier(parts, 'milestone', query.milestone);

  for (const label of cleanList(query.labels)) {
    parts.push(`label:${quoteSearchValue(label)}`);
  }

  if (query.type === 'pulls' || query.type === 'all') {
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

    appendSearchQualifier(parts, 'base', query.base);
    appendSearchQualifier(parts, 'head', query.head);
  }

  if (
    options.fallbackInvolves &&
    !query.repo &&
    !query.org &&
    !query.user &&
    !query.author &&
    !query.assignee &&
    !query.mentions &&
    !query.commenter &&
    !query.involves
  ) {
    parts.push(`involves:${options.fallbackInvolves}`);
  }

  return parts;
};
