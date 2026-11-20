import { afterEach, expect, test } from 'bun:test';

import * as icons from '@lucide/vue';
import { defineComponent, h, shallowRef } from 'vue';

import * as subjectStateVisual from '../app/utils/getDashboardSubjectStateVisual';
import { getPullRequestStateIcon } from '../app/utils/getPullRequestStateVisual';
import { getTextColorFromBackground } from '../app/utils/getTextColorFromBackground';
import * as pullRequestConflicts from '../shared/utils/pull-request-conflicts';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

// ScrollArea is presentation-only: it must still render the cards it wraps.
const SlotPassThrough = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});
const PullRequestConflictMarker = await compileVue(
  'app/components/dashboard/pr/PullRequestConflictMarker.vue',
  {
    '@lucide/vue': icons,
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key, locale: shallowRef('en') }) },
  },
  { useI18n: 'vue-i18n' }
);
const Preview = await compileVue(
  'app/components/dashboard/SearchResultPreview.vue',
  {
    '@lucide/vue': icons,
    '#shared/utils/pull-request-conflicts': pullRequestConflicts,
    '~/components/dashboard/pr/PullRequestConflictMarker.vue': {
      default: PullRequestConflictMarker,
    },
    '~/components/ui/ScrollArea.vue': { default: SlotPassThrough },
    '~/utils/getDashboardSubjectStateVisual': subjectStateVisual,
    '~/utils/getPullRequestStateVisual': { getPullRequestStateIcon },
    '~/utils/getTextColorFromBackground': { getTextColorFromBackground },
    'vue-i18n': { useI18n: () => ({ locale: shallowRef('en') }) },
    'virtual:search-preview': { useRelativeTimeNow: () => shallowRef(0) },
  },
  {
    useI18n: 'vue-i18n',
    useRelativeTimeNow: 'virtual:search-preview',
  }
);

let dom: ReturnType<typeof createVueDom> | undefined;

afterEach(async () => {
  await dom?.cleanup();
  dom = undefined;
});

const mountItem = (item: Record<string, unknown>) => {
  dom = createVueDom();
  return dom.mount(
    defineComponent({
      setup: () => () =>
        h(Preview, {
          items: [{ id: 1, title: 'A result', number: 7, ...item }],
          loading: false,
          error: null,
          loadingLabel: 'Loading',
          waitingLabel: 'Waiting',
          emptyLabel: 'Empty',
        }),
    })
  );
};

const stateIconOf = (root: ParentNode) => root.querySelector('.srp-card__state svg');

test('a completed issue previews the purple check, not the closed minus', () => {
  const { root } = mountItem({ state: 'closed', state_reason: 'completed' });

  const card = root.querySelector('.srp-card');
  expect(stateIconOf(root)?.classList.contains('lucide-circle-check')).toBe(true);
  expect(card?.classList.contains('srp-card--completed')).toBe(true);
  expect(card?.classList.contains('srp-card--closed')).toBe(false);
});

test('a plain closed issue previews the closed state', () => {
  const { root } = mountItem({ state: 'closed', state_reason: 'not_planned' });

  const card = root.querySelector('.srp-card');
  expect(stateIconOf(root)?.classList.contains('lucide-circle-minus')).toBe(true);
  expect(card?.classList.contains('srp-card--closed')).toBe(true);
  expect(card?.classList.contains('srp-card--completed')).toBe(false);
});

test('a closed issue with no known reason previews as closed', () => {
  const { root } = mountItem({ state: 'closed' });

  const card = root.querySelector('.srp-card');
  expect(card?.classList.contains('srp-card--closed')).toBe(true);
  expect(card?.classList.contains('srp-card--completed')).toBe(false);
});

test('a merged pull request carries no closed tint', () => {
  const { root } = mountItem({
    state: 'closed',
    pull_request: { merged_at: '2024-01-01T00:00:00Z' },
  });

  const card = root.querySelector('.srp-card');
  expect(card?.classList.contains('srp-card--closed')).toBe(false);
  expect(card?.classList.contains('srp-card--completed')).toBe(false);
});

test('an open conflicting pull request keeps the marker after the title', () => {
  const title = 'Resolve conflicts in the preview card before the title runs out of room';
  const { root } = mountItem({
    title,
    state: 'open',
    pull_request: {},
    mergeable: 'CONFLICTING',
  });

  const heading = root.querySelector('.srp-card__title');
  const text = heading?.querySelector('.srp-card__title-text');
  const marker = heading?.querySelector('.pr-conflict-marker');

  expect(heading?.classList.contains('srp-card__title--with-conflict')).toBe(true);
  expect(text?.textContent).toBe(title);
  expect(text?.nextElementSibling).toBe(marker);
  expect(marker?.getAttribute('aria-label')).toBe('dashboard.pullRequestConflicts');
});

test('a closed conflicting pull request preview stays unmarked', () => {
  const { root } = mountItem({
    state: 'closed',
    pull_request: {},
    mergeable: 'CONFLICTING',
  });

  expect(root.querySelector('.pr-conflict-marker')).toBeNull();
});

test('a state-less result such as a commit carries no state tint', () => {
  const { root } = mountItem({ commit: { message: 'A commit' } });

  const card = root.querySelector('.srp-card');
  expect(card?.classList.contains('srp-card--closed')).toBe(false);
  expect(card?.classList.contains('srp-card--open')).toBe(false);
});
