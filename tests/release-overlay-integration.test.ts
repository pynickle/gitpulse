import { afterEach, beforeEach, expect, test } from 'bun:test';

import {
  computed,
  defineComponent,
  h,
  nextTick,
  ref,
  shallowRef,
  type PropType,
  type Ref,
} from 'vue';

import type { ReleaseTimelineGroup, TimelineRelease } from '#shared/types/release-follows';
import type { ReleaseListItem } from '#shared/types/releases';

import { useModalLifecycle } from '../app/composables/useModalLifecycle';
import { useModalState } from '../app/composables/useModalState';
import { useReleaseDrawer } from '../app/composables/useReleaseDrawer';
import { useReleaseOverlaySheet } from '../app/composables/useReleaseOverlaySheet';
import { useRepoReleases } from '../app/composables/useRepoReleases';
import * as dateRange from '../app/utils/filterDateRange';
import filterReleaseTimelineGroups, * as filters from '../app/utils/filterReleaseTimelineGroups';
import formatCompactNumber from '../app/utils/formatCompactNumber';
import formatDurationFromNow from '../app/utils/formatDurationFromNow';
import formatReleaseAssetSize from '../app/utils/formatReleaseAssetSize';
import getFetchErrorMessage from '../app/utils/getFetchErrorMessage';
import handleRovingTablistKeydown from '../app/utils/handleRovingTablistKeydown';
import withPendingPaginationPage from '../app/utils/withPendingPaginationPage';
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
const icons = {
  Loader2Icon: empty,
  RocketIcon: empty,
  XIcon: empty,
  HistoryIcon: empty,
  ArrowLeftIcon: empty,
  ListIcon: empty,
  CalendarIcon: empty,
  PackageIcon: empty,
  TagIcon: empty,
  LayoutGridIcon: empty,
  FlaskConicalIcon: empty,
  PencilLineIcon: empty,
  ChevronRightIcon: empty,
  DownloadIcon: empty,
};
const i18n = {
  useI18n: () => ({
    locale: shallowRef('en'),
    t: (key: string, params?: Record<string, unknown>) =>
      [key, ...Object.values(params ?? {})].join(' '),
  }),
};
const Pagination = await compileVue('app/components/dashboard/DashboardPagination.vue', {
  '@lucide/vue': { ChevronLeftIcon: empty, ChevronRightIcon: empty },
});
const DrawerFilters = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseDrawerReleaseFilters.vue',
  { '@lucide/vue': icons }
);
const DrawerRows = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseDrawerReleaseRows.vue',
  {
    '@lucide/vue': icons,
    '~/components/ui/GitHubAvatar.vue': { default: empty },
  }
);
const DrawerList = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseDrawerReleaseList.vue',
  {
    '@lucide/vue': icons,
    '~/components/dashboard/DashboardPagination.vue': { default: Pagination },
    '~/components/dashboard/release-timeline/ReleaseDrawerReleaseFilters.vue': {
      default: DrawerFilters,
    },
    '~/components/dashboard/release-timeline/ReleaseDrawerReleaseRows.vue': { default: DrawerRows },
  }
);
const Reactions = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseTimelineReactionBar.vue',
  {
    '~/components/dashboard/reactions/ReactionBar.vue': { default: empty },
  }
);
const Assets = await compileVue('app/components/dashboard/releases/ReleaseAssetsList.vue', {
  '@lucide/vue': { DownloadIcon: empty },
});
// Markdown parsing is outside this seam. Keep its rendered link and router activation
// observable so the real drawer can close in capture phase before navigation.
const Markdown = defineComponent({
  props: { value: { type: String, required: true } },
  setup: (props) => () =>
    h(
      'a',
      {
        class: 'body-link',
        href: props.value,
        target: githubLinks.value ? '_blank' : undefined,
        onClick: async (event: MouseEvent) => {
          event.preventDefault();
          await recordNavigation('body', [props.value]);
        },
      },
      'Body link'
    ),
});
const Body = await compileVue('app/components/dashboard/release-timeline/ReleaseDrawerBody.vue', {
  '@lucide/vue': icons,
  'vue3-simple-icons': { GitHubIcon: empty },
  '~/components/dashboard/release-timeline/ReleaseTimelineReactionBar.vue': { default: Reactions },
  '~/components/dashboard/releases/ReleaseAssetsList.vue': { default: Assets },
  '~/components/ui/GitHubAvatar.vue': { default: empty },
  '~/components/ui/MarkdownRenderer.vue': { default: Markdown },
});
const Drawer = await compileVue('app/components/dashboard/release-timeline/ReleaseDrawer.vue', {
  '@lucide/vue': icons,
  '~/components/dashboard/release-timeline/ReleaseDrawerBody.vue': { default: Body },
  '~/components/dashboard/release-timeline/ReleaseDrawerReleaseList.vue': { default: DrawerList },
});
const ToggleSwitch = await compileVue('app/components/ui/ToggleSwitch.vue');
const FilterPanel = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseTimelineFilterPanel.vue',
  {
    '@lucide/vue': icons,
    'vue-i18n': i18n,
    '~/components/ui/FilterDateRange.vue': { default: empty },
    '~/components/ui/FilterMultiSelect.vue': { default: empty },
    '~/components/ui/ToggleSwitch.vue': { default: ToggleSwitch },
    '~/utils/filterDateRange': dateRange,
    '~/utils/filterReleaseTimelineGroups': filters,
  }
);
const Recovery = await compileVue(
  'app/components/dashboard/release-timeline/RecoveredReleaseHistory.vue',
  { '@lucide/vue': icons }
);
const Status = await compileVue(
  'app/components/dashboard/release-timeline/ReleaseTimelineStatus.vue',
  { '@lucide/vue': { AlertCircleIcon: empty } }
);
const Header = defineComponent({
  props: { filterActive: Boolean },
  emits: ['filter-click', 'recovery', 'reload'],
  setup:
    (props, { emit }) =>
    () =>
      h('div', [
        h(
          'button',
          {
            class: 'open-filter',
            'aria-pressed': props.filterActive,
            onClick: () => emit('filter-click'),
          },
          'Filter'
        ),
        h('button', { class: 'open-recovery', onClick: () => emit('recovery') }, 'Recovered'),
        h('button', { class: 'reload-timeline', onClick: () => emit('reload') }, 'Reload'),
      ]),
});
const Grid = defineComponent({
  props: { groups: { type: Array as PropType<ReleaseTimelineGroup[]>, required: true } },
  emits: ['open'],
  setup(props, { emit, expose }) {
    expose({
      scrollToTop: () => {
        timelineScrolls += 1;
      },
    });
    return () =>
      h(
        'div',
        props.groups.flatMap((group) =>
          group.items.map((release) =>
            h(
              'button',
              { class: 'open-drawer', onClick: () => emit('open', release) },
              release.tagName
            )
          )
        )
      );
  },
});
const View = await compileVue('app/components/dashboard/release-timeline/ReleaseTimelineView.vue', {
  '@lucide/vue': icons,
  '~/components/dashboard/release-timeline/RecoveredReleaseHistory.vue': { default: Recovery },
  '~/components/dashboard/release-timeline/ReleaseTimelineStatus.vue': { default: Status },
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
let requests: { url: string; resolve: (value: unknown) => void; reject: (error: Error) => void }[];
let navigation: { kind: string; args: unknown[]; drawerOpen: boolean }[];
let githubLinks = shallowRef(false);
let timelineItems: TimelineRelease[];
let timelineGroups: Ref<ReleaseTimelineGroup[]>;
let timelineScrolls: number;
const recoveredItem: TimelineRelease = {
  ...item,
  id: 9,
  tagName: 'v9',
  title: 'v9',
  repository: { id: 'R_other', owner: 'octo', name: 'other' },
};
const recordNavigation = async (kind: string, args: unknown[]) => {
  await nextTick();
  navigation.push({
    kind,
    args,
    drawerOpen: dom.document.querySelector('.release-drawer') !== null,
  });
};
beforeEach(() => {
  requests = [];
  navigation = [];
  githubLinks = shallowRef(false);
  timelineItems = [item];
  timelineScrolls = 0;
  dom = createVueDom({
    ...i18n,
    useModalLifecycle,
    useReleaseOverlaySheet,
    useRepoReleases,
    ref,
    withPendingPaginationPage,
    formatDurationFromNow,
    formatCompactNumber,
    formatReleaseAssetSize,
    getFetchErrorMessage,
    handleRovingTablistKeydown,
    useRelativeTimeNow: () => shallowRef(Date.parse('2026-10-16T00:00:00Z')),
    useUserSettings: () => ({ settings: shallowRef({ releaseTimeline: { showReactions: true } }) }),
    useReleaseReactionSummaries: () => ({
      itemsFor: (release: TimelineRelease) => release.reactions,
      setItems: () => {},
    }),
    filterReleaseTimelineGroups,
    useReleaseDrawer: () => {
      drawer = useReleaseDrawer();
      return drawer;
    },
    useGitPulseApiFetch: () => (url: string) =>
      new Promise((resolve, reject) => {
        respond = resolve;
        requests.push({ url, resolve, reject });
      }),
    useDashboardRepositoryNavigation: () => ({
      openRepository: (...args: unknown[]) => recordNavigation('repository', args),
      openRelease: (...args: unknown[]) => recordNavigation('release', args),
    }),
    useGitHubLinkRouting: () => ({ opensGitHubLinks: githubLinks }),
    useReleaseFollows: () => ({ followedRepositories: shallowRef([item.repository]) }),
    shouldShowReleaseTimelineBackToTop: () => false,
    useReleaseTimeline: (filter: Readonly<Ref<filters.ReleaseTimelineFilterState>>) => ({
      loaded: shallowRef(true),
      visibleGroups: computed(() =>
        filterReleaseTimelineGroups(timelineGroups.value, filter.value)
      ),
      recoveredRecords: shallowRef([{ ...recoveredItem, discoveredAt: '2026-10-15T00:00:00Z' }]),
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
      groups: (timelineGroups = shallowRef([{ date: '2026-10-02', items: timelineItems }])),
      loading: shallowRef(false),
      error: shallowRef(null),
      hasFollows: shallowRef(true),
      hasLookupFailures: shallowRef(false),
      unavailableRepos: shallowRef([]),
      transientRepos: shallowRef([]),
      fetchTimeline: () => {},
    }),
  });
  dom.window.happyDOM.setURL('https://gitpulse.example/dashboard');
  // Happy DOM has no layout; expose visible controls to the existing focus primitive.
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      let ancestor: HTMLElement | null = this;
      while (ancestor) {
        if (ancestor.style.display === 'none') return null;
        ancestor = ancestor.parentElement;
      }
      return this.parentElement;
    },
  });
});

