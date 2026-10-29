# Flutter Follows navigation and discovery pagination

Status: behavior and pagination option A confirmed by the user; implementation
authorized through the explicitly invoked implement workflow.

## Confirmed behavior

- Scope is the Flutter application only.
- Within the current application run and account session, returning to Follows
  restores the last selected discovery source, page, and reading position.
- Starred and Search retain their own page, results, and reading position.
  Retained search text does not select Search when Starred was last selected.
- Switching main destinations, switching discovery sources, and revisiting a
  cached page reuse loaded results without an automatic request.
- Every explicit page-navigation action (previous, next, first, or entering a
  page number) shows the target page from the top, including cached pages.
  Restoring a reading position applies to returning from another destination or
  discovery source, not to selecting a page through pagination.
- An explicit refresh reloads only the current discovery source's current page
  and returns that page to the top.
- Changing the search conditions or Starred ordering starts the new results at
  page one, at the top.
- Changes made on another device are discovered on an explicit refresh rather
  than by switching pages.
- No restoration across a full application restart is required. Signing out or
  changing account clears the retained browsing state; account/backend data
  remains isolated.
- Keep numbered pagination and direct inline page-number entry. Do not replace
  it with load-more navigation, a strip of many numbered buttons, or a dialog
  required to enter the target page. Provide a quick way to return to page one.
- Use architecture review candidate C as the direction: Search and Starred share
  discovery pagination behavior, including caching, page changes, current-page
  refresh, retries, and stale-result handling. Keep their request differences at
  the source boundary and preserve the sole confirmation authority for Release
  Follows established by ADR 0021.
- Backward compatibility and refactoring cost are not constraints. Prefer reuse
  of behavior over duplicated implementations.

## Presentation

The current Follows destination contains Starred and Search tabs. Followed
Repositories open in a separate management sheet, rather than a third tab. The
first interview round described these three as parallel views; the final design
keeps the existing sheet presentation and restores the discovery tabs beneath it.

The accepted option A is a fixed footer with first-page and previous-page
buttons, a directly editable current page, an optional total-page count, and a
next-page button. Remove the enclosing pill border and internal dividers. The
whole current-page/total indicator is a softly filled rounded button without a
pencil glyph. Tapping it replaces the whole indicator with a vertically centered
numeric input and selects the current page; the total disappears while editing
and returns after submission or focus loss. Keep the indicator's dimensions stable
and retain validation of the target number. The minimum width is 56dp, shared
with the Settings retention editor; longer page labels and larger text can grow
the indicator. Completing an unchanged page edit restores the indicator without
requiring a tab switch.
Unknown totals omit the total rather than inventing a last page.

The first-page action also returns to the top when already on page one, without
refreshing. Ordinary page controls use the existing standard control target
geometry and support larger text. ADR 0033 replaces the special
32dp pill geometry in ADR 0026. The management sheet retains its
existing presentation; no overlay-lifecycle redesign is proposed.

The user subsequently requested removal of the pencil, smaller integer editors,
centered input text, and reliable completion of an unchanged page edit.

## Acceptance scenarios

1. Search on page three, switch to Starred, advance to page five and scroll,
   switch to Settings, then return to Follows: Starred page five is shown at the
   previous reading position without another discovery request.
2. Switch from that Starred view to Search: the earlier search conditions,
   page-three results, and reading position return without another request.
3. Visit another page and return to an already cached page: reuse its results
   without fetching it automatically, and show it from the top.
4. Explicitly refresh Starred page five: request page five for the same ordering
   and show that page from the top; Search is not refreshed by this action.
5. Change search conditions or Starred ordering: show page one from the top.
6. Sign out or change account/backend: another session cannot inherit the prior
   session's discovery results or reading position.
7. Fully exit and reopen the application: restoration is not required.
8. Enter a valid page directly in the footer: go to that page from the top,
   without opening a separate dialog. Reuse its results when cached.
9. Use the first-page action, including while already on page one: show page one
   from the top without refreshing cached results.
10. At 320dp width with larger text, first/previous/next, page editing, and the
    management entry remain reachable without horizontal overflow.
11. A page request completed while another destination is open is available when
    Follows returns, without another automatic request.

## Previous behavior

`ReleaseFollowsScreen.initState` infers the source from retained search text and
reloads Starred and any nonempty search at page one. Its local scroll controller
is discarded on destination changes. The session already outlives the screen,
but currently retains only the current result page per source. The screen test
that expects Starred to refresh when the page reopens must change with this
contract. Ordinary settings collection reads already follow ADR 0021 and keep
that owner.

## Implementation and verification

`repository_discovery_session.dart` owns both sources' common pagination rules,
in-memory visited-page results, independent reading positions, and session reset.
The source-specific search and ordering parameters stay at its request boundary.
`ReleaseFollowsSession` retains membership confirmation and metadata enrichment.
The screen consumes the discovery page's loading, retry, and pagination state.

The bounded 30-row discovery page restores a stable repository identity and the
position within that row, rather than relying on a pixel distance through rows
whose heights may have changed. Explicit page navigation creates a fresh reading
position; returning to a destination or source reuses its position.

Behavior tests use the existing real-app widget harness and HTTP boundary, plus
the discovery session's public actions with the real session/Dio harness. They
check rendered rows and position, inline editing, cache reuse, current-page
refresh, retries, stale responses, and account isolation. No device or browser
session is started by this work.
