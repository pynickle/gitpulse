import { describe, expect, test } from 'bun:test';

import {
  appendCustomTabQueryParams,
  buildIssueSearchParts,
  createGitHubIssueSearchUrl,
  normalizeIssueSearchScopes,
  quoteSearchValue,
} from '../shared/utils/github-search-query';

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

  test('serializes custom tab query params with trimmed string lists', () => {
    const params = new URLSearchParams();

    appendCustomTabQueryParams(params, {
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
      merged: 'merged',
      sort: 'best-match',
      order: 'asc',
      base: ' main ',
      head: ' feature ',
    });

    expect(params.toString()).toBe(
      'text=review+queue&repo=owner%2Frepo&base=main&head=feature&labels=bug%2Cneeds+triage&scopes=title%2Ccomments&type=pulls&state=open&visibility=private&archived=exclude&draft=ready&review=required&merged=merged&order=asc'
    );
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
          merged: 'merged',
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
      'is:merged',
      'base:main',
      'head:"feature branch"',
    ]);
  });

  test('does not add implicit owner qualifiers', () => {
    expect(buildIssueSearchParts({})).toEqual(['is:issue', 'archived:false']);

    expect(buildIssueSearchParts({ type: 'pulls' })).toEqual(['is:pr', 'archived:false']);
  });

  test('keeps closed and merged pull request searches mutually exclusive', () => {
    expect(buildIssueSearchParts({ type: 'pulls', state: 'closed', merged: 'unmerged' })).toEqual([
      'is:pr',
      'archived:false',
      'state:closed',
      '-is:merged',
    ]);

    expect(buildIssueSearchParts({ type: 'pulls', state: 'closed', merged: 'merged' })).toEqual([
      'is:pr',
      'archived:false',
      'state:closed',
      'is:merged',
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
});
