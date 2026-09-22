import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue';

import {
  PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH,
  resolvePRReviewWorkspacePresentation,
  resolveReviewKeyboardInset,
} from '#shared/utils/pr-review-workspace-presentation';

/**
 * Starts wide so server markup and hydration match. The narrow layout itself
 * is the stylesheet built from PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH, which
 * applies before this listener runs.
 */
export function usePRReviewWorkspacePresentation() {
  const viewportWidth = shallowRef(PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH + 1);
  const keyboardInsetPx = shallowRef(0);

  let media: MediaQueryList | undefined;
  const syncViewport = () => {
    viewportWidth.value = media?.matches
      ? PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH
      : PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH + 1;
  };

  const syncKeyboard = () => {
    const visualViewport = window.visualViewport;
    keyboardInsetPx.value = resolveReviewKeyboardInset({
      innerHeight: window.innerHeight,
      visualViewportHeight: visualViewport?.height ?? null,
      visualViewportOffsetTop: visualViewport?.offsetTop ?? null,
      visualViewportScale: visualViewport?.scale ?? null,
    });
  };

  onMounted(() => {
    media = window.matchMedia(`(max-width: ${PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH}px)`);
    syncViewport();
    syncKeyboard();
    media.addEventListener('change', syncViewport);
    window.visualViewport?.addEventListener('resize', syncKeyboard);
    window.visualViewport?.addEventListener('scroll', syncKeyboard);
    window.addEventListener('resize', syncKeyboard);
  });

  onBeforeUnmount(() => {
    media?.removeEventListener('change', syncViewport);
    window.visualViewport?.removeEventListener('resize', syncKeyboard);
    window.visualViewport?.removeEventListener('scroll', syncKeyboard);
    window.removeEventListener('resize', syncKeyboard);
    media = undefined;
  });

  const presentation = computed(() =>
    resolvePRReviewWorkspacePresentation({ viewportWidth: viewportWidth.value })
  );

  return { presentation, keyboardInsetPx };
}
