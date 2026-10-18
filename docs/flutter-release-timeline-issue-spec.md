## Problem Statement

GitPulse's Release Timeline is currently part of a broader web dashboard. Users who primarily follow software releases need a focused native desktop/mobile application that reuses their GitPulse backend, keeps the familiar information layout, and makes recently fetched release history available across app restarts and network interruptions.

Fetching the latest pages alone can leave a gap between new results and previously fetched history. Simply appending every cached release, comparing publication dates, or finding an overlapping release in one repository can conceal missing pages in other repositories. The app must preserve useful local history without presenting disconnected records as a continuous timeline.

The owner will use the existing Nitro deployment at https://gitpulse.euphony.ink and debug Windows and Android. The client must also be distributable to other users with compatible self-hosted GitPulse instances and provide code-level Linux, macOS, and iOS support.

## Solution

Build a focused, publicly distributable Flutter GitPulse application in the existing monorepo. It contains Release Timeline, Release Follow management, repository overview/README, Repository Release Lists, release details, and the settings/authentication necessary to use those surfaces. Retain the broad web layout using customized Material 3, date-grouped cards, adaptive columns, a desktop Release Drawer, and a mobile bottom sheet.

Persist the latest known content returned by timeline requests and enough pagination provenance to reconnect history safely. The Timeline Cache Retention Window defaults to 30 days and is configurable from 1 to 90 days by release publication time. Retention settings, Release Follows, and the Timeline Refresh Baseline are account-shared; retained release data is local to each installation.

Determine connections separately for each repository by following fetched pages back into retained records. A shared gate controls the cached extension: fresh successful results can display immediately, while disconnected history remains hidden until the required repository connections are established. Each refresh/load action performs one coordinated round; users explicitly load more to bridge gaps. Offline reading restores the Saved Visible Timeline rather than exposing every record in the local database.

Reuse Nitro Cookie sessions, the existing provider/session authorities, and CSRF protections. Support enabled personal-password, PAT, and GitHub OAuth providers. Native Login Handoff uses the system browser and an initiating-app-bound, expiring, single-use result that the app polls/redeems after the user returns.

## User Stories

