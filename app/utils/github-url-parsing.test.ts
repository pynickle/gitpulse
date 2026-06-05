import { describe, expect, test } from 'bun:test';

import { buildRepoRawFileUrl, parseMarkdownRepoResource } from './markdown-repo-path-utils';
import parseGitHubMarkdownTarget from './parseGitHubMarkdownTarget';
import parseGitHubRepoPath from './parseGitHubRepoPath';

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
  test('parses GitHub issue and pull request targets', () => {
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
  });

  test('rejects unsupported hosts and invalid target numbers', () => {
    expect(parseGitHubMarkdownTarget('https://example.com/owner/repo/issues/42')).toBeNull();
    expect(parseGitHubMarkdownTarget('https://github.com/owner/repo/issues/0')).toBeNull();
    expect(parseGitHubMarkdownTarget('/owner/repo/issues/42')).toBeNull();
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
