# AGENTS.md — GitPulse Flutter native client

> Native Flutter client for GitPulse — Release Timeline, Release Follows, and Settings, rendered
> natively. The one WebView is the document renderer: a release's notes and a repository README are
> GitHub Markdown an author also wrote HTML into, so they are drawn by the browser engine running the
> app's own renderer (`lib/releases/release_document.dart`, ADR 0028). Independently released package.
> Connects to any GitPulse backend: discovers providers via `GET /api/native/capabilities`, then signs
> in with personal password, PAT, or GitHub OAuth through the system browser. Deep contract (timeline
> window semantics, platform matrix, dependency rationale): `../docs/flutter-release-timeline-spec.md`
> and `../docs/flutter-release-timeline-plan.md`. Server handoff protocol: `../docs/native-login-handoff.md`.

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

## UI — tokens first

Before changing any widget, layout, color, type, spacing or interaction state, read the tokens in
`lib/presentation/gitpulse_tokens.dart`; `gitPulseTheme` is the single theme source. Do not invent
a value the token file does not name, and do not read `theme.dividerColor` for an internal rule —
a surface's edge and its internal rule are two registered tones. A visual choice that contradicts
an existing rule needs an ADR (see `../docs/adr/0023-flutter-press-feedback-scope.md`).

## UI conventions

- **Settings is a column of cards, not a table or a document** (`lib/settings/`): each card is a
  leading icon, one label, and the control that holds its value, framed by `GitPulseSettingSurface`
  in `presentation/gitpulse_setting_rows.dart`. A card has no description under the label; failure
  and status feedback stays, because it reports what last happened. The backend card is
  `settings/account_panel.dart` with `card: true` on Settings only. The signed-out Timeline/Follows
  gate and the repository pages keep that panel without the frame. Account actions are
  tooltip-named icon buttons, so tests address them with `find.byTooltip`. The retention card steps
  one whole day at a time and applies immediately. Its number is always a field; leaving the field
  saves a whole day from 1 to 90, and an illegal entry snaps back to the value in force with a short
  hint beside the title that then disappears. The window defaults to 30. The account name and sign-out
  sit on the backend card's header, one `GitPulseSpace.inline` above it. Timeline cache keeps its
  clear action on the title's line.
- **The page pill is flat** (`presentation/gitpulse_pill.dart`): page navigation is one hairline
  `GitPulsePill` whose cells are the two step arrows and an always-editable `GitPulsePillNumber`.
  A cell is `GitPulseHeight.pill` (32dp, flatter than a toolbar control — ADR 0026) and the number
  cell is `GitPulseWidth.pillNumber` wide before the text scale; the pill grows only when the
  number's own line needs more room. How many pages there are is stated beside the pill, not inside
  it. Taking the focus turns the pill's edge to the accent and moves nothing — no second box, no
  floating label, no size change (that is the whole of the focus feedback). The number names the
  page the reader asked for as soon as the request starts, not the page it replaced.
- **Follows discovery reads** (`lib/follows/release_follows_screen.dart`): a first read or a page
  turn replaces the list with `GitPulseLoadingView`; the page already on screen is re-read by
  `GitPulsePullToRefresh` (the Timeline's own surface), which is the only progress a same-page read
  shows; a read that failed replaces the list with the page-level `GitPulseMessageView` and its one
  Retry, never keeping the rows it could not load. The footer holds the manage button alone while a
  read has failed and the page pill plus the manage button otherwise — no progress bar and no retry
  line (only an edit in flight still reports through `LinearProgressIndicator`).
- **Chrome & states**: `gitPulseTheme` is the single theme source; use `GitPulseLoadingView` /
  `GitPulseMessageView` for page-level loading, empty, and error states — not a second look.
- **i18n & formatting**: add new page copy to both ARB files. Format dates through
  `gitpulse_formatting.dart`; give count placeholders `"format": "decimalPattern"` in the ARB so
  intl localizes them. Star counts on Release Follows use `formatGitPulseLocaleCompactCount`
  (locale `K` / `万`); download counts stay on `formatGitPulseCompactCount`.
- **Repository detail page** (`lib/repositories/repository_screen.dart`): bands on the shared
  gutter, capped at the reading measure so a README keeps its line length —
  identity, a full-width rule, then the README under the revision and path it was read from
  (`main · docs/README.md`). The app bar passes no title — the band below names the page.
  The identity is the owner's real avatar (`GitPulseAvatar`, from the payload's `avatar_url`)
  beside two lines: the owner at 14 muted, the repository at 22 half-bold
  (`GitPulseType.pageTitleSize`) wrapping in full rather than truncating, then its 14sp
  description. The data line puts a glyph (`LanguageSwatch`, a star, a fork, an eye from
  `presentation/gitpulse_language_colors.dart`) where the noun would go, keeping the noun in that
  fact's `Semantics` label. Below it, Release List, Release Follow and Share stay on **one row at
  every width** (the user rejected the two-row fallback): the list is the primary action on the
  row's spare width under the short `repositoryReleasesAction` name (the full
  `repositoryReleasesTitle` stays in its `Semantics` label and in the Release Drawer's tooltip),
  the other two are `presentation/gitpulse_icon_action.dart` compact targets named by tooltip. A
  README failure stays inside its band; only a repository failure replaces the page.
