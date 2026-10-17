import { expect, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive, shallowRef } from 'vue';

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
const Host = await compileVue('app/components/dashboard/detail/DetailOverlayHost.vue', {
  '@lucide/vue': { Loader2Icon: empty },
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/components/dashboard/overlay/DashboardOverlayFrame.vue': { default: frame },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  '~/composables/useComposerBleedPosition': { COMPOSER_BLEED_LAYER_ID: 'test-bleed' },
  '~/utils/createDashboardDetailPaneLoaders': {
    default: () => ({
      loadIssueDetail: load,
      loadPrDetail: load,
      loadDiscussionDetail: load,
      loadReleaseDetail: load,
      loadRepoDetail: async () => repository,
    }),
  },
});

test('repository loading and errors fill the pane without a nested scrolling content box', async () => {
  const dom = createVueDom({
    useNavigationHistory: () => ({ shouldShowHomeButton: shallowRef(false) }),
    useDetailSidebarState: () => ({
      isDetailSidebarHidden: shallowRef(false),
      syncDetailSidebarPane: () => {},
      toggleDetailSidebar: () => {},
    }),
    useDetailSidebarViewport: () => ({ isDetailSidebarSheetViewport: shallowRef(false) }),
    resolveDetailSidebarSheetOpen: () => false,
  });
  const props = reactive({
    issue: null,
    pullRequest: null,
    discussion: null,
    release: null,
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
    for (let i = 0; i < 6; i++) await nextTick();
    expect(pane.classList.contains('scroll-area--disabled')).toBe(false);
    expect(pane.classList.contains('detail-pane--page-scroll')).toBe(true);
    expect(pane.classList.contains('detail-pane--feedback')).toBe(false);
    expect(view.root.textContent).toContain('Repository content');
  } finally {
    await dom.cleanup();
  }
});
