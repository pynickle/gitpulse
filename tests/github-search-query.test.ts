import { describe, expect, test } from 'bun:test';

import {
  appendCustomTabQueryParams,
  buildIssueSearchParts,
  buildCustomTabSearchQuery,
  createGitHubIssueSearchUrl,
  createGitHubSearchUrl,
  getCustomTabEffectiveSearchQuery,
  getCustomTabLabelsRepositoryId,
  getCustomTabSearchValidationIssue,
  normalizeIssueSearchScopes,
  quoteSearchValue,
} from '../shared/utils/github-search-query';
import { parseGitHubSearchSyntax } from '../shared/utils/github-search-syntax';

describe('github search query helpers', () => {
  test('quotes search values only when GitHub requires it', () => {
    expect(quoteSearchValue('plain')).toBe('plain');
    expect(quoteSearchValue('two words')).toBe('"two words"');
    expect(quoteSearchValue('label "with quote"')).toBe('"label \\"with quote\\""');
  });

  test('filters unsupported search scopes', () => {
    expect(normalizeIssueSearchScopes(['title', 'invalid', 'comments'])).toEqual([
      'title',
      'comments',
    ]);
  });

  test('serializes custom tab query params as endpoint search syntax', () => {
    const params = new URLSearchParams();

    appendCustomTabQueryParams(params, {
      endpoint: 'code',
      syntax: 'repo:owner/repo language:ts "review queue"',
      type: 'issues',
    });

    expect(params.toString()).toBe(
      'endpoint=code&q=repo%3Aowner%2Frepo+language%3Ats+%22review+queue%22'
    );
  });

  test('keeps legacy structured custom tabs convertible to syntax', () => {
    expect(
      buildCustomTabSearchQuery({
        text: ' review queue ',
        repo: ' owner/repo ',
        labels: [' bug ', '', 'needs triage'],
        scopes: ['title', 'comments'],
        type: 'pulls',
        state: 'open',
        visibility: 'private',
        archived: 'exclude',
        draft: 'ready',
        review: 'required',
        base: ' main ',
        head: ' feature ',
      })
    ).toContain('repo:owner/repo');
  });

  test('builds issue search parts in GitHub qualifier order', () => {
    expect(
      buildIssueSearchParts(
        {
          text: ' crash report ',
          type: 'pulls',
          archived: 'exclude',
          state: 'open',
          scopes: ['title', 'comments'],
          visibility: 'private',
          repo: ' owner/repo ',
          author: 'octo user',
          labels: ['bug', 'needs triage'],
          draft: 'ready',
          review: 'required',
          base: 'main',
          head: 'feature branch',
        },
        { createdAfter: '2025-01-01' }
      )
    ).toEqual([
      'crash report',
      'created:>=2025-01-01',
      'is:pr',
      'archived:false',
      'state:open',
      'in:title,comments',
      'is:private',
      'repo:owner/repo',
      'author:"octo user"',
      'label:bug',
      'label:"needs triage"',
      'draft:false',
      'review:required',
      'base:main',
      'head:"feature branch"',
    ]);
  });

  test('does not add implicit owner qualifiers', () => {
    expect(buildIssueSearchParts({ type: 'issues' })).toEqual(['is:issue', 'archived:false']);

    expect(buildIssueSearchParts({ type: 'pulls' })).toEqual(['is:pr', 'archived:false']);
  });

  test('keeps closed and merged pull request searches mutually exclusive', () => {
    expect(buildIssueSearchParts({ type: 'pulls', state: 'closed' })).toEqual([
      'is:pr',
      'archived:false',
      'state:closed',
      '-is:merged',
    ]);

    expect(buildIssueSearchParts({ type: 'pulls', state: 'merged' })).toEqual([
      'is:pr',
      'archived:false',
      'is:merged',
    ]);

    expect(buildIssueSearchParts({ type: 'issues', state: 'closed' })).toEqual([
      'is:issue',
      'archived:false',
      'state:closed',
    ]);
  });

  test('creates GitHub search URLs from the displayed query without type overrides', () => {
    const url = createGitHubIssueSearchUrl(
      { type: 'pulls', sort: 'updated', order: 'desc' },
      'created:>=2025-01-01 is:pr archived:false'
    );

    expect(url).toBe(
      'https://github.com/search?q=created%3A%3E%3D2025-01-01+is%3Apr+archived%3Afalse&s=updated&o=desc'
    );
  });

  test('creates GitHub web URLs for non-issue endpoints', () => {
    const url = createGitHubSearchUrl(
      { endpoint: 'repositories', type: 'issues', syntax: 'topic:nuxt stars:>100' },
      'topic:nuxt stars:>100'
    );

    expect(url).toBe('https://github.com/search?q=topic%3Anuxt+stars%3A%3E100&type=repositories');
  });

  test('parses GitHub search syntax and reports unknown qualifiers', () => {
    const ast = parseGitHubSearchSyntax(
      'repo:nuxt/nuxt language:ts badqual:value reviewed-by:octocat location:Shanghai'
    );

    expect(ast.qualifiers.map((node) => node.name)).toEqual([
      'repo',
      'language',
      'badqual',
      'reviewed-by',
      'location',
    ]);
    expect(ast.diagnostics).toEqual([
      {
        code: 'unknown-qualifier',
        start: 27,
        end: 34,
        message: 'Unknown qualifier: badqual',
      },
    ]);
  });

  test('splits qualifier highlighting into name, colon, and value spans', () => {
    const ast = parseGitHubSearchSyntax('repo:owner/repo');

    expect(ast.highlights).toContainEqual({
      type: 'qualifier-name',
      start: 0,
      end: 4,
    });
    expect(ast.highlights).toContainEqual({
      type: 'qualifier-colon',
      start: 4,
      end: 5,
    });
    expect(ast.highlights).toContainEqual({
      type: 'qualifier-value',
      start: 5,
      end: 15,
    });
  });

  test('reports unsupported operators except when the endpoint explicitly allows them', () => {
    expect(parseGitHubSearchSyntax('bug OR regression').diagnostics).toContainEqual({
      code: 'unsupported-operator',
      start: 4,
      end: 6,
      message: 'Unsupported operator: OR',
    });

    expect(
      parseGitHubSearchSyntax('bug OR regression', { allowOperators: true }).diagnostics
    ).toEqual([]);
  });

  test('uses repository_id from labels syntax as a REST parameter side channel', () => {
    const query = {
      endpoint: 'labels' as const,
      type: 'issues' as const,
      syntax: 'repository_id:12345 bug',
    };
    const params = new URLSearchParams();

    appendCustomTabQueryParams(params, query);

    expect(getCustomTabLabelsRepositoryId(query)).toBe('12345');
    expect(getCustomTabEffectiveSearchQuery(query)).toBe('bug');
    expect(params.toString()).toBe('endpoint=labels&q=bug&repository_id=12345');
  });

  test('validates custom tab search before saving syntax-first views', () => {
    expect(
      getCustomTabSearchValidationIssue(
        { endpoint: 'repositories', type: 'issues', syntax: '' },
        { requireManualSyntax: true }
      )
    ).toBe('missing-query');

    expect(
      getCustomTabSearchValidationIssue(
        { endpoint: 'labels', type: 'issues', syntax: 'bug' },
        { requireManualSyntax: true }
      )
    ).toBe('missing-label-repository');

    expect(
      getCustomTabSearchValidationIssue(
        { endpoint: 'issues', type: 'issues', syntax: 'bug OR regression' },
        { requireManualSyntax: true }
      )
    ).toBe('unsupported-operator');

    expect(
      getCustomTabSearchValidationIssue(
        { endpoint: 'code', type: 'issues', syntax: 'bug OR regression' },
        { requireManualSyntax: true }
      )
    ).toBe('');

    expect(
      getCustomTabSearchValidationIssue(
        { endpoint: 'labels', type: 'issues', syntax: 'repository_id:12345 bug' },
        { requireManualSyntax: true }
      )
    ).toBe('');
  });
});