test('hiding prereleases applies immediately, survives panel reopening and clears with all filters', async () => {
  timelineItems.push({ ...item, id: 2, tagName: 'v2-preview', isPrerelease: true });
  dom.mount(View);
  expect(dom.document.querySelectorAll('.open-drawer')).toHaveLength(2);
  await click('.open-filter');
  const toggle = '[role="switch"][aria-label="releaseTimeline.filterPanelHidePrereleases"]';
  expect(dom.document.querySelector(toggle)?.getAttribute('aria-checked')).toBe('false');
  await click(toggle);
  expect(dom.document.querySelectorAll('.open-drawer')).toHaveLength(1);
  expect(dom.document.querySelector('.open-filter')?.getAttribute('aria-pressed')).toBe('true');
  await click('.release-timeline-filter-panel__close');
  await click('.reload-timeline');
  timelineGroups.value = [{ date: '2026-10-02', items: [...timelineItems] }];
  await click('.open-filter');
  expect(dom.document.querySelector(toggle)?.getAttribute('aria-checked')).toBe('true');
  await click('.release-timeline-filter-panel__footer button');
  expect(dom.document.querySelector(toggle)?.getAttribute('aria-checked')).toBe('false');
  expect(dom.document.querySelectorAll('.open-drawer')).toHaveLength(2);
  expect(dom.document.querySelector('.open-filter')?.getAttribute('aria-pressed')).toBe('false');
});

