---
status: accepted
---

# The Release Assets rise over the notes, and the notes stay under them

Opening the Release Assets swapped the reading area: the notes were replaced by the asset list, and
folding them away replaced the document again. The notes are a WebView (ADR 0028), so the second half
of that swap was not a redraw but a new engine — the area went blank while the page was rebuilt, and
a reader's place in a long changelog was gone. The module itself appeared in one frame, which read as
the fold row having done nothing at all.

## The module arrives over the notes

- **It rises and fades into its own place; the notes do not move.** `gitPulseAssetsReveal` (220ms,
  `gitPulseAssetsRevealCurve`) lifts the module `GitPulseMotion.assetsRevealShift` (16dp) into its
  resting place in the reading area and brings it from transparent to solid. Both are paint-only, so
  the reading area keeps its layout and the document keeps its scroll, and the shift is a registered
  motion role rather than a spacing token — the way ADR 0030 registered the Timeline's 12dp return.
  220ms is the app's speed for handing a whole reading area over (`gitPulseDestinationTransition`),
  not the shorter turn of a control inside a surface; 16dp is a nudge into place, not the distance
  from the fold row, which never moves.
- **The notes stay mounted underneath.** The module is a sibling above the document, not a replacement
  for it, for the reason the drawer already keeps a document behind its Repository Release List:
  folding the module away returns to the same rendered page at the same reading position instead of
  rendering the document again. The module paints its own `Material` in the sheet's surface tone, so
  it reads as part of the surface rather than as a second container inside it — and ink features paint
  above a `Material`'s fill, so an asset row still answers a press (ADR 0019).
- **What fades is never the platform view.** ADR 0029's rule stands, and its amendment is this change:
  an opacity layer over a platform view is the path that already flashed once, so the layer here sits
  above the document and holds only Flutter content; the notes are a sibling beneath it and are never
  inside it.
- **The way out is faster than the way in.** `gitPulseAssetsFold` (140ms) settles the module back over
  the same curve run in reverse, which on a descending controller is the accelerating departure
  Material gives a dismissal: an arrival has to be read, a departure only has to get out of the way.
  The fold row's chevron turns on whichever of the two clocks the tap started, by the module's curve
  when it opens and by that curve mirrored when it closes, so the chevron's openness and the module's
  opacity are the same number at every frame.
- **A module that is moving answers nothing.** It absorbs pointers until it has come to rest, which
  covers both halves: on the way in it is still see-through, and on the way out it is already going
  away, and a row that can be hit either time starts a download nobody asked for. The notes get
  nothing either, so a moving module cannot pass its gestures through to them.
- **The module is dropped once it has finished leaving.** At rest the reading area holds one of the two
  again, so a folded drawer keeps no invisible list behind the notes.
- **A reader who asked for reduced motion gets the module, not the crossing.** Both directions run in
  `Duration.zero`, the rise is never seen, and the fold row's chevron jumps with it.

## Consequences

- While the module covers the notes it also takes them out of the screen reader's tree, because a
  reader who cannot see the notes should not be read a second document beside the list. That is
  asserted against the widget's own tree; what a texture-composited platform view reports to the
  platform's accessibility service under that exclusion stays a device check, like the rest of ADR
  0028's engine behaviour.
- The drawer's own test now says the list **covers** the notes rather than that the notes are absent.
  The document stays mounted by design, so what the reader cannot reach — not what is missing from the
  tree — is the assertion.
- One composited opacity layer exists inside a sheet for 220ms on the way in and 140ms on the way out.
  It is the only one, it sits above the document rather than around it, and ADR 0029 names it.
- The design needs the texture composition ADR 0028 gives a document. ADR 0028 keeps
  `initSurfaceAndroidView`'s fallback to hybrid composition for a device that cannot present a texture,
  and on that path a platform view floats above Flutter's canvas: a module drawn over the notes is not
  in the same composite, so it could sit behind them. The swap this change replaces never painted above
  the platform view, so that fallback is a broken state for this module. It remains the platform's
  fallback rather than a second path in the app, which is why it is recorded here: a device that cannot
  present a texture would show the notes without the module over them.
- A release with no assets still shows no fold row, so the module is never mounted over notes that have
  none, and ADR 0028's "an explicit action with an explicit way back" is unchanged.
