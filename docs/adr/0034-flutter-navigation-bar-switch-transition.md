---
status: accepted
---

# The shell owns the bottom bar, and a destination switch is one movement

The bar used to be part of each destination: `/timeline`, `/follows` and `/settings` were three
sibling pages, each building its own `Scaffold` and its own `GitPulseNavigationBar`. A switch
therefore replaced the whole screen — the platform's page transition carried the bar off screen
and a new bar came back already standing on the new destination — so the bar could not answer the
tap at all: the step the reader had been reading appeared for the first time a third of the way
along, with nothing to have moved from.

The three destinations become the children of one `ShellRoute`, and the shell builds the `Scaffold`
the bar stands on (`lib/app.dart`). The bar is now a surface of the screen rather than of a page: it
stays mounted across a switch, which is what lets it carry the answer to the tap.

## The switch

- **One step, drawn by the bar, and it travels.** The active step is a rounded block
  (`GitPulseRadius.row`) inset `GitPulseSpace.destinationStepInset` from the compartment it marks,
  painted by the bar beneath the destinations, and moved between compartments by an
  `AnimatedPositioned`. It replaces the fill a selected destination used to paint for itself: one
  block that moves says how far the reader moved, where a fill that blinked from one third to another
  said only "here". The inset is a registered distance rather than a literal because it is the one
  value that decides whether a destination's step reads as a block standing on the bar or as a third
  of it.
- **The word and mark cross with it.** Each destination lerps its ink from `toneTextMuted` to
  `toneAccent` over the same duration and curve, so a destination is exactly as Accented as the block
  beneath it has come. ADR 0032's pairing is unchanged — the selected destination is the only one in
  the Accent, on the active step — and so is its contract: the step is drawn below the destinations'
  ink layers, so a press, a hover and the keyboard's focus still read over it, and a destination
  still paints no fill of its own.
- **The page crosses over, and nothing about it moves.** A destination's page is a
  `CustomTransitionPage` that fades in over the destination it replaces, over the same duration and
  on the same curve as the step — one answer to one tap. The page is opaque: it stands on the page's
  own tone (`tonePage`) rather than letting the screen beneath it show through, so the two screens
  cross from one to the other instead of both showing through each other. A destination is not a
  place reached by travelling sideways, it is the same shell showing another place (ADR 0029 keeps
  the client a phone layout at every width).
- **One duration, one curve, one place.** `gitPulseDestinationTransition` (220ms) and
  `gitPulseDestinationCurve` (`Curves.easeOutCubic`) are stated beside the bar, and
  `gitPulseDestinationTurn(context)` is the only reader that turns them into a length — so the step,
  the ink and the page cannot drift apart, and reduced motion is decided once.
- **Reduced motion removes the travel, not the answer.** A reader whose platform asks for reduced
  motion gets a zero-length step, a zero-length ink crossing and a zero-length page transition: the
  destination the tap chose is simply there, with no route left running behind it.

The frame the destination pages were built in is otherwise unchanged: each still decides its own
content — Settings always, the signed-in page or the account gate on the other two — and the bar is
still the app's own face under ADR 0032.

## What this changes

- **The bar is reachable from no destination.** A destination page is not the owner of the bar, so
  nothing about a destination can move it, restyle it or take it away; the shell is the only caller.
- **The three destinations are one page in the root navigator.** Anything that counted pages now
  counts one: `/timeline`, `/follows` and `/settings` are pages of the shell's own navigator, while
  `RepositoryScreen` and `RepositoryReleasesScreen` stay top-level routes and pageless pushes on top
  of the shell, which is why Home still returns to the shell and Back still restores the drawer it
  was opened from.
- **One Platform Dialect Exception narrows** (ADR 0032). The platform's page transition is still the
  platform's for every page that is pushed — the Connection page, the Repository pages, and whatever
  a page opens above them — while the three shell destinations state their own: they are not pushes,
  they are one shell showing another place. Two consequences follow and are accepted: a page pushed
  above the shell (a Repository page) no longer drags the destination underneath it, because a
  destination page states its whole transition and answers nothing from a route above it; and the
  back affordance, the system back gesture and a pushed page's own entrance are the platform's
  throughout.
- **`gitPulseDestinationTransition` (220ms) is the app's longest content movement** after the
  Timeline's distant return (ADR 0030). It is registered here rather than as a `GitPulseMotion`
  distance: `GitPulseMotion` names the paint offsets a movement is made of, and the app's other
  transitions already state their durations beside the surface that owns them
  (`gitPulseSheetTransition`, `gitPulseDialogTransition`, `gitPulseToggleTurn`).

## Why not keep the pages and animate the bar anyway

The alternative was to leave the destinations as sibling pages and animate the bar inside each one.
A bar built by a page has no previous position: its first frame already stands on the destination it
belongs to, so the only animation available is an entrance — a step that fades in at every switch
rather than one that travels. The navigation state would also have to be guessed, because the widget
answering the tap is already gone. Keeping each destination's own scroll and reading state alive
with a `StatefulShellRoute.indexedStack` was rejected too: the branches stay mounted and offstage, so
the Timeline would keep polling while a reader is in Settings, and the client's reading-position
design (the Timeline keeps its own in-memory position across tab widgets) already exists to make a
destination rebuild cheap.

## Verification

- `test/presentation/gitpulse_navigation_bar_test.dart` asserts where the step is over the frame the
  tap produces: resting on the selected compartment at its inset, still at the old one on the
  rebuild that changes the index, part way between the two half way through
  `gitPulseDestinationTransition`, and on the chosen compartment once settled — plus the ink
  crossing through a blend that is neither tone, and a reduced-motion frame that is already in place.
- `test/app_shell_test.dart` mounts the whole client and asserts the shell's own property: one bar
  across a switch, its step in flight while the arriving page is part way opaque, standing on the
  page's own tone; then the arrival complete, the old page gone and the step resting on the chosen
  destination.
- Both read the step through one query (`test/support/navigation_step.dart`), so the bar's own
  behaviour and the shell's are stated against the same thing.