test('a prerelease-only timeline uses the filter empty state, can be cleared and resets on remount', async () => {
  timelineItems = [{ ...item, isPrerelease: true }];
  const mounted = dom.mount(View);
  await click('.open-filter');
  const toggle = '[role="switch"]';
  await click(toggle);
  await click('.release-timeline-filter-panel__close');
  expect(dom.document.querySelectorAll('.open-drawer')).toHaveLength(0);
  expect(dom.document.querySelector('.release-timeline__empty-title')?.textContent).toBe(
    'releaseTimeline.filterEmptyTitle'
  );
  expect(dom.document.querySelector('.timeline-status button')?.textContent?.trim()).toBe(
    'releaseTimeline.loadOlder'
  );
  await click('.release-timeline__empty button');
  expect(dom.document.querySelectorAll('.open-drawer')).toHaveLength(1);
  await click('.open-filter');
  expect(dom.document.querySelector(toggle)?.getAttribute('aria-checked')).toBe('false');
  await click(toggle);
  mounted.unmount();
  await settle();
  dom.mount(View);
  await click('.open-filter');
  expect(dom.document.querySelector(toggle)?.getAttribute('aria-checked')).toBe('false');
  expect(dom.document.querySelectorAll('.open-drawer')).toHaveLength(1);
});

