# Flutter document rendering: the WebView decision

Investigated on 2026-10-28 for the Flutter native client, after the user asked for the
Markdown rendering path to be replaced by a WebView, with the web app's own display as the
reference. Every version below was read from the package registries at that time; the
selected pair is pinned in `flutter/pubspec.yaml` (Dart) and
`flutter/tool/document_viewer/package.json` (the in-page renderer).

This note records the comparison. [ADR 0028](../adr/0028-flutter-document-webview-boundary.md)
records the decision that follows from it.

## What has to be decided

A README or a release's notes is authored GitHub Markdown. That means: GFM blocks (tables,
strikethrough, task lists, autolinks, alerts), and **embedded HTML an author wrote**, including
its layout (`align`, `width`/`height`, `<details>`, `<kbd>`), badges (SVG served without an
`.svg` suffix), and code fences with a language.

Two decisions are independent:

1. **Who lays the document out** — a Flutter widget renderer with a finite CSS subset, or a
   browser engine.
2. **Who turns Markdown into a document** — a Dart parser, or the page's own script.

The earlier native path (flutter_widget_from_html_core + flutter_svg + a per-tag style table)
was a widget renderer with a Dart parser. Its limits are the ones this app kept hitting: an
allowlist had to grow one attribute at a time, an author's table style was interpreted by hand,
and SVG text was re-implemented outside the engine that already renders it.

## Candidate 1: the WebView plugin

The app ships **Android and Windows**. The plugin therefore has to render a document on both.

| Package                  | Latest | Platforms the plugin declares         | Dart/Flutter floor     | Verdict                                                              |
| ------------------------ | ------ | ------------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| `flutter_inappwebview`   | 6.1.5  | android, ios, macos, web, **windows** | `^3.5.0` / `>=3.24.0`  | **Selected** — one API over Android WebView and Windows WebView2     |
| `webview_flutter`        | 4.14.1 | android, ios, macos                   | `^3.10.0` / `>=3.38.0` | Rejected: no Windows implementation, so it cannot be the only engine |
| `webview_windows`        | 0.4.0  | windows                               | `>=2.13.0 <3.0.0`      | Rejected: its SDK constraint excludes Dart 3; Windows-only anyway    |
| `desktop_webview_window` | 0.4.0  | macos, windows, linux                 | `>=3.5.0 <4.0.0`       | Rejected: desktop only; no Android                                   |
| `webview_cef`            | 0.6.2  | macos, windows, linux, elinux         | `>=3.6.0 <4.0.0`       | Rejected: desktop only, and ships its own Chromium                   |

`flutter_inappwebview` 6.1.5 is therefore not merely the most convenient choice: it is the only
candidate whose declared platform set covers both shipping targets at a version that resolves
against Dart 3.13 / Flutter 3.47. Its Windows implementation requires the WebView2 runtime on
the machine, which is a deployment note (see ADR 0028), not a rendering one.

Feature boundary confirmed in the 6.1.5 sources before implementing:

- `InAppWebViewInitialData` (in-memory page + base URL) — no local file access needed.
- `addJavaScriptHandler` + the page's `callHandler` promise bridge.
- `shouldOverrideUrlLoading` returning `NavigationActionPolicy`, so the page cannot navigate.
- Android-side settings used here: `allowFileAccess: false`, `allowContentAccess: false`,
  `allowFileAccessFromFileURLs: false`, `allowUniversalAccessFromFileURLs: false`,
  `thirdPartyCookiesEnabled: false`, `textZoom: 100` (the page applies the reader's text scale
  itself, so the platform must not apply it twice).

## Candidate 2: the in-page Markdown renderer

Once a browser engine owns the document, the parser runs in it. The web app in this repository
parses with **comark** (0.8.1, which is built on `markdown-exit`) and draws with
`@primer/css/markdown`; that is the display this Flutter app is asked to match.

| Option                  | HTML in Markdown | GFM extras                                                                                    | Browser build                                       | Verdict                                                                                   |
| ----------------------- | ---------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `comark` 0.8.1          | yes              | via its own plugins                                                                           | no plain-HTML renderer; renderers are per-framework | Rejected: its AST would need a bespoke HTML serializer written and maintained here        |
| `marked` 18.1.2         | yes              | tables, task lists, autolinks, strikethrough                                                  | yes                                                 | Not selected: fewer extension points for alerts, and its HTML output is the whole surface |
| `markdown-it` 15.0.3    | `html: true`     | tables + strikethrough + autolinks in core; alerts, task lists and heading ids as small rules | yes                                                 | **Selected**                                                                              |
| Dart `markdown` (7.3.1) | yes              | `gitHubWeb` extension set                                                                     | n/a                                                 | Rejected: keeps the parse in Dart, so the page would only draw a pre-built string         |

`markdown-it` is the markdown-it lineage the web app's own parser (`markdown-exit`) descends
from, it is CommonMark-conformant, and its rule API is what the three GitHub behaviours this
document needs are written against (~90 lines total, in `tool/document_viewer/src/viewer.js`).

## Candidate 3: sanitizing

| Option                             | Where it runs         | Why it is or is not enough                                                                                                                                                                                                   |
| ---------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dart allowlist over `package:html` | Dart, before the page | What the old path did: has to re-implement parsing semantics the browser will apply, and a second parser can disagree about what a tag means                                                                                 |
| `DOMPurify` 3.4.17                 | in the page           | **Selected**: filters with the very engine that will build the DOM, so there is no parser differential; strips scripts, event handlers, `style`, `srcdoc`, `javascript:`/`data:` URLs and every tag not on GitHub's own list |
| `sanitize-html`                    | Node only             | Wrong runtime                                                                                                                                                                                                                |

Sanitizing in the render engine is the security argument for this architecture, not an
afterthought. The Dart side still owns the **address policy** (`RepositoryDocumentContext.resolve`

- `safeContentUri`), so a link or image the page keeps is still resolved and re-validated by the
  same code every other caller uses.

## Candidate 4: syntax highlighting

| Option                 | Size / runtime                        | Verdict                                                                                                       |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `highlight.js` 11.12.0 | ~120 KB, pure JS, 36 common languages | **Selected**: runs where the code block is drawn, no isolate, no second theme source                          |
| `shiki` 4.x            | large; grammar bundle per language    | Rejected for the page: shipping TextMate grammars into the WebView costs more than the fidelity is worth here |
| `shiki_flutter` 1.1.0  | Dart isolate + TextSpans              | Dropped: it produced `TextSpan`s for a Flutter widget that no longer draws the document                       |

Code blocks keep a language label and a copy action; the copy is written by the app
(`Clipboard.setData`) through the page bridge rather than `navigator.clipboard`, which is not a
secure-context API under the page's origin.

## What this costs

- Two new build surfaces: the WebView plugin per platform, and a committed renderer bundle built
  by `flutter/tool/document_viewer` (`bun run build`) and verified by `bun run verify`.
- A platform view cannot share Flutter's scroll: the document owns its own scroll, so the drawer
  and the repository page keep their chrome fixed (ADR 0028).
- Flutter-side text selection, per-image alt fallback and per-code-block widgets are replaced by
  the engine's own behaviour. The renderer's own behaviour is asserted against the built asset in
  `tool/document_viewer/verify.mjs` (jsdom), and the app's own policy — resolution, link taps,
  clipboard, fallback — in `test/releases/release_document_test.dart`.
