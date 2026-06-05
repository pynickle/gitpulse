import { describe, expect, test } from 'bun:test';

import {
  appendCustomTabQueryParams,
  buildIssueSearchParts,
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
      sort: 'best-match',
      order: 'asc',
      base: ' main ',
      head: ' feature ',
    });

    expect(params.toString()).toBe(
      'text=review+queue&repo=owner%2Frepo&base=main&head=feature&labels=bug%2Cneeds+triage&scopes=title%2Ccomments&type=pulls&state=open&visibility=private&archived=exclude&draft=ready&review=required&order=asc'
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
          base: 'main',
          head: 'feature branch',
        },
        { createdAfter: '2025-01-01', fallbackInvolves: 'fallback-user' }
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

  test('adds fallback involves only when no owner qualifiers are set', () => {
    expect(buildIssueSearchParts({}, { fallbackInvolves: 'octocat' })).toEqual([
      'is:issue',
      'archived:false',
      'involves:octocat',
    ]);

    expect(buildIssueSearchParts({ repo: ' ' }, { fallbackInvolves: 'octocat' })).toEqual([
      'is:issue',
      'archived:false',
    ]);
  });
});
