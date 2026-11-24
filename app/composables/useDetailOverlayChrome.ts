import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  readonly,
  shallowRef,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue';

import {
  presentDetailBottomBar,
  reduceDetailOverlaySheets,
  type DetailBottomBarPresentation,
  type DetailOverlaySheet,
  type DetailOverlaySheetAction,
} from '#shared/utils/detail-overlay-presentation';
import { resolveReviewKeyboardFrame } from '#shared/utils/pr-review-workspace-presentation';

export const DETAIL_SHEET_LAYER_ID = 'gitpulse-detail-sheet-layer';

export type DetailOverlayPaneType =
  | 'issue'
  | 'pull-request'
  | 'discussion'
  | 'release'
  | 'repository';

export interface DetailComposerAvailability {
  available: boolean;
  locked: boolean;
}

export interface DetailBottomBarComposerState extends DetailComposerAvailability {
  hasDraft: boolean;
}

export interface DetailBottomBarPrSummary {
  additions?: number;
  deletions?: number;
  canOpenReview: boolean;
  onOpenReview: () => void;
}

export interface DetailBottomBarReleaseSummary {
  assetCount: number;
}

export interface DetailBottomBarRepoSummary {
  starCount: number;
  language?: string | null;
  languageColor?: string;
}

export interface DetailOverlayChromeOptions {
  activePaneType: Readonly<Ref<DetailOverlayPaneType | null>>;
  activeDetailKey: Readonly<Ref<string>>;
  isFeedbackVisible: Readonly<Ref<boolean>>;
  isPullRequestReviewActive: Readonly<Ref<boolean>>;
  isNarrowViewport: Readonly<Ref<boolean>>;
  isSidebarHidden: Readonly<Ref<boolean>>;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
}

export interface DetailOverlayChromeContext {
  activePaneType: Readonly<Ref<DetailOverlayPaneType | null>>;
  isNarrowViewport: Readonly<Ref<boolean>>;
  openSheet: ComputedRef<DetailOverlaySheet | null>;
  bottomBar: ComputedRef<DetailBottomBarPresentation>;
  keyboardInsetPx: Readonly<Ref<number>>;
  keyboardVisibleHeightPx: Readonly<Ref<number | null>>;
  metadataCount: Readonly<Ref<number>>;
  composer: ComputedRef<DetailBottomBarComposerState>;
  prSummary: Readonly<Ref<DetailBottomBarPrSummary | null>>;
  releaseSummary: Readonly<Ref<DetailBottomBarReleaseSummary | null>>;
  repoSummary: Readonly<Ref<DetailBottomBarRepoSummary | null>>;
  dispatch: (action: DetailOverlaySheetAction) => void;
  setMetadataCount: (count: number) => void;
  setComposerAvailability: (value: DetailComposerAvailability) => void;
  setComposerDraft: (hasDraft: boolean) => void;
  setInlineReplyOpen: (open: boolean) => void;
  setPrSummary: (summary: DetailBottomBarPrSummary | null) => void;
  setReleaseSummary: (summary: DetailBottomBarReleaseSummary | null) => void;
  setRepoSummary: (summary: DetailBottomBarRepoSummary | null) => void;
}

const detailOverlayChromeKey: InjectionKey<DetailOverlayChromeContext> = Symbol(
  'gitpulse-detail-overlay-chrome'
);

