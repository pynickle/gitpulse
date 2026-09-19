/**
 * Volatile Detail Sidebar visibility state shared by every Detail Overlay.
 *
 * The flag is intentionally not persisted: every Detail Overlay opens with the
 * Detail Sidebar in the viewport's default state — expanded on desktop, closed
 * as a bottom sheet on mobile (`max-width: 1024px`). A collapsed choice
 * survives only pane re-entries of the same subject (returning from the PR
 * Review Workspace) and is dropped as soon as a different subject is opened.
 * The overlay host drives `syncDetailSidebarPane` whenever the active pane
 * identity changes; the reset decision lives in
 * `resolveDetailSidebarHiddenState`.
 */
export default function useDetailSidebarState() {
  const isDetailSidebarHidden = useState<boolean>('detail-sidebar-hidden', () => false);
  const lastPaneIdentity = useState<string | null>('detail-sidebar-pane-identity', () => null);
  const { isDetailSidebarSheetViewport } = useDetailSidebarViewport();

  const syncDetailSidebarPane = (paneIdentity: string | null) => {
    isDetailSidebarHidden.value = resolveDetailSidebarHiddenState(
      lastPaneIdentity.value,
      paneIdentity,
      isDetailSidebarHidden.value,
      isDetailSidebarSheetViewport.value
    );
    lastPaneIdentity.value = paneIdentity;
  };

  /*
   * Entering/leaving the sheet viewport flips the neutral state: the sidebar
   * is expanded on desktop but starts as a closed sheet on mobile. Without
   * this, the desktop-mounted expanded default would stay stacked on mobile
   * (the media query only applies after hydration).
   */
  watch(isDetailSidebarSheetViewport, (isSheetViewport) => {
    if (isSheetViewport !== isDetailSidebarHidden.value) {
      isDetailSidebarHidden.value = isSheetViewport;
    }
  });

  const toggleDetailSidebar = () => {
    isDetailSidebarHidden.value = !isDetailSidebarHidden.value;
  };

  return {
    isDetailSidebarHidden,
    syncDetailSidebarPane,
    toggleDetailSidebar,
  };
}
