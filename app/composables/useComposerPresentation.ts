import type { MaybeRefOrGetter } from 'vue';
import { computed, onBeforeUnmount, onMounted, shallowRef, toValue, watch } from 'vue';

import type { ComposerLayoutId } from '#shared/types/user-settings';
import {
  canSwitchComposerLayout,
  COMPOSER_BLEED_MAX_VIEWPORT_WIDTH,
  resolveComposerActivePaneAfterLayoutChange,
  resolveComposerInitialLayout,
  shouldComposerBleed,
  type ComposerLayoutContext,
  type ComposerPane,
  type ComposerSurface,
} from '#shared/utils/composer-presentation';

export function useComposerPresentation(options: {
  surface: MaybeRefOrGetter<ComposerSurface>;
  expanded?: MaybeRefOrGetter<boolean>;
  reviewWorkspaceMode?: MaybeRefOrGetter<ComposerLayoutContext['reviewWorkspaceMode']>;
}) {
  const { settings } = useUserSettings();
  const surface = computed(() => toValue(options.surface));
  const expanded = computed(() =>
    options.expanded === undefined ? true : toValue(options.expanded)
  );
  const reviewWorkspaceMode = computed(() =>
    options.reviewWorkspaceMode === undefined ? undefined : toValue(options.reviewWorkspaceMode)
  );
  const isNarrowViewport = shallowRef(
    import.meta.client &&
      window.matchMedia(`(max-width: ${COMPOSER_BLEED_MAX_VIEWPORT_WIDTH}px)`).matches
  );
  const layoutContext = computed<ComposerLayoutContext>(() => ({
    isMobile: isNarrowViewport.value,
    ...(reviewWorkspaceMode.value ? { reviewWorkspaceMode: reviewWorkspaceMode.value } : {}),
  }));
  const layout = shallowRef<ComposerLayoutId>(
    resolveComposerInitialLayout(surface.value, settings.value.composer, layoutContext.value)
  );
  const activePane = shallowRef<ComposerPane>('write');

  const switchable = computed(() => canSwitchComposerLayout(surface.value, layoutContext.value));
  const bleed = computed(() =>
    shouldComposerBleed({
      surface: surface.value,
      layout: layout.value,
      expanded: expanded.value,
      viewportWidth: isNarrowViewport.value
        ? COMPOSER_BLEED_MAX_VIEWPORT_WIDTH
        : COMPOSER_BLEED_MAX_VIEWPORT_WIDTH + 1,
    })
  );

  const seedLayout = () => {
    layout.value = resolveComposerInitialLayout(
      surface.value,
      settings.value.composer,
      layoutContext.value
    );
    activePane.value = 'write';
  };

  const toggleLayout = () => {
    if (!switchable.value) {
      layout.value = 'tabbed';
      activePane.value = 'write';
      return;
    }

    layout.value = layout.value === 'split' ? 'tabbed' : 'split';
    activePane.value = resolveComposerActivePaneAfterLayoutChange(layout.value);
  };

  const setActivePane = (pane: ComposerPane) => {
    if (layout.value === 'split') {
      return;
    }

    activePane.value = pane;
  };

  seedLayout();

  watch(reviewWorkspaceMode, () => {
    if (surface.value === 'review-inline') {
      seedLayout();
    }
  });

  if (import.meta.client) {
    let media: MediaQueryList | undefined;
    const syncViewport = () => {
      isNarrowViewport.value = Boolean(media?.matches);
    };

    onMounted(() => {
      media = window.matchMedia(`(max-width: ${COMPOSER_BLEED_MAX_VIEWPORT_WIDTH}px)`);
      syncViewport();
      media.addEventListener('change', syncViewport);
    });

    onBeforeUnmount(() => {
      media?.removeEventListener('change', syncViewport);
    });
  }

  return {
    layout,
    activePane,
    switchable,
    bleed,
    seedLayout,
    toggleLayout,
    setActivePane,
  };
}
