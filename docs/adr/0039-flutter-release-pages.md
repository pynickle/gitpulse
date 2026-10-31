---
status: accepted
---

# A release is a page, not a sheet

The Flutter client's Release Drawer was a `DraggableScrollableSheet`: it opened at 70% of the window,
snapped between two heights, and let the reader enlarge it with a 96dp pull (ADR 0010, ADR 0018). Every
rule that governed it — the opening extent, the pull travel, the flick velocity, the closing line —
existed to make a sheet comfortable, and none of it made reading a release's notes and its files
anything other than work. This record replaces the sheet with pages, and the sheet's geometry module
(`release_drawer_geometry.dart`) and its `DraggableScrollableSheet` are deleted with it.

## The screens

- **A release is a screen of its own** (`lib/releases/release_screen.dart`), opened at
  `/releases/:owner/:repository/:id`. Its title names the repository, and the one action beside it is
  the app's **Home**; the title itself is also the way to that repository. Its body is the web Release
  Drawer's, in the client's own vocabulary: a tag line with the prerelease (or draft) pill beside it,
  the release's name at a page title's weight, the line that signs it — author avatar, handle, how long
  ago, and the way out to GitHub — a rule, then the notes.
- **The Repository Release List is a screen of its own** (`repository_releases_page.dart`) at
  `/releases/:owner/:repository`, reached from the release's own swipe and from a repository page's
  Releases action. The list itself is the shared presentation ADR 0020 already specifies: the same
  filters, rows, pager and Entry Release marker.
- **The Release Assets are a screen of their own** (`release_assets_screen.dart`) at
  `.../:id/assets`. The row under the notes opens them; Back returns to the release. A list and a
  document that both scroll, in one reading area, is two gestures aiming at one place.
- **A release's GitHub page** is a quiet icon action on the signing line rather than a slot in a chrome
  row: the line already names the release, and the way to it on GitHub is the same sentence's last
  word.

## Swiping, and closing

The release screen answers a **swipe left** on its header by opening the repository's releases; the
release list answers the same gesture by leaving releases altogether. The gesture is offered only
where a scrollable or a platform view is not already listening: the notes belong to the renderer
(ADR 0028), and a selectable line answers a horizontal drag itself, so the header is the place a
shortcut belongs. `GitPulseSwipe` claims the gesture arena from `isPointerAllowed` — the dispatch that
happens as the finger lands, before the tap's own recognizer speaks — and gives it back on any drag
that is not sideways or any finger that lifts without a throw, so a tap on the title, a selection and a
scrolling list all keep their gestures.

**Every way out of a release surface leaves releases.** Back, the system's back gesture and Home all
pop the screens this feature pushed and return to the shell's Timeline; the stack is emptied rather
than walked back. A reader who is done with a release is done with releases, and a Back that stepped
through four of them would be a history they never meant to make. The one exception is a repository a
release opened: it is the release's own step, so its Back affordance returns to those notes.

## What this supersedes

- **ADR 0018 and ADR 0010's sheet geometry no longer apply to this client.** The opening height, the
  pull travel, the flick and the closing line are gone with the sheet.
- **ADR 0035's asset module is superseded.** The assets are a page rather than a module revealed over
  the notes; the reveal's motion roles (`gitPulseAssetsReveal`, `gitPulseAssetsFold`,
  `gitPulseAssetsRevealCurve`) and `GitPulseMotion.assetsRevealShift` go with it.
- **ADR 0012's concept survives.** Entry Release, the Repository Release List and the one-step return
  to it are unchanged; only the surface each is drawn on has moved.
