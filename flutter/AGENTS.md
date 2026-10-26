# AGENTS.md — GitPulse Flutter native client

> Native Flutter client for GitPulse — Release Timeline, Release Follows, and Settings,
> rendered natively, no WebView anywhere. Independently released package. Connects to any
> GitPulse backend: discovers providers via `GET /api/native/capabilities`, then signs in with
> personal password, PAT, or GitHub OAuth through the system browser. Deep contract (timeline
> window semantics, platform matrix, dependency rationale): `docs/flutter-release-timeline-spec.md`
> and `docs/flutter-release-timeline-plan.md`. Server handoff protocol: `../docs/native-login-handoff.md`.

## Commands

Run from `flutter/`. Root `bun run lint` / `fmt:check` and Nuxt discovery ignore this tree —
verify with the Flutter toolchain.

1. `flutter pub get`
2. `dart run build_runner build` — regenerates the **committed** DTO mappings and Drift schema;
   commit the generated files with the change that caused the regen. Codegen covers
   json_serializable DTOs and `timeline_cache.drift`; Riverpod and presentation state are handwritten.
3. `flutter gen-l10n` — required after every `lib/l10n/*.arb` edit.
4. `flutter analyze` && `dart format --output=none --set-exit-if-changed lib test`
5. `flutter test` — needs **Bun** on the host: the contract tests run real local Nitro handlers
   with separate browser/app cookie jars; only external GitHub success is simulated. Run one
   `flutter test` at a time. A leftover `flutter_tester` from an interrupted run holds
   `sqlite3.dll`, and the next run fails with `Flutter failed to delete file … sqlite3.dll`.
   Stop it with `Get-Process flutter_tester | Stop-Process -Force`, then run again.
   `--reporter expanded` prints each test as it starts; a plain run prints nothing until it exits.

## UI — read the design system first

Before changing any widget, layout, color, type, spacing or interaction state, read
`design-system/gitpulse/MASTER.md`.

- MASTER owns typography/color/spacing/radius/stroke/icon tokens, component density, interaction
  states, and the scenario exceptions. Do not invent a value it does not name; do not read
  `theme.dividerColor` for an internal rule.
- A page override at `design-system/gitpulse/pages/<page>.md`, if it exists, wins over MASTER for
  that page.
- MASTER §12 lists choices that look inconsistent on purpose — do not "fix" them. A new exception
  enters that table before the code; one that contradicts a rule needs an ADR (see
  `../docs/adr/0023-flutter-press-feedback-scope.md`).

## UI conventions (beyond MASTER)

MASTER §0 defers these to this file.

- **Settings is a table, not a document** (`lib/settings/`): rows come from
  `presentation/gitpulse_setting_rows.dart` — one label column, one control column, a hairline
  between rows. The account/backend surface is `settings/account_panel.dart`, shared with the
  signed-out Timeline/Follows gate and the repository pages. A setting's copy is its label and its
  control; a description line under either one is a review defect. Account actions are
  tooltip-named icon buttons, so tests address them with `find.byTooltip`.
- **Chrome & states**: `gitPulseTheme` is the single theme source; use `GitPulseLoadingView` /
  `GitPulseMessageView` for page-level loading, empty, and error states — not a second look.
- **i18n & formatting**: add new page copy to both ARB files. Format dates through
  `gitpulse_formatting.dart`; give count placeholders `"format": "decimalPattern"` in the ARB so
  intl localizes them. Star counts on Release Follows use `formatGitPulseLocaleCompactCount`
  (locale `K` / `万`); download counts stay on `formatGitPulseCompactCount`.
- **Repository detail page** (`lib/repositories/repository_screen.dart`): bands on the shared
  gutter, capped at the reading measure (MASTER §5 / E11) so a README keeps its line length —
  identity, a full-width rule, then the README under the revision and path it was read from
  (`main · docs/README.md`). The app bar passes no title — the band below names the page. The data
  line puts a glyph (`LanguageSwatch`, a star, a fork, an eye from
  `presentation/gitpulse_language_colors.dart`) where the noun would go, keeping the noun in that
  fact's `Semantics` label. A README failure stays inside its band; only a repository failure
  replaces the page.

## Server contracts — change both sides together

- `server/api/native/capabilities.get.ts` mirrors provider availability from
  `resolveAuthProviderState()` (personal mode > PAT > OAuth). Changing server auth providers
  without updating it silently breaks the client's sign-in form selection. Root test:
  `tests/native-capabilities.test.ts`.
- Sign-in calls `/auth/unlock` and `/auth/pat`, resending `gitpulse_csrf` as `x-csrf-token`; no
  bearer token, `remember` always false. The `nuxt-session` cookie persisted via
  `flutter_secure_storage` **is** the session; password and PAT never touch disk.