1. As a GitPulse user, I want a native application focused on releases, so that unrelated dashboard features do not interrupt release tracking.
2. As a GitPulse user, I want to use the application on Windows and Android, so that I can follow releases on my computer and phone.
3. As a Linux, macOS, or iOS user, I want compatible platform code and configuration, so that the same client can be built for my platform without a different product architecture.
4. As a self-hosted GitPulse user, I want to enter my backend address, so that I can use my own instance instead of depending on a central hosted service.
5. As the instance owner, I want to connect to gitpulse.euphony.ink, so that I can reuse my deployed Nitro backend.
6. As a returning user, I want the last successfully connected backend remembered and connected automatically, so that I do not have to enter or confirm it on every launch.
7. As a first-time user, I want unsupported backend capabilities explained, so that I know when my server must be upgraded.
8. As a personal-mode user, I want password unlock, so that I can use the server-owned GitHub identity without entering its GitHub token.
9. As a PAT-mode user, I want PAT sign-in when the server enables it, so that I can authenticate through my instance's supported mechanism.
10. As an OAuth-mode user, I want to authorize in my system browser, so that I can use the existing GitHub sign-in flow.
11. As an OAuth-mode user, I want to return to the app and complete the same sign-in attempt, so that browser authentication establishes my app session.
12. As a user, I want only the connected server's usable providers displayed, so that personal-mode restrictions are respected.
13. As a user, I want my server session remembered securely, so that I can restart the app without saving my password or PAT.
14. As a user, I want explicit logout to clear my local session and release cache, so that the previous identity's data is removed from the installation.
15. As a user, I want changing accounts or backends to clear the previous identity's data, so that records cannot leak between identities.
16. As a user whose session is rejected, I want cached data hidden until I authenticate again, so that stale authentication does not continue to expose it.
17. As a user reauthenticating the same account, I want retained history restored when eligible, so that session expiry does not unnecessarily destroy my cache.
18. As a user with a temporary network problem, I want my local cache preserved, so that a connection failure is not treated as logout.
19. As a release follower, I want to search for repositories, so that I can find projects to follow.
20. As a release follower, I want to paste a GitHub repository URL, so that I can follow a project I already know.
21. As a release follower, I want to inspect my Followed Repositories, so that I can manage my Release Follows.
22. As a release follower, I want follows shared with the web application, so that both clients use the same subscriptions.
23. As a release follower, I want unfollowed repositories removed from the local timeline and cache, so that obsolete subscriptions do not remain visible or block loading.
24. As a release follower, I want newly followed repositories loaded from their first page, so that their releases can enter the current timeline.
25. As a user, I want published releases ordered newest to oldest by publication time, so that I can review recent announcements first.
26. As a user, I want releases grouped by dates in my display time zone, so that the timeline is easy to scan.
27. As a user, I want to refresh the timeline, so that I can retrieve current release data.
28. As a user, I want to load older history explicitly, so that I control pagination and request volume.
29. As a user, I want one coordinated pagination round per action, so that the app does not silently scan arbitrarily deep history.
30. As a user, I want failed repositories identified and retryable, so that I can understand partial results and recover them.
31. As a user, I want successful fresh results to remain readable when another repository fails, so that partial failure does not discard useful current data.
32. As a user, I want fetched timeline data retained locally, so that history remains useful after leaving or restarting the app.
33. As a user, I want a default 30-day publication-time retention window, so that recent release history is available without configuration.
34. As a user, I want to configure retention from 1 to 90 whole days, so that I can balance local history and storage.
35. As a user of multiple installations, I want the retention preference synchronized by account, so that the same policy is applied when devices next synchronize.
36. As a user, I want changing the display time zone to leave retention unchanged, so that grouping changes do not unexpectedly delete history.
37. As a user, I want older online releases readable without extending their durable retention, so that browsing history does not change the cache policy.
38. As a user, I want cached history hidden while a gap remains, so that the timeline does not imply that missing pages have been loaded.
39. As a user, I want connected cache appended automatically when a request reaches it, so that I can read retained history without fetching it again.
40. As a user following several repositories, I want cache connections checked for every required repository, so that one repository's overlap does not certify another's history.
41. As a user, I want the cached extension released through one shared gate, so that only some repositories' cached tails are not silently presented as shared coverage.
42. As a user, I want repeated retrieval of the latest cached segment to keep older disconnected segments hidden, so that app restarts cannot accidentally bridge a gap.
43. As a user, I want duplicate releases merged into their latest known content, so that refreshing does not duplicate cards or retain an unwanted edit history.
44. As a user, I want a repository whose entire current history no longer contains a cache anchor to recover from that condition, so that obsolete cache does not permanently block the timeline.
45. As a user, I want unavailable repositories distinguished from timeouts and rate limits, so that I can choose whether to retry or unfollow them.
46. As an offline user, I want to read the Saved Visible Timeline and retained release bodies, so that I can review already exposed history without a connection.
47. As an offline user, I want offline state and the saved update time visible, so that I can judge the freshness of what I am reading.
48. As a user, I want a clear-cache action that keeps login and server-owned settings, so that I can rebuild this installation's history without changing my account.
49. As a user, I want text search across repository identity, title, tag, and optionally release notes, so that I can locate releases I have loaded.
50. As a user, I want repository/date/prerelease filters, so that I can narrow the current exposed timeline.
51. As a user, I want disconnected cached history excluded from search and counts, so that hidden records cannot make the visible results misleading.
52. As a multi-device user, I want the Timeline Refresh Baseline shared with the web and other installations, so that all clients use the account's last usable refresh as their next reference point.
53. As a user, I want an in-progress cycle to keep its captured previous baseline, so that another device's refresh does not change my counts halfway through reading.
54. As a user, I want the count labeled as loaded new releases and affected by my current filters, so that it does not claim to be a complete upstream total or unread count.
55. As a user, I want late-discovered releases inserted in normal publication order, so that newly retrieved omissions appear in the appropriate place.
56. As a desktop user, I want adaptive one-to-three-column date-grouped cards, so that the layout makes useful use of my window width.
57. As a phone user, I want a single-column timeline and accessible navigation, so that releases remain readable on a narrow screen.
58. As a user, I want Timeline, Follows, and Settings as the main navigation destinations, so that the application stays focused.
59. As a user opening a release, I want a desktop drawer or mobile bottom sheet, so that I can inspect details without losing my timeline position.
60. As a user, I want the Repository Release List available from release details, so that I can inspect other releases from that repository.
61. As a user, I want a direct return to the Entry Release, so that browsing the repository's list does not lose my original context.
62. As a user opening a repository, I want its overview, primary metrics, README, and releases entry, so that I can understand the project without unrelated issue/PR surfaces.
63. As a user, I want release asset information and external download links, so that I can obtain published files through the existing browser-based path.
64. As a user reading notes or a README, I want common embedded HTML including details/summary, images, and tables, so that important content is not lost.
65. As a user, I want relative repository links and images resolved with repository context, so that document resources point to the correct targets.
66. As a user, I want code highlighting that supports common release-note languages, so that Shell, PowerShell, TypeScript, and C-family examples are readable.
67. As a user, I want code selection, original-source copying, and horizontal scrolling, so that I can reuse examples without corrupted text.
68. As a user, I want unknown code languages or highlighter errors to fall back to plain text, so that one code block cannot prevent reading the release.
69. As a user, I want SVG badges supported, so that common README images can be displayed.
70. As a user, I want supported repo/release links to open in the app and excluded subjects to open externally, so that navigation respects the app's focused scope.
71. As a user, I want Android Back and desktop Escape to close overlays before leaving pages, so that navigation behaves predictably.
72. As a returning timeline reader, I want scroll position preserved when closing details, so that I can continue where I was reading.
73. As a user, I want Simplified Chinese and English with system defaults and manual selection, so that I can use my preferred language.
74. As a user, I want light, dark, and system themes in the GitPulse style, so that the app fits my environment while remaining recognizable.
75. As a Windows user, I want a complete runnable ZIP distribution, so that I can install the app without an initial store or installer dependency.
76. As an Android user, I want a properly signed APK, so that I can install the app directly and update it with the same signing identity.
77. As a maintainer, I want Flutter releases independently versioned, so that publishing the client does not accidentally release the web application or browser extension.
78. As a maintainer, I want the newest compatible stable dependencies and a committed lockfile, so that upgrades are current and builds remain reproducible.
79. As a maintainer, I want documented native prerequisites and unverified-platform limits, so that package platform badges are not mistaken for completed device testing.
80. As a maintainer, I want behavior-level tests for refresh, cache connection, persistence, and identity changes, so that the app's central guarantees survive refactoring.

