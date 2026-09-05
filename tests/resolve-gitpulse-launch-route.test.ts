import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { parseDashboardUrlTarget } from '../app/utils/dashboardUrlNavigationUtils';
import { resolveNavigationEntryRoute } from '../app/utils/navigationEntryRouting';
import resolveGitPulseLaunchRoute from '../app/utils/resolveGitPulseLaunchRoute';

const globals = globalThis as unknown as Record<string, unknown>;
const originals = {
  parseDashboardUrlTarget: globals.parseDashboardUrlTarget,
  resolveNavigationEntryRoute: globals.resolveNavigationEntryRoute,
};

beforeAll(() => Object.assign(globals, { parseDashboardUrlTarget, resolveNavigationEntryRoute }));
afterAll(() => Object.assign(globals, originals));

describe('resolveGitPulseLaunchRoute', () => {
  test.each([
    ['https://github.com/octo/widgets/issues', '/dashboard'],
    ['https://github.com/octo/widgets/pulls?state=closed', '/dashboard'],
    ['https://github.com/octo/widgets/commits/main', '/dashboard'],
    ['https://github.com/octo/widgets/branches', '/dashboard/branches'],
    ['https://github.com/octo/widgets/releases', '/dashboard/releases'],
    ['https://github.com/octo/widgets/graphs/contributors', '/dashboard/contributors'],
    ['https://github.com/octo/widgets/wiki/Setup', '/dashboard/wiki'],
    ['https://github.com/octo', '/dashboard/profile'],
    ['https://github.com/octo?tab=stars', '/dashboard/starred'],
    ['https://github.com/users/octo/packages/container/widgets', '/dashboard/package'],
  ])('maps %s to %s', (githubUrl, path) => {
    expect(resolveGitPulseLaunchRoute(githubUrl)?.path).toBe(path);
  });

  test('maps issue and pull request detail URLs to dashboard queries', () => {
    expect(resolveGitPulseLaunchRoute('https://github.com/octo/widgets/issues/42')).toEqual({
      path: '/dashboard',
      query: { issue: 'octo/widgets/42' },
      hash: undefined,
    });

    expect(
      resolveGitPulseLaunchRoute('https://github.com/octo/widgets/pull/7/files#diff-1')
    ).toEqual({
      path: '/dashboard',
      query: { prReview: 'octo/widgets/7' },
      hash: '#diff-1',
    });
  });

  test('keeps list and child-page parameters in the resolved route', () => {
    expect(
      resolveGitPulseLaunchRoute('https://github.com/octo/widgets/issues?state=closed')
    ).toEqual({
      path: '/dashboard',
      query: {
        tab: 'repos',
        repo: 'octo/widgets',
        branch: undefined,
        section: 'issues',
        repoPage: undefined,
        repoState: 'closed',
      },
      hash: undefined,
    });

    expect(resolveGitPulseLaunchRoute('https://github.com/octo/widgets/wiki/Setup')).toEqual({
      path: '/dashboard/wiki',
      query: { repo: 'octo/widgets', page: 'Setup' },
      hash: undefined,
    });

    expect(resolveGitPulseLaunchRoute('https://github.com/orgs/octo/packages')).toEqual({
      path: '/dashboard/profile',
      query: { user: 'octo', tab: 'packages' },
      hash: undefined,
    });
  });

  test('keeps branch roots and package identity including encoded slashes', () => {
    expect(
      resolveGitPulseLaunchRoute('https://github.com/octo/widgets/tree/feature%2Ftopic')
    ).toMatchObject({
      path: '/dashboard',
      query: { repo: 'octo/widgets', path: '', branch: 'feature/topic' },
    });
    expect(
      resolveGitPulseLaunchRoute('https://github.com/orgs/octo/packages/container/team%2Fwidgets')
    ).toEqual({
      path: '/dashboard/package',
      query: { user: 'octo', type: 'container', name: 'team/widgets', account: 'organization' },
      hash: undefined,
    });
  });

  test('rejects GitHub pages without a GitPulse equivalent', () => {
    expect(resolveGitPulseLaunchRoute('https://github.com/octo/widgets/actions')).toBeNull();
    expect(resolveGitPulseLaunchRoute('https://github.com/octo/widgets/commit/abc123')).toBeNull();
    expect(resolveGitPulseLaunchRoute('https://github.com/settings')).toBeNull();
    expect(resolveGitPulseLaunchRoute('https://github.com/octo/widgets/tags')).toBeNull();
    expect(
      resolveGitPulseLaunchRoute('https://github.com/octo/widgets/wiki/Setup/_edit')
    ).toBeNull();
    expect(
      resolveGitPulseLaunchRoute('https://github.com/octo/widgets/commits/main/src/app.ts')
    ).toBeNull();
    expect(resolveGitPulseLaunchRoute('https://evil.example/octo/widgets')).toBeNull();
  });
});
