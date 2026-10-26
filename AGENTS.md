# AGENTS.md — GitPulse

> Compact guidance for AI agents working in this repository. Every entry answers: "Would an agent likely miss this without help?" Update when build/auth/storage/CSRF/conventions change. Commands, commit format, and pre-PR checks live in `CONTRIBUTING.md`; this file holds what that guide cannot say.

## Interface copy (non-negotiable)

**Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.**

## Tests (Non-Negotiable)

**A test executes the code and asserts on behavior.** Call the function, mount the component, hit the route, then assert returned values, rendered output, request payloads, or public contracts. Source text is not behavior: a test that reads a `.vue` / `.ts` file and matches its characters proves nothing, and fails on every rename.

## Scope

Before adding complexity for a speculative or vanishingly unlikely race or security edge case, explain the concrete failure mode, likelihood, and complexity cost to the user and get their buy-in. Do not silently expand scope for theoretical robustness.

## Commands

Full command reference and pre-PR checks: `CONTRIBUTING.md`.

- **Pre-commit verification** (matches CI intent): `bun run fmt:check && bun run lint && bunx nuxi typecheck && bun test --parallel`.
- `bun run build` is **intentionally reserved for CI** — do not invoke locally unless asked. `bun run generate` is the static export, not a build.
- Root CI runs format, lint, typecheck, `bun test --parallel`, extension typecheck, and build. Run `bun run extension:test` for the extension package. Flutter CI runs Flutter tests. `--parallel` isolates each file, so a test must install its own `mock.module` aliases before importing the module under test.
- The extension is a separate WXT package; root `extension:*` scripts are wrappers. After a clean checkout, `cd extension && bun install` may be needed for WXT/editor state.

## Layout & Wiring

- Global layouts via `routeRules` `appLayout` in `nuxt.config.ts` (not `layout:` / `definePageMeta` in pages). Locale prefixes need the `/**/` rules:
  - `/` → `landing`
  - `/open` and `/**/open` → `landing` (the browser integration launch entry)
  - `/**/dashboard` and `/**/dashboard/**` → `dashboard`
- `nuxt.config.ts` does early auth validation at load time and will throw if no provider is available.
- `nuxt.config.ts` ignores the entire `extension/` tree.
- Logical navigation history is **derived from the route** — pages and components must never record it manually. The client plugin `app/plugins/navigation-history.client.ts` feeds each `router.afterEach` (route + vue-router `history.state.position`) into `useNavigationHistory` → `applyLogicalNavigationEvent` in `app/utils/navigationEntryRouting.ts`; logical Back/Home are the same function. New dashboard URL shapes must be added to `routeToNavigationEntry` and covered by the round-trip tests in `tests/navigation-entry-routing.test.ts`. Sequential push/replace/back/home cases belong on `applyLogicalNavigationEvent` in that same file.
- Dashboard child pages (`/dashboard/profile`, `/dashboard/package`, `/dashboard/releases`, `/dashboard/branches`, `/dashboard/wiki`, …) must use the generic **Back + Home** header unless explicitly required otherwise: labels `t('detailOverlay.back')` / `t('detailOverlay.home')` and `useNavigationRouting` (`goBackToPreviousPage`/`goToDashboardHome`/`shouldShowHomeButton`). Never hardcode "Back to X" labels, fixed back targets, or local entry→route fallbacks — `resolveNavigationEntryRoute` is the only resolver.

## Imports (Strict)

- `app/utils/*.ts` → **default** exports, auto-imported by Nuxt. Reference them by name in SFCs and other app code; Nuxt resolves them with no import statement.
- Named-export util modules (for example `navigationEntryRouting.ts`) are imported explicitly.
- `server/utils/*.ts` → **named** exports. Import explicitly.
- Shared: reach through the `#shared/*` alias; `server/utils/` exposes its named exports directly, with no thin re-export wrappers.
- Auto-imported composables (`~/composables/*`): reference by name, same as the `app/utils/` defaults.

## Auth & Sessions (Must-Use)

