import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive, shallowRef, type Component } from 'vue';

import { commentModerationComposable } from './helpers/comment-moderation';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

const detailOverlayChromeStub = {
  DETAIL_SHEET_LAYER_ID: 'gitpulse-detail-sheet-layer',
  provideDetailOverlayChrome: () => ({
    keyboardInsetPx: shallowRef(0),
    keyboardVisibleHeightPx: shallowRef(null),
    openSheet: shallowRef(null),
  }),
};

const empty = defineComponent({ setup: () => () => h('span') });
const frame = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});
const repository = defineComponent({ setup: () => () => h('article', 'Repository content') });
const load = async () => empty;
const defaultLoaders = () => ({
  loadIssueDetail: load,
  loadPrDetail: load,
  loadDiscussionDetail: load,
  loadReleaseDetail: load,
  loadRepoDetail: async () => repository,
});
type PaneLoaders = Record<keyof ReturnType<typeof defaultLoaders>, () => Promise<Component>>;
const PageErrorState = await compileVue('app/components/ui/PageErrorState.vue', {
  '@lucide/vue': {
    RefreshCwIcon: empty,
    TriangleExclamationPointIcon: empty,
  },
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
});
const Host = await compileVue('app/components/dashboard/detail/DetailOverlayHost.vue', {
  '~/composables/useCommentModeration': commentModerationComposable,
  '@lucide/vue': { LoaderCircleIcon: empty },
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/components/dashboard/overlay/DashboardOverlayFrame.vue': { default: frame },
  '~/components/ui/PageErrorState.vue': { default: PageErrorState },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  '~/composables/useComposerBleedPosition': { COMPOSER_BLEED_LAYER_ID: 'test-bleed' },
  '~/composables/useDetailOverlayChrome': detailOverlayChromeStub,
});

const createDom = (loaders: () => PaneLoaders = defaultLoaders) =>
  createVueDom({
    createDashboardDetailPaneLoaders: loaders,
    useNavigationHistory: () => ({ shouldShowHomeButton: shallowRef(false) }),
    useDetailSidebarState: () => ({
      isDetailSidebarHidden: shallowRef(false),
      syncDetailSidebarPane: () => {},
      toggleDetailSidebar: () => {},
      closeDetailSidebar: () => {},
    }),
    useDetailSidebarViewport: () => ({ isDetailSidebarSheetViewport: shallowRef(false) }),
    resolveDetailSidebarSheetOpen: () => false,
  });
const createProps = () =>
  reactive({
    issue: null,
    pullRequest: null,
    discussion: null,
    release: null as { id: number; tag_name: string } | null,
    repository: null as { id: number; name: string; owner: { login: string } } | null,
    issueError: '',
    pullRequestError: '',
    discussionError: '',
    releaseError: '',
    repoError: '',
    isIssueVisible: false,
    isPullRequestVisible: false,
    isDiscussionVisible: false,
    isReleaseVisible: false,
    isRepositoryVisible: true,
    isPullRequestReviewRoute: false,
    issueDetailKey: '',
    pullRequestDetailKey: '',
    discussionDetailKey: '',
    releaseDetailKey: '',
    repositoryDetailKey: 'repo-octo-app',
    loadingIssue: false,
    loadingPullRequest: false,
    loadingDiscussion: false,
    loadingRelease: false,
    loadingRepository: true,
    sourceNotification: null,
  });

