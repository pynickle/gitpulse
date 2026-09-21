import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue';

import {
  PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH,
  resolvePRReviewWorkspacePresentation,
} from '#shared/utils/pr-review-workspace-presentation';

/**
 * Starts wide so server markup and hydration match. The narrow layout itself
 * is the stylesheet built from PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH, which
 * applies before this listener runs.
 */
export function usePRReviewWorkspacePresentation() {
  const viewportWidth = shallowRef(PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH + 1);

  let media: MediaQueryList | undefined;
  const syncViewport = () => {
    viewportWidth.value = media?.matches
      ? PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH
      : PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH + 1;
  };

  onMounted(() => {
    media = window.matchMedia(`(max-width: ${PR_REVIEW_WORKSPACE_NARROW_MAX_WIDTH}px)`);
    syncViewport();
    media.addEventListener('change', syncViewport);
  });

  onBeforeUnmount(() => {
    media?.removeEventListener('change', syncViewport);
    media = undefined;
  });

  const presentation = computed(() =>
    resolvePRReviewWorkspacePresentation({ viewportWidth: viewportWidth.value })
  );

  return { presentation };
}
