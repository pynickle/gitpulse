import { describe, expect, mock, test } from 'bun:test';

import { computed, defineComponent, h, nextTick, ref, shallowRef } from 'vue';

import { parseGridTemplateColumnWidths } from '../app/utils/parseGridTemplateColumnWidths';
import * as prReviewWorkspacePresentation from '../shared/utils/pr-review-workspace-presentation';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const empty = defineComponent({ setup: () => () => h('span') });
const i18n = { useI18n: () => ({ t: (key: string) => key }) };

// The review data is irrelevant here: an empty file list keeps the header
// mounted while the diff panes stay out of the tree.
const review = {
  files: ref([]),
  reviewComments: ref([]),
  activeFilename: shallowRef(''),
  pagination: ref({ hasNext: false }),
  loading: shallowRef(false),
  loadingMore: shallowRef(false),
  submitting: shallowRef(false),
  resolvingReviewThreadId: shallowRef(null),
  errorMessage: shallowRef(''),
  submitError: shallowRef(''),
  draftBody: shallowRef(''),
  selectedEvent: shallowRef('COMMENT'),
  draftComments: ref([]),
  activeDraftTarget: ref(null),
  allDiffSections: computed(() => []),
  reviewCommentThreads: computed(() => []),
  pendingCommentCount: computed(() => 0),
  canSubmit: computed(() => false),
  loadMoreFiles: () => {},
  retryLoad: () => {},
  selectFile: () => {},
  syncVisibleFile: () => {},
  openDraftEditor: () => {},
  closeDraftEditor: () => {},
  saveDraftComment: () => {},
  removeDraftComment: () => {},
  toggleReviewThreadResolved: () => {},
  submitReview: () => {},
};

const presentation = {
  presentation: ref({
    mode: 'wide',
    diffArrangement: 'split',
    showFileColumn: true,
    showSubmitColumn: true,
    wrapCode: true,
  }),
  keyboardInsetPx: ref(0),
  keyboardVisibleHeightPx: ref(null),
};

const navigation = {
  canGoBack: ref(false),
  goBackToPreviousPage: mock(async () => {}),
  goToDashboardHome: mock(async () => {}),
};

const Workspace = await compileVue(
  'app/components/dashboard/pr/PRReviewWorkspace.vue',
  {
    '@lucide/vue': {
      ArrowLeftIcon: empty,
      GitPullRequestIcon: empty,
      HouseIcon: empty,
      MessageSquareIcon: empty,
    },
    '#shared/utils/pr-review-workspace-presentation': prReviewWorkspacePresentation,
    '~/components/dashboard/pr/PRReviewBottomBar.vue': { default: empty },
    '~/components/dashboard/pr/PRReviewDiffViewer.vue': { default: empty },
    '~/components/dashboard/pr/PRReviewFileSidebar.vue': { default: empty },
    '~/components/dashboard/pr/PRReviewSubmitBar.vue': { default: empty },
    '~/utils/prReviewNavigation': { shouldCloseReviewWorkspaceAfterSubmit: () => false },
    '~/utils/parseGridTemplateColumnWidths': { parseGridTemplateColumnWidths },
    '~/composables/usePRReview': { usePRReview: () => review },
    '~/composables/usePRReviewWorkspacePresentation': {
      usePRReviewWorkspacePresentation: () => presentation,
    },
    '~/composables/useNavigationRouting': { useNavigationRouting: () => navigation },
    'vue-i18n': i18n,
  },
  {
    useI18n: 'vue-i18n',
    useNavigationRouting: '~/composables/useNavigationRouting',
    usePRReview: '~/composables/usePRReview',
    usePRReviewWorkspacePresentation: '~/composables/usePRReviewWorkspacePresentation',
    parseGridTemplateColumnWidths: '~/utils/parseGridTemplateColumnWidths',
  }
);

const mountWorkspace = async (canGoBack: boolean) => {
  navigation.canGoBack.value = canGoBack;
  navigation.goBackToPreviousPage.mockClear();
  navigation.goToDashboardHome.mockClear();

  const close = mock(() => {});
  const dom = createVueDom();
  const view = dom.mount(
    defineComponent({
      setup: () => () =>
        h(Workspace, {
          owner: 'acme',
          repo: 'widget',
          pullNumber: 42,
          commitId: 'abc123',
          title: 'Add a widget',
          onClose: close,
        }),
    })
  );
  await nextTick();

  return {
    dom,
    close,
    backButton: () => view.root.querySelector<HTMLElement>('[aria-label="repoFileView.back"]'),
    homeButton: () => view.root.querySelector<HTMLElement>('[aria-label="repoFileView.home"]'),
  };
};

describe('PR review workspace header navigation', () => {
  test('Back returns to the pull request details when there is no navigation history', async () => {
    const workspace = await mountWorkspace(false);
    try {
      workspace.backButton()!.click();
      await nextTick();

      expect(workspace.close).toHaveBeenCalledTimes(1);
      expect(navigation.goBackToPreviousPage).not.toHaveBeenCalled();
    } finally {
      await workspace.dom.cleanup();
    }
  });

  test('Back follows the logical history when the workspace was opened from another page', async () => {
    const workspace = await mountWorkspace(true);
    try {
      workspace.backButton()!.click();
      await nextTick();

      expect(navigation.goBackToPreviousPage).toHaveBeenCalledTimes(1);
      expect(workspace.close).not.toHaveBeenCalled();
    } finally {
      await workspace.dom.cleanup();
    }
  });

  test('Back and Home are always offered, and Home returns to the dashboard home', async () => {
    for (const canGoBack of [false, true]) {
      const workspace = await mountWorkspace(canGoBack);
      try {
        expect(workspace.backButton()).not.toBeNull();
        expect(workspace.homeButton()).not.toBeNull();

        workspace.homeButton()!.click();
        await nextTick();

        expect(navigation.goToDashboardHome).toHaveBeenCalledTimes(1);
      } finally {
        await workspace.dom.cleanup();
      }
    }
  });
});
