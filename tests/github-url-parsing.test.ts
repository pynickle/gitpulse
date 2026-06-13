import { describe, expect, test } from 'bun:test';

import {
  buildDashboardQueryFromNavigationEntry,
  buildDashboardTabSwitchQuery,
  parseDashboardUrlTarget,
} from '../app/utils/dashboard-url-navigation-utils';
import {
  buildRepoRawFileUrl,
  parseMarkdownRepoResource,
} from '../app/utils/markdown-repo-path-utils';
import parseGitHubMarkdownTarget from '../app/utils/parseGitHubMarkdownTarget';
import parseGitHubNotificationSubjectTarget, {
  toNotificationSubjectStateTarget,
} from '../app/utils/parseGitHubNotificationSubjectTarget';
import parseGitHubRepoPath from '../app/utils/parseGitHubRepoPath';

describe('parseGitHubRepoPath', () => {
  test('parses GitHub web and API repository URLs', () => {
    expect(parseGitHubRepoPath('https://github.com/vuejs/core')).toEqual({
      owner: 'vuejs',
      repo: 'core',
      fullName: 'vuejs/core',
    });

    expect(parseGitHubRepoPath('https://api.github.com/repos/nuxt/nuxt')).toEqual({
      owner: 'nuxt',
      repo: 'nuxt',
      fullName: 'nuxt/nuxt',
    });
  });

  test('parses relative repository paths and rejects non-repo targets', () => {
    expect(parseGitHubRepoPath('owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
      fullName: 'owner/repo',
    });
    expect(parseGitHubRepoPath('/repos/owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
      fullName: 'owner/repo',
    });

    expect(parseGitHubRepoPath('https://github.com/owner/repo/issues/1')).toBeNull();
    expect(parseGitHubRepoPath('https://example.com/owner/repo')).toBeNull();
    expect(parseGitHubRepoPath(null)).toBeNull();
  });
});

describe('parseGitHubMarkdownTarget', () => {
  test('parses GitHub issue, pull request, and discussion targets', () => {
    expect(parseGitHubMarkdownTarget('https://github.com/owner/repo/issues/42')).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 42,
      type: 'issue',
    });

    expect(parseGitHubMarkdownTarget('https://api.github.com/repos/owner/repo/pulls/7')).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 7,
      type: 'pull-request',
    });

    expect(parseGitHubMarkdownTarget('https://github.com/owner/repo/discussions/9')).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 9,
      type: 'discussion',
    });
  });

  test('rejects unsupported hosts and invalid target numbers', () => {
    expect(parseGitHubMarkdownTarget('https://example.com/owner/repo/issues/42')).toBeNull();
    expect(parseGitHubMarkdownTarget('https://github.com/owner/repo/issues/0')).toBeNull();
    expect(parseGitHubMarkdownTarget('/owner/repo/issues/42')).toBeNull();
  });
});

describe('parseGitHubNotificationSubjectTarget', () => {
  test('keeps discussion notifications navigable but outside subject-state enrichment', () => {
    const target = parseGitHubNotificationSubjectTarget({
      type: 'Discussion',
      url: 'https://github.com/owner/repo/discussions/9',
    });

    expect(target).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 9,
      type: 'discussions',
    });
    expect(target && toNotificationSubjectStateTarget(target)).toBeNull();
  });

  test('converts issue and pull request notification targets for state enrichment', () => {
    const issueTarget = parseGitHubNotificationSubjectTarget({
      type: 'Issue',
      url: 'https://github.com/owner/repo/issues/42',
    });
    const pullTarget = parseGitHubNotificationSubjectTarget({
      type: 'PullRequest',
      url: 'https://github.com/owner/repo/pull/7',
    });

    expect(issueTarget && toNotificationSubjectStateTarget(issueTarget)).toEqual({
      key: 'owner/repo/issues/42',
      owner: 'owner',
      repo: 'repo',
      number: 42,
      type: 'issues',
    });
    expect(pullTarget && toNotificationSubjectStateTarget(pullTarget)).toEqual({
      key: 'owner/repo/pulls/7',
      owner: 'owner',
      repo: 'repo',
      number: 7,
      type: 'pulls',
    });
  });

  test('parses release notification targets without state enrichment', () => {
    const target = parseGitHubNotificationSubjectTarget({
      type: 'Release',
      url: 'https://api.github.com/repos/owner/repo/releases/123',
    });

    expect(target).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 123,
      type: 'releases',
    });
    expect(target && toNotificationSubjectStateTarget(target)).toBeNull();
  });
});

describe('markdown repository resources', () => {
  test('parses GitHub web and raw file URLs', () => {
    expect(
      parseMarkdownRepoResource('https://github.com/owner/repo/blob/main/docs/readme.md#intro')
    ).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      path: 'docs/readme.md',
      hash: '#intro',
    });

    expect(
      parseMarkdownRepoResource('https://raw.githubusercontent.com/owner/repo/main/assets/logo.png')
    ).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      path: 'assets/logo.png',
      hash: undefined,
    });
  });

  test('resolves repository-local paths from context', () => {
    expect(
      parseMarkdownRepoResource('./images/diagram.png', {
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
        basePath: 'docs/guide.md',
      })
    ).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      path: 'docs/images/diagram.png',
      hash: undefined,
    });
  });

  test('builds raw API URLs for parsed resources', () => {
    expect(
      buildRepoRawFileUrl({
        owner: 'owner',
        repo: 'repo',
        branch: 'feature/docs',
        path: 'docs/readme.md',
      })
    ).toBe('/api/repos/owner/repo/raw/docs/readme.md?ref=feature%2Fdocs');
  });
});

