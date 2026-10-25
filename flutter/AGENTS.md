# AGENTS.md — GitPulse Flutter native client

> Independent Flutter package in `flutter/` (app **GitPulse**,
> `ink.euphony.gitpulse`, `flutter-vX.Y.Z` release tags). Connects to any
> GitPulse backend: discovers providers via `GET /api/native/capabilities`,
> then signs in with personal password, PAT, or GitHub OAuth through the system
> browser. Release Timeline + Release Follows + Settings, rendered natively —
> no WebView anywhere. Deep product contract (timeline window semantics,
> platform matrix, dependency rationale): `docs/flutter-release-timeline-spec.md`
> and `docs/flutter-release-timeline-plan.md` at the repo root. Server handoff
> protocol: `../docs/native-login-handoff.md`.

## Commands

Run from `flutter/`. Root `bun run lint` / `fmt:check` / Nuxt discovery ignore
this tree — verify with the Flutter toolchain.

1. `flutter pub get`
2. `dart run build_runner build` — regenerates the **committed** DTO mappings and Drift schema;
   commit the generated files with the change that caused the regen. Codegen
   covers json_serializable DTOs and `timeline_cache.drift` — Riverpod and presentation state are
   handwritten.
3. `flutter gen-l10n` — required after every `lib/l10n/*.arb` edit.
4. `flutter analyze` && `dart format --output=none --set-exit-if-changed lib test`
5. `flutter test` — needs **Bun** on the host: the contract tests run real local
   Nitro handlers with separate browser/app cookie jars; only external GitHub
   success is simulated.

## UI — read the design system first

Before changing any widget, layout, color, type, spacing or interaction state,
read `design-system/gitpulse/MASTER.md` and the matching batch in
`design-system/gitpulse/PROGRESS.md` (paths relative to this package).

- MASTER owns typography roles, color roles, spacing/radius/stroke/icon tokens,
  component density, interaction states, and the scenario exceptions. Do not
  invent a value it does not name; do not read `theme.dividerColor` for an
  internal rule.
- A page-level override, if one exists at `design-system/gitpulse/pages/<page>.md`,
  wins over MASTER for that page.
- MASTER §12 lists choices that look inconsistent on purpose. Do not "fix" them;
  a new exception enters that table before the code, and one that contradicts a
  rule needs an ADR (see `../docs/adr/0023-flutter-press-feedback-scope.md`).

## Server contracts — change both sides together

- `server/api/native/capabilities.get.ts` mirrors provider availability from
  `resolveAuthProviderState()` (personal mode > PAT > OAuth). Changing server
  auth providers without updating it silently breaks the client's sign-in form
  selection. Root tests: `tests/native-capabilities.test.ts`.
- Sign-in calls the existing `/auth/unlock` and `/auth/pat`, resending
  `gitpulse_csrf` as `x-csrf-token`; no bearer token, `remember` always false.
  The `nuxt-session` cookie persisted via `flutter_secure_storage` **is** the
  session; password and PAT never touch disk.
- OAuth is an **external-browser flow** on all five platforms: no callback
  links, no background service; the app polls and redeems a single-use
  approval. Verifier/origin binding and atomic consumption live in
  `server/utils/native-login-handoff.ts`.

## Gotchas (written nowhere in config)

- Cache/schema, retention, offline startup, or session-clearing changes: read
  `../docs/flutter-timeline-cache.md`. Online refresh and offline saved membership
  are separate; storing a record does not authorize exposing it.

- Android `kotlin.incremental=false` is deliberate — a Windows Pub cache and
  checkout on different drives break incremental caches. Keep it disabled.
- Android release builds require the existing private release identity and fail
  without it; debug signing is never a release fallback. Signing inputs, portable
  Windows packaging and the owner/device checklist live in `../docs/flutter-release.md`.
- `build_runner` is pinned at 2.16.2: 2.17.x needs `build`/`build_config`
  versions the selected generators cannot resolve. Keep the pin.
