---
status: accepted
---

# A document takes no page zoom, and a flick is read under one finger

A README or a release's notes is a reading surface drawn by the platform's browser engine (ADR 0028),
and its reading scale is the app's own: the type table's body and heading rows, grown by the reader's
text size, written into the page's CSS variables (ADR 0031). The engine still shipped with its
defaults, which say a page may be zoomed — Android accepted `setSupportZoom` and
`setBuiltInZoomControls`, Windows accepted `IsPinchZoomEnabled`, and the page's viewport let a pinch
through. A reader who had set a comfortable text size and then rested a second finger on the glass
resized the page instead: the text jumped out of the rhythm the app had chosen, and the page no longer
matched the box it had been given. The engine's visible zoom controls were already off
(`displayZoomControls`), so the zoom was reachable only by accident, and it was never the control a
reader had asked for.

That same gesture had a second, worse consequence. Because a document is a platform view it keeps
every pointer that lands on it, so the page reads a horizontal flick itself and reports the result to
the app — and a report is what opens the repository's release list from a release screen. The script
measured from the first `touchstart` and reported on the first `touchend`, so a two-finger gesture was
routinely reported as "swipe left": a reader trying to enlarge the notes navigated away from them
instead.

## Decision

**A document takes no page zoom of its own.** The engine is told so on every platform it can be told
on: Android's `supportZoom`, `builtInZoomControls` and `displayZoomControls` are off, Windows'
`pinchZoomEnabled` is off, and `pageZoom`, `maximumZoomScale` and `minimumZoomScale` are pinned at 1.
The page's own viewport states the same thing in the content it serves (`maximum-scale=1,
user-scalable=no`), so the refusal survives an engine that would still honour a pinch. Text zoom stays
at 100%, which leaves the app's CSS variables as the only thing that sets a document's size.

The reading scale is therefore the app's only scale, and the engine's zoom is not a second
accessibility path beside it. A reader who needs larger text changes the app's text size, which every
surface — the chrome and the document alike — already follows; the platform's own screen magnifier is
still the platform's, outside the page.

**A flick is one finger, for the whole gesture.** A `touchstart` that carries more than one touch
abandons the track rather than leaving the first finger armed, and a `touchend` that still has another
touch down does not report and does not measure the movement. The flick's own thresholds are
unchanged: horizontal wins over vertical, at least 80dp of travel, no more than 600ms from the first
finger, and passive listeners throughout so the page's scrolling is never delayed.

## Consequences

- **A pinch is a scroll or nothing now, never a page resize.** Two fingers on a document do what a
  reader expects two fingers to do in a browser tab whose page cannot zoom; the text they read is the
  text the app set.
- **The header's own gesture is untouched.** `GitPulseSwipe` on a release screen is a Flutter gesture
  in the app's arena, not this script, so swiping the header still opens the repository's release
  list. Inside the page, scrolling, tapping, selecting, following a link, copying code and loading
  images all keep their behaviour: the script still only ever reports a sideways flick, and only the
  result of one.
- **The contract is asserted where it is written.** The engine settings are read through
  `documentWebViewSettings()` in `test/releases/document_host_test.dart`; the viewport declaration and
  the single-finger rule in the generated swipe script through `buildDocumentViewPage()` in
  `test/releases/document_view_page_test.dart`, which is the page's own contract in the same way its
  CSP is. No device was run for this: an engine's actual pinch behaviour is the platform's, and the
  verification bar stayed `flutter analyze` plus `flutter test` (`flutter/AGENTS.md`).
