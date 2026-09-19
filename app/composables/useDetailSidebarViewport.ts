import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

/**
 * Tracks whether the Detail Sidebar bottom-sheet viewport is active. Mobile
 * sheet behavior and the stacked column layout share the 1024px breakpoint
 * from the `detail-sidebar-stacking` SCSS mixin, so keep the two in sync.
 *
 * The query is client-only: on the server and during hydration the ref stays
 * `false` (the desktop default), which also keeps SSR markup stable.
 */
const DETAIL_SIDEBAR_SHEET_QUERY = '(max-width: 1024px)';

export default function useDetailSidebarViewport() {
  const isDetailSidebarSheetViewport = shallowRef(false);

  let media: MediaQueryList | null = null;
  const onViewportChange = () => {
    isDetailSidebarSheetViewport.value = media?.matches ?? false;
  };

  onMounted(() => {
    media = window.matchMedia(DETAIL_SIDEBAR_SHEET_QUERY);
    onViewportChange();
    media.addEventListener('change', onViewportChange);
  });

  onBeforeUnmount(() => {
    media?.removeEventListener('change', onViewportChange);
    media = null;
  });

  return {
    isDetailSidebarSheetViewport,
  };
}