describe('parseDashboardUrlTarget', () => {
  test('parses pull request files URLs as PR diff targets', () => {
    expect(parseDashboardUrlTarget('https://github.com/owner/repo/pull/7/files#diff-abc')).toEqual({
      type: 'pull-request-review',
      owner: 'owner',
      repo: 'repo',
      number: 7,
      query: {
        prReview: 'owner/repo/7',
      },
      hash: '#diff-abc',
    });
  });

  test('parses pull request changes URLs as PR diff targets', () => {
    expect(
      parseDashboardUrlTarget('https://github.com/PCL-Community/PCL-CE/pull/3056/changes')
    ).toEqual({
      type: 'pull-request-review',
      owner: 'PCL-Community',
      repo: 'PCL-CE',
      number: 3056,
      query: {
        prReview: 'PCL-Community/PCL-CE/3056',
      },
      hash: undefined,
    });
  });

  test('parses release API URLs as release detail targets', () => {
    expect(parseDashboardUrlTarget('https://api.github.com/repos/owner/repo/releases/123')).toEqual(
      {
        type: 'release',
        owner: 'owner',
        repo: 'repo',
        releaseRef: {
          kind: 'id',
          id: 123,
        },
        query: {
          release: 'owner/repo/123',
        },
        hash: undefined,
      }
    );
  });

  test('parses release web tag URLs as release detail targets', () => {
    expect(parseDashboardUrlTarget('https://github.com/owner/repo/releases/tag/v1.2.3')).toEqual({
      type: 'release',
      owner: 'owner',
      repo: 'repo',
      releaseRef: {
        kind: 'tag',
        tag: 'v1.2.3',
      },
      query: {
        release: 'owner/repo',
        releaseTag: 'v1.2.3',
      },
      hash: undefined,
    });
  });

  test('keeps slash-delimited release tags intact', () => {
    expect(
      parseDashboardUrlTarget('https://github.com/owner/repo/releases/tag/release/2026.06')
    ).toMatchObject({
      releaseRef: {
        kind: 'tag',
        tag: 'release/2026.06',
      },
      query: {
        release: 'owner/repo',
        releaseTag: 'release/2026.06',
      },
    });
  });

  test('parses repository file URLs as dashboard file targets', () => {
    expect(parseDashboardUrlTarget('https://github.com/owner/repo/blob/main/src/app.vue')).toEqual({
      type: 'file',
      owner: 'owner',
      repo: 'repo',
      path: 'src/app.vue',
      branch: 'main',
      query: {
        repo: 'owner/repo',
        path: 'src/app.vue',
        branch: 'main',
      },
      hash: undefined,
    });
  });

  test('preserves markdown context branch for same-repo dashboard repo links', () => {
    expect(
      parseDashboardUrlTarget('https://github.com/owner/repo', {
        owner: 'owner',
        repo: 'repo',
        branch: 'feature/docs',
      })
    ).toEqual({
      type: 'repository',
      owner: 'owner',
      repo: 'repo',
      branch: 'feature/docs',
      query: {
        repo: 'owner/repo',
        branch: 'feature/docs',
      },
      hash: undefined,
    });
  });

  test('does not rewrite site-relative repo-shaped links without repo context', () => {
    expect(parseDashboardUrlTarget('/owner/repo')).toBeNull();
  });
});

describe('buildDashboardQueryFromNavigationEntry', () => {
  test('serializes pull request review navigation entries', () => {
    expect(
      buildDashboardQueryFromNavigationEntry({
        type: 'pull-request-review',
        data: {
          owner: 'owner',
          repo: 'repo',
          number: 7,
          tab: 'pulls',
        },
      })
    ).toEqual({
      tab: 'pulls',
      prReview: 'owner/repo/7',
    });
  });

  test('serializes release navigation entries', () => {
    expect(
      buildDashboardQueryFromNavigationEntry({
        type: 'release',
        data: {
          owner: 'owner',
          repo: 'repo',
          number: 123,
          releaseRef: {
            kind: 'id',
            id: 123,
          },
          tab: 'notifications',
        },
      })
    ).toEqual({
      tab: 'notifications',
      release: 'owner/repo/123',
    });
  });

  test('serializes release tag navigation entries', () => {
    expect(
      buildDashboardQueryFromNavigationEntry({
        type: 'release',
        data: {
          owner: 'owner',
          repo: 'repo',
          releaseRef: {
            kind: 'tag',
            tag: 'v1.2.3',
          },
          tab: 'notifications',
        },
      })
    ).toEqual({
      tab: 'notifications',
      release: 'owner/repo',
      releaseTag: 'v1.2.3',
    });
  });
});

describe('buildDashboardTabSwitchQuery', () => {
  test('resets query state when selecting a custom tab from the page', () => {
    expect(
      buildDashboardTabSwitchQuery('custom-tab-1', {
        currentQuery: {
          tab: 'issues',
          page: 3,
          f_repo: 'owner/repo',
          f_state: 'closed',
          repo: 'detail/repo',
          issue: 'detail/repo/12',
        },
        resetQuery: true,
      })
    ).toEqual({
      tab: 'custom-tab-1',
    });
  });

  test('preserves route filters for built-in tab switches', () => {
    expect(
      buildDashboardTabSwitchQuery('pulls', {
        currentQuery: {
          tab: 'issues',
          page: 3,
          f_repo: 'owner/repo',
          issue: 'detail/repo/12',
        },
      })
    ).toEqual({
      tab: 'pulls',
      page: undefined,
      f_repo: 'owner/repo',
      issue: undefined,
      pr: undefined,
      prReview: undefined,
      discussion: undefined,
      release: undefined,
      releaseTag: undefined,
      repo: undefined,
      path: undefined,
      branch: undefined,
      url: undefined,
    });
  });
});
