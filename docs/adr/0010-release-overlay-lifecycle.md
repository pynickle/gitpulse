---
status: accepted
---

# Release overlays share lifecycle ownership without sharing their visual shell

Release Drawer and Release Timeline Filter Panel will share a module that owns modal registration,
focus capture and restoration, render scheduling, keyboard handling, and unmount cleanup. Each
component retains its template, presentation, and content interactions. This keeps callers from
having to coordinate lifecycle primitives without coupling the release content to filter controls.
Migration is limited to these two overlays; other overlays have not been assessed for compatible
registration ownership.

The following constraints were agreed during the design interview:

- At or below 860px, Release Timeline Filter Panel adopts Release Drawer's bottom-sheet behavior:
  an initial height of 70vh, drag expansion to 100dvh, collapse, and downward dismissal. The
  lifecycle module does not own those gestures. ADR 0004 and ADR 0008 retain their distinct
  viewport thresholds.
- A child control consumes Escape only when it handles an open child surface. A consumed Escape
  does not also close the parent overlay; a subsequent Escape can close the parent.
- Changing open to false releases modal registration immediately and restores focus after the
  DOM update, without waiting for a leave animation. Obsolete scheduled work must not interfere
  with a later opening.
- Release Timeline owns mutual exclusion: opening either overlay closes the other through its
  existing close operation. The shared lifecycle module does not decide which release surface
  should be open and does not introduce a global modal stack.
- Restore focus only when the original target remains usable, without overriding valid focus
  that has moved elsewhere. If the target is gone, do not require a caller-supplied fallback.
- Initial focus remains the first focusable element inside the panel, falling back to the panel
  itself. Opening the filter panel does not automatically focus its repository input.
- Lifecycle tests use a minimal Vue host calling the production composable. They drive open
  state, keyboard events, and unmounting, and observe DOM focus and modal registration across
  actual Vue scheduling. A DOM test environment may be added as needed.

## Interface and ownership

The lifecycle composable accepts read-only open state, a panel element reference, and an
onRequestClose callback. It returns handleKeydown for the overlay's local keyboard binding.
It owns registration pairing, focus scheduling and restoration, stale-work invalidation, and
unmount cleanup, including when mounted initially open. It does not own writable open state,
release data, filter values, or presentation. Callers do not manually order focus primitives.

During replacement of one Release Timeline overlay by the other, focus moves into the new
panel and retains the original usable external return target. Closing the replacement returns
focus there; delayed cleanup from the replaced panel must not steal focus. This handoff is
part of lifecycle ownership, not focus orchestration repeated in the two components.

The two components also compose a separate sheet-gesture module, sharing pointer handling,
gesture state, and reset behavior without merging gestures into modal lifecycle ownership.
Normal thresholds stay unchanged: upward movement of 48px expands a collapsed sheet,
downward movement of 48px collapses an expanded sheet, and downward movement of 80px
dismisses either state. Pointer cancellation cancels the drag without committing an outcome.
Crossing into the desktop viewport resets sheet state; returning to mobile starts at 70vh.

Mutual exclusion applies only to the two Release Timeline surfaces. Release Drawer content
can open a Mermaid viewer, so other overlays can still coexist. Keyboard handling stays local,
and this work must not replace existing overlays with a global Escape handler or modal stack.

## Acceptance scenarios

- Mount closed and initially open; acquire and release each registration exactly once.
- Focus the first usable panel control, or the panel when it has no focusable controls.
- Exercise Tab and Shift+Tab wrapping through the production lifecycle interface.
- Close normally and unmount while open; restore usable return focus only when appropriate,
  preserve focus intentionally moved elsewhere, and tolerate removed return targets.
- Close or unmount before scheduled initial focus; close and reopen rapidly; obsolete tasks
  neither focus removed content nor steal focus from the current opening.
- Switch filter panel to Drawer and back through the Timeline's mutually exclusive operations;
  retain the external return target and keep registration balanced. Drawer close still invalidates
  its pending detail result through its existing close operation.
- Escape closes an open repository dropdown first, then the parent on a subsequent press.
  Other nested overlays retain their own keyboard and focus behavior.
- Both sheets share normal expand, collapse, and dismiss behavior, cancellation without an
  outcome, close/reopen reset, and desktop/mobile transition reset.

Lifecycle assertions use the production composable in a minimal mounted Vue host with DOM
focus and real Vue scheduling. Existing primitive tests can remain, but do not substitute for
these lifecycle tests. Gesture tests exercise outcomes rather than source text. Implementation
verification includes root tests, formatting, lint, and Nuxt typecheck; browser testing remains
outside this request unless explicitly requested.

The consolidated design was confirmed by the user's implementation request.
