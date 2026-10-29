# AGENTS.md — GitPulse Flutter native client

> Every entry below answers "what would an agent get wrong here by reading only the code?". Contracts
> deeper than this file: timeline window semantics in `../docs/flutter-release-timeline-spec.md`, local
> history and offline startup in `../docs/flutter-timeline-cache.md`, signing, packaging and device
> acceptance in `../docs/flutter-release.md`.

## Commands

Root `bun run lint` / `fmt:check` skip this tree (the `flutter/` ignore in `package.json` and
`.oxfmtrc.json`), so the Flutter toolchain is the only verification. From `flutter/`:

- `flutter analyze && dart format --output=none --set-exit-if-changed lib test`
- `flutter test` — needs **Bun** on the host: the contract tests run real local Nitro handlers with
  separate browser/app cookie jars; only external GitHub success is simulated.
- One `flutter test` at a time. A leftover `flutter_tester` from an interrupted run holds
  `sqlite3.dll` and the next run fails with `Flutter failed to delete file … sqlite3.dll`; stop it
  with `Get-Process flutter_tester | Stop-Process -Force`. `--reporter expanded` prints each test as
  it starts; `--timeout 30s` makes a hang fail on a line.

Committed codegen, regenerated in the change that causes it: `dart run build_runner build` after any
`@JsonSerializable` DTO or `timeline_cache.drift` edit, `flutter gen-l10n` after every
`lib/l10n/*.arb` edit, and `dart run tool/generate_theme_palette.dart` after any
`../shared/data/theme-palette.json` edit — that file is the palette both clients present, and
`lib/presentation/gitpulse_palette.g.dart` is its committed Dart form. New page copy goes into both
ARB files, and a count placeholder carries `"format": "decimalPattern"` in the ARB so intl localizes
it.

## UI — tokens first

Read `lib/presentation/gitpulse_tokens.dart` before changing any widget, layout, colour, type,
spacing or interaction state. `gitPulseTheme` is the single theme source; a distance or tone no token
names is an ADR rather than a literal, and a visual choice that contradicts a registered rule needs
one too (`../docs/adr/`).

- **The theme is a Theme Preset, not a seed** (ADR 0031): `gitPulsePreset`
  (`lib/presentation/gitpulse_preset.dart`) carries the light and dark palettes and the one type
  table; `gitPulseColorScheme` and the table fill Material's `ColorScheme` and `TextTheme` so a
  retained Material control still receives coherent values. There is no `ColorScheme.fromSeed` and no
  second preset to choose from — a second one is data, not a code path.
- **Colours are read as tones, type as helpers**: `tone…(context)` functions in
  `gitpulse_tokens.dart` (`toneSurface`, `toneTextMuted`, `toneTextStrong`, `toneAccent`,
  `toneDanger`…) are the app's colour vocabulary, and `gitPulseType…(context)` are its type. A widget
  that reads `colorScheme.<role>` or invents a `fontSize` is out of spec; a new tone or type size is
  a row in the preset, never a literal in a widget.

- **Repository detail page**: Release List, Release Follow and Share stay on one row at every width
  (`lib/repositories/repository_screen.dart`). A two-row fallback was tried and rejected — the row's
  spare width goes to the list, at a short action name.
- Star counts use `gitPulseLocaleCompactCount` (locale `K` / `万`); download counts use
  `gitPulseCompactCount`, which appends `k` / `m` in every language.
- **Sheets** — the Release Drawer and the Release Timeline Filter Panel — open only through
  `showGitPulseSheet` (`lib/presentation/gitpulse_sheet.dart`), which owns the route, entry, rounded
  surface and Escape dismissal (ADR 0029). Do not open a second `showGeneralDialog` sheet; pass a
  body that decides its own content and height. **Dialogs** open only through `showGitPulseDialog`
  (`lib/presentation/gitpulse_dialog.dart`) for the same reason (ADR 0032): pass a `GitPulseDialog`
  body that decides its title, content and actions.
- **Controls are GitPulse's own** (ADR 0032): the bottom bar (`GitPulseNavigationBar`), the button
  family (`GitPulseButton` with its four variants, and `GitPulseIconButton`), the two progress
  indicators (`GitPulseProgressInline`, `GitPulseProgressPage`) and the dialog entry point replace
  Material's `NavigationBar`, its five button widgets, its spinner and its dialog. A migrated screen
  mounts none of those Material faces, and its widget test asserts they are absent from its rendered
  tree (`find.byType(FilledButton)` → `findsNothing`). The interaction contract is one rule and lives
  in `gitpulse_theme.dart`: `gitPulseInkOverlay` for a control with no fill (nothing on press, the
  one half-strength tint on hover and focus) and `gitPulseFilledInkOverlay` for a filled or tonal
  one (its own foreground while pressed). A control that paints a fill paints it through its own
  `Material`, never above the ink.
