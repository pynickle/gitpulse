---
status: accepted
---

# Keep native document layout and use Rust only for SVG rendering

On 2026-10-27 the user accepted retaining the shared Flutter Markdown-to-sanitized-HTML reading surface and its native code blocks while repairing lost author alignment and replacing the document SVG image backend with upstream Rust resvg. Independent probes showed that sanitization discarded supported alignment, and that the existing SVG backend misrendered scaled text; a Windows-hosted Rust experiment rendered the complete badge, including its embedded SVG logo. This evidence justifies a narrow image dependency change rather than replacing Markdown parsing or the entire layout engine.

The production boundary accepts SVG bytes plus explicit dimensions, theme and font inputs and returns raster image data or a local error through FFI. Anonymous resource resolution remains app-owned; text selection, navigation, code copying, reading typography and layout remain native. Android and Windows library packaging, fonts, actual native calls and fixed-fixture behavior must be verified during implementation; the Node binding experiment is neither a production dependency nor mobile integration evidence. The accepted target is specified in [the document rendering specification](../flutter-document-rendering-spec.md) and [Issue #136](https://github.com/pynickle/gitpulse/issues/136).

This amends ADR 0025's initial dependency freeze only at the document SVG boundary and preserves ADR 0018's product reading scale. A whole-document WebView or embedded Rust browser engine, server-side image conversion, and general offline image storage were considered but are outside this change.
