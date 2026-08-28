/**
 * Resolves the Detail Sidebar hidden state after the active Detail Overlay
 * pane changed. Pane identities are opaque strings composed by the overlay
 * host; the review workspace shares its pull request pane's identity so a
 * review detour never resets the choice.
 *
 * - No previous identity (first open) or no next identity (overlay closed):
 *   always expanded, so every Detail Overlay opens with the Detail Sidebar
 *   visible.
 * - Same pane identity: the current choice is kept.
 * - Different pane identity: back to the expanded default.
 */
export default function resolveDetailSidebarHiddenState(
  previousPaneIdentity: string | null,
  nextPaneIdentity: string | null,
  isDetailSidebarHidden: boolean
): boolean {
  if (previousPaneIdentity === null || nextPaneIdentity === null) {
    return false;
  }

  return previousPaneIdentity === nextPaneIdentity ? isDetailSidebarHidden : false;
}
