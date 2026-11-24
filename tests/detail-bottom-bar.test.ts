import { expect, mock, test } from 'bun:test';

import { defineComponent, h, nextTick, reactive, shallowRef, watch, type Component } from 'vue';

import { resolveDetailSidebarSheetOpen } from '../app/utils/resolveDetailSidebarSheetOpen';
import { resolveReleaseDrawerSheetGesture } from '../app/utils/resolveReleaseDrawerSheetGesture';
import * as composerPresentation from '../shared/utils/composer-presentation';
import * as detailOverlayPresentation from '../shared/utils/detail-overlay-presentation';
import * as prReviewPresentation from '../shared/utils/pr-review-workspace-presentation';
import { commentModerationComposable } from './helpers/comment-moderation';
import { compileVue } from './helpers/compile-vue';
import { ScrollArea } from './helpers/scroll-area';
import { createVueDom } from './helpers/vue-dom';

mock.module('#shared/utils/composer-presentation', () => composerPresentation);
mock.module('#shared/utils/detail-overlay-presentation', () => detailOverlayPresentation);
mock.module('#shared/utils/pr-review-workspace-presentation', () => prReviewPresentation);

const detailOverlayChrome = await import('../app/composables/useDetailOverlayChrome');
const detailSheetDrag = await import('../app/composables/useDetailSheetDrag');

const empty = defineComponent({ setup: () => () => h('span') });
const iconProxy = new Proxy({}, { get: () => empty });

const DashboardTopHeader = await compileVue(
  'app/components/dashboard/overlay/DashboardTopHeader.vue',
  {
    '@lucide/vue': iconProxy,
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
    '~/components/layouts/ChromeActions.vue': {
      default: defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('div', { class: 'chrome-actions-stub' }, slots.actions?.()),
      }),
    },
    '~/utils/getDashboardSubjectStateVisual': {
      getIssueStatePillClass: () => 'is-closed',
      getIssueStateVisual: () => ({ icon: empty, color: '', isCompleted: false }),
    },
    '~/utils/getPullRequestStateVisual': {
      getPullRequestStateIcon: () => empty,
    },
  }
);

const DetailBottomBar = await compileVue('app/components/dashboard/detail/DetailBottomBar.vue', {
  '@lucide/vue': iconProxy,
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/composables/useDetailOverlayChrome': detailOverlayChrome,
});

const DetailSidebarColumn = await compileVue(
  'app/components/dashboard/detail/DetailSidebarColumn.vue',
  {
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    '~/composables/useDetailOverlayChrome': detailOverlayChrome,
    '~/composables/useDetailSheetDrag': detailSheetDrag,
  }
);

const MarkdownComposerStub = defineComponent({
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue', 'update:layout', 'update:bleed'],
  setup(props, { emit, expose }) {
    const focus = () => {};
    expose({ focus, seedLayout: () => {}, layout: 'tabbed', bleed: false });
    return () =>
      h('textarea', {
        class: 'composer-textarea',
        value: props.modelValue,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      });
  },
});

const FloatingMarkdownEditor = await compileVue(
  'app/components/dashboard/timeline/FloatingMarkdownEditor.vue',
  {
    '#shared/utils/composer-presentation': composerPresentation,
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
    '~/components/dashboard/composer/MarkdownComposer.vue': { default: MarkdownComposerStub },
    '~/components/ui/GitHubAvatar.vue': { default: empty },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
    '~/composables/useDetailOverlayChrome': detailOverlayChrome,
    '~/composables/useDetailSheetDrag': detailSheetDrag,
    '~/composables/useComposerBleedPosition': {
      useComposerBleedPosition: () => ({
        bleedStyle: shallowRef({}),
        panelHeight: shallowRef(0),
        bleedTarget: shallowRef('body'),
      }),
    },
  }
);