test('repository loading and errors fill the pane without a nested scrolling content box', async () => {
  const dom = createDom();
  const props = createProps();
  try {
    const view = dom.mount(defineComponent({ setup: () => () => h(Host, props) }));
    await nextTick();
    const pane = view.root.querySelector<HTMLElement>('.detail-pane')!;
    expect(view.root.querySelector('.detail-loading-pane')).not.toBeNull();
    expect(pane.classList.contains('scroll-area--disabled')).toBe(true);
    expect(pane.classList.contains('detail-pane--page-scroll')).toBe(false);
    expect(pane.classList.contains('detail-pane--feedback')).toBe(true);

    props.loadingRepository = false;
    props.repoError = 'Repository request failed';
    await nextTick();
    // The pane names what failed, and the server's own message is the detail
    // under it — not the headline.
    const feedback = view.root.querySelector('.detail-feedback-pane');
    expect(feedback?.querySelector('.page-error-state__message[role="alert"]')).not.toBeNull();
    expect(feedback?.querySelector('.page-error-state__title')?.textContent).toBe(
      'detailOverlay.loadError.repository'
    );
    expect(feedback?.querySelector('.page-error-state__description')?.textContent).toBe(
      props.repoError
    );
    expect(pane.classList.contains('scroll-area--disabled')).toBe(true);
    expect(pane.classList.contains('detail-pane--feedback')).toBe(true);

    props.repoError = '';
    props.repository = { id: 1, name: 'app', owner: { login: 'octo' } };
    await Bun.sleep(0);
    await nextTick();
    expect(pane.classList.contains('scroll-area--disabled')).toBe(false);
    expect(pane.classList.contains('detail-pane--page-scroll')).toBe(true);
    expect(pane.classList.contains('detail-pane--feedback')).toBe(false);
    expect(view.root.textContent).toContain('Repository content');
  } finally {
    await dom.cleanup();
  }
});

test('prepares only the selected detail while data is pending and keeps feedback until its code arrives', async () => {
  let resolveModule!: (component: Component) => void;
  const module = new Promise<Component>((resolve) => {
    resolveModule = resolve;
  });
  const requested: string[] = [];
  const request = (type: string) => {
    requested.push(type);
    return module;
  };
  const dom = createDom(() => ({
    loadIssueDetail: () => request('issue'),
    loadPrDetail: () => request('pull-request'),
    loadDiscussionDetail: () => request('discussion'),
    loadReleaseDetail: () => request('release'),
    loadRepoDetail: () => request('repository'),
  }));
  const props = createProps();
  try {
    const view = dom.mount(defineComponent({ setup: () => () => h(Host, props) }));
    await nextTick();
    expect(requested).toEqual(['repository']);
    expect(view.root.querySelector('.detail-loading-pane')).not.toBeNull();

    props.repository = { id: 1, name: 'app', owner: { login: 'octo' } };
    props.loadingRepository = false;
    await nextTick();
    expect(view.root.querySelector('[role="status"]')).not.toBeNull();
    expect(view.root.textContent).not.toContain('Repository content');

    resolveModule(repository);
    await Bun.sleep(0);
    await nextTick();
    expect(view.root.querySelector('[role="status"]')).toBeNull();
    expect(view.root.textContent).toContain('Repository content');
  } finally {
    resolveModule(repository);
    await dom.cleanup();
  }
});

test('a ready detail module still waits for data before replacing the loading view', async () => {
  const dom = createDom();
  const props = createProps();
  try {
    const view = dom.mount(defineComponent({ setup: () => () => h(Host, props) }));
    await Bun.sleep(0);
    expect(view.root.querySelector('.detail-loading-pane')).not.toBeNull();
    expect(view.root.textContent).not.toContain('Repository content');

    props.repository = { id: 1, name: 'app', owner: { login: 'octo' } };
    props.loadingRepository = false;
    await Bun.sleep(0);
    await nextTick();
    expect(view.root.querySelector('.detail-loading-pane')).toBeNull();
    expect(view.root.textContent).toContain('Repository content');
  } finally {
    await dom.cleanup();
  }
});

const DashboardOverlayFrame = await compileVue(
  'app/components/dashboard/overlay/DashboardOverlayFrame.vue',
  {
    '@lucide/vue': { LoaderCircleIcon: empty },
    '~/components/dashboard/overlay/DashboardTopHeader.vue': { default: empty },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  }
);
const HostWithRealFrame = await compileVue(
  'app/components/dashboard/detail/DetailOverlayHost.vue',
  {
    '~/composables/useCommentModeration': commentModerationComposable,
    '@lucide/vue': { LoaderCircleIcon: empty },
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
    '~/components/dashboard/overlay/DashboardOverlayFrame.vue': { default: DashboardOverlayFrame },
    '~/components/ui/PageErrorState.vue': { default: PageErrorState },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    '~/composables/useComposerBleedPosition': { COMPOSER_BLEED_LAYER_ID: 'test-bleed' },
    '~/composables/useDetailOverlayChrome': detailOverlayChromeStub,
  }
);

