export type DetailOverlaySheet = 'sidebar' | 'composer';

export interface DetailOverlaySheetState {
  openSheet: DetailOverlaySheet | null;
}

export type DetailOverlaySheetAction =
  | { type: 'toggle-sidebar' }
  | { type: 'toggle-composer' }
  | { type: 'dismiss-sheet' }
  | { type: 'cancel-composer' }
  | { type: 'submit-composer' }
  | { type: 'navigate-from-sheet' };

export interface DetailBottomBarPresentationInput {
  isNarrowViewport: boolean;
  hasActivePane: boolean;
  isFeedbackVisible: boolean;
  isPullRequestReviewActive: boolean;
  openSheet: DetailOverlaySheet | null;
  keyboardOpen: boolean;
  inlineReplyOpen: boolean;
}

export interface DetailBottomBarPresentation {
  openSheet: DetailOverlaySheet | null;
  showBottomBar: boolean;
}

export type DetailMetadataCountInput =
  | { kind: 'pull-request'; labelCount: number; assigneeCount: number; reviewerCount: number }
  | { kind: 'issue'; labelCount: number; assigneeCount: number; hasIssueType: boolean }
  | { kind: 'discussion' | 'release' | 'repository' };

export function reduceDetailOverlaySheets(
  state: DetailOverlaySheetState,
  action: DetailOverlaySheetAction
): DetailOverlaySheetState {
  if (action.type === 'toggle-sidebar') {
    return { openSheet: state.openSheet === 'sidebar' ? null : 'sidebar' };
  }

  if (action.type === 'toggle-composer') {
    return { openSheet: state.openSheet === 'composer' ? null : 'composer' };
  }

  return { openSheet: null };
}

export function presentDetailBottomBar(
  input: DetailBottomBarPresentationInput
): DetailBottomBarPresentation {
  if (
    !input.isNarrowViewport ||
    !input.hasActivePane ||
    input.isFeedbackVisible ||
    input.isPullRequestReviewActive
  ) {
    return { openSheet: null, showBottomBar: false };
  }

  return {
    openSheet: input.openSheet,
    showBottomBar: !input.keyboardOpen && !input.inlineReplyOpen,
  };
}

export function resolveDetailSidebarMetadataCount(input: DetailMetadataCountInput): number {
  if (input.kind === 'pull-request') {
    return (
      Math.max(0, input.labelCount) +
      Math.max(0, input.assigneeCount) +
      Math.max(0, input.reviewerCount)
    );
  }

  if (input.kind === 'issue') {
    return (
      Math.max(0, input.labelCount) +
      Math.max(0, input.assigneeCount) +
      (input.hasIssueType ? 1 : 0)
    );
  }

  return 0;
}
