/**
 * Resolves the Detail Sidebar hidden state after the active Detail Overlay
 * pane changed. Pane identities are opaque strings composed by the overlay
 * host; the review workspace shares its pull request pane's identity so a
 * review detour never resets the choice.
 *
 * - No previous identity (first open) or no next identity (overlay closed):
 *   back to `defaultHidden`, so every Detail Overlay opens with the Detail
 *   Sidebar in the viewport's default state.
 * - Same pane identity: the current choice is kept.
 * - Different pane identity: back to `defaultHidden`.
 *
 * `defaultHidden` is `true` in the mobile bottom-sheet viewport (sidebar
 * starts as a closed sheet) and `false` on desktop (sidebar expanded).
 */
export default function resolveDetailSidebarHiddenState(
  previousPaneIdentity: string | null,
  nextPaneIdentity: string | null,
  isDetailSidebarHidden: boolean,
  defaultHidden = false
): boolean {
  if (previousPaneIdentity === null || nextPaneIdentity === null) {
    return defaultHidden;
  }

  return previousPaneIdentity === nextPaneIdentity ? isDetailSidebarHidden : defaultHidden;
}