test('body navigation closes the drawer before changing the GitPulse surface', async () => {
  dom.mount(View);
  await click('.open-drawer');
  requests[0]!.resolve({ ...releaseDetail(1), body: '/dashboard?repo=octo/widgets' });
  await settle();
  await click('.body-link');
  expect(navigation).toEqual([
    { kind: 'body', args: ['/dashboard?repo=octo/widgets'], drawerOpen: false },
  ]);
  expect(dom.document.querySelector('.release-drawer')).toBeNull();
});

test('repository navigation and release titles close the drawer, while GitHub targets and downloads keep it open', async () => {
  dom.mount(View);
  await click('.open-drawer');
  requests[0]!.resolve({
    ...releaseDetail(1),
    html_url: item.htmlUrl,
    body: 'https://github.com/octo/widgets/issues/9',
    assets: [
      {
        id: 1,
        name: 'widgets.zip',
        size: 1024,
        download_count: 2,
        browser_download_url: 'https://github.com/octo/widgets/releases/download/v1/widgets.zip',
      },
    ],
  });
  await settle();
  const dialog = dom.document.querySelector('.release-drawer');
  for (const selector of ['.release-drawer-body__github', '.release-assets-list__item']) {
    const link = dom.document.querySelector<HTMLAnchorElement>(selector)!;
    expect(link.target).toBe('_blank');
    link.addEventListener('click', (event) => event.preventDefault());
    link.click();
    await nextTick();
    expect(dom.document.querySelector('.release-drawer')).toBe(dialog);
  }
  githubLinks.value = true;
  await nextTick();
  await click('.body-link');
  await click('.release-drawer__repo');
  expect(navigation.at(-1)).toEqual({
    kind: 'repository',
    args: ['octo', 'widgets'],
    drawerOpen: true,
  });
  expect(dom.document.querySelector('.release-drawer')).toBe(dialog);
  githubLinks.value = false;
  await click('.release-drawer__repo');
  expect(navigation.at(-1)?.drawerOpen).toBe(false);
  expect(dom.document.querySelector('.release-drawer')).toBeNull();
  await click('.open-drawer');
  await showList();
  requests.at(-1)!.resolve(releasePage([listRelease(2)]));
  await settle();
  await click('.release-drawer-list__row');
  requests.at(-1)!.resolve(releaseDetail(2));
  await settle();
  await click('.release-drawer-body__title');
  expect(navigation.at(-1)).toEqual({
    kind: 'release',
    args: ['octo', 'widgets', 2],
    drawerOpen: false,
  });
  expect(dom.document.querySelector('.release-drawer')).toBeNull();
});

