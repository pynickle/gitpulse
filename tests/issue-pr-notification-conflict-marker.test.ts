import { afterEach, beforeEach, expect, mock, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import { getDashboardSubjectStateVisual } from '../app/utils/getDashboardSubjectStateVisual';
import { parseGitHubRepoPath } from '../app/utils/parseGitHubRepoPath';
import * as linkedPullRequests from '../shared/utils/linked-pull-requests';
import * as prChecks from '../shared/utils/pr-checks';
import * as pullRequestConflicts from '../shared/utils/pull-request-conflicts';
import * as subIssues from '../shared/utils/sub-issues';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

mock.module('#shared/utils/linked-pull-requests', () => linkedPullRequests);
mock.module('#shared/utils/pr-checks', () => prChecks);
mock.module('#shared/utils/pull-request-conflicts', () => pullRequestConflicts);
mock.module('#shared/utils/sub-issues', () => subIssues);

const { toDashboardIssuePrCard } = await import('../app/utils/dashboardIssuePrCard');

const icon = defineComponent({ setup: () => () => h('svg') });
const stub = defineComponent({ setup: () => () => h('div') });

const PullRequestConflictMarker = await compileVue(
  'app/components/dashboard/pr/PullRequestConflictMarker.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }),
    'virtual:app-runtime': {
      useI18n: () => ({ t: (key: string) => key, locale: shallowRef('en') }),
    },
  },
  { useI18n: 'virtual:app-runtime' }
);

const IssuePrNotificationItem = await compileVue(
  'app/components/dashboard/IssuePrNotificationItem.vue',
  {
    '@lucide/vue': new Proxy({}, { get: () => icon }),
    '#shared/utils/linked-pull-requests': linkedPullRequests,
    '#shared/utils/pr-checks': prChecks,
    '#shared/utils/sub-issues': subIssues,
    '~/components/dashboard/issue/IssueTypeBadge.vue': { default: stub },
    '~/components/dashboard/issue/SubIssueProgressControl.vue': { default: stub },
    '~/components/dashboard/LinkedPullRequestCountControl.vue': { default: stub },
    '~/components/dashboard/pr/CheckStatusChip.vue': { default: stub },
    '~/components/dashboard/pr/PullRequestConflictMarker.vue': {
      default: PullRequestConflictMarker,
    },
    '~/components/ui/GitHubAvatar.vue': { default: stub },
    '~/utils/dashboardIssuePrCard': { toDashboardIssuePrCard },
    '~/utils/getDashboardSubjectStateVisual': { getDashboardSubjectStateVisual },
    'virtual:app-runtime': {
      useI18n: () => ({ t: (key: string) => key, locale: shallowRef('en') }),
      useCheckListModal: () => ({ open: () => {} }),
      useRelativeTimeNow: () => shallowRef(new Date().toISOString()),
    },
    'virtual:formatters': {
      formatDurationFromNow: () => '3 hours ago',
      formatCompactNumber: (value: number) => String(value),
      parseGitHubRepoPath,
    },
  },
  {
    useI18n: 'virtual:app-runtime',
    useCheckListModal: 'virtual:app-runtime',
    useRelativeTimeNow: 'virtual:app-runtime',
    formatDurationFromNow: 'virtual:formatters',
    formatCompactNumber: 'virtual:formatters',
    parseGitHubRepoPath: 'virtual:formatters',
  }
);

let dom: ReturnType<typeof createVueDom>;

beforeEach(() => {
  dom = createVueDom();
});

afterEach(async () => {
  await dom.cleanup();
});

const mountCard = (item: Record<string, unknown>) =>
  dom.mount(
    defineComponent({
      setup: () => () => h(IssuePrNotificationItem as never, { item }),
    })
  );

test('an open conflicting pull request card keeps the marker after the title', async () => {
  const title = 'Resolve the conflicts in this pull request before the row runs out of width';
  const { root } = mountCard({
    id: 1,
    title,
    state: 'open',
    number: 8,
    repository_url: 'https://api.github.com/repos/acme/widgets',
    pull_request: {},
    mergeable: 'CONFLICTING',
  });
  await nextTick();

  const subject = root.querySelector('.dashboard-list-card__subject');
  const text = subject?.querySelector('.dashboard-list-card__subject-text');
  const marker = subject?.querySelector('.pr-conflict-marker');

  expect(subject?.classList.contains('dashboard-list-card__subject--with-conflict')).toBe(true);
  expect(text?.textContent).toBe(title);
  expect(text?.nextElementSibling).toBe(marker);
  expect(text?.contains(marker ?? null)).toBe(false);
  expect(marker?.getAttribute('aria-label')).toBe('dashboard.pullRequestConflicts');
});

test('an issue card never shows the conflict marker', async () => {
  const { root } = mountCard({
    id: 2,
    title: 'An issue',
    state: 'open',
    mergeable: 'CONFLICTING',
  });
  await nextTick();

  expect(root.querySelector('.pr-conflict-marker')).toBeNull();
  expect(
    root
      .querySelector('.dashboard-list-card__subject')
      ?.classList.contains('dashboard-list-card__subject--with-conflict')
  ).toBe(false);
});
