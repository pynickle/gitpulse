import { afterEach, beforeEach, expect, test } from 'bun:test';

import { defineComponent, h, nextTick, shallowRef } from 'vue';

import type { TimelineRelease } from '#shared/types/release-follows';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { useModalState } from '../app/composables/useModalState';
import { useReleaseDrawer } from '../app/composables/useReleaseDrawer';
import { useReleaseOverlaySheet } from '../app/composables/useReleaseOverlaySheet';
import * as dateRange from '../app/utils/filterDateRange';
import filterReleaseTimelineGroups, * as filters from '../app/utils/filterReleaseTimelineGroups';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const item: TimelineRelease = {
  repository: { id: 'R_widgets', owner: 'octo', name: 'widgets' },
  id: 1,
  title: 'v1',
  tagName: 'v1',
  publishedAt: '2026-10-02T00:00:00Z',
  changelog: '',
  changelogTruncated: false,
  assetCount: 0,
  isPrerelease: false,
  isOldestShown: false,
  htmlUrl: 'https://github.com/octo/widgets/releases/tag/v1',
  reactions: [],
};
const empty = defineComponent({ setup: () => () => h('span') });
const icons = { Loader2Icon: empty, RocketIcon: empty, XIcon: empty, HistoryIcon: empty };
const i18n = { useI18n: () => ({ t: (key: string) => key }) };
const Drawer = await compileVue('app/components/dashboard/release-timeline/ReleaseDrawer.vue', {
  '@lucide/vue': icons,
  '~/components/dashboard/release-timeline/ReleaseDrawerBody.vue': { default: empty },
});
const FilterPanel = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseTimelineFilterPanel.vue',
  {
    '@lucide/vue': icons,
    'vue-i18n': i18n,
    '~/components/ui/FilterDateRange.vue': { default: empty },
    '~/components/ui/FilterMultiSelect.vue': { default: empty },
    '~/utils/filterDateRange': dateRange,
    '~/utils/filterReleaseTimelineGroups': filters,
  }
);
const Recovery = await compileVue(
  'app/components/dashboard/release-timeline/RecoveredReleaseHistory.vue',
  { '@lucide/vue': icons }
);
const Header = defineComponent({
  emits: ['filter-click', 'recovery'],
  setup:
    (_, { emit }) =>
    () =>
      h('div', [
        h('button', { class: 'open-filter', onClick: () => emit('filter-click') }, 'Filter'),
        h('button', { class: 'open-recovery', onClick: () => emit('recovery') }, 'Recovered'),
      ]),
});
const Grid = defineComponent({
  emits: ['open'],
  setup:
    (_, { emit }) =>
    () =>
      h('button', { class: 'open-drawer', onClick: () => emit('open', item) }, 'Release'),
});
const View = await compileVue('app/components/dashboard/release-timeline/ReleaseTimelineView.vue', {
  '@lucide/vue': icons,
  '~/components/dashboard/release-timeline/RecoveredReleaseHistory.vue': { default: Recovery },
  '~/components/dashboard/release-timeline/ReleaseTimelineStatus.vue': { default: empty },
  '~/components/dashboard/FloatingBackToTopButton.vue': { default: empty },
  '~/components/dashboard/release-timeline/ReleaseDrawer.vue': { default: Drawer },
  '~/components/dashboard/release-timeline/ReleaseTimelineFilterPanel.vue': {
    default: FilterPanel,
  },
  '~/components/dashboard/release-timeline/ReleaseTimelineHeader.vue': { default: Header },
  '~/components/dashboard/release-timeline/ReleaseTimelineGrid.vue': { default: Grid },
  '~/components/dashboard/release-timeline/ReleaseTimelineFailureBanner.vue': { default: empty },
  '~/utils/filterDateRange': dateRange,
  '~/utils/filterReleaseTimelineGroups': filters,
});