test('failed release details retain list and return controls and can be retried', async () => {
  dom.mount(View);
  await click('.open-drawer');
  requests[0]!.reject(new Error('Detail unavailable'));
  await settle();
  expect(dom.document.querySelector('.release-drawer__error')?.textContent).toContain(
    'Detail unavailable'
  );
  await showList();
  requests[1]!.resolve(releasePage([listRelease(2)]));
  await settle();
  await click('.release-drawer-list__row');
  requests[2]!.reject(new Error('Older release unavailable'));
  await settle();
  expect(
    dom.document.querySelector('[aria-label="releaseTimeline.returnToEntryRelease v1"]')
  ).not.toBeNull();
  expect(
    dom.document.querySelector('[aria-label^="releaseTimeline.openRepositoryReleases"]')
  ).not.toBeNull();
  await click('.release-drawer__status button');
  expect(requests[3]!.url).toBe('/api/releases/octo/widgets/2');
  requests[3]!.resolve(releaseDetail(2));
  await settle();
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 2');
  await click('[aria-label="releaseTimeline.returnToEntryRelease v1"]');
  expect(requests[4]!.url).toBe('/api/releases/octo/widgets/1');
});

test('the Repository Release List opens independently while Entry Release detail is loading', async () => {
  dom.mount(View);
  const trigger = dom.document.querySelector<HTMLButtonElement>('.open-drawer')!;
  trigger.focus();
  trigger.click();
  await nextTick();
  const dialog = dom.document.querySelector('.release-drawer');
  const listControl = dom.document.querySelector<HTMLButtonElement>(
    '[aria-label="releaseTimeline.openRepositoryReleases octo/widgets"]'
  );
  expect(listControl).not.toBeNull();
  listControl!.click();
  await nextTick();
  expect(requests.map((request) => request.url)).toEqual([
    '/api/releases/octo/widgets/1',
    '/api/releases/octo/widgets?page=1',
  ]);
  expect(dom.document.querySelector('.release-drawer')).toBe(dialog);
  expect(dom.document.querySelector('[aria-label="releasesPage.loadingTitle"]')).not.toBeNull();
  expect(dom.document.activeElement?.className).toBe('release-drawer__repo');
  expect(useModalState().openModalCount.value).toBe(1);
});

const listRelease = (id: number, extra: Partial<ReleaseListItem> = {}): ReleaseListItem => ({
  id,
  tag_name: `v${id}`,
  name: `v${id}`,
  published_at: '2026-10-02T00:00:00Z',
  created_at: '2026-10-01T00:00:00Z',
  assets_count: 0,
  download_count: 0,
  ...extra,
});
const releasePage = (items: ReleaseListItem[], page = 1, hasNext = false) => ({
  items,
  pagination: { page, perPage: 20, hasPrev: page > 1, hasNext, totalCount: null, totalPages: null },
});
const click = async (selector: string) => {
  const button = dom.document.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  button!.focus();
  button!.click();
  await nextTick();
};
const showList = () => click('[aria-label^="releaseTimeline.openRepositoryReleases"]');
const rows = () =>
  Array.from(dom.document.querySelectorAll<HTMLButtonElement>('.release-drawer-list__row'));
const settle = async () => {
  await nextTick();
  await nextTick();
};
const releaseDetail = (id: number) => ({
  id,
  tag_name: `v${id}`,
  name: `Release ${id}`,
  created_at: '2026-10-01T00:00:00Z',
});