## Implementation Decisions

### Product and platform boundary

- Add a dedicated Flutter package alongside the existing web/backend and extension packages in the monorepo. Use the app name GitPulse, application identifier `ink.euphony.gitpulse`, and independent `flutter-vX.Y.Z` release tags.
- Target Windows, Android, Linux, macOS, and iOS. Windows and Android are the owner's manual-debug targets. Other platforms require compatible dependencies, scaffolding, permissions/entitlements, and prerequisite documentation; runtime verification is not promised.
- The backend address defaults to https://gitpulse.euphony.ink, is user-configurable, and is remembered after successful connection. Automatically connect to the saved address on later launches, or the default address on first launch, without asking the user to confirm it. Check the required native backend capabilities and clearly require an upgrade rather than silently degrading agreed functionality on an old server.
- Preserve existing web behavior and the extension's independent release lifecycle. Isolate Flutter tooling/generated content from unrelated Nuxt checks and packaging.

### App modules and public interface

- Separate thin UI views, Riverpod presentation controllers, pure timeline/domain policies, typed HTTP services, secure session storage, and transactional local persistence.
- Introduce one app-facing timeline session/repository facade as the principal orchestration boundary. It owns refresh, load-older, retry, restore, follow-set changes, and clear-cache actions and exposes immutable current/exposed timeline state, loading/errors, partial coverage, cached-extension availability, and loaded-new counts.
- Widgets do not independently paginate, merge releases, infer cache connections, or write cached history. Riverpod provides state composition and dependency injection; do not add a second state/DI framework.
- Keep stable backend/repository/release identities distinct from display names and navigation identifiers. Repository renames must not duplicate cache records or be treated as a different identity. Identity scope includes the canonical backend base URL and stable GitHub identity.

