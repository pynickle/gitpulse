import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive, shallowRef, type Component } from 'vue';

import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

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
const Host = await compileVue('app/components/dashboard/detail/DetailOverlayHost.vue', {
  '@lucide/vue': { Loader2Icon: empty },
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/components/dashboard/overlay/DashboardOverlayFrame.vue': { default: frame },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  '~/composables/useComposerBleedPosition': { COMPOSER_BLEED_LAYER_ID: 'test-bleed' },
});

const createDom = (loaders: () => PaneLoaders = defaultLoaders) =>
  createVueDom({
    createDashboardDetailPaneLoaders: loaders,
    useNavigationHistory: () => ({ shouldShowHomeButton: shallowRef(false) }),
    useDetailSidebarState: () => ({
      isDetailSidebarHidden: shallowRef(false),
      syncDetailSidebarPane: () => {},
      toggleDetailSidebar: () => {},
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
    expect(view.root.querySelector('.detail-feedback-pane')?.textContent).toContain(
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