- **Documents are drawn by the app's own WebView renderer** (`lib/releases/release_document.dart`,
  `document_view_page.dart`, `document_web_view.dart`; ADR 0028): a release's notes and a repository
  README are GitHub Markdown an author also wrote HTML into, so the page parses, sanitizes and lays
  them out, and `flutter/tool/document_viewer` builds the two committed assets. The app keeps the
  theme, the reading scale, the address policy (`RepositoryDocumentContext.resolve`), navigation and
  the clipboard, reached from the page through four named bridge calls — never add a second
  Markdown-to-widget path to fix a rendering gap. The document owns its own scroll, because a
  platform view keeps the gestures that land on it, so its host fixes the chrome around it: the
  Release Drawer keeps its header above the notes and its Release Assets row below them (opening the
  assets puts the list in the reading area, folding them puts the notes back), and the repository
  page keeps its identity band above the README. Never stretch a document to its content height
  inside a Flutter scroll view.
- **Release Follow from the detail page** reads and writes the shared
  `releaseFollowsSessionProvider` — the `node_id` the page maps is the same identity a follow
  stores, so there is no second follow state. The action is a bookmark (never a GitHub star or
  watch), is disabled by `ReleaseFollowsState.editBlocked` (the one predicate every surface and the
  session's own guard uses), and whatever the shared session could not read or save is stated under
  the row with `GitPulseSettingNote`, so an unread list never reads as an unfollowed one. Share goes
  through `repository_share.dart`: `repositorySharerProvider` (share_plus) gets the canonical
  `https://github.com/owner/name`, and a platform that answers false gets the link on the
  clipboard with `repositoryLinkCopied`. Tests override the provider instead of opening a sheet.

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
  shared refresh baseline (window semantics: `../docs/flutter-release-timeline-spec.md`).
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
  the window is edited on the retention card and applies to saved history at once, offline.
  All four share the device controller's save queue; the followed-view provider is read-only. View
  save failures stay silent; the other three report them. The file keeps its historical name
  `presentation_preferences.json` (ADR 0024), and the old view text file is unused (ADR 0022).
- The window is resolved before anything is pruned or saved; an installation without one is seeded
  once from the window its cache ledger last wrote. Never prune or save against an unresolved window.

### Documents

- Rebuild the renderer after changing `tool/document_viewer/src/` or its pinned versions:
  `cd tool/document_viewer && bun install && bun run build && bun run verify`, then commit
  `assets/document_viewer/`. A Flutter checkout needs no JavaScript toolchain; a renderer change
  does.
- A widget test has no browser engine. Mount a document with `documentViewerOverrides()`
  (`test/support/document_viewer.dart`), which stubs the assets and the platform view; the global
  `mountedDocument` is how a screen test acts as the page — reporting a link tap, a copy, or a failed
  render. What the renderer does with a document is asserted in `tool/document_viewer/verify.mjs`,
  not in Flutter.
- The sheet's grab handle resizes through `DraggableScrollableSheet`'s scroll controller, so the
  drawer body keeps a scrollable attached to it (`_documentBody`, never scrollable). Without that
  attachment the handle silently stops resizing the sheet.

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
