/**
 * Volatile Detail Sidebar visibility state shared by every Detail Overlay.
 *
 * The flag is intentionally not persisted: every Detail Overlay opens with the
 * Detail Sidebar expanded, a collapsed choice survives only pane re-entries of
 * the same subject (returning from the PR Review Workspace) and is dropped as
 * soon as a different subject is opened. The overlay host drives
 * `syncDetailSidebarPane` whenever the active pane identity changes; the reset
 * decision lives in `resolveDetailSidebarHiddenState`.
 */
export default function useDetailSidebarState() {
  const isDetailSidebarHidden = useState<boolean>('detail-sidebar-hidden', () => false);
  const lastPaneIdentity = useState<string | null>('detail-sidebar-pane-identity', () => null);

  const syncDetailSidebarPane = (paneIdentity: string | null) => {
    isDetailSidebarHidden.value = resolveDetailSidebarHiddenState(
      lastPaneIdentity.value,
      paneIdentity,
      isDetailSidebarHidden.value
    );
    lastPaneIdentity.value = paneIdentity;
  };

  const toggleDetailSidebar = () => {
    isDetailSidebarHidden.value = !isDetailSidebarHidden.value;
  };

  return {
    isDetailSidebarHidden,
    syncDetailSidebarPane,
    toggleDetailSidebar,
  };
}