### Local cache, connection, and persistence contract

- Retain releases whose publication time is at or after the current UTC instant minus N times 24 hours, including the boundary. N is an account-synchronized integer from 1 to 90, default 30. Grouping time zones do not change this cutoff.
- Persist the latest known release content, normalized stable identities, page/cursor provenance, connected/disconnected segment relationships, and the Saved Visible Timeline. Do not store immutable copies of every response or release-edit history.
- Determine connections per repository through the fetched pagination chain. Publication-date overlap, a different repository's repeated release, or newly saved current-request rows do not establish connectivity to an older segment.
- Release the cached extension through the agreed all-repository gate. Successful fresh results can display while any required cached connection is unresolved. An unavailable Followed Repository remains a reported blocker until recovery or unfollowing.
- A refresh or load-more action performs one coordinated round, advancing participating repositories using their own continuation state. Do not silently fetch additional rounds solely to reach cached history.
- Preserve failed repositories' previous continuation state and retry explicitly. An empty displayable page does not prove exhaustion when the backend reports further pages.
- If a repository is successfully paged to the upstream end without reaching any retained anchor, discard its old retained history and remove that repository's connection barrier. Transient errors, timeouts, rate limits, and incomplete pages cannot trigger this fallback.
- Do not infer deletion merely because a release is absent from a bounded response. Preserve deterministic deduplication/publication ordering and the existing bounded-pagination treatment of late publication.
- Changing follows begins a new cycle. Unfollowing removes the repository from display/cache and recomputes required connections. A newly followed repository without retained history requires no old-cache anchor.
- Store only data eligible for durable retention. Older online history can remain in the current browsing session without persistence. Increasing retention cannot recover previously evicted data without fetching it again.
- Cache clearing affects the current installation's timeline data and pagination state, not its login, Release Follows, server preferences, or shared refresh baseline.
- Persist enough distinction between exposed history, fetched buffers, and disconnected segments to restore the correct offline window. Search/filtering cannot reveal disconnected retained records.
- Retain the existing Shared Timeline Window/Partial Timeline Window vocabulary and guarantees. GitHub connection pagination follows creation order while display follows publication order; this specification does not promise exhaustive publication-time completeness.

### Account state and authentication

- Share Release Follows, retention preference, and Timeline Refresh Baseline with the same account's web/app clients. Keep cached release contents device-local. Release Follow remains independent of GitHub Watch and Star.
- Save retention changes online and apply after server success. Other installations synchronize at startup or refresh; offline installations use their last synchronized value. Preserve unrelated account preferences and the existing settings storage-driver support.
- Support the connected server's usable personal-password, PAT, and GitHub OAuth providers. Use the existing provider authority and respect personal-mode precedence rather than treating every true availability flag as independently usable.
- Keep one active identity. Explicit logout or backend/account switching clears the old identity's local credentials/cache and invalidates in-flight work. Remember the opaque server session without persisting the personal password or PAT.
- Reuse Nitro Cookie sessions with Dio, cookie_jar, and dio_cookie_manager. Persist sensitive session credentials through flutter_secure_storage rather than relying on a default file-based Cookie jar. Honor the server's session lifetime.
- Every GitHub session establishment continues through `establishGitHubSession()`. Preserve the existing auth/session shape and CSRF protections; do not introduce an independent Bearer-session system or native-client exemptions.
- Keep the current upstream GitHub browser authorization flow. Add Native Login Handoff with an initiating-client verifier/challenge, backend-origin binding, expiration, cancellation, and atomic single-use redemption. Status reads do not issue sessions; successful mutating redemption uses the existing session writer.
- Open OAuth in the system browser. The user returns to the app, which queries/redeems its transaction. Resume on foreground return without an always-running mobile background service, OS callback registration, or a central callback service.
- Do not place session cookies, passwords, PATs, or GitHub access tokens in callback URLs. The app's HTTP session is distinct from the browser's session. No GitHub Device Flow addition is selected.
- On an explicit server authentication rejection, pause requests and hide cached data while retaining it for same-identity reauthentication and normal retention pruning. Distinguish that condition from network failure, rate limits, and repository-specific permissions.