- OAuth is an **external-browser flow** on all five platforms: no callback links, no background
  service; the app polls and redeems a single-use approval. Verifier/origin binding and atomic
  consumption live in `server/utils/native-login-handoff.ts`.

## Gotchas (written nowhere in config)

### Build & toolchain

- Android `kotlin.incremental=false` is deliberate — a Windows Pub cache and checkout on different
  drives break incremental caches. Keep it disabled.
- `build_runner` is pinned at 2.16.2: 2.17.x needs `build`/`build_config` versions the selected
  generators cannot resolve. Keep the pin.
- Android release builds require the existing private release identity and fail without it; debug
  signing is never a release fallback. Signing inputs, portable Windows packaging, and the
  owner/device checklist live in `../docs/flutter-release.md`.

### Timeline & data

- Cache/schema, retention, offline startup, or session-clearing changes: read
  `../docs/flutter-timeline-cache.md`. Online refresh and offline saved membership are separate;
  storing a record does not authorize exposing it.
- The timeline assembles its Shared Timeline Window from per-repository pages — never treat the
  refresh response's groups as a ready-made window, and neither pagination nor retry advances the
  shared refresh baseline (window semantics: `docs/flutter-release-timeline-spec.md`).
- `TimelineViewState.groups` is the exposed window (what is saved, and what offline release bodies
  resolve against); `visibleGroups` is what the filter and search display. Recompute both plus
  `loadedNewCount` whenever `groups` changes, and keep `applyFilters` request-free.
- Follow edits send only `followedRepositories` to `PUT /api/settings` (100 available / 150 stored
  limits) so unrelated preferences survive.

### Device preferences

- Language, appearance, Followed Repository View, and the **Timeline Cache Retention Window** are
  **device preferences** (`lib/device/`), stored in a local JSON document beside — never inside —
  the timeline database; all four survive clear-cache, sign-out, and account changes. Language and
  appearance apply through `MaterialApp` (`locale`, `themeMode`) before connection or sign-in, with
  controls in Settings and the connection screen; the view control stays in Followed Repositories;
  the window is edited with the other device rows and applies to saved history at once, offline.
  All four share the device controller's save queue; the followed-view provider is read-only. View
  save failures stay silent; the other three report them. The file keeps its historical name
  `presentation_preferences.json` (ADR 0024), and the old view text file is unused (ADR 0022).
- The window is resolved before anything is pruned or saved; an installation without one is seeded
  once from the window its cache ledger last wrote. Never prune or save against an unresolved window.

### Testing

- Widget tests run on a fake clock. An unmocked platform channel (`path_provider` and the others),
  an awaited `File` or `Directory`, or a `Future.delayed` the test awaits without pumping, never
  completes. Anything that awaits it waits too: another provider, a startup gate, `pumpAndSettle`.
  With `--reporter expanded`, a test that prints nothing after its name is this wait.
- A provider the mount awaits for device, preference, or cache I/O comes from
  `gitPulseHarnessOverrides` (`test/support/app_overrides.dart`). The list always replaces the
  device store. Pass `timelineCache` when the mount already holds one, and add a new provider of
  this kind to the function. The test body waits for that I/O with `tester.runAsync`, or with
  `settleUi` and `pumpUntil` (`test/support/settling.dart`). A suite whose real work is slower
  passes a wider frame budget. `DevicePreferencesController.selectLanguage` is the example: pass
  a `createTempSync` file as `preferencesFile` (`mountApp` still calls that argument
  `presentationFile`) and advance the read with `settleUi`. Pass `flutter test --timeout 30s` so
  a hang fails on a line.
- When the suite fails and one file passes, suspect the shared startup path.
  `test/shell_startup_guard_test.dart` mounts the real shell with no device-store override: it
  must settle, and it must not write the support directory.
- A menu that must stay inside the window uses `showMenu`. `MenuAnchor`'s `maximumSize` caps the
  panel's children; the overlay still anchors that panel, so a label at text scale 1.8 paints past
  the view edge. Assert the menu item's global rectangle, not the child's max width.

## Verification bar

Use Marionette MCP only when the user explicitly requests it; for routine changes use the Flutter
checks above.

`flutter analyze` + `flutter test` cover Dart behavior; Flutter Release additionally builds the
Windows/Android distributions. Credential stores, device networking, and install/update remain
owner-manual (Windows/Android). Linux/macOS/iOS have code-level support only: macOS/iOS need a
configured Keychain access group and Linux a running D-Bus Secret Service before the session cookie
can be stored. Plugin platform badges are not runtime evidence — state exactly what was run.
