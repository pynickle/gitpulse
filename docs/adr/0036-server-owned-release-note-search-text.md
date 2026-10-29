---
status: accepted
---

# The backend supplies release-note search text to Flutter

Flutter documents render through the WebView renderer (ADR 0028), but Release Timeline Search still
uses Dart's `markdown` and `html` packages to extract readable release-note text. Remove those Dart
dependencies by making the backend supply the search text alongside the complete Markdown notes.
Preserving readable-content matching is a requirement; dependency removal is the objective, with no
assumed package-size or performance improvement.

## Contract and ownership

- The existing Release Timeline refresh and pagination responses include a required
  `notesSearchText` string on each release. Empty notes produce an empty string. Extraction runs on
  the complete notes, never the truncated card summary, and requires no additional GitHub requests
  or per-release client requests.
- Extract the existing web search-text helper into a shared utility using the already installed
  `markdown-exit` and `htmlparser2` packages. The web client and backend use that utility. Preserve
  prose, link labels, code and image alternative text; exclude link destinations, image source
  addresses, HTML tags and attributes, and script/style contents. Preserve block boundaries and
  image-alt boundaries, inline code within alternative text, and case/whitespace normalization so
  quoted phrases keep their current meaning. Task-list checkbox markers are excluded; escaped
  markers and code examples remain readable content.
- Flutter carries the supplied text through its release DTOs, timeline models and cached release
  JSON. Search uses that text directly and stays independent of opening a document or starting a
  WebView. Current query syntax, default search fields, filter behavior and offline search remain.
- The backend declares a `release-note-search-text` native capability. The new Flutter client
  requires it in both online discovery and saved-capability validation. The response field is
  required even when its value is empty; missing data is a contract failure.
- Remove Flutter's Markdown-to-HTML search extraction and the direct `markdown` and `html`
  dependencies, and regenerate the dependency lockfile. The WebView renderer continues to own
  document display and its JavaScript dependencies.

## Upgrade boundary

Support only the new contract. Do not add old-backend fallbacks, optional-field substitutes, raw
Markdown search, old-cache backfills, or preservation of previous cache formats. Invalidate old
timeline history once so every retained release carries the supplied search text; the existing JSON
content column needs no additional SQL column. Preserve the secure session, device preferences and
Release Follows. The first use after upgrading requires contact with an updated backend and a
timeline refresh; subsequent launches retain offline reading and full-note search.

## Consequences and verification

Parsing moves to the backend and responses carry additional text. Flutter no longer needs Dart
document parsers for searching. Sharing the web helper keeps the extraction rules in one place;
neither a second parser maintained by the app nor a background WebView is introduced.

Behavior checks must cover text extraction, both timeline response paths, capability enforcement,
required-field decoding, cache round trips with complete search text, old-history invalidation,
offline search after reopening, and preserved session/preferences/follows. Keep existing search
cases for excluded URLs and attributes, included labels/code/alternative text, and quoted phrases.
Run the root checks appropriate to the shared/server changes and Flutter analysis, formatting and
the behavior suite. Report actual verification without claiming an unmeasured runtime or APK-size
benefit.
