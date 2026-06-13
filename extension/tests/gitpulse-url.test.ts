import { describe, expect, test } from 'bun:test';

import { parseDashboardUrlTarget } from '../../app/utils/dashboard-url-navigation-utils';
import {
  DEFAULT_GITPULSE_BASE_URL,
  buildGitPulseUrl,
  isGithubWebUrl,
  normalizeGitPulseBaseUrl,
} from '../utils/gitpulse-url';

describe('normalizeGitPulseBaseUrl', () => {
  test('uses the default GitPulse URL for blank input', () => {
    expect(normalizeGitPulseBaseUrl('')).toBe(`${DEFAULT_GITPULSE_BASE_URL}/`);
  });

  test('normalizes host-only input to HTTPS', () => {
    expect(normalizeGitPulseBaseUrl('gitpulse.example.com')).toBe('https://gitpulse.example.com/');
  });

  test('drops credentials, search, and hash from base URLs', () => {
    expect(normalizeGitPulseBaseUrl('https://user:pass@gitpulse.example.com/app?x=1#top')).toBe(
      'https://gitpulse.example.com/app'
    );
  });

  test('allows HTTP only for local development URLs', () => {
    expect(normalizeGitPulseBaseUrl('http://localhost:3000')).toBe('http://localhost:3000/');
    expect(normalizeGitPulseBaseUrl('http://127.0.0.1:3000/app')).toBe('http://127.0.0.1:3000/app');
    expect(normalizeGitPulseBaseUrl('http://[::1]:3000')).toBe('http://[::1]:3000/');
  });

  test('rejects remote HTTP base URLs', () => {
    expect(() => normalizeGitPulseBaseUrl('http://gitpulse.example.com')).toThrow(
      'GitPulse URL must use HTTPS unless it points to localhost.'
    );
  });

  test('rejects unsupported protocols', () => {
    expect(() => normalizeGitPulseBaseUrl('ftp://gitpulse.example.com')).toThrow(
      'GitPulse URL must use HTTP or HTTPS.'
    );
  });
});

describe('isGithubWebUrl', () => {
  test('accepts GitHub web URLs', () => {
    expect(isGithubWebUrl('https://github.com/owner/repo/pull/1')).toBe(true);
    expect(isGithubWebUrl('https://www.github.com/owner/repo/pull/1')).toBe(true);
  });

  test('rejects non-GitHub and non-HTTPS URLs', () => {
    expect(isGithubWebUrl('https://example.com/owner/repo')).toBe(false);
    expect(isGithubWebUrl('http://github.com/owner/repo')).toBe(false);
  });
});

describe('buildGitPulseUrl', () => {
  test('builds dashboard URL with the current GitHub URL', () => {
    expect(
      buildGitPulseUrl('https://gitpulse.example.com', 'https://github.com/owner/repo/pull/7')
    ).toBe(
      'https://gitpulse.example.com/dashboard?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F7'
    );
  });

  test('keeps a configured deployment subpath', () => {
    expect(buildGitPulseUrl('https://example.com/gitpulse', 'https://github.com/owner/repo')).toBe(
      'https://example.com/gitpulse/dashboard?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo'
    );
  });

  test('does not duplicate dashboard when base points at dashboard', () => {
    expect(buildGitPulseUrl('https://example.com/dashboard', 'https://github.com/owner/repo')).toBe(
      'https://example.com/dashboard?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo'
    );
  });

  test('opens dashboard without url query outside GitHub', () => {
    expect(buildGitPulseUrl('https://gitpulse.example.com', 'https://example.com/owner/repo')).toBe(
      'https://gitpulse.example.com/dashboard'
    );
  });

  test('passes GitHub targets through the dashboard parser contract', () => {
    const gitPulseUrl = new URL(
      buildGitPulseUrl(
        'https://gitpulse.example.com',
        'https://github.com/owner/repo/pull/7/files#diff-abc'
      )
    );

    expect(gitPulseUrl.pathname).toBe('/dashboard');
    expect(parseDashboardUrlTarget(gitPulseUrl.searchParams.get('url'))).toEqual({
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
});