- The timeline assembles its Shared Timeline Window from per-repository pages —
  never treat the refresh response's groups as a ready-made window, and neither
  pagination nor retry advances the shared refresh baseline.
- `TimelineViewState.groups` is the exposed window (what is saved, and what
  offline release bodies resolve against); `visibleGroups` is what the filter
  and search display. Recompute both plus `loadedNewCount` whenever `groups`
  changes, and keep `applyFilters` request-free.
- Follow edits send only `followedRepositories` to `PUT /api/settings`
  (100 available / 150 stored limits) so unrelated preferences survive.
- Language, appearance, and Followed Repository View are **device-local presentation preferences**
  (`lib/presentation/`), stored in `presentation_preferences.json` beside — never
  inside — the timeline database. All three survive clear-cache. Language and
  appearance apply through `MaterialApp` (`locale`, `themeMode`) before
  connection or sign-in, with controls in Settings and the connection screen; the view
  control stays in Followed Repositories. All three share the presentation
  controller's save queue; the followed-view provider is read-only. View save
  failures stay silent, and the old view text file is unused (ADR 0022).
  Add new page copy to both ARB
  files; use `gitPulseTheme` for app chrome and `GitPulseLoadingView` /
  `GitPulseMessageView` for page-level loading, empty, and error states instead
  of a second look. Format dates through `gitpulse_formatting.dart`; give count
  placeholders `"format": "decimalPattern"` in the ARB so intl localizes them.
  Star counts on Release Follows use `formatGitPulseLocaleCompactCount` (locale
  `K` / `万`). Download counts stay on `formatGitPulseCompactCount`.
- Settings (`lib/settings/`) is a table, not a document: rows come from
  `presentation/gitpulse_setting_rows.dart` — one label column, one control
  column, a hairline between rows — and the account/backend surface is
  `settings/account_panel.dart`, shared with the signed-out Timeline/Follows
  gate and the repository pages. A setting's copy is its label and its control;
  a description line under either one is a review defect. Account actions are
  tooltip-named icon buttons, so tests address them with `find.byTooltip`.
- The Repository detail page (`lib/repositories/repository_screen.dart`) is bands
  on that same 16 gutter, capped at 960 so a README keeps a reading measure: the
  identity, a full-width rule, then the README under the revision and path it was
  read from (`main · docs/README.md`). Its app bar passes no title — the band
  below names the page — and its data line puts a glyph
  (`presentation/gitpulse_language_colors.dart`'s `LanguageSwatch`, a star, a
  fork, an eye) where the noun would go, keeping the noun in that fact's
  `Semantics` label. A README failure stays inside its band; only a repository
  failure replaces the page.
- Widget tests run on a fake clock. An awaited `File` or `Directory` call in the
  test body, or the first `build()` of an async notifier, never resumes, so
  `PresentationPreferencesController.selectLanguage` waits forever on
  `state.value == null` and the Settings chip looks dead. Create the temp
  preferences file with `createTempSync`, pass it as `mountApp`'s
  `presentationFile`, and advance the read with the shared bounded
  `runAsync` + `pump` loop `settleUi` (`test/support/settling.dart`); a
  suite whose real work is slower passes it a wider frame budget.
  A test that prints nothing after its name is this wait. Pass
  `flutter test --timeout 30s` so the hang fails on a line.
- A menu that must stay inside the window uses `showMenu`. `MenuAnchor`'s
  `maximumSize` caps the panel's children; the overlay still anchors that panel,
  so a label at text scale 1.8 paints past the view edge. Assert the menu
  item's global rectangle, not the child's max width.

## Verification bar

Use Marionette MCP only when the user explicitly requests it. For routine
changes, use the Flutter checks above.

`flutter analyze` + `flutter test` cover Dart behavior; Flutter Release additionally
builds Windows/Android distributions. Credential stores, device networking and
install/update remain owner-manual (Windows/Android). Linux/macOS/iOS runners
provide code-level support: macOS/iOS need a
configured Keychain access group and Linux a running D-Bus Secret Service
before the session cookie can be stored. Plugin platform badges are not
runtime evidence — state exactly what was run.
