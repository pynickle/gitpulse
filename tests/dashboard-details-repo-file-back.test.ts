import { describe, expect, mock, test } from 'bun:test';

import { nextTick, reactive, ref } from 'vue';

import type { RepositoryDetailPayload } from '../shared/types/repos';

const createPullRequestDetailViewModel =
  await import('../app/utils/createPullRequestDetailViewModel');
const dashboardUrlNavigationUtils = await import('../app/utils/dashboardUrlNavigationUtils');
const getQueryParamValue = await import('../app/utils/getQueryParamValue');
const parseGitHubRepoPath = await import('../app/utils/parseGitHubRepoPath');

mock.module('~/utils/createPullRequestDetailViewModel', () => createPullRequestDetailViewModel);
mock.module('~/utils/dashboardUrlNavigationUtils', () => dashboardUrlNavigationUtils);
mock.module('~/utils/getQueryParamValue', () => getQueryParamValue);
mock.module('~/utils/parseGitHubRepoPath', () => parseGitHubRepoPath);

const flush = async () => {
  for (let index = 0; index < 5; index += 1) {
    await nextTick();
    await Promise.resolve();
  }
};

const createRepository = (): RepositoryDetailPayload => ({
  id: 1,
  name: 'repo',
  default_branch: 'main',
  owner: {
    login: 'octo',
  },
});

describe('dashboard repository detail routing', () => {
  test('keeps repository detail data when returning from file browsing', async () => {
    const route = reactive({
      path: '/dashboard',
      query: {
        repo: 'octo/repo',
      } as Record<string, unknown>,
    });
    const currentEntry = ref(null);
    const repoRequests: string[] = [];

    const router = {
      push: mock(async (location: { query?: Record<string, unknown> }) => {
        if (location.query) {
          route.query = location.query;
        }
      }),
      replace: mock(async (location: { query?: Record<string, unknown> }) => {
        if (location.query) {
          route.query = location.query;
        }
      }),
    };

    Object.assign(globalThis, {
      useGitPulseApiFetch: () => async (url: string) => {
        if (url === '/api/repos/octo/repo') {
          repoRequests.push(url);
          return createRepository();
        }

        throw new Error(`Unexpected request: ${url}`);
      },
      useGitHubLinkRouting: () => ({
        opensGitHubLinks: ref(false),
        openGitHubTarget: mock(),
      }),
      useLocalePath: () => (value: string | { path: string }) =>
        typeof value === 'string' ? value : value.path,
      useNavigationHistory: () => ({
        currentEntry,
        goBack: () => null,
        goToHome: mock(),
        navigateToDiscussion: mock(),
        navigateToIssue: mock(),
        navigateToPullRequest: mock(),
        navigateToPullRequestReview: mock(),
        navigateToRepo: mock(),
        navigateToRelease: mock(),
        replaceWithEntry: (entry: unknown) => {
          currentEntry.value = entry;
        },
      }),
      useRoute: () => route,
      useRouter: () => router,
      useUrlHelper: () => ({
        getNotificationDetails: mock(),
        openExternalNotification: mock(),
      }),
      useUserSession: () => ({
        loggedIn: ref(true),
        ready: ref(true),
      }),
    });

    const { useDashboardDetails } = await import('../app/composables/useDashboardDetails');
    const details = useDashboardDetails(ref('repos'));

    await flush();

    expect(details.currentRepo.value?.name).toBe('repo');
    expect(details.isRepoDetailVisible.value).toBe(true);
    expect(repoRequests).toHaveLength(1);

    route.query = {
      repo: 'octo/repo',
      path: 'src/index.ts',
    };
    await flush();

    expect(details.currentRepo.value?.name).toBe('repo');
    expect(details.isRepoDetailVisible.value).toBe(false);
    expect(details.hasVisibleDetail.value).toBe(false);

    route.query = {
      repo: 'octo/repo',
    };
    await flush();

    expect(details.currentRepo.value?.name).toBe('repo');
    expect(details.isRepoDetailVisible.value).toBe(true);
    expect(details.loadingRepo.value).toBe(false);
    expect(repoRequests).toHaveLength(1);
  });
});