const DeferredFloatingMarkdownEditor = await compileVue(
  'app/components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue',
  {
    'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
    '~/components/ui/GitHubAvatar.vue': { default: empty },
    '~/components/dashboard/timeline/FloatingMarkdownEditor.vue': {
      default: FloatingMarkdownEditor,
    },
    '~/composables/useDetailOverlayChrome': detailOverlayChrome,
  }
);

const DashboardOverlayFrame = await compileVue(
  'app/components/dashboard/overlay/DashboardOverlayFrame.vue',
  {
    '@lucide/vue': iconProxy,
    '~/components/dashboard/overlay/DashboardTopHeader.vue': { default: DashboardTopHeader },
    '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  }
);

const Host = await compileVue('app/components/dashboard/detail/DetailOverlayHost.vue', {
  '~/composables/useCommentModeration': commentModerationComposable,
  '@lucide/vue': iconProxy,
  'vue-i18n': { useI18n: () => ({ t: (key: string) => key }) },
  '~/components/dashboard/detail/DetailBottomBar.vue': { default: DetailBottomBar },
  '~/components/dashboard/overlay/DashboardOverlayFrame.vue': { default: DashboardOverlayFrame },
  '~/components/ui/ScrollArea.vue': { default: ScrollArea },
  '~/composables/useComposerBleedPosition': { COMPOSER_BLEED_LAYER_ID: 'test-bleed' },
  '~/composables/useDetailOverlayChrome': detailOverlayChrome,
});

function createTestHarness(isNarrow: boolean) {
  const hidden = shallowRef(isNarrow);
  const isNarrowViewport = shallowRef(isNarrow);
  const isAnyModalOpen = shallowRef(false);
  const openReviewCalls: number[] = [];
  const submittedComments: string[] = [];
  let dispatchChrome:
    | ((action: detailOverlayPresentation.DetailOverlaySheetAction) => void)
    | null = null;

  const paneConfig = reactive({
    kind: 'pull-request' as 'pull-request' | 'issue' | 'discussion' | 'release' | 'repository',
    metadataCount: 4,
    additions: 1500,
    deletions: 3,
    canOpenReview: true,
    locked: false,
    inlineReplyOpen: false,
    releaseAssetCount: 3,
    starCount: 1500,
    language: 'TypeScript',
    languageColor: '#3178c6',
  });

  const TestPane = defineComponent({
    props: { detailSidebarHidden: Boolean },
    setup(props) {
      const chrome = detailOverlayChrome.useDetailOverlayChrome();
      if (chrome) {
        dispatchChrome = chrome.dispatch;
        chrome.setMetadataCount(paneConfig.metadataCount);
        const syncComposerAvailability = (locked: boolean) => {
          chrome.setComposerAvailability({
            available:
              paneConfig.kind === 'pull-request' ||
              paneConfig.kind === 'issue' ||
              paneConfig.kind === 'discussion',
            locked,
          });
        };
        syncComposerAvailability(paneConfig.locked);
        watch(
          () => paneConfig.locked,
          (locked) => syncComposerAvailability(locked)
        );
        chrome.setInlineReplyOpen(paneConfig.inlineReplyOpen);
        watch(
          () => paneConfig.inlineReplyOpen,
          (open) => chrome.setInlineReplyOpen(open)
        );
        chrome.setPrSummary(
          paneConfig.kind === 'pull-request'
            ? {
                additions: paneConfig.additions,
                deletions: paneConfig.deletions,
                canOpenReview: paneConfig.canOpenReview,
                onOpenReview: () => openReviewCalls.push(1),
              }
            : null
        );
        chrome.setReleaseSummary(
          paneConfig.kind === 'release' ? { assetCount: paneConfig.releaseAssetCount } : null
        );
        chrome.setRepoSummary(
          paneConfig.kind === 'repository'
            ? {
                starCount: paneConfig.starCount,
                language: paneConfig.language,
                languageColor: paneConfig.languageColor,
              }
            : null
        );
      }

      return () =>
        h('div', { class: 'columns' }, [
          h('div', { class: 'column detail-main-column' }, [
            paneConfig.kind === 'pull-request' ||
            paneConfig.kind === 'issue' ||
            paneConfig.kind === 'discussion'
              ? h(DeferredFloatingMarkdownEditor as never, {
                  repoOwner: 'pynickle',
                  repoName: 'gitpulse',
                  submit: async (body: string) => {
                    submittedComments.push(body);
                  },
                })
              : null,
          ]),
          h(
            DetailSidebarColumn as never,
            { hidden: props.detailSidebarHidden },
            { default: () => [h('div', { class: 'sidebar-marker' }, 'Sidebar')] }
          ),
        ]);
    },
  });

  const loadPane = async () => TestPane as Component;

  const dom = createVueDom({
    createDashboardDetailPaneLoaders: () => ({
      loadIssueDetail: loadPane,
      loadPrDetail: loadPane,
      loadDiscussionDetail: loadPane,
      loadReleaseDetail: loadPane,
      loadRepoDetail: loadPane,
    }),
    useNavigationHistory: () => ({ shouldShowHomeButton: shallowRef(false) }),
    useDetailSidebarState: () => ({
      isDetailSidebarHidden: hidden,
      syncDetailSidebarPane: () => {},
      toggleDetailSidebar: () => {
        hidden.value = !hidden.value;
      },
      closeDetailSidebar: () => {
        hidden.value = true;
      },
    }),
    useDetailSidebarViewport: () => ({
      isDetailSidebarSheetViewport: isNarrowViewport,
    }),
    useCompactCount: () => ({
      compact: (n: number | null | undefined) => (n === 1500 ? '1.5K' : String(n ?? 0)),
      exact: (n: number | null | undefined) => (n ?? 0).toLocaleString('en-US'),
    }),
    useModalState: () => ({
      isAnyModalOpen,
      openModal: () => {},
      closeModal: () => {},
    }),
    useUserSession: () => ({ user: shallowRef({ login: 'octocat', avatar_url: '' }) }),
    useUserSettings: () => ({
      settings: shallowRef({
        composer: {
          conversationDefaultLayout: 'tabbed',
          reviewInlineDefaultLayout: 'tabbed',
          conversationMobileDefaultLayout: 'tabbed',
          reviewInlineMobileDefaultLayout: 'tabbed',
        },
      }),
    }),
    useGitPulseApiFetch: () => async () => ({}),
    resolveDetailSidebarSheetOpen,
    resolveReleaseDrawerSheetGesture,
  });

  const hostProps = reactive({
    issue: null as Record<string, unknown> | null,
    pullRequest: { number: 12, title: 'Narrow overlay', state: 'open' } as Record<
      string,
      unknown
    > | null,
    discussion: null as Record<string, unknown> | null,
    release: null as Record<string, unknown> | null,
    repository: null as Record<string, unknown> | null,
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
    pullRequestDetailKey: 'pr-12',
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

  const switchPane = (kind: 'pull-request' | 'issue' | 'discussion' | 'release' | 'repository') => {
    paneConfig.kind = kind;
    hostProps.isPullRequestVisible = kind === 'pull-request';
    hostProps.isIssueVisible = kind === 'issue';
    hostProps.isDiscussionVisible = kind === 'discussion';
    hostProps.isReleaseVisible = kind === 'release';
    hostProps.isRepositoryVisible = kind === 'repository';
    hostProps.pullRequest =
      kind === 'pull-request' ? { number: 12, title: 'PR', state: 'open' } : null;
    hostProps.issue = kind === 'issue' ? { number: 7, title: 'Issue', state: 'open' } : null;
    hostProps.discussion =
      kind === 'discussion' ? { number: 9, title: 'Disc', isAnswered: false } : null;
    hostProps.release = kind === 'release' ? { id: 3, tag_name: 'v1.0.0' } : null;
    hostProps.repository =
      kind === 'repository' ? { id: 4, name: 'gitpulse', owner: { login: 'pynickle' } } : null;
    hostProps.pullRequestDetailKey = kind === 'pull-request' ? 'pr-12' : '';
    hostProps.issueDetailKey = kind === 'issue' ? 'issue-7' : '';
    hostProps.discussionDetailKey = kind === 'discussion' ? 'disc-9' : '';
    hostProps.releaseDetailKey = kind === 'release' ? 'rel-3' : '';
    hostProps.repositoryDetailKey = kind === 'repository' ? 'repo-4' : '';
  };

  return {
    dom,
    hidden,
    isNarrowViewport,
    hostProps,
    paneConfig,
    openReviewCalls,
    submittedComments,
    dispatchChrome: (action: detailOverlayPresentation.DetailOverlaySheetAction) =>
      dispatchChrome?.(action),
    switchPane,
  };
}

const settle = async () => {
  await Bun.sleep(0);
  await nextTick();
  await nextTick();
};

test('renders subject-specific slots across all 5 Detail Overlays and hides top-bar toggle on narrow', async () => {
  const harness = createTestHarness(true);
  try {
    const view = harness.dom.mount(
      defineComponent({ setup: () => () => h(Host, harness.hostProps) })
    );
    await settle();

    // Top-bar sidebar toggle is hidden on narrow.
    expect(view.root.querySelector('.dashboard-top-header__detail-sidebar-toggle')).toBeNull();

    // Pull Request: 3 slots (Comment, Review +1.5K -3, Details 4) + exact count tooltips
    const bar = view.root.querySelector('.detail-bottom-bar')!;
    expect(bar).not.toBeNull();
    expect(bar.querySelector('.detail-bottom-bar__composer-toggle')).not.toBeNull();
    expect(bar.querySelector('.detail-bottom-bar__review-trigger')?.textContent).toContain('+1.5K');
    expect(bar.querySelector('.detail-bottom-bar__review-trigger')?.textContent).toContain('-3');
    expect(bar.querySelector('.detail-bottom-bar__diff-add')?.getAttribute('title')).toBe('1,500');
    expect(bar.querySelector('.detail-bottom-bar__diff-del')?.getAttribute('title')).toBe('3');
    expect(bar.querySelector('.detail-bottom-bar__sidebar-toggle')?.textContent).toContain('4');

    // Issue: 2 slots (Comment, Details 4)
    harness.switchPane('issue');
    await settle();
    expect(view.root.querySelector('.detail-bottom-bar__composer-toggle')).not.toBeNull();
    expect(view.root.querySelector('.detail-bottom-bar__review-trigger')).toBeNull();
    expect(view.root.querySelector('.detail-bottom-bar__sidebar-toggle')?.textContent).toContain(
      '4'
    );

    // Discussion (locked): 2 slots with disabled locked comment button and no count badge
    harness.paneConfig.locked = true;
    harness.paneConfig.metadataCount = 0;
    harness.switchPane('discussion');
    await settle();
    const lockedCommentBtn = view.root.querySelector<HTMLButtonElement>(
      '.detail-bottom-bar__composer-toggle'
    )!;
    expect(lockedCommentBtn.disabled).toBe(true);
    expect(lockedCommentBtn.textContent).toContain('detailOverlay.commentLocked');
    expect(view.root.querySelector('.detail-bottom-bar__count')).toBeNull();

    // Release: single unified summary trigger showing asset count
    harness.paneConfig.locked = false;
    harness.switchPane('release');
    await settle();
    const releaseTriggers = view.root.querySelectorAll('.detail-bottom-bar__entry');
    expect(releaseTriggers).toHaveLength(1);
    expect(releaseTriggers[0]?.textContent).toContain('releaseDetail.assetCount');
    expect(releaseTriggers[0]?.textContent).toContain('detailOverlay.releaseDetails');

    // Repository: single unified summary trigger showing compact star count and language
    harness.switchPane('repository');
    await settle();
    const repoTriggers = view.root.querySelectorAll('.detail-bottom-bar__entry');
    expect(repoTriggers).toHaveLength(1);
    expect(repoTriggers[0]?.textContent).toContain('1.5K');
    expect(
      repoTriggers[0]?.querySelector('.detail-bottom-bar__stat-value')?.getAttribute('title')
    ).toBe('1,500');
    expect(releaseTriggers[0]).not.toBeNull();
    expect(repoTriggers[0]?.textContent).toContain('TypeScript');
    expect(repoTriggers[0]?.textContent).toContain('detailOverlay.repoDetails');
  } finally {
    await harness.dom.cleanup();
  }
});

test('PR Review button triggers review workspace and closes any open sheet', async () => {
  const harness = createTestHarness(true);
  try {
    const view = harness.dom.mount(
      defineComponent({ setup: () => () => h(Host, harness.hostProps) })
    );
    await settle();

    view.root.querySelector<HTMLButtonElement>('.detail-bottom-bar__sidebar-toggle')!.click();
    await nextTick();
    expect(harness.hidden.value).toBe(false);

    view.root.querySelector<HTMLButtonElement>('.detail-bottom-bar__review-trigger')!.click();
    await nextTick();
    expect(harness.openReviewCalls).toHaveLength(1);
    expect(harness.hidden.value).toBe(true);
  } finally {
    await harness.dom.cleanup();
  }
});

test('enforces mutual exclusion between sidebar and composer sheets and retains composer draft on dismiss vs clears on Cancel', async () => {
  const harness = createTestHarness(true);
  try {
    const view = harness.dom.mount(
      defineComponent({ setup: () => () => h(Host, harness.hostProps) })
    );
    await settle();

    // In-flow sticky capsule is hidden on narrow.
    expect(view.root.querySelector('.deferred-floating-markdown-editor')).toBeNull();

    const sidebarBtn = view.root.querySelector<HTMLButtonElement>(
      '.detail-bottom-bar__sidebar-toggle'
    )!;
    const composerBtn = view.root.querySelector<HTMLButtonElement>(
      '.detail-bottom-bar__composer-toggle'
    )!;

    // Open sidebar sheet, then switch to composer sheet (sidebar closes).
    sidebarBtn.click();
    await settle();
    expect(harness.hidden.value).toBe(false);

    composerBtn.click();
    await settle();
    expect(harness.hidden.value).toBe(true);
    const sheet = view.root.querySelector('.detail-composer-sheet');
    expect(sheet).not.toBeNull();

    // Type a draft, then dismiss via scrim -> draft is kept and draft dot is visible.
    const textarea = sheet!.querySelector<HTMLTextAreaElement>('textarea.composer-textarea')!;
    textarea.value = 'Draft surviving scrim';
    textarea.dispatchEvent(new harness.dom.window.Event('input', { bubbles: true }));
    await nextTick();

    view.root.querySelector<HTMLButtonElement>('.detail-composer-sheet-backdrop')!.click();
    await settle();
    expect(view.root.querySelector('.detail-composer-sheet')).toBeNull();
    expect(view.root.querySelector('.detail-bottom-bar__draft-dot')).not.toBeNull();

    // Re-open composer -> draft text is still there; explicit Cancel clears draft and hides dot.
    composerBtn.click();
    await settle();
    const reopenedTextarea = view.root.querySelector<HTMLTextAreaElement>(
      '.detail-composer-sheet textarea.composer-textarea'
    )!;
    expect(reopenedTextarea.value).toBe('Draft surviving scrim');

    const cancelBtn = [
      ...view.root.querySelectorAll<HTMLButtonElement>('.detail-composer-sheet button'),
    ].find((button) => button.textContent?.includes('floatingMarkdownEditor.cancel'))!;
    cancelBtn.click();
    await settle();
    expect(view.root.querySelector('.detail-composer-sheet')).toBeNull();
    expect(view.root.querySelector('.detail-bottom-bar__draft-dot')).toBeNull();
  } finally {
    await harness.dom.cleanup();
  }
});

test('suppresses the Detail Bottom Bar on wide viewports, feedback states, inline reply, and keyboard open', async () => {
  const harness = createTestHarness(true);
  const listeners = new Map<string, Set<() => void>>();
  let visualHeight = 844;
  Object.defineProperty(harness.dom.window, 'innerHeight', {
    configurable: true,
    value: 844,
  });
  Object.defineProperty(harness.dom.window, 'visualViewport', {
    configurable: true,
    value: {
      get height() {
        return visualHeight;
      },
      offsetTop: 0,
      scale: 1,
      addEventListener: (type: string, cb: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(cb);
      },
      removeEventListener: (type: string, cb: () => void) => {
        listeners.get(type)?.delete(cb);
      },
    },
  });
  try {
    const view = harness.dom.mount(
      defineComponent({ setup: () => () => h(Host, harness.hostProps) })
    );
    await settle();
    expect(view.root.querySelector('.detail-bottom-bar')).not.toBeNull();

    harness.hostProps.loadingPullRequest = true;
    await settle();
    expect(view.root.querySelector('.detail-bottom-bar')).toBeNull();

    harness.hostProps.loadingPullRequest = false;
    await settle();
    expect(view.root.querySelector('.detail-bottom-bar')).not.toBeNull();

    // Opening the virtual keyboard hides the Detail Bottom Bar.
    visualHeight = 500;
    listeners.get('resize')?.forEach((cb) => cb());
    await settle();
    expect(view.root.querySelector('.detail-bottom-bar')).toBeNull();

    visualHeight = 844;
    listeners.get('resize')?.forEach((cb) => cb());
    await settle();
    expect(view.root.querySelector('.detail-bottom-bar')).not.toBeNull();

    // Opening an inline Discussion reply suppresses the Detail Bottom Bar.
    harness.paneConfig.inlineReplyOpen = true;
    await settle();
    expect(view.root.querySelector('.detail-bottom-bar')).toBeNull();

    harness.paneConfig.inlineReplyOpen = false;
    await settle();
    expect(view.root.querySelector('.detail-bottom-bar')).not.toBeNull();

    // Switching to wide hides Detail Bottom Bar and shows top-bar toggle.
    harness.isNarrowViewport.value = false;
    await settle();
    expect(view.root.querySelector('.detail-bottom-bar')).toBeNull();
    expect(view.root.querySelector('.dashboard-top-header__detail-sidebar-toggle')).not.toBeNull();
  } finally {
    await harness.dom.cleanup();
  }
});

test('locked conversations disable and close the narrow composer sheet', async () => {
  const harness = createTestHarness(true);
  try {
    const view = harness.dom.mount(
      defineComponent({ setup: () => () => h(Host, harness.hostProps) })
    );
    await settle();

    const composerToggle = () =>
      view.root.querySelector<HTMLButtonElement>('.detail-bottom-bar__composer-toggle')!;

    // Open composer while unlocked, then lock the conversation -> sheet closes immediately.
    composerToggle().click();
    await settle();
    expect(view.root.querySelector('.detail-composer-sheet')).not.toBeNull();

    harness.paneConfig.locked = true;
    await settle();
    expect(view.root.querySelector('.detail-composer-sheet')).toBeNull();
    expect(composerToggle().disabled).toBe(true);
    expect(composerToggle().textContent).toContain('detailOverlay.commentLocked');

    // Direct dispatch / clicking disabled toggle while locked cannot open the composer sheet.
    composerToggle().click();
    harness.dispatchChrome({ type: 'toggle-composer' });
    await settle();
    expect(view.root.querySelector('.detail-composer-sheet')).toBeNull();
  } finally {
    await harness.dom.cleanup();
  }
});