test('list page, filter, scroll and expanded sheet survive detail browsing, then close starts a clean opening', async () => {
  dom.mount(View);
  await click('.open-drawer');
  const dialog = dom.document.querySelector('.release-drawer');
  const grab = dom.document.querySelector('.release-drawer__grab')!;
  const pointer = (type: string, y: number) =>
    grab.dispatchEvent(
      new dom.window.PointerEvent(type, {
        pointerId: 1,
        button: 0,
        clientY: y,
        bubbles: true,
      }) as unknown as Event
    );
  pointer('pointerdown', 100);
  pointer('pointerup', 0);
  await nextTick();
  expect(dialog?.classList.contains('release-drawer--expanded')).toBe(true);
  await showList();
  requests[1]!.resolve(releasePage([listRelease(1)], 1, true));
  await settle();
  await click('.pagination-next');
  expect(requests[2]!.url).toBe('/api/releases/octo/widgets?page=2');
  requests[2]!.resolve(releasePage([listRelease(2, { draft: true })], 2, true));
  await settle();
  await click('[data-filter="draft"]');
  const list = dom.document.querySelector<HTMLElement>('.release-drawer-list')!;
  list.scrollTop = 143;
  await click('.release-drawer-list__row');
  requests[3]!.resolve(releaseDetail(2));
  await settle();
  await showList();
  expect(list.scrollTop).toBe(143);
  expect(dom.document.querySelector('[data-filter="draft"]')?.getAttribute('aria-selected')).toBe(
    'true'
  );
  expect(dom.document.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('2');
  expect(dom.document.querySelector('.release-drawer-list__entry')).toBeNull();
  expect(rows()[0]!.textContent).not.toContain('releasesPage.latest');
  expect(dom.document.querySelector('.release-drawer')).toBe(dialog);
  expect(dialog?.classList.contains('release-drawer--expanded')).toBe(true);
  await click('[aria-label="releaseTimeline.returnToEntryRelease v1"]');
  requests[0]!.resolve(releaseDetail(1));
  await settle();
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 1');
  await showList();
  await click('.release-drawer__close');
  await nextTick();
  expect(dom.document.activeElement?.className).toBe('open-drawer');
  await click('.open-drawer');
  await showList();
  expect(requests.at(-1)?.url).toBe('/api/releases/octo/widgets?page=1');
  expect(dom.document.querySelector('[data-filter="all"]')?.getAttribute('aria-selected')).toBe(
    'true'
  );
  expect(dom.document.querySelector<HTMLElement>('.release-drawer-list')?.scrollTop).toBe(0);
  expect(dom.document.querySelector('.release-drawer--expanded')).toBeNull();
});

test('a stale detail cannot replace the list or another release, including after closing and reopening', async () => {
  dom.mount(View);
  await click('.open-drawer');
  await showList();
  requests[1]!.resolve(releasePage([listRelease(2), listRelease(3)]));
  await settle();
  await click('.release-drawer-list__row');
  await showList();
  requests[0]!.resolve(releaseDetail(1));
  await settle();
  expect(dom.document.querySelector<HTMLElement>('.release-drawer-list')?.style.display).not.toBe(
    'none'
  );
  rows()[1]!.click();
  await nextTick();
  requests[3]!.resolve(releaseDetail(3));
  await settle();
  requests[2]!.resolve(releaseDetail(2));
  await settle();
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 3');
  await click('.release-drawer__close');
  await click('.open-drawer');
  const late = requests[4]!;
  await click('.release-drawer__close');
  await click('.open-drawer');
  late.resolve({ ...releaseDetail(1), name: 'Obsolete opening' });
  await settle();
  expect(dom.document.querySelector('.release-drawer-body__title')).toBeNull();
  requests[5]!.resolve(releaseDetail(1));
  await settle();
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 1');
});

test('failed and empty lists keep filters, pagination and retry usable; Escape from a filter ends the opening', async () => {
  dom.mount(View);
  await click('.open-drawer');
  await showList();
  requests[1]!.reject(new Error('GitHub unavailable'));
  await settle();
  expect(dom.document.querySelector('.release-drawer-list')?.textContent).toContain(
    'GitHub unavailable'
  );
  await click('.release-drawer-list__retry');
  requests[2]!.resolve(releasePage([]));
  await settle();
  expect(dom.document.querySelector('.release-drawer-list__empty')?.textContent).toContain(
    'releasesPage.empty'
  );
  await click('[data-filter="draft"]');
  expect(dom.document.querySelector('[role="tablist"]')).not.toBeNull();
  expect(dom.document.querySelector('.dashboard-pagination')).not.toBeNull();
  dom.document.activeElement?.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }) as unknown as Event
  );
  await settle();
  expect(dom.document.querySelector('.release-drawer')).toBeNull();
  expect(dom.document.activeElement?.className).toBe('open-drawer');
  expect(useModalState().openModalCount.value).toBe(0);
});

