## Problem Statement

Followed Repositories currently show little beyond `owner/name`. Users may recognize a name without remembering what the project does, making a larger followed collection difficult to distinguish and review. Opening individual repositories to recover that context interrupts browsing.

Users need an immediately switchable presentation that adds enough context to recognize projects while retaining the density and convenience of the existing Compact View.

## Solution

Add Compact / Detailed controls to the Followed Repository list header. The chosen view applies to the entire collection in place, inside the existing desktop sidebar and narrow-screen bottom sheet.

Detailed View presents each repository in three parts: full `owner/name`, a description of at most two lines, and a visually secondary primary-language / Star Count row. Omit Topics and absent descriptions or languages. Keep the existing unavailable indicator and independent unfollow action.

Switching preserves repository order, current browsing context, and the management page's existing source, search, sorting, and pagination state. Default to Compact View when no preference exists, then save the user's choice per account and restore it across devices and viewport sizes.

Repository identities and actions remain immediately usable while additional metadata loads asynchronously. Reuse loaded metadata during the same management-page visit and refresh it on a subsequent visit. Allow retries after failures without incorrectly marking repositories unavailable.

## User Stories

1. As a user with many Followed Repositories, I want to switch the whole collection to Detailed View, so that I can recognize projects without opening each repository.
2. As a user scanning familiar repositories, I want Compact View to remain available, so that I can use a dense identity-focused list.
3. As a first-time user, I want Compact View to be the initial default, so that the existing presentation remains familiar.
4. As a returning user, I want my last chosen view restored, so that I do not repeat the same adjustment on every visit.
5. As a user accessing GitPulse on multiple devices, I want my view preference saved to my account, so that my choice follows me across devices.
6. As a user changing viewport sizes, I want the same selected mode retained, so that resizing does not change my preference.
7. As a user identifying similarly named projects, I want the full owner/name visible in Detailed View, so that repositories from different owners remain distinguishable.
8. As a user who has forgotten a project's purpose, I want its description alongside its name, so that I can recognize what it does.
9. As a user browsing a dense collection, I want long descriptions limited to two lines, so that one repository does not dominate the list.
10. As a user recognizing a project's ecosystem, I want its primary language displayed when available, so that I can distinguish otherwise similar projects.
11. As a user recognizing projects by familiarity and scale, I want Star Count available as secondary information, so that I have an additional identification cue.
12. As a user seeking a focused list, I want Topics omitted, so that detailed items remain compact and easy to scan.
13. As a desktop user, I want Detailed View inside the existing sidebar, so that I retain access to the Starred/Search main area.
14. As a mobile user, I want Detailed View inside the existing bottom sheet, so that I can use the same collection without a new page or larger surface.
15. As a user switching views partway through a collection, I want my browsing position retained, so that I can continue reviewing the same area.
16. As a user browsing Starred or Search results, I want switching the followed collection's view to preserve the management page's current state, so that I do not lose my search, sorting, or page.
17. As a user waiting for GitHub metadata, I want the view switch and repository actions to work immediately, so that network latency does not block management.
18. As a user switching views repeatedly during one visit, I want previously loaded metadata reused, so that toggling does not cause repeated loading.
19. As a returning user, I want repository metadata refreshed on a subsequent management-page visit, so that descriptions, language, and Stars can reflect updates.
20. As a user following a repository without a description, I want its missing description omitted, so that the list does not fill with empty placeholders.
21. As a user following a repository without a primary language, I want that missing language omitted, so that the available information remains clear.
22. As a user experiencing metadata failures, I want repository identities and actions retained, so that I can still manage my follows.
23. As a user experiencing a temporary metadata failure, I want a retry action, so that I can recover information without changing my follows.
24. As a user experiencing a timeout or rate limit, I want repositories to retain their correct availability classification, so that a temporary failure does not imply that a repository has disappeared.
25. As a user inspecting a project, I want its name to open the GitPulse repository detail, so that I can continue exploring in GitPulse.
26. As a user managing follows, I want unfollow to remain an independent control in either mode, so that reading or opening a repository does not accidentally remove it.
27. As a user reading repository information, I want non-action text selectable, so that I can copy a description or other displayed text.
28. As a user managing an empty or changing collection, I want existing count, empty-state, clear-confirmation, and follow-management behavior retained in either mode, so that the new presentation remains consistent with my collection.

## Implementation Decisions

