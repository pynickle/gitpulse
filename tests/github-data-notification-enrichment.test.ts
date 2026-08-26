import { describe, expect, mock, test } from 'bun:test';

import parseGitHubNotificationSubjectTarget from '../app/utils/parseGitHubNotificationSubjectTarget';
import type { DashboardNotification } from '../shared/types/notifications';
import * as linkedPullRequests from '../shared/utils/linked-pull-requests';
import { InMemoryNotificationSubjectEnrichmentAdapter } from './support/inMemoryNotificationSubjectEnrichmentAdapter';

const githubSearchQueryUtils = await import('../shared/utils/github-search-query');
const dashboardFilters = await import('../app/composables/useDashboardFilters');

mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);
mock.module('#shared/utils/github-search-query', () => githubSearchQueryUtils);
mock.module('~/composables/useDashboardFilters', () => dashboardFilters);

const { createNotificationSubjectEnrichmentSession } =
  await import('../app/composables/notification-subject-enrichment/session');

const { useGithubData } = await import('../app/composables/useGithubData');

const notification = (
  id: string,
  number: number,
  title = `Raw ${number}`
): DashboardNotification => ({
  id,
  unread: false,
  subject: {
    title,
    type: 'Issue',
    url: `https://api.github.com/repos/acme/widgets/issues/${number}`,
  },
});

const pageResponse = (items: DashboardNotification[], page = 1, hasNext = false) => ({
  items,
  pagination: {
    page,
    perPage: 20,
    hasPrev: page > 1,
    hasNext,
    totalCount: null,
    totalPages: null,
  },
});

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const configureComposition = (
  apiFetch: (url: string, options?: Record<string, unknown>) => Promise<unknown>,
  adapter: InMemoryNotificationSubjectEnrichmentAdapter
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
      adapter,
      parseSubject: parseGitHubNotificationSubjectTarget,
    });
};

describe('useGithubData Notification Subject Enrichment integration', () => {
  test('applies immediate and completed values to an ordinary Notifications page', async () => {
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter();
    configureComposition(async () => pageResponse([notification('one', 1)]), adapter);
    const githubData = useGithubData();

    await githubData.fetchNotifications();
    await flushPromises();

    expect(githubData.notifications.value[0]?.subject).toMatchObject({
      title: 'Raw 1',
      stateStatus: 'pending',
    });
    adapter.pending[0]?.resolve([
      {
        key: 'acme/widgets/issues/1',
        title: 'Current 1',
        state: 'open',
      },
    ]);
    await flushPromises();

    expect(githubData.notifications.value[0]?.subject).toMatchObject({
      title: 'Current 1',
      stateStatus: 'loaded',
    });
    expect(githubData.notificationSubjectEnrichmentError.value).toBe(false);
  });

  test('does not display or cache a stale ordinary-page completion', async () => {
    let primaryRequest = 0;
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter();
    configureComposition(async () => {
      primaryRequest += 1;
      return pageResponse([notification('one', 1, `Raw version ${primaryRequest}`)]);
    }, adapter);
    const githubData = useGithubData();

    await githubData.fetchNotifications();
    await flushPromises();
    await githubData.fetchNotifications(1, { force: true });
    await flushPromises();

    adapter.pending[0]?.resolve([
      {
        key: 'acme/widgets/issues/1',
        title: 'Stale result',
        state: 'closed',
      },
    ]);
    await flushPromises();
    expect(githubData.notifications.value[0]?.subject).toMatchObject({
      title: 'Raw version 2',
      stateStatus: 'pending',
    });

    adapter.pending[1]?.resolve([
      {
        key: 'acme/widgets/issues/1',
        title: 'Current result',
        state: 'open',
      },
    ]);
    await flushPromises();
    expect(githubData.notifications.value[0]?.subject?.title).toBe('Current result');
  });

  test('starts a new enrichment run when the current list is retried', async () => {
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter();
    configureComposition(async () => pageResponse([notification('one', 1)]), adapter);
    const githubData = useGithubData();

    await githubData.fetchNotifications();
    await flushPromises();
    expect(adapter.pending).toHaveLength(1);

    await githubData.retryNotificationSubjectEnrichment();
    await flushPromises();

    expect(adapter.pending).toHaveLength(2);
    expect(githubData.notifications.value[0]?.subject?.stateStatus).toBe('pending');
  });

  test('does not roll back a read-state change when enrichment completes', async () => {
    const rawNotification = notification('one', 1);
    rawNotification.unread = true;
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter();
    configureComposition(async (_url, options) => {
      return options?.method === 'PATCH' ? {} : pageResponse([rawNotification]);
    }, adapter);
    const githubData = useGithubData();

    await githubData.fetchNotifications();
    await flushPromises();
    const pendingNotification = githubData.notifications.value[0];
    if (!pendingNotification) throw new Error('Expected pending Notification');
    expect(await githubData.markNotificationAsRead(pendingNotification)).toBe(true);
    expect(githubData.notifications.value[0]?.unread).toBe(false);

    adapter.pending[0]?.resolve([
      {
        key: 'acme/widgets/issues/1',
        title: 'Current title',
        state: 'open',
      },
    ]);
    await flushPromises();

    expect(githubData.notifications.value[0]?.unread).toBe(false);
    expect(githubData.notifications.value[0]?.subject?.title).toBe('Current title');
  });

  test('enriches parallel filtered raw pages as one ordered input', async () => {
    let resolveBatch:
      | ((value: Array<{ key: string; title: string; state: 'open' }>) => void)
      | null = null;
    const adapter = new InMemoryNotificationSubjectEnrichmentAdapter((targets) => {
      if (targets.length !== 3) {
        throw new Error('Expected one logical three-target enrichment run');
      }

      return new Promise((resolve) => {
        resolveBatch = resolve;
      });
    });
    configureComposition(async (url) => {
      const page = Number(new URL(url, 'https://gitpulse.local').searchParams.get('page'));
      return pageResponse([notification(`issue-${page}`, page)], page, false);
    }, adapter);
    const githubData = useGithubData();

    await githubData.fetchNotifications(1, {
      notificationFilters: { readState: 'read' },
    });
    await flushPromises();

    expect(githubData.notifications.value.map((item) => item.subject?.stateStatus)).toEqual([
      'pending',
      'pending',
      'pending',
    ]);
    resolveBatch?.(
      [1, 2, 3].map((number) => ({
        key: `acme/widgets/issues/${number}`,
        title: `Current ${number}`,
        state: 'open' as const,
      }))
    );
    await flushPromises();

    expect(githubData.notifications.value.map((item) => item.subject?.title)).toEqual([
      'Current 1',
      'Current 2',
      'Current 3',
    ]);
  });
});