### Refresh baseline, search, and release data

- Share the account baseline as explicitly chosen by the user. A usable refresh, including partial usable results, affects later new-release comparisons by other clients. A wholly failed round, even with HTTP status 200, must not advance it.
- Keep the previous baseline captured for each in-progress cycle fixed. Pagination, retries, and local cache clearing do not advance it. Validate concurrent refreshes cannot move the shared baseline backward.
- Present a loaded-new count based on distinct currently exposed releases newer than the captured previous baseline, after current filters. Do not imply unread state or an exhaustive upstream total.
- Search repository identity, release title, tag, and optionally complete fetched release notes. Apply repository/date/prerelease filters to exposed data. Preserve current web search/filter semantics where applicable.
- Reuse the existing repository, README, repository-release-list, release-detail, and per-repository timeline contracts. Preserve cursor/status/error distinctions and identifier mapping in Flutter DTOs. Backend response date groups must not be treated as an already coordinated shared window.
- Do not add the web client's Recovered Release History merge adapter or list/management UI. Later-discovered releases can still merge into the normal timeline in publication order.

### Presentation and content

- Use customized SDK Material 3 with GitPulse colors. Desktop uses narrow Timeline/Follows/Settings navigation and one-to-three-column date groups; mobile uses three bottom-navigation destinations and a single column.
- Repository overview/README are separate detail pages. Release details use a desktop drawer/mobile sheet with a Repository Release List and a direct return to the Entry Release. Preserve timeline scroll context and close overlays before normal Back/Escape page navigation.
- Include repository search, pasted GitHub repository URLs, and current-follow management. Keep repository metrics/README/releases focused on the agreed scope rather than adding issue/PR or file browsers.
- Render locally using Dart markdown, explicit content/resource normalization, flutter_widget_from_html_core, and fwfh_svg. Preserve repository/ref/document context for relative links and images; a single generic base URL is not sufficient for all link/raw-image cases.
- Support common embedded HTML, nested details/summary and default-open behavior, HTML tables, ordinary images, and SVG badges. Native widgets do not imply exact browser rendering.
- Use shiki_flutter with its default pure-Dart engine. Use bundled grammar/theme resources, select required languages/themes deliberately, and integrate native spans/async work with the code-block component. Do not add its optional native engine, a WebView, or an editor.
- Provide code selection, copying of original source, horizontal scrolling, theme switching, and plain-text fallback for unknown languages or highlight failures. A highlighting failure must not make the release body unreadable.
- Support repo/release navigation in-app; open excluded GitHub subjects externally. Scope session credentials to the configured backend, never arbitrary external images/resources.
- Asset metadata and external browser download links are included. An in-app download manager and guaranteed private-asset download through the App session are not included.
- The offline guarantee covers retained timeline data and release bodies. Do not add persistent README/repository/image caches or claim arbitrary document images/current asset metadata are available offline.
- Provide Simplified Chinese and English, system-default/manual language selection, and light/dark/system themes using SDK localization and intl.

### Selected libraries and dependency policy

