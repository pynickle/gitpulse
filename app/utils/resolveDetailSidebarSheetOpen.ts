/**
 * Resolves whether the Detail Sidebar bottom sheet is open. The sheet only
 * exists in the mobile sheet viewport (`max-width: 1024px`) for panes that
 * have a Detail Sidebar; the same `isDetailSidebarHidden` flag that collapses
 * the desktop column drives the sheet, so a hidden sidebar is a closed sheet
 * and the expanded default becomes an open sheet.
 */
export default function resolveDetailSidebarSheetOpen(
  hasDetailSidebar: boolean,
  isDetailSidebarSheetViewport: boolean,
  isDetailSidebarHidden: boolean
): boolean {
  return hasDetailSidebar && isDetailSidebarSheetViewport && !isDetailSidebarHidden;
}
