# AGENTS.md — GitPulse Flutter native client

> Only what the code cannot tell you. Contracts behind these lines:
> `../docs/flutter-release-timeline-spec.md` (window semantics),
> `../docs/flutter-timeline-cache.md` (cache, retention, offline startup),
> `../docs/flutter-follows-navigation-spec.md` (discovery navigation),
> `../docs/flutter-release.md` (signing, packaging, device acceptance),
> `../docs/adr/` (every visual rule and why it is that rule).

## Verify

From `flutter/` — the root `bun run lint` / `fmt:check` skip this tree, so the Flutter toolchain is
the only check:

- Match the run to the work, in this order: `flutter analyze` during edits (seconds), then
  `dart format --output=none --set-exit-if-changed lib test`, then the narrowest tests that cover
  what you changed — `flutter test test/timeline/timeline_cache_test.dart`, or `--name <test name>`
  for one case — and the whole suite once, at the end, before handing the change over.
- Spend full runs sparingly: `flutter test` with no argument recompiles and reloads 66 files to run
  663 tests, about two minutes warm and longer cold, while one file lands in seconds. Re-run the
  slice after each edit, and let the full suite be the last run rather than the loop.
- `flutter test` needs **Bun** on the host: the contract tests run real local Nitro handlers with
  separate browser and app cookie jars, so only external GitHub success is simulated.
- One `flutter test` at a time. A `flutter_tester` left over from an interrupted run holds
  `sqlite3.dll`, and the next run dies on `Flutter failed to delete file … sqlite3.dll` — clear it
  with `Get-Process flutter_tester | Stop-Process -Force`.
- Commit codegen in the change that causes it: `dart run build_runner build` after any
  `@JsonSerializable` DTO or `timeline_cache.drift` edit (generated files are committed),
  `flutter gen-l10n` after every `lib/l10n/*.arb` edit (`lib/l10n/generated/` is gitignored), and
  `dart run tool/generate_theme_palette.dart` after any `../shared/data/theme-palette.json` edit.
  New page copy goes into both ARB files; a count placeholder carries `"format": "decimalPattern"`.

## Tests

- Widget tests run on a fake clock, so an unmocked platform channel, an awaited `File`, or a
  `Future.delayed` never completes and everything awaiting it hangs with it. Advance real I/O with
  `tester.runAsync` plus `settleUi` / `pumpUntil` (`test/support/settling.dart`); a `pumpAndSettle`
  over owed I/O is the hang. A test that prints nothing after its name is this wait.
- A provider the mount awaits for device, preference or cache I/O is overridden in
  `gitPulseHarnessOverrides` (`test/support/app_overrides.dart`). A new provider of that kind is
  added there, or every widget test that mounts the shell starts waiting.
- A suite that fails while single files pass points at the shared startup path:
  `test/shell_startup_guard_test.dart` mounts the real shell with no device-store override and must
  settle without writing the support directory.

## Presentation — tokens first

Read `lib/presentation/gitpulse_tokens.dart` before touching any colour, type, spacing or interaction
state. `tone…(context)` and `gitPulseType…(context)` are the app's whole visual vocabulary, and
`gitPulsePreset` (`lib/presentation/gitpulse_preset.dart`) is the data behind them: a tone or size
these functions do not name is a new row in the preset plus an ADR, never a literal in a widget.
Colour literals live only in `gitpulse_tokens.dart`, `gitpulse_preset.dart`, the generated palette
and `gitpulse_theme.dart`; a surface that shows the ink beneath it says `GitPulsePaint.none`.

- **Controls are the app's own** (ADR 0032). A migrated screen mounts none of the Material faces the
  control layer replaced, and its widget test says so with `expectNoReplacedMaterialFaces`
  (`test/support/material_faces.dart`) — one list, one set of carve-outs, shared with
  `test/presentation/app_faces_test.dart`. A Material face a reader operates is added to ADR 0032,
  not just mounted.
- **Sheets and dialogs open only through `showGitPulseSheet` and `showGitPulseDialog`**, passing a
  body that decides its own content and height. A release's notes are a platform view: an opacity
  layer over one is what flashed on close, so a sheet slides and never fades, and the one opacity
  inside a sheet belongs to the assets module rising above the notes.
- **A destination owns no chrome.** The bar belongs to the shell (`lib/app.dart`); a page-built bar
  has no previous position to animate from.
- **The bar stands on the device.** `GitPulseNavigationBar` pads with the view's bottom inset
  (`maintainBottomViewPadding`) and never with `padding`, which the IME zeroes.
- **Documents** — release notes and READMEs — render only through `tool/document_viewer` (ADR 0028);
  a second Markdown-to-widget path is never the answer.

## Data

- Cache, schema, retention, offline startup or session-clearing changes start by reading
  `../docs/flutter-timeline-cache.md`. Online refresh and offline saved membership stay separate:
  storing a record never authorizes exposing it.
- Language, appearance, Followed Repository View and the retention window are **device** choices
  (`lib/device/`): they outlive clear-cache, sign-out and account change, so a new choice of that
  kind belongs there and not in the account's settings payload.
- Follow edits send only `followedRepositories` to `PUT /api/settings`, so unrelated preferences
  survive the write.

## Server contracts — change both sides together

- `server/api/native/capabilities.get.ts` mirrors provider availability from
  `resolveAuthProviderState()`; a server-side auth change that skips it silently picks the wrong
  sign-in form in the app (root test: `tests/native-capabilities.test.ts`).
- OAuth is an external-browser flow on every platform: no callback link, no background service. The
  app polls and redeems a single-use approval, bound and consumed by the root app
  (`server/utils/native-login-handoff.ts`, `../docs/native-login-handoff.md`).
- The `nuxt-session` cookie in `flutter_secure_storage` **is** the session. The password and PAT are
  never stored.

## Traps

- Stay on `build_runner` 2.16.x; 2.17.x needs `build` / `build_config` versions the selected
  generators cannot resolve.
- Android release builds need the private release identity, which is deliberately absent from the
  repo. Debug signing is never a release fallback.
- Touching `tool/document_viewer/src/` or its pins means rebuilding and committing
  `assets/document_viewer/` (`tool/document_viewer/README.md`). A Flutter checkout needs no
  JavaScript toolchain; a renderer change does.
- A widget test has no browser engine: mount a document with `documentViewerOverrides()`
  (`test/support/document_viewer.dart`) and act as the page through the global `mountedDocument`.
  What the renderer does with a document is asserted in `tool/document_viewer/verify.mjs`.
- The Release Drawer's grab handle resizes through `DraggableScrollableSheet`'s scroll controller, so
  the drawer body keeps a scrollable attached to it; without that attachment the handle silently
  stops resizing the sheet.

## Verification bar

`flutter analyze` + `flutter test` cover Dart behaviour; Flutter Release additionally builds Android.
Android is the only platform that is built and run — the client is a phone layout at every window
width (ADR 0029), and iOS stays code-level (it needs a configured Keychain access group). Credential
stores, device networking and install/update stay owner-manual. Plugin platform badges are not
runtime evidence: state exactly what was run. Use Marionette MCP only when the user asks for it.