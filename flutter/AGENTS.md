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
- Android release APKs are **debug-signed**; a private release key outside
  version control is required before distributing.
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

## Verification bar

Use Marionette MCP only when the user explicitly requests it. For routine
changes, use the Flutter checks above.

`flutter analyze` + `flutter test` cover Dart behavior only; native builds,
plugin integration, credential stores, and device networking are owner-manual
(Windows/Android). Linux/macOS/iOS runners are scaffolding: macOS/iOS need a
configured Keychain access group and Linux a running D-Bus Secret Service
before the session cookie can be stored. Plugin platform badges are not
runtime evidence — state exactly what was run.
