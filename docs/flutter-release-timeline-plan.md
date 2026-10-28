# Flutter Release Timeline implementation plan

Status: synthesized into the published implementation specification, [GitHub issue #95](https://github.com/pynickle/gitpulse/issues/95), labelled ready-for-agent. The product and major library choices below are accepted; explicitly proposed engineering defaults/supporting dependencies retain their recommendation status in the published specification. This specification task has not started application implementation or production deployment.

Decision history: [interview specification](flutter-release-timeline-spec.md). Architecture decisions: [client boundary](adr/0015-flutter-release-timeline-client-boundary.md), [cache reconnection](adr/0016-flutter-timeline-cache-reconnection.md), [native authentication](adr/0017-flutter-cookie-session-browser-handoff.md).

## Accepted product

- Build a publicly distributable GitPulse app under `flutter/`, application identifier `ink.euphony.gitpulse`, independent `flutter-vX.Y.Z` releases.
- Connect to a user-configured compatible GitPulse Nitro backend. The first backend field is empty; remember the last successful address. The owner's installation can use `https://gitpulse.euphony.ink`.
- Support Windows, Android, Linux, macOS, and iOS. The user manually debugs Windows and Android. The other platforms receive code/configuration support and prerequisite documentation without a claim of runtime verification.
- Limit features to Release Timeline, Release Follows, repository overview/README, repository release lists, release bodies, asset information/external links, and necessary settings/authentication.
- Exclude issues/PRs, file/commit browsing, GitHub Star/Watch mutations, reactions, Recovered Release History UI/merge, and an in-app download manager.
- Use customized Material 3 with GitPulse colors, Simplified Chinese/English, and light/dark/system themes. Desktop uses a narrow navigation rail, one to three date-grouped card columns, and a release drawer; mobile uses three navigation destinations, one column, and a release sheet. Repository details are separate pages.
- Share Release Follows, the retention-days preference, and Timeline Refresh Baseline across web/app clients of the same account. Cache contents and clear-cache actions are device-local. Each in-progress refresh cycle keeps its captured previous baseline fixed.

## Accepted cache contract

Retention is an account-level integer from 1 to 90 days, default 30. Keep publication times at or after `nowUtc - Duration(days: retentionDays)`, including the boundary. Date-grouping time zones do not change retention. Older online results can remain in the current browsing session but are not persisted.

Persist the latest release content by stable repository/release identity, not every raw HTTP response. Persist sufficient page/cursor provenance and the Saved Visible Timeline to recover the correct display state. README, arbitrary document images, and current asset metadata are outside the offline guarantee.

Read new pages per repository until their fetched chain reconnects to that repository's retained history. Dates overlapping, one shared release in a different repository, or the mere presence of newly written records in the database do not establish a connection. A refresh/load action performs one coordinated round; bridging requires explicit further loading.

Expose the cached extension only after the required repositories pass the shared connection checks. Successful fresh results remain displayable while waiting. Transient failures preserve cursors/data and require retry. A repository that is explicitly unavailable continues blocking the extension until recovery or unfollowing. Successful upstream exhaustion without any surviving cached anchor discards that repository's old history and removes its barrier.

Unfollowing deletes the repository's local history and recomputes participation; a new Followed Repository with no old history needs no cache anchor. Search, filters, and loaded-new counts operate on the current exposed timeline, never disconnected cached islands.

Keep local cached content hidden after an explicit server session rejection, without deleting it immediately. Reauthentication as the same identity can restore it subject to retention. Explicit logout or backend/account switching clears the previous identity's credentials and cache. A network failure alone does not clear them.

## Dependency profile

Versions below are observed stable versions, not a frozen manifest. At implementation time select the newest mutually compatible stable set, commit `flutter/pubspec.lock`, and record any necessary older selection. Do not force incompatible versions together through overrides.

| Role                           | Selected package / observed version                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| UI                             | Flutter SDK Material 3                                                                    |
| State and dependency injection | flutter_riverpod 3.4.3; handwritten providers                                             |
| Local database                 | drift 2.35.2 with sqlite3 3.7.1 native implementation                                     |
| HTTP                           | dio 5.11.1                                                                                |
| Cookie handling                | cookie_jar 4.0.9, dio_cookie_manager 3.5.0                                                |
| Remembered credentials         | flutter_secure_storage 11.2.0                                                             |
| Navigation                     | go_router 18.1.0                                                                          |
| Document rendering             | flutter_inappwebview 6.1.5; the page runs the app's own renderer (ADR 0028)               |
| Markdown, sanitizing, code     | markdown-it 15.0.3, DOMPurify 3.4.17, highlight.js 11.12.0; built by tool/document_viewer |
| Timeline filters               | markdown 7.3.1                                                                            |
| JSON DTO mapping               | json_annotation 4.12.0, json_serializable 6.14.1                                          |
| Internationalization           | SDK flutter_localizations and intl 0.20.3                                                 |

Supporting direct dependencies proposed for the final profile:

| Package / observed version                         | Purpose                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| url_launcher 6.3.3                                 | System browser OAuth and external links                                                                              |
| share_plus 13.3.1                                  | The platform share sheet for a repository link; a platform without one is answered false and the app copies the link |
| path_provider 2.1.6 and path 1.9.1                 | Application-support paths and portable filesystem operations                                                         |
| html 0.15.7                                        | Parse/normalize HTML and resource URLs; application policy still defines allowed content                             |
| crypto 3.0.7                                       | SHA-256 for the app-bound authorization challenge; base64url uses dart:convert                                       |
| drift_dev, build_runner                            | Required generation tools, selected as a compatible set                                                              |
| SDK flutter_test and standard Flutter lint tooling | Behavioral/widget tests and static analysis                                                                          |

Use Drift's native opener with an application-support path; drift_flutter is a viable optional helper but unnecessary for the proposed path/lifecycle ownership. Do not add Freezed, riverpod_generator, get_it/Provider, experimental Riverpod persistence, an editor, a persistent image-cache library, or native Shiki engines as part of this agreed profile. The document WebView is the one exception, scoped by [ADR 0028](adr/0028-flutter-document-webview-boundary.md).

A real observed generator conflict exists: build_runner 2.17.1 requires build 5 while current drift_dev/json_serializable require build 4. The complete project must be resolved rather than copying every independent newest version. Sources and the existing-SDK checks are in [dependency research](research/flutter-release-timeline-dependencies.md) and [highlighting research](research/flutter-syntax-highlighting.md).

## Proposed engineering defaults for final confirmation

1. **Startup and resume.** Restore the retained Saved Visible Timeline, then perform one automatic fresh round on startup when possible. While waiting, label restored data with its update time. A usable fresh response switches to fresh data plus only an eligible connected extension. A wholly failed refresh leaves the previous saved view available. Returning to the foreground prunes expired data and resumes a pending login handoff; it does not automatically refresh the timeline being read.
2. **Cache segments.** One repository may have several disconnected retained segments after successive refreshes. Reuse only the segment reachable from the current fetched chain. Encountering the most recently cached page must never unlock an older disconnected island. Apply coordinated display boundaries before user filters, preserving the existing bounded-pagination semantics.
3. **Saved view and filters.** Save the exposed timeline window before user display filters. Offline users can change search/filter conditions within that saved window. Do not include disconnected history or fetched buffers beyond the exposed window merely because they exist on disk.
4. **Pruning and settings.** Prune on startup, foreground return, writes/refreshes, and a shorter synchronized retention setting; re-check eligibility before displaying retained data. Remove orphaned page/release metadata consistently. Existing accounts can use their last valid preference when settings synchronization fails. A new identity with no synchronized preference can browse fresh results but waits for settings before enabling durable caching.
5. **Concurrency and invalidation.** Keep at most one timeline operation active for a cycle. Cancel/discard obsolete responses after refresh, unfollow, clear-cache, logout, or identity/backend changes. Serialize related database changes transactionally; old responses cannot restore removed data. Invalid cursors offer retry/refresh rather than silently skipping pages. Never infer release deletion merely from absence in one response page.
6. **Failures and recovery.** A failed cache write can leave fresh results readable in memory, with an explicit caching failure indication; keep the last committed saved view intact. Report database corruption and offer local cache rebuilding. Keep credential storage and server-owned settings independent of this cache recovery. A server-authentication rejection remains distinct from timeouts, rate limits, or repository-level permissions.
7. **Rich content.** Convert Markdown locally, normalize allowed HTML/resources, then render native widgets. Preserve owner/repository/ref/path context for relative links and images. Only the configured backend receives its session credentials. Supported repo/release links navigate in-app; excluded GitHub subjects open externally. Code blocks support selection, plain-source copy, horizontal scrolling, light/dark themes, and plain-text fallback for unknown languages or highlighting failure. Bound expensive work and cache token results; use the Dart engine's asynchronous path deliberately. Do not promise exact browser rendering or offline images.
8. **Supporting conventions.** Use SDK localization generation and system fonts/icons. Keep first-version settings and navigation focused on the accepted surfaces. Follow the latest selected SDK/plugins' supported OS requirements and document platform prerequisites instead of adding legacy compatibility forks.

Example that must remain correct after restart:

```text
Older retained segment:             8 -> 7 -> 6
Fresh request, saved separately: 12 -> 11 -> 10
Next startup repeats:            12 -> 11 -> 10

Repeating 12/11/10 does not expose 8/7/6. A later fetched page
containing 9 -> 8 provides the missing connection.
```

## Module boundaries

Follow the UI/Logic/Data separation while keeping the user-selected Riverpod and handwritten domain state classes.

- `lib/ui/`: thin feature views and shared Material components. Riverpod controllers expose immutable view state and commands; widgets do not coordinate pages or write caches.
- `lib/domain/`: pure Dart timeline transitions, page provenance/reconnection, coordinated exposure, retention, filtering/search, and stable identity models. Keep this logic testable without a database, network, or Flutter layout.
- `lib/data/`: typed API DTOs/services, secure Cookie-session adapter, Drift storage, and repositories that combine remote results with domain transitions and transactions.
- `lib/app/`: routing, bootstrap, localization/theme, and provider composition. Use Riverpod for injection; do not introduce another state/DI framework.

The timeline repository owns the normalized releases, retained segments, operation generation, and Saved Visible Timeline. Retention settings and shared baseline come from the backend; no widget independently recreates these rules. Identity scope uses the canonical backend base URL and stable GitHub account identity, including after reauthentication and renames.

## Nitro adaptations

1. Expose a small versioned native-capability contract using the existing provider resolver; reject unsupported backend capabilities clearly. Keep existing browser routes compatible.
2. Add Native Login Handoff start/status/approval/redemption/cancellation under the auth route family. Reads do not issue sessions; successful mutating redemption uses establishGitHubSession. Use existing CSRF conventions and an atomic expiring single-use transaction bound to origin and the initiating verifier. Protect temporary authorization material and never place session credentials into callback URLs.
3. Extend typed account settings with validated native cache-retention days, preserving unrelated preferences and the existing settings storage drivers. Keep Release Follow changes consistent with web account state.
4. Reuse repository/README/release APIs and per-repository timeline pages. Preserve stable identifiers and cursor/error semantics in Flutter DTOs; do not append response groups as though they were already a coordinated window.
5. Use the shared refresh-baseline path on refresh; partial usable results advance it and a wholly failed round does not. Verify concurrent refreshes cannot regress the shared baseline. Pagination/retry and cache clearing do not advance it. Native clients do not submit recovered-history merges.

## Implementation sequence

1. Add the five-platform project scaffold, SDK/dependency resolution, theme/localization, routing, and independent Flutter checks. Exclude Flutter/generated trees from unrelated Nuxt/root tooling where appropriate.
2. Adapt and test backend capabilities/settings/native login. Wire the app's provider discovery, secure Cookie persistence, system-browser handoff, expiry, and identity clearing.
3. Implement the pure timeline model and transactional cache first, including disconnected segments, all-repository gating, retained saved-view recovery, pruning, failures, and operation invalidation.
4. Build Timeline/Follows/Settings, repository overview/README, and release drawer/list/body/assets. Integrate the local HTML/SVG/Shiki renderer and adaptive navigation.
5. Complete automated checks, document Windows/Android manual-debug scenarios, and prepare the complete Windows ZIP/Android APK build path. Formal Android signing uses the release identity supplied through the release workflow; never label a debug-signed artifact as the final signed release.

The plan does not publish a release, configure external signing accounts/secrets, or deploy the production backend as part of design confirmation. Any later production action must be concrete and reviewable first.

## Verification and acceptance

- Cache behavior: overlap and gaps, multiple retained islands/restarts, one repository ahead of another, unavailable/failed/empty/exhausted pages, removed anchors, duplicate IDs, equal timestamps, renamed repositories, changed follows, UTC retention boundaries, setting shrink/expansion, old online-only history, rollback/write failure, and stale responses after clearing or identity changes.
- Auth/API contracts: personal-mode provider precedence, password/PAT/OAuth, wrong verifier/origin, expired/cancelled/replayed handoffs, CSRF, secure Cookie restoration, rejected-session hiding, shared-baseline concurrency, partial success, and HTTP 200 with no usable results. Use behavioral payload fixtures at the HTTP boundary.
- Widget behavior: adaptive columns/navigation, Back/Escape and drawer/sheet state, preserved scroll anchors, filters excluding disconnected history, and offline/partial/error states.
- Rich content: nested/open details, tables with colspan/rowspan, relative resources, SVG, fenced HTML text, Shell/PowerShell/TS/C++ samples, unknown languages, text selection/copy, horizontal scrolling, and theme changes.
- Run Dart formatting, Flutter analyze and tests; run repository format/lint/Nuxt typecheck/root tests for backend changes. Follow the repository's additional pre-push extension checks when pushing. Root bun build remains CI-only; do not start a web dev server or drive a browser without an explicit request.
- Windows/Android receive the user's real-device debugging. Linux/macOS/iOS acceptance is platform scaffolding, compatible dependencies and permissions/entitlements, and documented prerequisites/known unverified items. No five-platform runtime success is implied by a package badge or a headless Windows test.

The headless highlighting experiments already completed during research validate small source/widget samples only; they do not replace the application-level acceptance work above.
