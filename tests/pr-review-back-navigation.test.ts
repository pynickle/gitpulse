import { describe, expect, mock, test } from 'bun:test';

import { nextTick, reactive, ref } from 'vue';

const createPullRequestDetailViewModel =
  await import('../app/utils/createPullRequestDetailViewModel');
const dashboardUrlNavigationUtils = await import('../app/utils/dashboardUrlNavigationUtils');
const getQueryParamValue = await import('../app/utils/getQueryParamValue');
const parseGitHubRepoPath = await import('../app/utils/parseGitHubRepoPath');

mock.module('~/utils/createPullRequestDetailViewModel', () => createPullRequestDetailViewModel);
mock.module('~/utils/dashboardUrlNavigationUtils', () => dashboardUrlNavigationUtils);
mock.module('~/utils/getQueryParamValue', () => getQueryParamValue);
mock.module('~/utils/parseGitHubRepoPath', () => parseGitHubRepoPath);

const { useDashboardDetails } = await import('../app/composables/useDashboardDetails');

const flush = async () => {
  for (let index = 0; index < 5; index += 1) {
    await nextTick();
    await Promise.resolve();
  }
};

const pullRequestPayload = {
  number: 42,
  title: 'Add a widget',
  head: { sha: 'abc123' },
  base: { repo: { owner: { login: 'octo' }, name: 'repo' } },
};

const createDashboard = async (query: Record<string, unknown>, canGoBack = false) => {
  const route = reactive({ path: '/dashboard', query });
  const pushed: Array<{ path: string; query: Record<string, unknown> }> = [];
  const router = {
    push: mock(async (location: { path: string; query: Record<string, unknown> }) => {
      pushed.push(location);
    }),
    replace: mock(async () => {}),
  };
  const navigation = {
    canGoBack: ref(canGoBack),
    goBackToPreviousPage: mock(async () => {}),
    goToDashboardHome: mock(async () => {}),
  };

  Object.assign(globalThis, {
    useI18n: () => ({ t: (key: string) => key }),
    useGitPulseApiFetch: () => async (url: string) => {
      if (url === '/api/pulls/octo/repo/42') {
        return pullRequestPayload;
      }

      throw new Error(`Unexpected request: ${url}`);
    },
    useGitHubLinkRouting: () => ({ opensGitHubLinks: ref(false), openGitHubTarget: mock() }),
    useLocalePath: () => (value: string | { path: string }) =>
      typeof value === 'string' ? value : value.path,
    useNavigationRouting: () => navigation,
    useRoute: () => route,
    useRouter: () => router,
    useUrlHelper: () => ({ getNotificationDetails: mock(), openExternalNotification: mock() }),
    useUserSession: () => ({ loggedIn: ref(true), ready: ref(true) }),
    getFetchErrorMessage: (_error: unknown, fallback: string) => fallback,
  });

  const details = useDashboardDetails(ref('pulls'));
  await flush();

  return { details, navigation, pushed };
};

describe('PR review workspace back navigation', () => {
  test('closing the review returns to the pull request it belongs to', async () => {
    const { details, pushed } = await createDashboard({
      tab: 'pulls',
      prReview: 'octo/repo/42',
    });

    await details.handlePRReviewClose();

    expect(pushed).toEqual([{ path: '/dashboard', query: { tab: 'pulls', pr: 'octo/repo/42' } }]);
  });

  test('closing a review opened without a prReview query keeps the pull request on screen', async () => {
    const { details, pushed } = await createDashboard({
      tab: 'pulls',
      pr: 'octo/repo/42',
    });

    await details.handlePRReviewClose();

    expect(pushed).toEqual([{ path: '/dashboard', query: { tab: 'pulls', pr: 'octo/repo/42' } }]);
  });

  test('detail Back on a review route with no history returns to the pull request', async () => {
    const { details, navigation, pushed } = await createDashboard({
      tab: 'pulls',
      prReview: 'octo/repo/42',
    });

    await details.handleDetailBack();

    expect(pushed).toEqual([{ path: '/dashboard', query: { tab: 'pulls', pr: 'octo/repo/42' } }]);
    expect(navigation.goBackToPreviousPage).not.toHaveBeenCalled();
  });

  test('detail Back still follows the logical history when the review route has one', async () => {
    const { details, navigation, pushed } = await createDashboard(
      { tab: 'pulls', prReview: 'octo/repo/42' },
      true
    );

    await details.handleDetailBack();

    expect(navigation.goBackToPreviousPage).toHaveBeenCalledTimes(1);
    expect(pushed).toEqual([]);
  });
});
