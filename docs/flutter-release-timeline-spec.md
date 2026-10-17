# Flutter Release Timeline App

Status: interview synthesized and published as [GitHub issue #95](https://github.com/pynickle/gitpulse/issues/95), labelled ready-for-agent. The [published-spec local copy](flutter-release-timeline-issue-spec.md) is self-contained. The [implementation plan](flutter-release-timeline-plan.md) retains design rationale and explicitly proposed engineering defaults. No application implementation has started during specification publication.

## Explicit requirements

- Build a new Flutter application using the existing GitPulse Nitro backend at `https://gitpulse.euphony.ink`.
- Limit the application to Release Timeline and its necessary related surfaces, including repository details and repository releases. Issues and pull requests are outside the application scope.
- Target Windows, Android, Linux, macOS, and iOS. Windows and Android receive hands-on debugging by the user; the other platforms require code-level support without a promise of runtime verification.
- Persist the data returned by Release Timeline requests locally. Retention is an account-synchronized integer from 1 to 90 days, default 30, measured by release publication time against the current instant minus N times 24 hours, including the boundary. Display time-zone changes do not alter retention. Older online results may be read during the current session without persistence.
- Extend the displayed timeline with cached history only when newly requested data connects to that history. Use each repository's fetched pagination chain to reconnect to previously cached release records. Open the cached extension only after all relevant repositories with retained history have passed connection checks. Fresh successful results remain displayable while waiting. Each user refresh/load action performs one coordinated round; no automatic bridge scanning is selected. The final plan specifies segment/invalidation defaults for review.
- Preserve the broad layout of the current web application. The user selected a customized Material 3 visual direction after comparing alternatives.
- Research current dependency versions, platform support, and trade-offs before asking the user to choose dependencies. Selected foundations are Riverpod, Drift/SQLite, Dio, GoRouter, flutter_secure_storage, cookie_jar/dio_cookie_manager, Dart markdown, flutter_widget_from_html_core, shiki_flutter's default Dart engine, fwfh_svg, json_serializable, and SDK localization/intl, with customized SDK Material 3. The final plan lists the proposed supporting dependency profile for confirmation.

## Accepted decisions — round 1

The user answered `B, B, A, A, A` to Q1–Q5.

- Q1: Release the application for other users, rather than designing solely for personal use. Q6 later confirmed a configurable self-hosted backend.
- Q2: Keep Flutter in this repository alongside the web application and Nitro backend. Q38 later selected flutter/ and independent flutter-vX.Y.Z tags.
- Q3: Permit necessary Nitro adaptations for Flutter, preserving compatibility with the web application.
- Q4: Measure retained history by release publication time, not by when a response was fetched. Fetching an old release does not reset its eligibility period.
- Q5: Use the same account's existing Release Follows as the web application. Follow and unfollow changes affect both clients.

## Accepted decisions — round 2

- Q6 A: Users can configure a compatible GitPulse backend address. The application is not restricted to `gitpulse.euphony.ink`; Q38 later selected an initially empty backend field.
- Q7 A, confirmed after clarification: Determine connection separately for each repository by reading successive API pages back into cached release records. The worked example was cached `8,7,6`, a fresh page `12,11,10`, and a later page `9,8,7`: only after the later page reconnects can the cached tail be reused and duplicate records removed. This does not promise complete publication-time coverage. Q13 later selected a shared cache-display gate and Q14 selected manual bridging.
- Q8 A: Allow offline reading of the last successfully saved visible timeline, with offline/update-time indication. A successful online refresh returning disconnected data must still obey the rule against mixing in disconnected cached history.
- Q9 A: Include timeline refresh, pagination, failure retry, text/body search, repository/date/prerelease filters; repository discovery and Release Follow management; repository overview, primary metrics, README, and releases entry; release body, repository release list, asset information, and external download links; login, backend, theme, retention, and cache-clearing settings. Reactions, GitHub Star/Watch mutations, file browsing, commit history, and an in-app download manager are outside this first-version scope.
- Q10 B: Do not expose Recovered Release History in the Flutter application. The existing web/backend feature remains intact. Later-discovered releases can still belong in the normal timeline. Investigation confirmed that recovered records are created by an explicit client merge, not automatically by timeline requests; Q32 later selected the shared account refresh baseline.
- Q11 A: Use a consistent GitPulse visual direction based on customized Material 3. Preserve the web application's broad date-grouped cards and desktop-drawer/mobile-sheet layout. This choice does not approve all other UI dependencies.
- Q12 B: Synchronize the retention-days setting at account level. Cache contents remain local to each device. Q25 later specified online changes and startup/refresh propagation; Q34 specified local-only cache clearing.

## Accepted decisions — round 3

The user answered A to Q13–Q18.

- Q13 A: Gate the cached timeline extension across repositories. Wait for connection confirmation from all relevant Followed Repositories that have retained history before exposing that extension. Display successful fresh results while waiting. Do not independently expose just one connected repository's cached tail as though all cached coverage were available.
- Q14 A: Require explicit user loading to bridge gaps. A refresh or load-more action performs one coordinated request round; it does not silently keep fetching to reach a cache anchor. Q33 and Q34 later specified exhaustion and retry behavior.
- Q15 A: Store the latest known content per release, deduplicated by stable identity, with the pagination/provenance information needed for reconnection. Do not retain immutable copies of every HTTP response or a release-edit history.
- Q16 A: Support personal-mode password unlock, PAT login, and GitHub OAuth according to the connected server's enabled providers. Q27 and Q28 later selected Cookie sessions and browser/poll handoff.
- Q17 A: README and release notes must support common embedded GitHub HTML, including details/summary, images, and HTML tables. Q29 and Q30 later selected local Markdown conversion and the core native HTML renderer; the reopened Q41 selected shiki_flutter.
- Q18 A: Use Riverpod for state management. Keep timeline connection rules and persistence separate from the state library; the recommendation accepted here does not select Riverpod's experimental offline-persistence API. Q42 later selected handwritten Riverpod declarations and generated DTO mapping.

## Accepted decisions — round 4

The user accepted all recommendations for Q19–Q26.

- Q19 A: Use Drift backed by SQLite for the local cache, including transactions and schema migrations. The observed Drift version is 2.35.2; resolve compatible latest stable versions at implementation time.
- Q20 A: Use Dio for HTTP and centralized request/session behavior. Observed version: 5.11.1.
- Q21 A: Use GoRouter for page routing and authentication navigation. Observed version: 18.1.0.
- Q22 A: Use flutter_secure_storage for remembered server-session credentials, without persisting the personal password or PAT. Observed version: 11.2.0. This does not select database encryption. Include native platform prerequisites in setup guidance.
- Q23 A: Retention is an integer from 1 to 90 days, default 30. Include releases with publication time at or after current time minus N times 24 hours. Changing display time zone affects grouping, not retention eligibility.
- Q24 A: Allow online timeline browsing older than the retention cutoff during the current session, without persisting the expired release content.
- Q25 A: Save retention changes online; apply after success. Other app installations obtain the account setting at next startup or refresh. Offline clients use their last synchronized value. A larger retention setting cannot restore already-pruned data without fetching it again.
- Q26 A: First version keeps one active identity. Explicit logout, changing account, or changing backend clears that identity's local session credentials and cached data before login to the next identity. Temporary network loss does not trigger this clearing. Q35 later specified preservation with hidden content after rejected authentication.

## Accepted decisions — round 5

The user accepted recommendations for Q27–Q31 and Q33, and explicitly selected B for Q32.

- Q27 A: Retain the existing Nitro Cookie session contract and CSRF protections. Use cookie_jar and dio_cookie_manager with Dio; store persistent sensitive session credentials through the selected system credential store rather than a default plaintext persistent jar. Do not introduce an independent Bearer-session system.
- Q28 A: Retain the existing GitHub browser authorization flow and add a short-lived, initiating-client-bound handoff transaction. The app opens the system browser, the user returns to the app after authorization, and the app queries/redeems its result to establish its own Cookie session. Resume polling on foreground return; no continuously running mobile background service or OS callback registration is required. Timeouts, cancellation, origin binding, and single-use redemption are implementation requirements.
- Q29 A: Parse Markdown locally with the Dart markdown package, then normalize content/resources and render native HTML widgets. Persist original Markdown as the content source. Application content handling must cover relative links/images and parser differences from the web's Comark renderer.
- Q30 A: Use flutter_widget_from_html_core for HTML rendering. SVG, syntax highlighting, code actions, and other companion dependencies are separate choices.
- Q31 A: Offline guarantees cover retained timeline data and release bodies. Repository README, latest asset metadata, and arbitrary document images are not promised offline. Do not add a separate persistent repository/README/image cache in version one.
- Q32 B: Share the account-level Timeline Refresh Baseline with the web application and all app installations. A successful usable refresh on one client affects later new-release comparisons on another. This is separate from local cache contents and does not represent reading progress. Retain the captured baseline within each in-progress refresh cycle rather than changing counts mid-cycle.
- Q33 A: If a repository is successfully paged to the upstream end without reaching any retained release record, discard that repository's old retained history and remove that unresolved connection barrier. Other repositories still require their own connection checks. Transport failures and rate limits do not qualify as successful exhaustion.

## Accepted decisions — round 6

The user accepted recommendations for Q34–Q40 and Q42. Q41 was reopened for further research into flutter_highlight and alternatives, and subsequently resolved as described below.

- Q34 A: Unfollowing removes the repository from display, deletes its cached history, and recomputes connection participation. Follow-set changes start a new load cycle; a newly followed repository with no retained history does not need a cache-anchor check. Transient failures keep data/cursors and block the cached extension while successful fresh data can display. An unavailable repository remains a visible failure and blocks that extension until recovery or unfollowing. Search, filters, and new-release counts use current visible data only. Clear-cache removes this installation's timeline cache/pagination state while keeping its login, Release Follows, account preferences, and shared refresh baseline.
- Q35 A: A server-rejected/expired session pauses authenticated requests and hides cached data without immediately deleting it. Reauthenticate the same identity to restore access, subject to retention pruning. Explicit logout or identity/backend switching still clears the old identity's cache. Network failures are distinct from rejected authentication.
- Q36 A: Desktop uses a narrow Timeline/Follows/Settings navigation and one to three date-grouped timeline columns; mobile uses three bottom-navigation destinations and one column. Releases use a desktop drawer/mobile bottom sheet with the same-repository release list and Entry Release return. Repository details are separate pages. Follow management supports repository search, pasted GitHub repository URLs, and current follows. Android Back/Escape close overlays before page navigation, preserving timeline scroll position.
- Q37 A: Ship Simplified Chinese and English, following the system by default with manual selection. Offer light/dark/system themes using GitPulse colors, SDK localization, and intl.
- Q38 A: App name GitPulse; directory flutter/; application identifier ink.euphony.gitpulse; independent release tags flutter-vX.Y.Z. Initial backend address is empty; remember the last successfully connected address.
- Q39 A: First distribution targets are a complete Windows release-directory ZIP and a signed Android APK. Linux/macOS/iOS retain platform code/configuration and documented prerequisites without claiming runtime verification. No installer/store integration is selected for version one.
- Q40 A: Check required backend capabilities on connection and require an updated compatible server rather than silently degrading native authentication or account-synchronized retention behavior.
- Q41 A, after follow-up research: Select shiki_flutter 1.1.0 with its default pure-Dart engine, plus the independently proposed fwfh_svg support. Use native selectable/copyable/scrollable code blocks with plain-text fallback on unknown languages or highlighting failures. Do not use flutter_highlight Git source overrides or the native Shiki engine. This replaces the earlier re_highlight recommendation.
- Q42 A: Use json_serializable/json_annotation for DTO mapping; keep state classes and Riverpod declarations handwritten. Do not add Freezed or riverpod_generator. Drift generation remains selected.

## Published handoff

The user invoked to-spec instead of another interview/confirmation round. [Issue #95](https://github.com/pynickle/gitpulse/issues/95) now captures the accepted product/library choices, 80 user stories, the proposed highest-level testing seam, and clearly identified recommended engineering defaults. No additional interview or application implementation was performed as part of publishing the issue.

## Existing domain constraints

The canonical vocabulary remains in `../CONTEXT.md`. In particular, a Shared Timeline Window does not guarantee that every release in its interval has been found. Cache connection must not silently strengthen this into a completeness guarantee.

Read-only code investigation established the following constraints; these are facts about this checkout, not verification of the production deployment:

- GitHub release connections are fetched per repository in creation order, while timeline display uses publication order. See `server/utils/release-timeline-graphql-utils.ts` and ADR 0011. A repeated release identity or overlapping publication dates alone cannot prove completeness across repositories.
- `POST /api/release-timeline/refresh` refreshes first pages and can advance the server-side refresh baseline. `GET /api/release-timeline` accepts per-repository cursors. Responses expose per-repository status, end cursor, and older-history availability; the Vue client currently coordinates the shared display window in `app/composables/release-timeline/session.ts`.
- Authentication currently uses cookie sessions. Personal-mode password unlock uses one server-owned GitHub identity; OAuth and PAT are disabled in that mode. Native HTTP can implement the cookie/CSRF protocol, but the existing browser OAuth flow is not already a native callback protocol.
- Release Follows live in the account's settings; clients can patch that field without submitting unrelated web preferences. Cache retention is not currently a settings field.
- Recovered Release History is a separate permanent account-level collection, not an expiring request cache. Flutter will not expose its list or management UI and does not need a recovered-record merge adapter. Existing POST refresh advances the account-level baseline, matching the selected cross-client baseline policy; GET first-page loading does not.
- Existing repository details, README, repository release lists, and release-detail APIs can cover the basic read surfaces. Release bodies are raw Markdown. The current web attachment UI opens GitHub download URLs externally rather than providing a download manager.
- The web timeline uses date-grouped cards, one to three columns depending on width, a desktop release drawer, and a narrow-screen bottom sheet. Search and filters operate on fetched data.

## Decision record

Canonical terminology is recorded in `CONTEXT.md`. [ADR 0015](adr/0015-flutter-release-timeline-client-boundary.md) records the application and backend boundary. [ADR 0016](adr/0016-flutter-timeline-cache-reconnection.md) records the accepted per-repository reconnection rule. Dependency findings are recorded separately in [the research notes](research/flutter-release-timeline-dependencies.md); that file distinguishes accepted packages from remaining candidates.

Native authentication options and baseline side effects are investigated in [the authentication notes](research/flutter-native-auth.md). [ADR 0017](adr/0017-flutter-cookie-session-browser-handoff.md) records the chosen Cookie session and browser/poll handoff.

The reopened Q41 is investigated in [the syntax-highlighting follow-up](research/flutter-syntax-highlighting.md), including published versus source versions, current-SDK headless checks, and failed/successful Git dependency declarations. The user selected shiki_flutter. The [implementation plan](flutter-release-timeline-plan.md) consolidates the accepted choices and proposed operational defaults for final confirmation.