- Extend the shared Followed Repository list and its owning management-page/panel integration. Both desktop and narrow presentations use the same view choice and metadata semantics.
- Offer the view controls in the list header. A mode change affects the entire followed collection without changing the route or replacing the Starred/Search area.
- Keep the existing desktop sidebar and narrow bottom-sheet presentation. Respect the Release Follows layout ADR: page-owned scroll regions, fixed filter/footer bands, and no reintroduction of frame-level scrolling or nested sticky workarounds.
- Use the existing Composition API and TypeScript conventions for Vue components and existing localization facilities for visible labels and accessibility text.
- Detailed items contain full owner/name, a description capped at two visual lines, and a secondary primary-language / Star Count row. Topics, additional statistics, and new status badges are excluded. Retain the existing unavailable indicator and follow-management controls.
- Preserve the viewed part of the collection when item heights change; retaining a raw pixel offset alone is insufficient if it moves the user to different repositories. Preserve the existing source/search/sort/page state without adding a new followed-list search or sort feature.
- Store the view choice through the existing account-scoped user-settings contract. Older settings without the field resolve to Compact View. Use the existing optimistic update, persistence, and failure conventions, with one preference shared by wide and narrow layouts.
- Keep persisted Release Follow records as repository identities. Treat descriptions, language, and Star Count as separately read metadata, rather than persisting a duplicate repository snapshot in follow records.
- Extend or add the authenticated followed-repository metadata read contract so that it covers the user's complete followed collection independently of the currently loaded Starred/Search result page. Associate metadata with stable GitHub node identity and preserve existing repository-rename handling.
- The metadata result must distinguish successfully read metadata, confirmed unavailability, and transient failure. Descriptions and primary languages may be absent. Unknown Star Count during loading or failure must not be fabricated as zero; an actual zero is valid data.
- Follow existing server GitHub-client, private GET/coalescing, cache-header, and authentication conventions. Persist preference changes through the existing CSRF-aware settings mutation path.
- Render identities and management actions before additional metadata resolves. Restore a saved Detailed View using the same asynchronous behavior as a manual switch.
- Scope metadata reuse to the current management-page visit. Repeated switches reuse successful results; opening and closing the narrow sheet within that visit must not require refetching already loaded data. A subsequent management-page visit refreshes metadata when Detailed View needs it.
- Support retry after metadata failure while retaining usable identity/action state and other successful metadata. Transient metadata failures must not independently change the existing confirmed-unavailable classification or follow-limit accounting.
- Handle follows added or removed during pending requests without letting late metadata responses restore removed rows or leak information across account changes. Reuse the existing request-lifecycle conventions rather than introducing an unrelated state framework.
- Repository names open the GitPulse repository detail through the existing navigation routing contract. Keep unfollow independently operable and other content selectable in both views.

## Testing Decisions

- Status: the user confirmed both test boundaries before issue publication.
- Prefer two high-level boundaries: the mounted Release Follows management experience with real followed-list/panel behavior and user-settings actions, and the server metadata read contract with controlled GitHub/storage adapters. Avoid a new test seam for every formatting helper or component.
- Test externally observable behavior, rendered output, requests at external adapters, and public persistence contracts. Do not assert private refs, internal helper call chains, or source-text contents.
- At the mounted management boundary, cover default Compact View, whole-list switching, detailed fields, omitted Topics/missing fields, independent unfollow, repository navigation, selectable non-action content, and existing empty/count/clear behavior.
- Use the same boundary to cover saved Detailed View restoration, account-scoped preference saving, existing save-failure behavior, and preservation of source/search/sort/page state. Exercise both the sidebar and sheet entry points without replacing the real followed-list behavior with a stub.
- Control asynchronous metadata responses to verify immediate identities/actions, nonblocking mode changes, same-visit reuse, refresh on a new visit, retry, mixed success/failure, and the handling of removed follows or account changes while requests are pending.
- Check scroll preservation against the repository being viewed when row heights change. Follow the existing measured-geometry DOM-harness pattern where appropriate; do not equate an unchanged numeric scroll offset with preserved browsing context.
- At the server metadata boundary, verify representative GitHub payloads map descriptions, primary language, and Star Count correctly; include absent fields, zero Stars, renamed repositories, confirmed missing repositories, rate limits, and transient or partial failures. Verify metadata covers followed repositories absent from the current Starred/Search page.
- Prefer extending existing public user-settings normalization/persistence coverage if the new preference field requires it, rather than building a separate settings test framework.
- Prior art includes the mounted Release Overlay Integration and Release Timeline Grid Integration suites and their Vue DOM/scroll harnesses; the User Settings Store suite's controlled save/load requests; and the Followed Repository Queries and Release Timeline Server suites' request-lifecycle and provider-adapter patterns.
- Follow repository checks for UI changes: root tests, formatting, lint, and Nuxt typecheck. Do not run a local production build or start browser/dev-server testing without the user's separate instruction.
- The two-line description limit and responsive placement are visual contracts. DOM tests can cover content and supplied geometry but cannot by themselves prove actual browser wrapping; do not substitute source-text assertions for that limitation.

## Out of Scope

- Topics, Fork Count, latest commits, latest releases, and additional repository-status badges.
- A full-width followed collection, a new management route, or replacing Starred/Search with a followed-only main view.
- New followed-list search, sort, filter, or pagination functionality.
- Continuous metadata polling, live GitHub push updates, or treating mode switching as a forced refresh.
- Separate desktop/mobile mode preferences or cross-device live updates while another device remains open.
- Changes to Release Follow semantics, valid/stored follow limits, release timelines, or GitHub Watch/Star behavior.
- Automatic unfollowing or marking repositories unavailable because metadata requests fail.
- Browser extension changes, a new repository-client factory, or a second user-settings persistence system.

## Further Notes

- Published issue: [#94](https://github.com/pynickle/gitpulse/issues/94), labelled `ready-for-agent`.
- Followed Repository means a repository with the signed-in user's GitPulse-local Release Follow, independent of GitHub Watch and Star.
- The design intentionally prioritizes recognition over a comprehensive repository dashboard. Description, language, and Stars were retained; Topics and a larger presentation surface were explicitly rejected during discussion.
- Existing follow records contain identity only, so this feature requires a metadata read path as well as presentation changes. The Starred/Search page is not a complete metadata source for all followed repositories.
- Product decisions and both test boundaries have been confirmed in the design conversation. This specification is ready for implementation; no application implementation has been performed during specification work.