- **Every** GitHub auth session write goes through `establishGitHubSession()` from `server/utils/auth-session-utils.ts` — the only writer of `github`/`pat` sessions, and the owner of their shape and cookie wiring.
- Read provider availability with `resolveAuthProviderState()` / `assertAuthProviderState()` (`server/utils/auth-providers.ts`). Do not inspect raw `NUXT_*` env vars.
- Personal mode defaults **on** (`NUXT_AUTH_PERSONAL_MODE_ENABLED`, default `true`). Startup validation is `server/plugins/personal-mode.ts` (baked token against GitHub `/user`) plus `server/plugins/personal-mode-validate-secret.ts` (cookie-secret strength). Required values: `NUXT_GIT_PULSE_AUTH_GITHUB_TOKEN`, `NUXT_GIT_PULSE_AUTH_PERSONAL_PASSWORD`, `NUXT_GIT_PULSE_AUTH_PERSONAL_COOKIE_SECRET`. Old `AUTH_PERSONAL_*` names are not read. Fails fatally on error.
- Single global auth gate: `app/middleware/auth.global.ts`. Do not scatter checks.
- Browser launch links use `/open?url=<GitHub URL>`. `resolveGitPulseLaunchRoute` owns GitHub URL parsing and resolves supported targets through `resolveNavigationEntryRoute`; `/dashboard?url=` is not a supported entry shape. Cover new mappings in `tests/resolve-gitpulse-launch-route.test.ts`.
- OAuth/PAT/unlock/logout live under `/auth/**` (`server/routes/auth/`), not `/api/auth/*`.
- Native Login Handoff changes must preserve verifier/origin binding and atomic consumption in `server/utils/native-login-handoff.ts`. Read `docs/native-login-handoff.md` before changing its browser approval, storage, or Flutter lifecycle; `/native-login` is a server-rendered OAuth return target, and only mutating redemption establishes the app session.
- The browser extension is navigation-only. It opens the configured GitPulse base URL and does not call Web App API endpoints; keep its independently released WXT package decoupled from app APIs.
- Session shape is declared in `shared/types/auth.d.ts`.

## CSRF (Non-Negotiable)

- Mutating methods under `/api/` are protected by `server/middleware/csrf.ts` (double-submit cookie `gitpulse_csrf` + `x-csrf-token` header). Cookie issuance is `server/plugins/csrf.ts`.
- `/auth/**` is outside that middleware. Session mutations live there (`/auth/github`, `/auth/pat`, `/auth/unlock`, `/auth/logout`).
- Add a mutating `/api` exemption only via `CSRF_EXEMPT_PATHS` in that middleware, plus a security review.
- Client: `useGitPulseApiFetch()` for all mutating same-origin `/api/**` and `/auth/**` calls. Nuxt 4.5+ auto-imports `$fetch` as a module binding; that module binding is the `$fetch` to patch.
- Constant-time check + optional Origin/Referer host validation lives in `server/utils/csrf-utils.ts`.
- The server-rendered native approval form supplies its double-submit token through `assertCsrfToken`'s form-token argument. Other programmatic mutations keep the header contract; first-response form tokens come from the CSRF plugin's event context.

## Server API & Data

- GET private API handlers should use `definePrivateApiCoalescedEventHandler` (`server/utils/api-cache-utils.ts`) for in-flight coalescing. GET `/api/**` cache headers (`private, max-age=0, must-revalidate`) are set by `server/middleware/api-cache-control.ts`.
- GitHub client: `getGitHubClient(event)`, `getGitHubRequestContext(event)`, or `getGitHubSessionContext(event)` from `server/utils/github-auth-utils.ts`. Never `new Octokit(...)` in route handlers.
- User HTML must pass through `app/utils/sanitizeHtml.ts` (xss allowlist).

## User Settings Storage

- Backed by Nitro mount `userSettings`. Client entry: `app/composables/useUserSettings.ts` (optimistic store in `app/composables/user-settings/store.ts`).
- Driver and env-var matrix (`fs` / `redis` / `upstash`): `docs/self-hosted.md`.