- Selected foundations: Riverpod, Drift/SQLite, Dio, GoRouter, flutter_secure_storage, cookie_jar, dio_cookie_manager, Dart markdown, flutter_widget_from_html_core, shiki_flutter's default Dart engine, fwfh_svg, json_serializable/json_annotation, and SDK localization/intl.
- Use handwritten Riverpod declarations and domain state classes, with generated DTO mappings and Drift schema/query support. Freezed and riverpod_generator are not selected. Experimental Riverpod offline persistence does not own this cache.
- Resolve the newest mutually compatible stable dependency set at implementation time, commit the application lockfile, and record necessary older selections. Do not treat every independently newest version as jointly solvable or force incompatible constraints through overrides.
- Observed research anchors include flutter_riverpod 3.4.3, drift 2.35.2, sqlite3 3.7.1, dio 5.11.1, go_router 18.1.0, flutter_secure_storage 11.2.0, cookie_jar 4.0.9, dio_cookie_manager 3.5.0, markdown 7.3.1, core HTML renderer 0.17.4, shiki_flutter 1.1.0, fwfh_svg 0.16.1, json_serializable 6.14.1/json_annotation 4.12.0, and intl 0.20.3. These are a dated snapshot, not fixed release requirements.
- A concrete observed generator conflict exists between build_runner's build-5 requirement and current Drift/JSON generators' build-4 constraints. Resolve the complete project and justify the compatible stable version instead of copying the newest independent versions.

### Recommended engineering defaults from the final design draft

These details were proposed in the final implementation plan rather than individually confirmed in the interview. Preserve that provenance: they are recommended implementation defaults, not additional claims about what the user explicitly approved.

- Restore the eligible saved window on startup and attempt one fresh round. Mark restored data with its update time while waiting. A wholly failed refresh leaves the previous saved window available.
- Returning to the foreground prunes expired content and resumes pending login handoff, without automatically replacing the timeline currently being read.
- Treat retained history as connected segments, not a union of all cached releases. Encountering a recent saved segment must not unlock a separate older island. Save exposed membership before user filters so offline search/filter changes stay within the saved window.
- Prune on startup, foreground return, relevant writes/refreshes, and a shorter synchronized retention setting. Keep retained metadata consistent when content is removed. An existing installation can use its last valid setting on synchronization failure; a new identity without a valid synchronized setting can read fresh results while durable caching waits.
- Serialize timeline operations, invalidate obsolete generations, and commit related local changes transactionally. Old results cannot resurrect data after unfollow, clear-cache, identity changes, or a superseding refresh. Invalid cursors should offer retry/refresh rather than silently skip pages.
- Keep fresh results readable in memory if persistence fails, show the caching failure, and preserve the last committed saved view. Report cache corruption and offer rebuilding without clearing server-owned account state or unrelated secure credentials.
- Proposed small supporting dependencies are url_launcher for external browser/links, path_provider/path for application-support storage, html for DOM/resource normalization, and crypto for the handoff SHA-256 challenge. Use SDK base64url/clipboard/localization/test facilities where appropriate. These support the selected architecture without adding another state, auth, or rendering framework.

## Testing Decisions

### Primary seam and prior art

- Prefer one primary client test boundary: the app-facing timeline session/repository facade described above. Drive refresh, load-older, retry, restore, follow-set changes, and clear-cache actions; assert exposed releases/order, status/counts, emitted HTTP requests, and state restored by a new instance.
- Use a controlled HTTP transport returning real-shaped Nitro payloads, a deterministic clock, and real isolated temporary SQLite storage for the main behavioral suite. Recreate the facade/storage lifecycle to test persistence rather than proving only that an in-memory map can be reused. Inject storage faults only where necessary to verify failure behavior.
- This follows the existing Release Timeline lifecycle harness: a public session factory, deferred repository responses, observable exposed state, and identity/follow changes. Prefer those existing scenarios and HTTP boundaries over exporting private helpers solely for tests.
- Existing timeline server/GraphQL tests and timeline-history tests provide prior art for backend payload handling, partial failure, pagination, and baseline persistence. Existing filter tests provide search/date/prerelease semantics. Existing release-overlay/grid integration tests provide mounted interaction and scroll/context patterns. Existing CSRF tests provide the server security-test style.
- New pure domain logic can be tested through this public boundary; introduce focused lower-level tests only for behavior that cannot be exercised clearly there. Do not create duplicate suites for every getter, private merge step, or DAO method.

### What makes a good test

