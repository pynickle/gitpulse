import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive, shallowRef } from 'vue';

import { resolveDetailSidebarSheetOpen } from '../app/utils/resolveDetailSidebarSheetOpen';
import { commentModerationComposable } from './helpers/comment-moderation';
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
// Stands in for a detail pane: the main column is the page behind the sheet,
// the sidebar column is the sheet itself.
const detailPane = defineComponent({
  setup: () => () =>
    h('div', { class: 'columns' }, [
      h('div', { class: 'column detail-main-column' }, [
        h('button', { class: 'page-control', type: 'button' }, 'page'),
      ]),
      h('div', { class: 'column detail-sidebar-column' }, [
        h('button', { class: 'sheet-control', type: 'button' }, 'sheet'),
      ]),
    ]),
});
const load = async () => detailPane;
const loadPaneWithoutSheet = async () =>
  defineComponent({
    setup: () => () => h('div', { class: 'page-control' }, 'review workspace'),
  });
const Host = await compileVue('app/components/dashboard/detail/DetailOverlayHost.vue', {
  '~/composables/useCommentModeration': commentModerationComposable,
  '@lucide/vue': { LoaderCircleIcon: empty },
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/components/dashboard/overlay/DashboardOverlayFrame.vue': { default: frame },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  '~/composables/useComposerBleedPosition': { COMPOSER_BLEED_LAYER_ID: 'test-bleed' },
});

const createDom = (
  isDetailSidebarSheetViewport: boolean,
  loadDetail: () => Promise<unknown> = load
) => {
  const hidden = shallowRef(false);
  return {
    hidden,
    dom: createVueDom({
      createDashboardDetailPaneLoaders: () => ({
        loadIssueDetail: loadDetail,
        loadPrDetail: loadDetail,
        loadDiscussionDetail: loadDetail,
        loadReleaseDetail: loadDetail,
        loadRepoDetail: loadDetail,
      }),
      useNavigationHistory: () => ({ shouldShowHomeButton: shallowRef(false) }),
      useDetailSidebarState: () => ({
        isDetailSidebarHidden: hidden,
        syncDetailSidebarPane: () => {},
        toggleDetailSidebar: () => {
          hidden.value = !hidden.value;
        },
      }),
      useDetailSidebarViewport: () => ({
        isDetailSidebarSheetViewport: shallowRef(isDetailSidebarSheetViewport),
      }),
      resolveDetailSidebarSheetOpen,
    }),
  };
};

const mountHost = async (dom: ReturnType<typeof createDom>['dom']) => {
  const view = dom.mount(defineComponent({ setup: () => () => h(Host, createProps()) }));
  await Bun.sleep(0);
  await nextTick();
  return view;
};

const createProps = () =>
  reactive({
    issue: null,
    pullRequest: { number: 42, title: 'Fix the side panel', state: 'open' },
    discussion: null,
    release: null,
    repository: null,
    issueError: '',
    pullRequestError: '',
    discussionError: '',
    releaseError: '',
    repoError: '',
    isIssueVisible: false,
    isPullRequestVisible: true,
    isDiscussionVisible: false,
    isReleaseVisible: false,
    isRepositoryVisible: false,
    isPullRequestReviewRoute: false,
    issueDetailKey: '',
    pullRequestDetailKey: 'pr-octo-app-42',
    discussionDetailKey: '',
    releaseDetailKey: '',
    repositoryDetailKey: '',
    loadingIssue: false,
    loadingPullRequest: false,
    loadingDiscussion: false,
    loadingRelease: false,
    loadingRepository: false,
    sourceNotification: null,
  });

test('a narrow viewport pins the Detail Sidebar as a sheet with nothing painted over it', async () => {
  const { dom } = createDom(true);
  try {
    const view = await mountHost(dom);

    const stage = view.root.querySelector<HTMLElement>('.detail-pane-stage')!;
    expect(stage.classList.contains('detail-pane-stage--sidebar-sheet')).toBe(true);
    // A scrim here would out-stack the fixed sheet and eat its gestures.
    expect(view.root.querySelector('.detail-sidebar-sheet-backdrop')).toBeNull();
  } finally {
    await dom.cleanup();
  }
});

test('a wide viewport leaves the Detail Sidebar inline and ignores outside clicks', async () => {
  const { dom, hidden } = createDom(false);
  try {
    const view = await mountHost(dom);

    const stage = view.root.querySelector<HTMLElement>('.detail-pane-stage')!;
    expect(stage.classList.contains('detail-pane-stage--sidebar-sheet')).toBe(false);

    view.root.querySelector<HTMLElement>('.page-control')!.click();
    await nextTick();
    expect(hidden.value).toBe(false);
  } finally {
    await dom.cleanup();
  }
});

test('a click on the pane outside the sheet closes it', async () => {
  const { dom, hidden } = createDom(true);
  try {
    const view = await mountHost(dom);

    view.root.querySelector<HTMLElement>('.page-control')!.click();
    await nextTick();
    expect(hidden.value).toBe(true);
  } finally {
    await dom.cleanup();
  }
});

test('clicks inside the sheet and outside the pane leave it open', async () => {
  const { dom, hidden } = createDom(true);
  // The frame owns the header toggle; a click there must not close and reopen.
  const toggle = document.createElement('button');
  toggle.className = 'dashboard-top-header__detail-sidebar-toggle';
  document.body.append(toggle);
  try {
    const view = await mountHost(dom);

    view.root.querySelector<HTMLElement>('.sheet-control')!.click();
    await nextTick();
    expect(hidden.value).toBe(false);

    toggle.click();
    await nextTick();
    expect(hidden.value).toBe(false);
  } finally {
    toggle.remove();
    await dom.cleanup();
  }
});

test('closing the sheet from inside hands focus back to the header toggle', async () => {
  const { dom, hidden } = createDom(true);
  const toggle = document.createElement('button');
  toggle.className = 'dashboard-top-header__detail-sidebar-toggle';
  document.body.append(toggle);
  try {
    const view = await mountHost(dom);

    const sheetControl = view.root.querySelector<HTMLElement>('.sheet-control')!;
    sheetControl.focus();
    expect(document.activeElement).toBe(sheetControl);

    hidden.value = true;
    await nextTick();
    await nextTick();

    expect(document.activeElement).toBe(toggle);
  } finally {
    toggle.remove();
    await dom.cleanup();
  }
});

test('a click on the pane behind the sheet keeps focus on the clicked control', async () => {
  const { dom, hidden } = createDom(true);
  const toggle = document.createElement('button');
  toggle.className = 'dashboard-top-header__detail-sidebar-toggle';
  document.body.append(toggle);
  try {
    const view = await mountHost(dom);

    const pageControl = view.root.querySelector<HTMLElement>('.page-control')!;
    pageControl.focus();
    pageControl.click();
    await nextTick();
    await nextTick();

    expect(hidden.value).toBe(true);
    expect(document.activeElement).toBe(pageControl);
  } finally {
    toggle.remove();
    await dom.cleanup();
  }
});
test('clicks on a pane that renders no sheet leave its open flag alone', async () => {
  const { dom, hidden } = createDom(true, loadPaneWithoutSheet);
  try {
    const view = await mountHost(dom);

    view.root.querySelector<HTMLElement>('.page-control')!.click();
    await nextTick();

    expect(hidden.value).toBe(false);
  } finally {
    await dom.cleanup();
  }
});