- **Platform Dialect Exceptions** are the controls that stay Material's on purpose — text input and
  its IME/selection/magnifier/autofill, the date picker's calendar, tooltips, pull-to-refresh, the
  snackbar's behaviour (skinned, not replaced), tabs, the Material icon glyphs, and the platform's
  page transitions and back affordance. The list and each reason live in ADR 0032; adding a Material
  face a reader operates means amending that record, not just mounting the widget.
- **Documents** — a release's notes and a repository README — render only through
  `tool/document_viewer` (ADR 0028). Fix a rendering gap there; a second Markdown-to-widget path is
  never the answer.

## Server contracts — change both sides together

- `server/api/native/capabilities.get.ts` mirrors provider availability from
  `resolveAuthProviderState()` (personal mode > PAT > OAuth). Changing the server's auth providers
  without updating it silently breaks the client's sign-in form selection (root test:
  `tests/native-capabilities.test.ts`).
- OAuth is an **external-browser flow on every platform**: no callback links, no background service;
  the app polls and redeems a single-use approval. Binding and redemption belong to the root app
  (`server/utils/native-login-handoff.ts`, `../docs/native-login-handoff.md`).
- The `nuxt-session` cookie kept in `flutter_secure_storage` **is** the session; the password and PAT
  are never stored.

## Gotchas (written nowhere else)

### Build & toolchain

- Stay on `build_runner` 2.16.x: 2.17.x needs `build` / `build_config` versions the selected
  generators cannot resolve.
- Android release builds need the private release identity that is deliberately not in the repo, and
  debug signing is never a release fallback.

### Data

- Cache, schema, retention, offline startup or session-clearing changes: read
  `../docs/flutter-timeline-cache.md`. Online refresh and offline saved membership stay separate —
  storing a record never authorizes exposing it.
- Follow edits send only `followedRepositories` to `PUT /api/settings`, so unrelated preferences
  survive the write.
- Language, appearance, Followed Repository View and the retention window are **device** choices
  (`lib/device/`): they outlive clear-cache, sign-out and account change, so a new choice of that kind
  belongs there rather than in the account's settings payload.

### Documents

- Changing `tool/document_viewer/src/` or one of its pins means rebuilding and committing
  `assets/document_viewer/`; `tool/document_viewer/README.md` holds the commands. A Flutter checkout
  needs no JavaScript toolchain, a renderer change does.
- A widget test has no browser engine: mount a document with `documentViewerOverrides()`
  (`test/support/document_viewer.dart`) and act as the page through the global `mountedDocument`. What
  the renderer does with a document is asserted in `tool/document_viewer/verify.mjs`, not in Flutter.
- The Release Drawer's grab handle resizes through `DraggableScrollableSheet`'s scroll controller, so
  the drawer body keeps a scrollable attached to it (`_documentBody`); without that attachment the
  handle silently stops resizing the sheet.

### Testing

- Widget tests run on a fake clock. An unmocked platform channel (`path_provider` and the others), an
  awaited `File` or `Directory`, or a `Future.delayed` the test awaits without pumping never
  completes, and whatever awaits it waits too: another provider, a startup gate, `pumpAndSettle`. With
  `--reporter expanded`, a test that prints nothing after its name is this wait.
- A provider the mount awaits for device, preference or cache I/O is overridden by
  `gitPulseHarnessOverrides` (`test/support/app_overrides.dart`); a new provider of that kind is added
  there. The test body advances that I/O with `tester.runAsync`, or with `settleUi` / `pumpUntil`
  (`test/support/settling.dart`) — never `pumpAndSettle`.
- When the suite fails but one file passes, suspect the shared startup path:
  `test/shell_startup_guard_test.dart` mounts the real shell with no device-store override, and must
  settle without writing the support directory.

## Verification bar

`flutter analyze` + `flutter test` cover Dart behavior; Flutter Release additionally builds the
Android distribution. Android is the only platform this project builds and runs: the client is a
phone layout at every window width (ADR 0029), and Windows/macOS/Linux have no platform folder.
iOS keeps its platform code and configuration — it needs a configured Keychain access group — and is
code-level only. Credential stores, device networking and install/update stay owner-manual. Plugin
platform badges are not runtime evidence — state exactly what was run. Use Marionette MCP only when
the user explicitly requests it.
