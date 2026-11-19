import { afterEach, expect, test } from 'bun:test';

import * as icons from '@lucide/vue';
import { defineComponent, h, nextTick, shallowRef } from 'vue';

import {
  getIssueStatePillClass,
  getIssueStateVisual,
} from '../app/utils/getDashboardSubjectStateVisual';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const stub = defineComponent({ setup: () => () => h('div') });
const IssueHeader = await compileVue(
  'app/components/dashboard/issue/IssueHeader.vue',
  {
    '@lucide/vue': icons,
    '~/components/dashboard/reactions/ReactionBar.vue': { default: stub },
    '~/components/ui/GitHubAvatar.vue': { default: stub },
    '~/components/ui/GitHubProfileLink.vue': { default: stub },
    '~/components/ui/MarkdownRenderer.vue': { default: stub },
    '~/utils/getDashboardSubjectStateVisual': { getIssueStatePillClass, getIssueStateVisual },
    'vue-i18n': {
      useI18n: () => ({
        t: (key: string) => (key === 'issueDetail.completed' ? 'Completed' : key),
        locale: shallowRef('en'),
      }),
    },
    'virtual:issue-header': {
      useDashboardRepositoryNavigation: () => ({ openRepository: async () => {} }),
      useRelativeTimeNow: () => shallowRef(0),
      formatDurationFromNow: () => '',
    },
  },
  {
    useDashboardRepositoryNavigation: 'virtual:issue-header',
    useRelativeTimeNow: 'virtual:issue-header',
    formatDurationFromNow: 'virtual:issue-header',
  }
);

let dom: ReturnType<typeof createVueDom> | undefined;

afterEach(async () => {
  await dom?.cleanup();
  dom = undefined;
});

test('shows the completed icon and returns to the open icon after reopening', async () => {
  dom = createVueDom();
  const issue = shallowRef({ title: 'Issue', state: 'closed', state_reason: 'completed' });
  const { root } = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueHeader, { issue: issue.value, repoOwner: 'acme', repoName: 'repo' }),
    })
  );
  expect(root.querySelector('.header-title svg.lucide-circle-check')).not.toBeNull();
  expect((root.querySelector('.header-title svg') as SVGElement).style.color).toBe(
    'var(--gitpulse-purple)'
  );
  expect((root.querySelector('.header-state-tag svg') as SVGElement).style.color).toBe(
    'var(--gitpulse-purple)'
  );
  expect(root.querySelector('.header-state-tag')?.textContent).toContain('closed');
  expect(root.querySelector('.header-state-tag')?.classList.contains('is-completed')).toBe(true);
  expect(root.querySelector('.header-state-tag')?.classList.contains('is-closed')).toBe(false);

  issue.value = { ...issue.value, state: 'open', state_reason: null };
  await nextTick();

  expect(root.querySelector('.header-title svg.lucide-circle-dot')).not.toBeNull();
  expect(root.querySelector('.header-state-tag')?.textContent).toContain('open');
});

test('paints a closed issue that was not completed with the closed pill', () => {
  dom = createVueDom();
  const { root } = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueHeader, {
          issue: { title: 'Issue', state: 'closed', state_reason: 'not_planned' },
          repoOwner: 'acme',
          repoName: 'repo',
        }),
    })
  );

  expect(root.querySelector('.header-title svg.lucide-circle-minus')).not.toBeNull();
  expect(root.querySelector('.header-state-tag')?.classList.contains('is-closed')).toBe(true);
  expect(root.querySelector('.header-state-tag')?.classList.contains('is-completed')).toBe(false);
});