test('DashboardOverlayFrame disables outer ScrollArea via contentClipped without Bulma helper classes', async () => {
  const dom = createDom();
  const clipped = shallowRef(false);
  const unpadded = shallowRef(false);
  try {
    const view = dom.mount(
      defineComponent({
        setup: () => () =>
          h(
            DashboardOverlayFrame,
            {
              loading: false,
              loadingTitle: 'Loading',
              loadingSubtitle: 'Syncing',
              backLabel: 'Back',
              homeLabel: 'Home',
              showHomeButton: false,
              contentClipped: clipped.value,
              contentUnpadded: unpadded.value,
            },
            { default: () => h('div', 'Body') }
          ),
      })
    );
    await nextTick();
    const content = view.root.querySelector<HTMLElement>('.detail-frame__content')!;
    expect(content).not.toBeNull();
    expect(content.classList.contains('scroll-area--disabled')).toBe(false);
    expect(content.classList.contains('detail-frame__content--clipped')).toBe(false);
    expect(content.classList.contains('detail-frame__content--unpadded')).toBe(false);

    clipped.value = true;
    unpadded.value = true;
    await nextTick();
    expect(content.classList.contains('scroll-area--disabled')).toBe(true);
    expect(content.classList.contains('detail-frame__content--clipped')).toBe(true);
    expect(content.classList.contains('detail-frame__content--unpadded')).toBe(true);
    expect(content.classList.contains('is-clipped')).toBe(false);
    expect(content.classList.contains('p-0')).toBe(false);
  } finally {
    await dom.cleanup();
  }
});

test('DetailOverlayHost disables DashboardOverlayFrame ScrollArea cleanly without p-0 or is-clipped', async () => {
  const dom = createDom();
  const props = createProps();
  try {
    const view = dom.mount(defineComponent({ setup: () => () => h(HostWithRealFrame, props) }));
    await nextTick();
    const frameContent = view.root.querySelector<HTMLElement>('.detail-frame__content')!;
    const stage = view.root.querySelector<HTMLElement>('.detail-pane-stage')!;
    expect(frameContent).not.toBeNull();
    expect(frameContent.classList.contains('scroll-area--disabled')).toBe(true);
    expect(frameContent.classList.contains('detail-frame__content--clipped')).toBe(true);
    expect(frameContent.classList.contains('detail-frame__content--unpadded')).toBe(true);
    expect(frameContent.classList.contains('is-clipped')).toBe(false);
    expect(frameContent.classList.contains('p-0')).toBe(false);
    expect(stage.classList.contains('is-clipped')).toBe(false);
  } finally {
    await dom.cleanup();
  }
});

test('a late module cannot replace the newly selected detail or clear its loading feedback', async () => {
  let resolveRepo!: (component: Component) => void;
  let resolveRelease!: (component: Component) => void;
  const repoModule = new Promise<Component>((resolve) => {
    resolveRepo = resolve;
  });
  const releaseModule = new Promise<Component>((resolve) => {
    resolveRelease = resolve;
  });
  const dom = createDom(() => ({
    ...defaultLoaders(),
    loadRepoDetail: () => repoModule,
    loadReleaseDetail: () => releaseModule,
  }));
  const props = createProps();
  props.repository = { id: 1, name: 'app', owner: { login: 'octo' } };
  props.loadingRepository = false;
  try {
    const view = dom.mount(defineComponent({ setup: () => () => h(Host, props) }));
    await nextTick();
    props.isRepositoryVisible = false;
    props.isReleaseVisible = true;
    props.releaseDetailKey = 'release-octo-app-1';
    props.release = { id: 1, tag_name: 'v1' };
    await nextTick();
    resolveRepo(repository);
    await Bun.sleep(0);
    expect(view.root.textContent).not.toContain('Repository content');
    expect(view.root.querySelector('[role="status"]')).not.toBeNull();
    expect(view.root.querySelector('.detail-pane--feedback')).not.toBeNull();

    resolveRelease(defineComponent({ setup: () => () => h('article', 'Release content') }));
    await Bun.sleep(0);
    await nextTick();
    expect(view.root.querySelector('[role="status"]')).toBeNull();
    expect(view.root.textContent).toContain('Release content');
  } finally {
    resolveRepo(repository);
    resolveRelease(empty);
    await dom.cleanup();
  }
});