- Verify external behavior, results, request contracts, and durable recovery. Do not read source files as text, assert private fields, snapshot incidental widget trees, or mirror the implementation's internal algorithm.
- Use stable identities, realistic optional/nullable payloads, and deterministic time. Assert the visibility of specific releases and the absence of disconnected/foreign-identity records, not just a generic success state.
- A fixture containing a repeated release is not enough to prove reconnection; include missing intermediate pages, multiple repositories, multiple retained segments, and restarts.

### Required coverage

1. Direct reconnection, a gap requiring another explicit action, and several disconnected segments. Re-fetching a recently saved latest segment after restart must not expose an older unconnected segment.
2. Unequal repository release frequencies, independent cursors, shared gating, successful fresh partial results, failed/unavailable blockers, targeted retry, empty pages with continuation, incomplete pages, and successful exhaustion without a surviving anchor.
3. Deduplication and latest-known content, equal publication timestamps, stable identities through renames, late-published older creations, and the distinction between pagination provenance and publication-time completeness.
4. The exact retention boundary, values 1/30/90, invalid setting rejection, time-zone changes, shrinking/expanding a synchronized preference, and older online-only history that does not reappear as durable data after restart.
5. Saved-window offline restore, filters over exposed data, disconnected records excluded from search/counts, missing offline images/README, and wholly failed refreshes preserving the last committed saved view.
6. Follow/unfollow changes, clear-cache, superseding refreshes, and backend/account changes while responses are in flight. Removed or foreign data must not be republished or persisted.
7. Transaction rollback/write failure, explicit cache failure indication, reopening stored state, and recoverable cache corruption/migrations where supported by the selected public storage contract.
8. Shared baseline first-use and subsequent refresh behavior, fixed per-cycle previous baseline, usable partial results, HTTP 200 with no usable results, no advance on pagination/retry/clear-cache, and out-of-order multi-client refresh completion.
9. Provider availability and personal-mode precedence, password/PAT/OAuth session establishment, secure session restoration, identity isolation, explicit logout clearing, and rejected-session hiding versus transient offline behavior.
10. Native Login Handoff through the existing HTTP/auth boundary: correct verifier/origin, wrong verifier, pending state, expiration, cancellation, replay, concurrent redemption, and CSRF. Reads must not establish a session, and one approved transaction must not mint multiple sessions.
11. Mounted Flutter behavior for adaptive columns/navigation, drawer/sheet/Entry Release transitions, Back/Escape, scroll preservation, settings, filtered-empty states, and offline/partial/retry indicators. Avoid low-value tests that merely repeat a constructor's properties.
12. Rich-content behavior through the selected HTML/code components: nested/default-open details, rowspan/colspan/wide tables, relative links/images, SVG, fenced HTML text, preserved code copying, unknown-language fallback, theme changes, and safe external resource credential scoping.
13. Shell, PowerShell, TypeScript, and C++ samples with source/newline preservation. Existing small headless library probes are useful evidence but do not replace the integrated application tests or establish a performance ranking.
14. Dart formatting, Flutter static analysis/tests, and the project's required web/backend format/lint/type/root-test checks for changed backend behavior. Preserve extension regression checks required before pushing. The main web production build remains a CI task.
15. The owner's actual Windows and Android debugging covers login, scrolling, detail overlays, offline restart, settings synchronization, and install/update paths. Linux/macOS/iOS acceptance is code/configuration compatibility and documented prerequisites, not a claim that these platforms were run.

## Out of Scope

- Issue, pull-request, discussion, file/commit browsing, general dashboard, and other unrelated GitHub workflows.
- GitHub Star/Watch mutations, release reactions, and the web application's permanent Recovered Release History UI or record-merge adapter.
- In-app asset download management, resumable/background downloads, persistent image/README caches, and guaranteed offline current asset metadata.
- Strictly exhaustive publication-time coverage, unread/read-progress semantics, arbitrary automatic pagination scans, or a hidden cached-record count presented as a complete total.
- Multiple simultaneously retained account/backend profiles in version one.
- An independent Bearer-token lifecycle, GitHub Device Flow, registered callback/deep-link schemes, a central callback service, a WebView/editor solely for code display, and native Shiki engines.
- Windows installer/store integration, Android store/AAB publication, in-app auto-update infrastructure, and verified runtime delivery for Linux/macOS/iOS in the first release.
- Production deployment, creating external signing credentials, or publishing a public release as part of writing/publishing this specification.

