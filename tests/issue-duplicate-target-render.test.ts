import { afterEach, expect, test } from 'bun:test';

import * as icons from '@lucide/vue';
import { computed, defineComponent, h, nextTick, shallowRef } from 'vue';

import {
  getIssueStatePillClass,
  getIssueStateVisual,
} from '../app/utils/getDashboardSubjectStateVisual';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const stub = defineComponent({ setup: () => () => h('span') });
const i18n = { useI18n: () => ({ t: (key: string) => key, locale: shallowRef('en') }) };
const autoImports = {
  computed,
  useDashboardRepositoryNavigation: () => ({ openRepository: async () => {} }),
  useRelativeTimeNow: () => shallowRef(0),
  formatDurationFromNow: () => '',
};
const headerAutoImports = {
  useDashboardRepositoryNavigation: 'virtual:auto-imports',
  useRelativeTimeNow: 'virtual:auto-imports',
  formatDurationFromNow: 'virtual:auto-imports',
};

const ReferenceSubject = await compileVue(
  'app/components/dashboard/timeline/ReferenceSubject.vue',
  { 'vue-i18n': i18n, 'virtual:auto-imports': autoImports },
  { computed: 'virtual:auto-imports' }
);

const IssueHeader = await compileVue(
  'app/components/dashboard/issue/IssueHeader.vue',
  {
    '@lucide/vue': icons,
    '~/components/dashboard/reactions/ReactionBar.vue': { default: stub },
    '~/components/dashboard/timeline/ReferenceSubject.vue': { default: ReferenceSubject },
    '~/components/ui/GitHubAvatar.vue': { default: stub },
    '~/components/ui/GitHubProfileLink.vue': { default: stub },
    '~/components/ui/MarkdownRenderer.vue': { default: stub },
    '~/utils/getDashboardSubjectStateVisual': { getIssueStatePillClass, getIssueStateVisual },
    'vue-i18n': i18n,
    'virtual:auto-imports': autoImports,
  },
  headerAutoImports
);

const IssueTimelineReferenceEvents = await compileVue(
  'app/components/dashboard/issue/IssueTimelineReferenceEvents.vue',
  { '~/components/dashboard/timeline/ReferenceSubject.vue': { default: ReferenceSubject } }
);

const IssueTimelineEventBody = await compileVue(
  'app/components/dashboard/issue/IssueTimelineEventBody.vue',
  {
    'vue-i18n': i18n,
    '~/components/dashboard/issue/IssueTimelineReferenceEvents.vue': {
      default: IssueTimelineReferenceEvents,
    },
    '~/components/dashboard/issue/IssueTimelineStateEvents.vue': {
      default: defineComponent({ setup: () => () => h('span', 'state-event') }),
    },
    '~/components/dashboard/timeline/TimelineUnavailableEvent.vue': { default: stub },
    '~/components/ui/GitHubProfileLink.vue': { default: stub },
    '~/utils/formatDurationFromNow': { formatDurationFromNow: () => '' },
    'virtual:auto-imports': autoImports,
  },
  { useRelativeTimeNow: 'virtual:auto-imports' }
);

// The GitHub-shaped Duplicate Target the issue detail and timeline APIs return.
const duplicateOf = {
  resourceType: 'issue',
  number: 42,
  title: 'Original report',
  url: 'https://github.com/other/lib/issues/42',
  state: 'open',
  repository: { name: 'lib', nameWithOwner: 'other/lib', owner: { login: 'other' } },
};

let dom: ReturnType<typeof createVueDom> | undefined;
afterEach(async () => {
  await dom?.cleanup();
  dom = undefined;
});

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

test('a closed duplicate Issue names its cross-repository Duplicate Target and opens it', async () => {
  dom = createVueDom();
  const switches: unknown[][] = [];
  const { root } = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueHeader, {
          issue: {
            title: 'Login broken',
            state: 'closed',
            state_reason: 'duplicate',
            duplicate_of: duplicateOf,
          },
          repoOwner: 'acme',
          repoName: 'widgets',
          onSwitchIssue: (...args: unknown[]) => switches.push(args),
        }),
    })
  );

  const notice = root.querySelector('[data-duplicate-target]');
  expect(text(notice)).toStartWith('issueDetail.duplicateOf');
  expect(text(notice)).toContain('other/lib timeline.issueType #42');
  expect(text(notice)).toContain('Original report');

  (notice!.querySelector('a') as HTMLElement).click();
  await nextTick();
  expect(switches).toEqual([['other', 'lib', 42]]);
});

test('an Issue without a Duplicate Target shows no duplicate notice', () => {
  dom = createVueDom();
  const { root } = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueHeader, {
          issue: { title: 'Declined', state: 'closed', state_reason: 'not_planned' },
          repoOwner: 'acme',
          repoName: 'widgets',
        }),
    })
  );

  expect(root.querySelector('[data-duplicate-target]')).toBeNull();
});

test('the timeline close event links to its cross-repository Duplicate Target', async () => {
  dom = createVueDom();
  const switches: unknown[][] = [];
  const { root } = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueTimelineEventBody, {
          item: {
            kind: 'event',
            eventType: 'closed',
            stateReason: 'duplicate',
            duplicate: duplicateOf,
            renderKey: 'closed-1',
          },
          repoOwner: 'acme',
          repoName: 'widgets',
          onSwitchIssue: (...args: unknown[]) => switches.push(args),
        }),
    })
  );

  expect(text(root)).toStartWith('closed this as a duplicate of');
  expect(text(root)).toContain('other/lib timeline.issueType #42');
  expect(text(root)).toContain('Original report');
  (root.querySelector('a') as HTMLElement).click();
  await nextTick();
  expect(switches).toEqual([['other', 'lib', 42]]);
});

test('a close event without a Duplicate Target keeps the plain close rendering', () => {
  dom = createVueDom();
  const { root } = dom.mount(
    defineComponent({
      setup: () => () =>
        h(IssueTimelineEventBody, {
          item: { kind: 'event', eventType: 'closed', stateReason: 'not_planned', renderKey: 'c' },
          repoOwner: 'acme',
          repoName: 'widgets',
        }),
    })
  );

  expect(text(root)).toBe('state-event');
});
