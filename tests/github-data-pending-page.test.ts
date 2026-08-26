import { describe, expect, mock, test } from 'bun:test';

import parseGitHubNotificationSubjectTarget from '../app/utils/parseGitHubNotificationSubjectTarget';
import * as linkedPullRequests from '../shared/utils/linked-pull-requests';
import { InMemoryNotificationSubjectEnrichmentAdapter } from './support/inMemoryNotificationSubjectEnrichmentAdapter';

const githubSearchQueryUtils = await import('../shared/utils/github-search-query');
const dashboardFilters = await import('../app/composables/useDashboardFilters');
const pendingPaginationPage = await import('../app/utils/withPendingPaginationPage');

mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);
mock.module('#shared/utils/github-search-query', () => githubSearchQueryUtils);
mock.module('~/composables/useDashboardFilters', () => dashboardFilters);
mock.module('~/utils/withPendingPaginationPage', () => pendingPaginationPage);

const { createNotificationSubjectEnrichmentSession } =
  await import('../app/composables/notification-subject-enrichment/session');

const { useGithubData } = await import('../app/composables/useGithubData');

const issuesPage = (page: number, hasNext = false) => ({
  items: [{ id: page, title: `Issue ${page}` }],
  total_count: 40,
  pagination: {
    page,
    perPage: 20,
    hasPrev: page > 1,
    hasNext,
    totalCount: 40,
    totalPages: 2,
  },
});

const configureComposition = (
  apiFetch: (url: string, options?: Record<string, unknown>) => Promise<unknown>
) => {
  (
    globalThis as unknown as {
      useGitPulseApiFetch: typeof useGitPulseApiFetch;
    }
  ).useGitPulseApiFetch = () => apiFetch as ReturnType<typeof useGitPulseApiFetch>;
  (
    globalThis as unknown as {
      useNotificationSubjectEnrichment: typeof useNotificationSubjectEnrichment;
    }
  ).useNotificationSubjectEnrichment = () =>
    createNotificationSubjectEnrichmentSession({
      adapter: new InMemoryNotificationSubjectEnrichmentAdapter(),
      parseSubject: parseGitHubNotificationSubjectTarget,
    });
};

describe('useGithubData pending pagination page', () => {
  test('jumps to the requested issues page and starts loading before the response arrives', async () => {
    let resolvePageTwo: ((value: ReturnType<typeof issuesPage>) => void) | undefined;
    const pageTwo = new Promise<ReturnType<typeof issuesPage>>((resolve) => {
      resolvePageTwo = resolve;
    });
    let calls = 0;

    configureComposition(async () => {
      calls += 1;
      if (calls === 1) {
        return issuesPage(1, true);
      }
      return pageTwo;
    });

    const githubData = useGithubData();
    await githubData.fetchIssues(1);

    expect(githubData.loading.value).toBe(false);
    expect(githubData.pagination.value.issues.page).toBe(1);
    expect(githubData.issues.value[0]).toMatchObject({ id: 1 });

    const pending = githubData.fetchIssues(2);

    expect(githubData.loading.value).toBe(true);
    expect(githubData.pagination.value.issues).toMatchObject({
      page: 2,
      hasPrev: true,
      hasNext: false,
    });

    resolvePageTwo?.(issuesPage(2));
    await pending;

    expect(githubData.loading.value).toBe(false);
    expect(githubData.issues.value[0]).toMatchObject({ id: 2 });
    expect(githubData.pagination.value.issues.page).toBe(2);
  });
});
