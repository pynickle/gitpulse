# The document renderer bundle

This package builds the two files the Flutter app's document WebView runs:

| Output                                    | What it is                                                        |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `../../assets/document_viewer/viewer.js`  | `markdown-it`, `DOMPurify`, `highlight.js` and the glue, one IIFE |
| `../../assets/document_viewer/viewer.css` | GitHub's Markdown typography, driven by the app's CSS variables   |

The output is **committed**, so a Flutter checkout builds without Bun, Node or npm.

## Rebuild

```powershell
cd flutter/tool/document_viewer
bun install
bun run build     # writes the two assets and preview.html
bun run verify    # runs the built bundle in a real DOM (jsdom) and asserts what a reader gets
```

Versions are pinned in `package.json`. Change a version there, rebuild, and commit the asset with
the change.

## Check

`bun run verify` loads the **built** `viewer.js` — not this directory's sources — into jsdom and
asserts: GFM blocks, embedded author HTML and its layout (`align`, `width`/`height`, `<details>`,
`<kbd>`), task lists, GitHub alerts, repository-relative links and images resolved through a mock of
the app's bridge, heading ids, highlighted code with a label and a copy action, that a copy and a
link tap reach the bridge, and that nothing active from the author survives sanitizing.

`preview.html` is generated from `sample.md`: open it in a browser to look at the renderer the app
ships. It stands in for the Flutter bridge with the bundle's own fallback resolver.

## Why these three

The comparison — and the WebView plugin, sanitizer and highlighter it was chosen against — is in
[`docs/research/flutter-document-webview.md`](../../../docs/research/flutter-document-webview.md).
The boundary between the page and the app is
[ADR 0028](../../../docs/adr/0028-flutter-document-webview-boundary.md): the page parses, sanitizes
and paints; the app owns the theme, the reading scale, where an address points, where a tap goes and
the clipboard.
