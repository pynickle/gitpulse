import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive, shallowRef } from 'vue';

import { resolveDetailSidebarSheetOpen } from '../app/utils/resolveDetailSidebarSheetOpen';
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
const load = async () => empty;
const Host = await compileVue('app/components/dashboard/detail/DetailOverlayHost.vue', {
  '@lucide/vue': { LoaderCircleIcon: empty },
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/components/dashboard/overlay/DashboardOverlayFrame.vue': { default: frame },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  '~/composables/useComposerBleedPosition': { COMPOSER_BLEED_LAYER_ID: 'test-bleed' },
});

const createDom = (isDetailSidebarSheetViewport: boolean) => {
  const hidden = shallowRef(false);
  return {
    hidden,
    dom: createVueDom({
      createDashboardDetailPaneLoaders: () => ({
        loadIssueDetail: load,
        loadPrDetail: load,
        loadDiscussionDetail: load,
        loadReleaseDetail: load,
        loadRepoDetail: load,
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

const mountHost = (dom: ReturnType<typeof createDom>['dom']) => {
  const view = dom.mount(defineComponent({ setup: () => () => h(Host, createProps()) }));
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
    const view = mountHost(dom);
    await nextTick();

    const stage = view.root.querySelector<HTMLElement>('.detail-pane-stage')!;
    expect(stage.classList.contains('detail-pane-stage--sidebar-sheet')).toBe(true);
    // A scrim here would out-stack the fixed sheet and eat its gestures.
    expect(view.root.querySelector('.detail-sidebar-sheet-backdrop')).toBeNull();
  } finally {
    await dom.cleanup();
  }
});

test('a wide viewport leaves the Detail Sidebar inline instead of pinning a sheet', async () => {
  const { dom } = createDom(false);
  try {
    const view = mountHost(dom);
    await nextTick();

    const stage = view.root.querySelector<HTMLElement>('.detail-pane-stage')!;
    expect(stage.classList.contains('detail-pane-stage--sidebar-sheet')).toBe(false);
  } finally {
    await dom.cleanup();
  }
});

test('closing the sheet hands focus back to the header toggle', async () => {
  const { dom, hidden } = createDom(true);
  // The overlay frame owns the toggle; the host looks it up by class to restore focus.
  const toggle = document.createElement('button');
  toggle.className = 'dashboard-top-header__detail-sidebar-toggle';
  document.body.append(toggle);
  try {
    const view = mountHost(dom);
    await nextTick();

    const sheetControl = document.createElement('button');
    view.root.querySelector('.detail-pane')!.append(sheetControl);
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
