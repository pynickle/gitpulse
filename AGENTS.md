# AGENTS.md — GitPulse

> Compact guidance for AI agents working in this repository. Every entry answers: "Would an agent likely miss this without help?" Commands, commit format, and pre-PR checks live in `CONTRIBUTING.md`.

## Interface copy (non-negotiable)

Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.

## Tests (Non-Negotiable)

**A test executes the code and asserts on behavior.** Call the function, mount the component, hit the route, then assert returned values, rendered output, request payloads, or public contracts. Source text is not behavior: a test that reads a `.vue` / `.ts` file and matches its characters proves nothing, and fails on every rename.

## Scope

Before adding complexity for a speculative or vanishingly unlikely race or security edge case, explain the concrete failure mode, likelihood, and complexity cost to the user and get their buy-in. Do not silently expand scope for theoretical robustness.

## Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## Commands

- `bun run build` is reserved for CI; run it locally only when asked. `bun run generate` is the static export.
- `bun test --parallel` isolates each file, so a test installs its own `mock.module` aliases before importing the module under test.
- The extension is a separate WXT package; `cd extension && bun install` may be needed for WXT/editor state.

## Layout & Wiring

- Layouts: `routeRules` `appLayout` only, never `layout:` / `definePageMeta`.
- Top bars share `--gitpulse-topbar-height` and `ChromeActions`; a bar that hand-renders the GitHub, language and color-mode controls is a regression.
- Route-rule keys carry no `**` before the last segment: Nuxt's rou3 matcher truncates the key there and Nitro 2's radix3 never matches it. Expand locale prefixes with `localeVariants`; `tests/route-rules.test.ts` pins both engines.
- `shared/data/*.json` holds language-neutral data **both clients** read — presentation values live there, never in a stylesheet literal and never per client; the `gitpulse` Theme Preset palette is the worked example.
- Logical navigation history is **derived from the route** — pages and components must never record it manually. The client plugin feeds each `router.afterEach` into `useNavigationHistory` → `applyLogicalNavigationEvent` (`app/utils/navigationEntryRouting.ts`); logical Back/Home are the same function. New dashboard URL shapes must be added to `routeToNavigationEntry` and covered by `tests/navigation-entry-routing.test.ts`. An inadmissible dashboard child URL (`/dashboard/wiki` without `?repo=`) redirects to the dashboard root after the auth gate (`app/middleware/dashboard-route-shape.global.ts`); cover new child pages in `tests/dashboard-route-shape.test.ts`.
- Dashboard child pages (`/dashboard/profile`, `/dashboard/releases`, `/dashboard/wiki`, …) must use the generic **Back + Home** header via `useNavigationRouting` unless explicitly required otherwise; never hardcode labels, back targets, or local route fallbacks — `resolveNavigationEntryRoute` is the only resolver.

## Pointer contract (Web, ADR 0049)

