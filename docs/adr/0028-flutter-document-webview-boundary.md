---
status: accepted
---

# A document is drawn by a WebView, and the app still owns every address in it

A README or a release's notes is GitHub Markdown an author also wrote HTML into. The Flutter
renderer built for it (`flutter_widget_from_html_core` plus a per-tag style table) could only ever
draw the subset of HTML and CSS the app had taught it: an author's `align` had to be translated by
hand, a table's presentation was reinterpreted per attribute, and images were handed to
`flutter_svg`/`fwfh_svg`, which re-implements SVG text and kept failing on real badges. Every
fidelity fix added a rule that a browser already implements.

The document is therefore drawn by the platform's browser engine, and the page runs the app's own
renderer: `markdown-it` parses (GFM tables, strikethrough, autolinks in core; task lists, alerts and
heading ids as small rules), `DOMPurify` sanitizes in that same engine, `highlight.js` colours code.
The display follows the web app's: GitHub's Markdown typography with code blocks labelled and
copyable. The comparison behind that choice is in
[the research note](../research/flutter-document-webview.md).

**What the app still owns.** A document is not delegated: the theme, the reading scale, the
address policy, navigation and the clipboard stay in Dart, and the page reaches them only through
four named bridge calls.

- `resolveDocumentUrls` — the page never resolves a repository-relative address itself. The app
  resolves it with `RepositoryDocumentContext.resolve` and `safeContentUri`, the one implementation
  every other caller uses, and returns `null` for anything that does not survive that policy.
- `openDocumentUrl` — a link tap is a report to the app, never a navigation the page performs.
  `shouldOverrideUrlLoading` cancels everything else, so the page cannot leave its own content.
- `copyDocumentCode` — the real clipboard is written by the app; `navigator.clipboard` is not a
  secure-context API under this page's origin.
- `documentFailed` — the page reports a failed render, and the widget falls back to the author's
  own Markdown as selectable text.

**The page is app-owned.** It is built in memory (`InAppWebViewInitialData`) from two committed
assets — the renderer bundle and its stylesheet — so it needs no file access, no localhost server
and no network beyond a document's own images. The Markdown travels into it as a JSON payload, never
as markup, and the page sanitizes what it builds before inserting it. A CSP of
`default-src 'none'` plus inline script/style and `img-src`/`media-src https: http:` is the second
wall: an unknown script, a frame, a form or a `javascript:` URL has nowhere to go. The page sets no
cookies of its own, `thirdPartyCookiesEnabled` is off, and no session cookie from the app's HTTP
client is ever copied into it — a document's images are fetched anonymously, as before.

**The document owns its scroll.** A platform view keeps the gestures that land on it, so a document
stretched to its content height inside a Flutter scroll view could not be scrolled on Android or
Windows. The document therefore fills the box its host gives it and scrolls itself, and the chrome
around it stays put: the Release Drawer keeps its offline notice, name, meta line and rule above the
notes and its Release Assets row below them, and the repository page keeps its identity band above
the README. Because Release Assets can no longer sit _below_ a scrolling document, opening it swaps
the asset list into the reading area — an explicit action with an explicit way back.

## Consequences

- **Rebuilding the renderer is a step, not a dependency.** `flutter/tool/document_viewer` pins
  `markdown-it`, `DOMPurify` and `highlight.js`, and `bun run build` writes the two assets that are
  committed. A Flutter checkout needs no JavaScript toolchain; a change to the renderer needs Bun.
  `bun run verify` exercises the built asset in a real DOM (jsdom) and asserts what a reader gets:
  GFM blocks, embedded author HTML and its layout, task lists, alerts, resolved repository
  addresses, heading ids, highlighted code with a copy action, and that nothing active from the
  author survives.
- **The split of verification follows the split of ownership.** The renderer's own behaviour is
  asserted against the built asset; the app's policy is asserted through the widget's bridge in
  `test/releases/release_document_test.dart`, and the page contract (reading scale, colours, CSP,
  payload) in `test/releases/document_view_page_test.dart`. Widget-level tests replace the engine
  with a stand-in (`test/support/document_viewer.dart`), because a widget test has no browser.
- **Windows needs the WebView2 runtime.** Android uses the system WebView. This is a packaging and
  release-checklist item, not a rendering one; the plugin is the only candidate that covers both
  shipping platforms (research note, candidate 1).
- **Selection, alt text and code blocks are the engine's behaviour now.** A failed image shows the
  browser's own broken-image state with the author's alt text; a code block is HTML with a label and
  a copy button rather than a Flutter widget with a horizontal scroll controller. Nothing in the app
  should grow a second Markdown-to-widget path again: a fidelity gap is fixed in the renderer asset.
- **`flutter/AGENTS.md` changes with this.** Its opening statement "rendered natively, no WebView
  anywhere" was true of every surface before this decision; documents are now the one WebView, and
  the rest of the app stays native.