## Linting, Formatting, Hooks

- Formatter and linter config: `.oxfmtrc.json` / `.oxlintrc.json` (source files enable the `unicorn` plugin with a few rules disabled). Commands and the `prek` pre-commit hook: `CONTRIBUTING.md`.
- LF enforced by `.gitattributes`.
- Commits: use the project skill `.agents/skills/conventional-commit/SKILL.md`.

## Testing

- Root: `bun test --parallel` (`tests/`). Extension: `bun run extension:test` (`extension/tests/`); extension typecheck: `bun run extension:typecheck`.
- Timeline/detail response shapes and launch GitHub URL mappings are the highest-risk surfaces; re-verify against real GitHub payloads after changes, and cover new launch mappings in `tests/resolve-gitpulse-launch-route.test.ts`.
- Verify UI and layout changes with `bun test --parallel`, `bun run lint`, and `bunx nuxi typecheck`.
- Drive a real browser — Chrome DevTools, browser-use, or clicking through `bun run dev` — only when the user explicitly asks for browser testing; do not start the dev server on your own initiative.

## Anti-Patterns (High-Miss)

- Do not create a second Octokit factory — extend `server/utils/github-auth-utils.ts`.
- Do not duplicate timeline parsing in components — use the dedicated composables.
- Do not bypass `app/utils/sanitizeHtml.ts`.
- Do not add mutating `/api` routes without CSRF middleware.
- Do not scatter auth checks — the global middleware is the only gate.
- Do not manually import auto-imported `app/utils/` defaults or `app/composables/`.
- Do not write session shape inline in auth routes; keep `shared/types/auth.d.ts` + `establishGitHubSession` in sync.
- Do not treat `.nuxt/` or `.output/` as source of truth — read `nuxt.config.ts` and the app source.
- When a repository's documentation and its existing code disagree, follow the conventions used in the existing code, and in your final reply point out each inconsistency you found between the documentation and the code.
- Do not test source text (`readFileSync` + `toContain`) — see **Tests (Non-Negotiable)**.
- Extension releases (`extension-v*`), Flutter distributions (`flutter-vX.Y.Z`) and main app releases (`vX.Y.Z`) are independent. Their release workflows do not trigger each other.

## Design options

- Present options as compact labeled lists (`A`/`B`/`C` or `1`/`2`/`3`) using symbols, letters, and numbers. Short title plus a few bullets; no generated pictures.
- Call Imagine / `image_gen` / `image_edit` only when the user explicitly asks for images.

## Agent harness

- Determine the harness from the runtime instructions and the question tool's own name, namespace, and description. Under Codex CLI, ask directly in the ordinary response and end the turn — never invoke its `request_user_input*` tools; this holds inside skill workflows too. Other harnesses (Claude Code, Grok Build CLI, OpenCode) are unaffected.

## References

- Self-hosting / env matrix: `docs/self-hosted.md`
- Extension details: `extension/README.md`
- Conventional commits skill: `.agents/skills/conventional-commit/SKILL.md`
- Flutter UI rules — read before changing any Flutter interface: `flutter/design-system/gitpulse/MASTER.md`
  (migration batches and their verification: `flutter/design-system/gitpulse/PROGRESS.md`). These are the
  only visual rules for `flutter/`; the web app is not governed by them.

## Agent skills

Skills in `.agents/skills/` (plus user-level skills) cover Nuxt/Vue and Flutter/Dart work, among others; load the one whose description matches the task.

### Issue tracker

Issues and specs are tracked in GitHub Issues for `pynickle/gitpulse`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage labels without overrides. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain layout. See `docs/agents/domain.md`.
Domain files such as `CONTEXT.md` and `docs/adr/` are tracked source, not ignored files — read them
directly. If one is absent from the index, inspect that path through the filesystem instead of
concluding the file does not exist.

<!-- nuxt-skill-hub:start -->

Use the `nuxt-gitpulse` skill as the Nuxt router/entrypoint for tasks in this repository.
<!-- nuxt-skill-hub:end -->
