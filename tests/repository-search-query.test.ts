import { describe, expect, test } from 'bun:test';

import {
  REPOSITORY_SEARCH_DEFAULT_PER_PAGE,
  buildRepositorySearchRequest,
  normalizeRepositorySearchQuery,
} from '../app/utils/repositorySearchQuery';

const requestUrl = (path: string) => new URL(path, 'https://gitpulse.local');

describe('normalizeRepositorySearchQuery', () => {
  test('returns null for empty or whitespace-only input', () => {
    expect(normalizeRepositorySearchQuery('')).toBeNull();
    expect(normalizeRepositorySearchQuery('   ')).toBeNull();
    expect(normalizeRepositorySearchQuery('\t\n')).toBeNull();
    expect(normalizeRepositorySearchQuery(null)).toBeNull();
    expect(normalizeRepositorySearchQuery(undefined)).toBeNull();
  });

  test('trims a real query so callers search the same text the user meant', () => {
    expect(normalizeRepositorySearchQuery('  vue  ')).toBe('vue');
    expect(normalizeRepositorySearchQuery('user:octocat widgets')).toBe('user:octocat widgets');
  });
});

describe('buildRepositorySearchRequest', () => {
  test('does not build a request for an empty or whitespace-only query', () => {
    expect(buildRepositorySearchRequest({ query: '' })).toBeNull();
    expect(buildRepositorySearchRequest({ query: '   ' })).toBeNull();
    expect(buildRepositorySearchRequest({ query: '\n' })).toBeNull();
  });

  test('uses the existing GitHub repository search API with the trimmed query', () => {
    const request = buildRepositorySearchRequest({ query: '  vue  ', page: 2 });

    expect(request).not.toBeNull();
    if (!request) return;

    expect(request.query).toBe('vue');
    expect(request.page).toBe(2);
    expect(request.perPage).toBe(REPOSITORY_SEARCH_DEFAULT_PER_PAGE);

    const url = requestUrl(request.path);
    expect(url.pathname).toBe('/api/search/repositories');
    expect(url.searchParams.get('q')).toBe('vue');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('per_page')).toBe(String(REPOSITORY_SEARCH_DEFAULT_PER_PAGE));
  });

  test('defaults to page 1 and keeps GitHub search qualifiers intact', () => {
    const request = buildRepositorySearchRequest({ query: 'user:octocat language:ts' });

    expect(request).not.toBeNull();
    if (!request) return;

    const url = requestUrl(request.path);
    expect(request.page).toBe(1);
    expect(url.searchParams.get('q')).toBe('user:octocat language:ts');
    expect(url.searchParams.get('page')).toBe('1');
  });
});