export function provideDetailOverlayChrome(
  options: DetailOverlayChromeOptions
): DetailOverlayChromeContext {
  const composerOpen = shallowRef(false);
  const keyboardInsetPx = shallowRef(0);
  const keyboardVisibleHeightPx = shallowRef<number | null>(null);
  const metadataCount = shallowRef(0);
  const composerAvailability = shallowRef<DetailComposerAvailability>({
    available: false,
    locked: false,
  });
  const hasComposerDraft = shallowRef(false);
  const inlineReplyOpen = shallowRef(false);
  const prSummary = shallowRef<DetailBottomBarPrSummary | null>(null);
  const releaseSummary = shallowRef<DetailBottomBarReleaseSummary | null>(null);
  const repoSummary = shallowRef<DetailBottomBarRepoSummary | null>(null);

  const openSheet = computed<DetailOverlaySheet | null>(() => {
    if (
      !options.isNarrowViewport.value ||
      options.isFeedbackVisible.value ||
      options.isPullRequestReviewActive.value ||
      !options.activePaneType.value
    ) {
      return null;
    }

    if (
      composerOpen.value &&
      composerAvailability.value.available &&
      !composerAvailability.value.locked
    ) {
      return 'composer';
    }

    if (!options.isSidebarHidden.value) {
      return 'sidebar';
    }

    return null;
  });

  const bottomBar = computed<DetailBottomBarPresentation>(() =>
    presentDetailBottomBar({
      isNarrowViewport: options.isNarrowViewport.value,
      hasActivePane: Boolean(options.activePaneType.value),
      isFeedbackVisible: options.isFeedbackVisible.value,
      isPullRequestReviewActive: options.isPullRequestReviewActive.value,
      openSheet: openSheet.value,
      keyboardOpen: keyboardInsetPx.value > 0,
      inlineReplyOpen: inlineReplyOpen.value,
    })
  );

  const composer = computed<DetailBottomBarComposerState>(() => ({
    ...composerAvailability.value,
    hasDraft: hasComposerDraft.value,
  }));

  const dispatch = (action: DetailOverlaySheetAction) => {
    if (
      action.type === 'toggle-composer' &&
      (!composerAvailability.value.available || composerAvailability.value.locked)
    ) {
      return;
    }

    const next = reduceDetailOverlaySheets({ openSheet: openSheet.value }, action).openSheet;

    if (next === 'sidebar') {
      composerOpen.value = false;
      if (options.isSidebarHidden.value) {
        options.onToggleSidebar();
      }
      return;
    }

    if (next === 'composer') {
      if (!options.isSidebarHidden.value) {
        options.onCloseSidebar();
      }
      composerOpen.value = true;
      return;
    }

    composerOpen.value = false;
    if (options.isNarrowViewport.value && !options.isSidebarHidden.value) {
      options.onCloseSidebar();
    }
  };

  watch(
    options.activeDetailKey,
    () => {
      composerOpen.value = false;
      metadataCount.value = 0;
      composerAvailability.value = { available: false, locked: false };
      hasComposerDraft.value = false;
      inlineReplyOpen.value = false;
      prSummary.value = null;
      releaseSummary.value = null;
      repoSummary.value = null;
    },
    { flush: 'sync' }
  );

  watch([options.isPullRequestReviewActive, options.isNarrowViewport], ([reviewActive, narrow]) => {
    if (reviewActive || !narrow) {
      composerOpen.value = false;
    }
  });

  watch([options.isNarrowViewport, options.isSidebarHidden], ([narrow, hidden]) => {
    if (narrow && !hidden) {
      composerOpen.value = false;
    }
  });

  const syncKeyboard = () => {
    if (typeof window === 'undefined') return;
    const visualViewport = window.visualViewport;
    const frame = resolveReviewKeyboardFrame({
      innerHeight: window.innerHeight,
      visualViewportHeight: visualViewport?.height ?? null,
      visualViewportOffsetTop: visualViewport?.offsetTop ?? null,
      visualViewportScale: visualViewport?.scale ?? null,
    });
    keyboardInsetPx.value = frame.insetPx;
    keyboardVisibleHeightPx.value = frame.visibleHeightPx;
  };

  onMounted(() => {
    syncKeyboard();
    window.visualViewport?.addEventListener('resize', syncKeyboard);
    window.visualViewport?.addEventListener('scroll', syncKeyboard);
    window.addEventListener('resize', syncKeyboard);
  });

  onBeforeUnmount(() => {
    if (typeof window === 'undefined') return;
    window.visualViewport?.removeEventListener('resize', syncKeyboard);
    window.visualViewport?.removeEventListener('scroll', syncKeyboard);
    window.removeEventListener('resize', syncKeyboard);
  });

  const context: DetailOverlayChromeContext = {
    activePaneType: options.activePaneType,
    isNarrowViewport: options.isNarrowViewport,
    openSheet,
    bottomBar,
    keyboardInsetPx: readonly(keyboardInsetPx),
    keyboardVisibleHeightPx: readonly(keyboardVisibleHeightPx),
    metadataCount: readonly(metadataCount),
    composer,
    prSummary: readonly(prSummary),
    releaseSummary: readonly(releaseSummary),
    repoSummary: readonly(repoSummary),
    dispatch,
    setMetadataCount: (count) => {
      metadataCount.value = Math.max(0, count);
    },
    setComposerAvailability: (value) => {
      composerAvailability.value = value;
      if (!value.available || value.locked) {
        composerOpen.value = false;
      }
    },
    setComposerDraft: (hasDraft) => {
      hasComposerDraft.value = hasDraft;
    },
    setInlineReplyOpen: (open) => {
      inlineReplyOpen.value = open;
    },
    setPrSummary: (summary) => {
      prSummary.value = summary;
    },
    setReleaseSummary: (summary) => {
      releaseSummary.value = summary;
    },
    setRepoSummary: (summary) => {
      repoSummary.value = summary;
    },
  };

  provide(detailOverlayChromeKey, context);
  return context;
}

export function useDetailOverlayChrome(): DetailOverlayChromeContext | null {
  return inject(detailOverlayChromeKey, null);
}