let dom: ReturnType<typeof createVueDom>;
let drawer: ReturnType<typeof useReleaseDrawer>;
let respond: (value: unknown) => void;
beforeEach(() => {
  dom = createVueDom({
    ...i18n,
    useModalLifecycle,
    useReleaseOverlaySheet,
    filterReleaseTimelineGroups,
    useReleaseDrawer: () => {
      drawer = useReleaseDrawer();
      return drawer;
    },
    useGitPulseApiFetch: () => () =>
      new Promise((resolve) => {
        respond = resolve;
      }),
    useDashboardRepositoryNavigation: () => ({ openRepository: () => {}, openRelease: () => {} }),
    useGitHubLinkRouting: () => ({ opensGitHubLinks: shallowRef(false) }),
    useReleaseFollows: () => ({ followedRepositories: shallowRef([item.repository]) }),
    shouldShowReleaseTimelineBackToTop: () => false,
    useReleaseTimeline: () => ({
      loaded: shallowRef(true),
      visibleGroups: shallowRef([{ date: '2026-10-02', items: [item] }]),
      recoveredRecords: shallowRef([{ ...item, discoveredAt: '2026-10-15T00:00:00Z' }]),
      clearingHistory: shallowRef(false),
      persistenceError: shallowRef(null),
      loadedNewCount: shallowRef(0),
      previousBaseline: shallowRef(null),
      baselineExposed: shallowRef(false),
      partial: shallowRef(false),
      hasMore: shallowRef(true),
      canRetry: shallowRef(false),
      loadOlder: () => {},
      retryFailed: () => {},
      clearRecovered: () => {},
      retryPersistence: () => {},
      groups: shallowRef([{ date: '2026-10-02', items: [item] }]),
      loading: shallowRef(false),
      error: shallowRef(null),
      hasFollows: shallowRef(true),
      hasLookupFailures: shallowRef(false),
      unavailableRepos: shallowRef([]),
      transientRepos: shallowRef([]),
      fetchTimeline: () => {},
    }),
  });
  // Happy DOM has no layout; expose visible controls to the existing focus primitive.
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentElement;
    },
  });
});
afterEach(async () => {
  await dom.cleanup();
});

test('Timeline replaces either overlay, preserves return focus and invalidates closed Drawer results', async () => {
  dom.mount(View);
  const filterTrigger = dom.document.querySelector<HTMLButtonElement>('.open-filter')!;
  const releaseTrigger = dom.document.querySelector<HTMLButtonElement>('.open-drawer')!;
  filterTrigger.focus();
  filterTrigger.click();
  await nextTick();
  expect(dom.document.activeElement?.className).toBe('release-timeline-filter-panel__close');

  releaseTrigger.click();
  await nextTick();
  expect(useModalState().openModalCount.value).toBe(1);
  expect(dom.document.activeElement?.className).toBe('release-drawer__repo');
  const oldResponse = respond;
  filterTrigger.click();
  await nextTick();
  expect(drawer.isOpen.value).toBe(false);
  expect(dom.document.activeElement?.className).toBe('release-timeline-filter-panel__close');
  oldResponse({ id: 1 });
  await nextTick();
  expect(drawer.detail.value).toBeNull();
  expect(useModalState().openModalCount.value).toBe(1);

  dom.document.querySelector<HTMLButtonElement>('.release-timeline-filter-panel__close')!.click();
  await nextTick();
  // The parent propagates the closed prop first; the lifecycle then restores after that DOM flush.
  await nextTick();
  expect(dom.document.activeElement === filterTrigger).toBe(true);
  expect(useModalState().openModalCount.value).toBe(0);
});

test('retained recovery summaries open through the existing Drawer and hand off focus and modal ownership', async () => {
  dom.mount(View);
  const trigger = dom.document.querySelector<HTMLButtonElement>('.open-recovery')!;
  trigger.focus();
  trigger.click();
  await nextTick();
  expect(dom.document.querySelector('.recovered-history__record')?.textContent).toContain('v1');
  expect(useModalState().openModalCount.value).toBe(1);
  dom.document.querySelector<HTMLButtonElement>('.recovered-history__record')!.click();
  await nextTick();
  expect(drawer.openItem.value?.id).toBe(1);
  expect(dom.document.querySelector('.recovered-history')).toBeNull();
  expect(dom.document.activeElement?.className).toBe('release-drawer__repo');
  expect(useModalState().openModalCount.value).toBe(1);
  dom.document.querySelector<HTMLButtonElement>('.release-drawer__close')!.click();
  await nextTick();
  await nextTick();
  expect(dom.document.activeElement).toBe(trigger);
  expect(useModalState().openModalCount.value).toBe(0);
});

test('empty recovered history fills the panel instead of a blank list', async () => {
  const host = defineComponent({
    setup: () => () =>
      h(Recovery, {
        open: true,
        records: [],
        saving: false,
        error: null,
      }),
  });
  dom.mount(host);
  await nextTick();
  const emptyState = dom.document.querySelector('.recovered-history__empty');
  expect(emptyState?.textContent).toContain('releaseTimeline.recoveredEmpty');
  expect(emptyState?.textContent).toContain('releaseTimeline.recoveredDescription');
  expect(dom.document.querySelector('.recovered-history__list')).toBeNull();
  expect(dom.document.querySelector('.recovered-history__clear')).toBeNull();
});