## Further Notes

- The owner explicitly chose an account-shared Timeline Refresh Baseline after initially being offered a device-local alternative. Keep that correction: app/web/device refreshes affect one another's next new-release reference point, while release caches remain local.
- The cache stores current normalized content and connection provenance, not every response snapshot. Publication-time retention must not be accidentally replaced by fetched-at expiration or renewed whenever the same old release is requested again.
- A concrete continuity example is retained older releases 8/7/6 and a new page 12/11/10. The older segment stays hidden. Repeating 12/11/10 after restart still leaves it hidden. Fetching the intervening page containing 9 and 8 establishes the missing connection, subject to the other repositories' shared gate.
- The chosen highlighter was reconsidered after examining flutter_highlight. Its old published pair works in current-SDK headless samples; its substantially updated source is not yet a corresponding stable pub release and required a source override/initialization adjustment in experiments. The user subsequently selected shiki_flutter's stable default-Dart route. Do not revert to the earlier re_highlight recommendation or adopt floating Git source.
- Dependency research was performed on 2026-10-17. The complete app dependency graph has not yet been resolved. Package timestamps or small successful probes do not prove future maintenance, five-platform operation, or comparative performance.
- Formal distribution prepares a complete Windows runtime-directory ZIP and an Android APK signed with the intended release identity. Keep the Android signing identity stable across updates; a debug-signed build is not the final release artifact. Native prerequisites, especially system credential storage configuration, must be documented.
- Core scope and major technology choices were explicitly accepted during the interview. The final draft's engineering defaults and auxiliary dependencies are identified above as recommendations because the user requested synthesis/publication instead of conducting another confirmation round.
- This issue is the self-contained implementation specification. The publication request authorizes creating the tracker issue with the canonical ready-for-agent label; it does not itself start implementation or deploy the existing backend.

## Acceptance Clarification — Default Connection and Application Header (2026-10-18)

These requirements supersede the earlier initially-empty backend-address decision. They refine the in-progress Flutter implementation; they do not expand the client to unrelated web-dashboard features.

### Default and saved backend connection

- On first launch, automatically connect to `https://gitpulse.euphony.ink` and discover its capabilities without an address-confirmation step.
- On later launches, automatically connect to the last successfully saved backend, including its base path, and restore the existing secure session through the normal session-validation flow. Do not force a logged-in user through an address-confirmation screen.
- Keep the backend address editable in Settings and provide a change-server entry before sign-in, so self-hosted users can use their own compatible instance.
- Failed connection/capability validation must offer retry and address editing, preserve the last successful saved address and existing credentials/cache, and never silently reset a custom server to the hosted default. Capability/version/provider errors remain explicit.
- Explicit backend changes continue to clear the previous identity's session/cache and invalidate in-flight work before connecting to another backend. Merely opening the address editor must not clear the current identity.

### Timeline and application chrome

- On narrow Flutter layouts, show one page title (`Timeline` / `时间线`) with the refresh action at a stable trailing position in that same top bar. On wide layouts, use the navigation rail to identify the destination and show compact status plus the trailing refresh action without another page heading. Keep the operating-system window title as the application name; remove repeated GitPulse branding and the `Release Timeline` content heading from application chrome.
- Signed-in Timeline and Follows pages must not render the account-management panel. Show the current account, logout, and provider-appropriate account-switch action in Settings instead. Sign-in and expired-session recovery must remain accessible.
- Show refresh-baseline time and loaded-new count as compact secondary information. Long localized labels, narrow windows, and larger text must not displace the refresh action to another row or cause horizontal overflow.
- Preserve existing timeline refresh, loading/disabled states, offline/partial-failure indicators, date grouping, navigation, release cards, and detail interactions. Do not redesign release cards.
- Add behavioral coverage for first-launch connection, saved custom-server restart and session restoration, failure/retry/address preservation, pre-sign-in server editing, and signed-in phone/desktop navigation with account actions confined to Settings and a stable refresh action.
