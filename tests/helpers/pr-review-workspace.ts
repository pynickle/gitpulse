import { mock } from 'bun:test';

import { computed, defineComponent, h, ref, shallowRef, type Ref } from 'vue';

import type { PRReviewFile } from '../../app/composables/usePRReview';
import { parseGridTemplateColumnWidths } from '../../app/utils/parseGridTemplateColumnWidths';
import * as prReviewWorkspacePresentation from '../../shared/utils/pr-review-workspace-presentation';
import { compileVue } from './compile-vue';

const empty = defineComponent({ setup: () => () => h('span') });

export interface PRReviewWorkspaceI18n {
  useI18n: () => {
    locale: Ref<string>;
    t: (key: string, params?: Record<string, unknown>) => string;
  };
}

/**
 * The real review workspace compiled with its children stubbed, exposing the
 * seams a test steers: the loaded files, the presentation mode, and the
 * navigation actions.
 */
export async function compilePRReviewWorkspace(i18n: PRReviewWorkspaceI18n) {
  const review = {
    files: ref<PRReviewFile[]>([]),
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

  return { Workspace, review, presentation, navigation };
}