test('drawer rows show one status and a separate Entry Release chip, and filters narrow only the loaded page', async () => {
  dom.mount(View);
  await click('.open-drawer');
  await showList();
  requests[1]!.resolve(
    releasePage(
      [
        listRelease(4, {
          draft: true,
          prerelease: true,
          published_at: null,
          name: 'Work in progress',
        }),
        listRelease(3, { prerelease: true }),
        listRelease(1),
        listRelease(2, { published_at: null }),
      ],
      1,
      true
    )
  );
  await nextTick();
  await nextTick();
  expect(rows()).toHaveLength(4);
  expect(rows()[0]!.querySelectorAll('.release-drawer-list__status')).toHaveLength(1);
  expect(rows()[0]!.textContent).toContain('releaseDetail.draft');
  expect(rows()[0]!.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-01T00:00:00Z');
  expect(rows()[0]!.textContent).toContain('Work in progress');
  expect(rows()[2]!.textContent).toContain('releasesPage.latest');
  expect(rows()[2]!.textContent).toContain('releaseTimeline.entryRelease');
  expect(rows()[2]!.querySelector('.release-drawer-list__name')).toBeNull();
  await click('[role="tab"][data-filter="prerelease"]');
  expect(rows()).toHaveLength(1);
  expect(rows()[0]!.textContent).toContain('v3');
  expect(dom.document.querySelector('.release-drawer-list__entry')).toBeNull();
  await click('[role="tab"][data-filter="draft"]');
  expect(rows()).toHaveLength(1);
  expect(rows()[0]!.textContent).toContain('v4');
  await click('[role="tab"][data-filter="stable"]');
  expect(rows()).toHaveLength(2);
  expect(requests).toHaveLength(2);
  expect(
    dom.document.querySelector('[role="tab"][data-filter="stable"]')?.getAttribute('aria-selected')
  ).toBe('true');
});

test('an empty filtered page keeps pagination usable and selecting the Entry Release row agrees with return', async () => {
  dom.mount(View);
  await click('.open-drawer');
  requests[0]!.resolve(releaseDetail(1));
  await settle();
  await showList();
  requests[1]!.resolve(releasePage([listRelease(1)], 1, true));
  await settle();
  await click('[data-filter="draft"]');
  expect(dom.document.querySelector('.release-drawer-list__empty')?.textContent).toContain(
    'releasesPage.emptyFiltered'
  );
  expect(dom.document.querySelector('.release-drawer-list__entry')).toBeNull();
  await click('.pagination-next');
  requests[2]!.resolve(releasePage([listRelease(2, { draft: true })], 2));
  await settle();
  expect(rows()).toHaveLength(1);
  await click('.pagination-previous');
  requests[3]!.resolve(releasePage([listRelease(1)], 1, true));
  await settle();
  await click('[data-filter="all"]');
  await click('.release-drawer-list__row');
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 1');
  expect(
    dom.document.querySelector('[aria-label^="releaseTimeline.returnToEntryRelease"]')
  ).toBeNull();
  expect(requests).toHaveLength(4);
});

test('a release already loaded on the timeline retains its reaction bar when selected from the list', async () => {
  timelineItems.push({ ...item, id: 2, tagName: 'v2' });
  dom.mount(View);
  await click('.open-drawer');
  await showList();
  requests[1]!.resolve(releasePage([listRelease(2)]));
  await settle();
  await click('.release-drawer-list__row');
  requests[2]!.resolve(releaseDetail(2));
  await settle();
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 2');
  expect(dom.document.querySelector('.release-timeline-reaction-bar')).not.toBeNull();
  expect(dom.document.querySelectorAll('.open-drawer')).toHaveLength(2);
  expect(timelineScrolls).toBe(0);
});

for (const dismiss of ['scrim', 'sheet', 'filter'] as const) {
  test(`${dismiss} dismissal discards the list session`, async () => {
    dom.mount(View);
    await click('.open-drawer');
    await showList();
    requests[1]!.resolve(releasePage([listRelease(1)], 1, true));
    await settle();
    await click('[data-filter="draft"]');
    if (dismiss === 'scrim') await click('.release-drawer__scrim');
    if (dismiss === 'filter') await click('.open-filter');
    if (dismiss === 'sheet') {
      const grab = dom.document.querySelector('.release-drawer__grab')!;
      for (const [type, clientY] of [
        ['pointerdown', 100],
        ['pointerup', 200],
      ] as const) {
        grab.dispatchEvent(
          new dom.window.PointerEvent(type, {
            pointerId: 1,
            button: 0,
            clientY,
            bubbles: true,
          }) as unknown as Event
        );
      }
    }
    await settle();
    expect(dom.document.querySelector('.release-drawer')).toBeNull();
    await click('.open-drawer');
    await showList();
    expect(requests.at(-1)!.url).toBe('/api/releases/octo/widgets?page=1');
    expect(dom.document.querySelector('[data-filter="all"]')?.getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(useModalState().openModalCount.value).toBe(1);
  });
}

test('list-only releases use drawer detail without timeline reactions, and one step returns to cached Entry Release', async () => {
  dom.mount(View);
  await click('.open-drawer');
  requests[0]!.resolve(releaseDetail(1));
  await settle();
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 1');
  expect(dom.document.querySelector('.release-timeline-reaction-bar')).not.toBeNull();
  await showList();
  requests[1]!.resolve(releasePage([listRelease(2, { draft: true })]));
  await settle();
  expect(dom.document.querySelector('.release-drawer-list__entry')).toBeNull();
  await click('.release-drawer-list__row');
  expect(requests[2]!.url).toBe('/api/releases/octo/widgets/2');
  expect(
    dom.document.querySelector('[aria-label="releaseTimeline.returnToEntryRelease v1"]')
  ).not.toBeNull();
  expect(
    dom.document.querySelector('[aria-label^="releaseTimeline.openRepositoryReleases"]')
  ).not.toBeNull();
  requests[2]!.resolve(releaseDetail(2));
  await settle();
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 2');
  expect(dom.document.querySelector('.release-timeline-reaction-bar')).toBeNull();
  expect(dom.document.querySelector('.open-drawer')?.textContent).toBe('v1');
  expect(dom.document.querySelectorAll('.open-drawer')).toHaveLength(1);
  expect(timelineScrolls).toBe(0);
  expect(navigation).toHaveLength(0);
  expect(dom.window.location.href).toBe('https://gitpulse.example/dashboard');
  expect(dom.document.activeElement?.className).toBe('release-drawer__repo');
  await click('[aria-label="releaseTimeline.returnToEntryRelease v1"]');
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 1');
  expect(
    dom.document.querySelector('[aria-label^="releaseTimeline.returnToEntryRelease"]')
  ).toBeNull();
  expect(requests).toHaveLength(3);
  await showList();
  await click('.release-drawer-list__row');
  expect(dom.document.querySelector('.release-drawer-body__title')?.textContent).toBe('Release 2');
  expect(requests).toHaveLength(3);
  expect(useModalState().openModalCount.value).toBe(1);
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
  expect(dom.document.querySelector('.recovered-history__record')?.textContent).toContain('v9');
  expect(useModalState().openModalCount.value).toBe(1);
  dom.document.querySelector<HTMLButtonElement>('.recovered-history__record')!.click();
  await nextTick();
  expect(dom.document.querySelector('.release-drawer__repo')?.textContent?.trim()).toBe(
    'octo/other'
  );
  expect(requests[0]!.url).toBe('/api/releases/octo/other/9');
  expect(dom.document.querySelector('.recovered-history')).toBeNull();
  expect(dom.document.activeElement?.className).toBe('release-drawer__repo');
  expect(useModalState().openModalCount.value).toBe(1);
  await showList();
  expect(requests[1]!.url).toBe('/api/releases/octo/other?page=1');
  await click('[aria-label="releaseTimeline.returnToEntryRelease v9"]');
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