- A touch leaves no tint: a tap paints neither the platform highlight nor a hover background, a press paints nothing (it does not move or scale either), a filled control answers a press with its own deeper tone, and only the keyboard paints focus.
- A hover state is written as `@include hover-only { &:hover { … } }` (`app/assets/scss/_pointer.scss`); the query is `(hover: hover) and (pointer: fine)` — capability, never a width. `modules/hover-gate/` gates every hover rule in the built CSS, so a stylesheet that predates this rule and still writes a bare `:hover` is covered; one you write or edit must use the mixin.
- Anything that paints on `:focus` uses `:focus-visible`. Form fields keep bare `:focus`, because a field is tinted while the reader types in it.
- A `:focus-within` that _tints_ (a card wash) is gated with its `:hover`; a `:focus-within` that _reveals_ a control (a row's add button) stays outside the gate — a reveal is a keyboard affordance.
- A press never adds a tint and never adds motion; the one exception is a filled control, which deepens its own fill. The base rules live in `app/assets/scss/main.scss`, so a component does not re-declare the tap highlight itself; a drag surface keeps its own `touch-action: none`, and a component may keep its own `user-select: none`.

## Imports (Strict)

- `app/utils/*.ts` → **named** exports, auto-imported in app code by their declared name — reference them by name. Only tests, `server/`, and `mock.module` stubs import them explicitly; an explicit import in app code is redundant, not wrong.
- Never give an `app/utils` module a default export. A default binding takes the file's camelCase basename instead of the declared name, so a file rename silently renames every call site, and a TypeScript type cannot ride a default-exported value at all.
- `server/utils/*.ts` → **named** exports. Import explicitly.
- Shared: reach through the `#shared/*` alias; `server/utils/` exposes its named exports directly, with no thin re-export wrappers.

## Component Props (Vue SFCs)

- Read props through reactive destructure: `const { a, b = 2 } = defineProps<T>()` (stable since Vue 3.5, which is installed). Do not use `withDefaults()` — combined with a destructure it switches reactive destructuring off, and a factory default (`list = () => []`) does not compile. Array/object literals already get their per-instance factory from the compiler.
- Keep `const props = defineProps<T>()` only when the whole object is handed to a util or composable, or for dynamic access (`props[key]`), and say why in a one-line comment.
- A component that reads props only in its template calls `defineProps<T>()` unbound; bind a destructure only for the props that need a default, since a binding the script never reads is dead code. A prop whose name is not a valid identifier (`class`) is the one case that must be bound, aliased (`class: className`), because the template cannot read the bare name.
- Defaults must not reference another prop: they move into the hoisted runtime declaration, where the other binding does not exist.
- `watch(() => x, …)` — a bare `watch(x, …)` is a compile error. A composable that must track a prop takes `toRef(() => x)`, not `x`.
- After destructuring, a computed that only forwards a prop (`computed(() => props.x)`) is redundant — delete it, and a default belongs in the destructure rather than in a `?? fallback` computed.

## Auth & Sessions (Must-Use)

- **Every** GitHub auth session write goes through `establishGitHubSession()` from `server/utils/auth-session-utils.ts` — the only writer of `github`/`pat` sessions, and the owner of their shape and cookie wiring.
- Read provider availability with `resolveAuthProviderState()` / `assertAuthProviderState()` (`server/utils/auth-providers.ts`). Do not inspect raw `NUXT_*` env vars.
- Personal mode defaults **on** (`NUXT_AUTH_PERSONAL_MODE_ENABLED`, default `true`). Startup validates the baked token and the cookie secret; required values: `NUXT_GITPULSE_AUTH_GITHUB_TOKEN`, `NUXT_GITPULSE_AUTH_PERSONAL_PASSWORD`, `NUXT_GITPULSE_AUTH_PERSONAL_COOKIE_SECRET`. A blank value still accepts the same `NUXT_GIT_PULSE_AUTH_*` name; old `AUTH_PERSONAL_*` names are not read. Missing values fail startup.
- Single global auth gate: `app/middleware/auth.global.ts`. Do not scatter checks.
- `server/plugins/validate-app-secret.ts` asserts `NUXT_APP_SECRET` at startup in every mode (`assertAppSecretStrength` in `server/utils/app-secret-utils.ts`). `nuxt-auth-utils` seals the session with a secret HKDF-derived from that root and throws per request when it is missing; Nuxt generates one in development only, so a production build must set it. See `docs/self-hosted.md`.
- Browser launch links use `/open?url=<GitHub URL>`. `resolveGitPulseLaunchRoute` owns GitHub URL parsing and resolves supported targets through `resolveNavigationEntryRoute`; `/dashboard?url=` is not a supported entry shape. Cover new mappings in `tests/resolve-gitpulse-launch-route.test.ts`.
- OAuth/PAT/unlock/logout live under `/auth/**` (`server/routes/auth/`), not `/api/auth/*`.
- Native Login Handoff changes must preserve verifier/origin binding and atomic consumption in `server/utils/native-login-handoff.ts`. Read `docs/native-login-handoff.md` before changing its browser approval, storage, or Flutter lifecycle; `/native-login` is a server-rendered OAuth return target, and only mutating redemption establishes the app session.
- The browser extension is navigation-only. It opens the configured GitPulse base URL and does not call Web App API endpoints; keep its independently released WXT package decoupled from app APIs.
- Session shape is declared in `shared/types/auth.d.ts`.

## CSRF (Non-Negotiable)

- Mutating methods under `/api/` are protected by `server/middleware/csrf.ts` (double-submit cookie `gitpulse_csrf` + `x-csrf-token` header).
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

- Settings storage is the Nitro `userSettings` mount; the client entry is `useUserSettings` (`app/composables/useUserSettings.ts`), an optimistic store. Driver and env-var matrix: `docs/self-hosted.md`.

## Linting, Formatting, Hooks

- Oxlint runs the `unicorn`, `typescript` and `oxc` plugins with `correctness` at `deny`, so `bun run lint` fails on any diagnostic. Formatting, linting and hook commands: `CONTRIBUTING.md`.

## Testing

- Timeline/detail response shapes and launch GitHub URL mappings are the highest-risk surfaces; re-verify against real GitHub payloads and cover new launch mappings in `tests/resolve-gitpulse-launch-route.test.ts`.
- Drive a real browser — Chrome DevTools, browser-use, or clicking through `bun run dev` — only when the user explicitly asks for browser testing; do not start the dev server on your own initiative.

## Anti-Patterns (High-Miss)

- Do not create a second Octokit factory — extend `server/utils/github-auth-utils.ts`.
- Do not duplicate timeline parsing in components — use the dedicated composables.
- Do not write session shape inline in auth routes; keep `shared/types/auth.d.ts` + `establishGitHubSession` in sync.
- Do not treat `.nuxt/` or `.output/` as source of truth — read `nuxt.config.ts` and the app source.
- When a repository's documentation and its existing code disagree, follow the conventions used in the existing code, and in your final reply point out each inconsistency you found between the documentation and the code.
- Extension releases (`extension-v*`), Flutter distributions (`flutter-vX.Y.Z`) and main app releases (`vX.Y.Z`) are independent; their workflows do not trigger each other.

## Design options

- Call Imagine / `image_gen` / `image_edit` only when the user explicitly asks for images.

## Agent harness

- Determine the harness from the runtime instructions and the question tool's own name, namespace, and description. Under Codex CLI, ask directly in the ordinary response and end the turn — never invoke its `request_user_input*` tools; this holds inside skill workflows too. Other harnesses (Claude Code, Grok Build CLI, OpenCode) are unaffected.

## References

- Self-hosting / env matrix: `docs/self-hosted.md`
- Extension details: `extension/README.md`
- Conventional commits skill: `.agents/skills/conventional-commit/SKILL.md`

## Agent skills

Skills in `.agents/skills/` (plus user-level skills) cover Nuxt/Vue and Flutter/Dart work, among others; load the one whose description matches the task.

### Issue tracker

Issues and specs are tracked in GitHub Issues for `pynickle/gitpulse`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five canonical triage labels without overrides. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain layout. See `docs/agents/domain.md`.
Domain files such as `GLOSSARY.md` and `docs/adr/` are tracked source, not ignored files — read them
directly. If one is absent from the index, inspect that path through the filesystem instead of
concluding the file does not exist.

<!-- nuxt-skill-hub:start -->

Use the `nuxt-gitpulse` skill as the Nuxt router/entrypoint for tasks in this repository.
<!-- nuxt-skill-hub:end -->
