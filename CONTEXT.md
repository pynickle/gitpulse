# GitPulse

GitPulse presents GitHub activity for focused review and follow-up in one dashboard.

## Flutter Presentation

**Device Presentation Preferences**:
The language, appearance, and Followed Repository View chosen for one Flutter app installation, shared across its accounts and backends. These choices survive sign-out and account or backend changes, and are independent of another installation's choices.
_Avoid_: account settings when referring to these Flutter presentation choices

## Integration

**Browser Launch Link**:
A URL that asks GitPulse to open a supported GitHub page and resolve it into the matching GitPulse
surface after authentication.
_Avoid_: dashboard deep link when referring to the browser integration contract

**Native Login Handoff**:
A single-use authorization that lets the app which started a browser sign-in receive its own GitPulse session after sign-in completes. It does not transfer the browser's session to the app.
_Avoid_: OAuth callback when referring to this separate browser-to-app handoff

## Notifications

**Notifications**:
The dashboard collection of notifications delivered by GitHub.
_Avoid_: Feed

**Notification Subject**:
The GitHub issue, pull request, discussion, release, or other resource referenced by a Notification.

**Enrichable Notification Subject**:
A Notification Subject for which GitPulse can retrieve current metadata. Issues, pull requests, and discussions with a valid GitHub target are enrichable; releases and unrecognized subjects are not.

**Notification Subject Enrichment**:
Current metadata attached to a Notification Subject, including its title, lifecycle state, draft or answer state, issue type, labels, comment count, author when available, and Linked Pull Request Count for Issues.
_Avoid_: Notification Subject State when referring to the full enrichment

**Notification Todo**:
A user-saved Notification snapshot kept for later follow-up.
_Avoid_: Feed item, generic Todo

## Issues

**Linked Pull Request**:
A pull request attached to an Issue through GitHub Development — a closing keyword or a manual Development link — in any lifecycle state.
_Avoid_: associated PR, related PR, connected PR, mentioned PR, cross-referenced PR

**Linked Pull Request Count**:
How many Linked Pull Requests an Issue currently has.
_Avoid_: associated PR count, related PR count

**Linked Pull Request Picker**:
A modal that lists an Issue's Linked Pull Requests so the user can open one. It opens when Count is greater than 1, or when Count is 1 but routing identity is incomplete.
_Avoid_: associated PR modal, PR chooser

## Pull Request Review

**Check Rollup**:
GitHub's own precomputed summary of a Pull Request's checks for its head commit: one aggregate state plus the deduplicated set of check runs and status contexts GitHub shows on the Checks tab.
_Avoid_: CI status, action status, workflow status, combined status

**Check Status Chip**:
The meta-row indicator on a Pull Request Card and Notification Card that shows the Check Rollup's passed count over its total count and opens the Check List Modal. It is absent when the Check Rollup has no contexts.
_Avoid_: CI badge, action badge, checks icon, checks count

**Check List Modal**:
The modal opened from a Check Status Chip that shows the Check Rollup's summary line and its checks grouped by conclusion. It renders the same list as the PR Review Workspace merge box.
_Avoid_: checks panel, checks popover, checks drawer, CI details

**PR Review Workspace**:
The surface for reviewing one pull request: its changed files, its diff, and its review submission. On a wide viewport these are three panes. On a narrow viewport the Diff Viewer stays on screen, and a bottom bar opens the changed files and the review submission each in its own sheet.
_Avoid_: PR review page, review UI

**Review Bottom Bar**:
The bar on a narrow PR Review Workspace that opens the Review File Sheet and the Review Submit Sheet. It stays at the bottom of the screen while the diff scrolls, and both sheets open above it. It hides while the keyboard is open or a Review Inline Composer is open.
_Avoid_: bottom nav, tab bar, Dashboard Menu

**Review File Sheet**:
The sheet on a narrow PR Review Workspace that lists the pull request's changed files. It opens above the Review Bottom Bar. Choosing a file closes the sheet and moves the Diff Viewer to that File Card.
_Avoid_: file sidebar, file drawer

**Review Submit Sheet**:
The sheet on a narrow PR Review Workspace that holds the review submission, including the Review Submit Composer. It opens above the Review Bottom Bar.
_Avoid_: submit bar, review panel

**Diff Viewer**:
The part of the PR Review Workspace that shows the pull request's files as diffs. On a wide viewport it is the middle pane and uses Split Diff. On a narrow viewport it uses Unified Diff.
_Avoid_: middle part, code panel, diff panel

**Split Diff**:
The Diff Viewer arrangement that shows each Diff Row's old and new sides side by side. Used on a wide PR Review Workspace.
_Avoid_: dual pane, side-by-side

**Unified Diff**:
The Diff Viewer arrangement that shows each Diff Row in one column. A replaced line appears as its deleted line followed by its added line. The line number stays in place while the code scrolls horizontally. Used on a narrow PR Review Workspace.
_Avoid_: single column, stacked diff

**File Card**:
One changed file in the Diff Viewer, containing its File Header and Diff Rows.
_Avoid_: file section, file block

**File Header**:
The header of a File Card: path, change status, and addition and deletion counts.
_Avoid_: header, filename header, file bar

**Hunk Header**:
The row that marks a patch hunk with `@@ ... @@` line ranges.
_Avoid_: File Header

**Diff Row**:
A single context, added, deleted, or replaced line in a file diff.
_Avoid_: code line when referring to the review row, including its line numbers and comment controls

## Markdown Composer

**Markdown Composer**:
A surface for composing a GitHub comment in markdown, with a preview of the rendered body.
_Avoid_: markdown input, comment box, input box when referring to the editor

**Composer Layout**:
Which panes a Markdown Composer shows: Tabbed Layout or Split Layout.
_Avoid_: style, preview style

**Tabbed Layout**:
A Composer Layout that shows Write or Preview, never both.
_Avoid_: write window, preview window, write/preview

**Split Layout**:
A Composer Layout that shows Write on the left and a live Preview on the right at the same time.
_Avoid_: live preview, realtime preview when referring to the layout

**Conversation Composer**:
The Markdown Composer on an issue, pull request, or discussion conversation, including the sticky composer and in-thread discussion replies.
_Avoid_: PR/issue comment, floating editor

**Review Inline Composer**:
The Markdown Composer for a pending comment on a Diff Row in the PR Review Workspace. It sits under that row. On a narrow viewport it is always Tabbed Layout, and a tap on that row's code opens it.
_Avoid_: inline draft, line comment box

**Review Submit Composer**:
The Markdown Composer for the review summary in the PR Review Workspace. On a wide viewport it sits in the submit pane. On a narrow viewport it sits in the Review Submit Sheet. Always Tabbed Layout.
_Avoid_: submit bar, review panel textarea

**Conversation Composer Default Layout**:
The user setting that seeds Composer Layout when a Conversation Composer opens.

**Review Inline Composer Default Layout**:
The user setting that seeds Composer Layout when a Review Inline Composer opens on a wide viewport.

## Dashboard

**Landing**:
The unauthenticated marketing and sign-in surface at `/`.
_Avoid_: homepage, Dashboard Home

**Dashboard Home**:
The signed-in `/dashboard` surface: Activity Bar, Tab Sidebar, and the active tab's list, including the Release Timeline. Child routes and Detail Overlays leave this surface.
_Avoid_: homepage, landing, dashboard page, "pages" of the dashboard when referring to this surface

**Activity Bar**:
The dashboard chrome that switches built-in tabs (Todos, Notifications, Issues, Pulls, Repos, Release Timeline) and holds account actions (profile, starred, settings, logout). On the wide layout it is the far-left icon rail.
_Avoid_: left icon bar, dock, bottom nav when referring to this chrome on the wide layout

**Tab Sidebar**:
The dashboard's left navigation sidebar listing tabs and tab groups.
_Avoid_: left menu, main sidebar, Dashboard Menu

**Dashboard Menu**:
The narrow-viewport overlay on Dashboard Home that lists built-in tabs and Tab Sidebar views so the list can use the full width.
_Avoid_: hamburger menu, sidebar, Tab Sidebar when referring to this overlay

## Repositories

**Watcher Count**:
The number of users watching a repository — the total behind GitHub's Watch button.
_Avoid_: watchers_count, Star Count

## Detail Overlays

**Detail Overlay**:
The full-screen surface that opens over the dashboard to show one subject in depth: a pull request, issue, discussion, or repository.
_Avoid_: detail page, detail view

**Detail Sidebar**:
The metadata column on the right side of a Detail Overlay, holding cards such as labels, assignees, and actions. Present on pull request, issue, discussion, and repository Detail Overlays.
_Avoid_: right panel, metadata column, "sidebar" used alone

## Release Follows

**Release Follow**:
A GitPulse-local subscription to a repository's releases, independent of GitHub Watch and Star.
_Avoid_: watch, following, star, subscribe

**Followed Repository**:
A repository that has a Release Follow for the signed-in user.
_Avoid_: watched repo, starred repo, selected repo

**Followed Repository View**:
The presentation of the user's Followed Repositories: Compact View emphasizes repository identity; Detailed View adds information that helps the user recognize what each project does.
_Avoid_: Release Timeline when referring to the followed-repository collection

**Release Timeline**:
The sequence of published releases from the user's Followed Repositories, ordered from newest to oldest by publication time.
_Avoid_: feed, Repository Release List

**Shared Timeline Window**:
The publication-time interval currently exposed on the Release Timeline across Followed Repositories. It represents the history covered so far, without guaranteeing that every release in that interval has been found.
_Avoid_: Complete Timeline Window for bounded pagination coverage

**Partial Timeline Window**:
A Shared Timeline Window displayed while one or more Followed Repositories could not be included in the current load.
_Avoid_: full repository coverage when a repository could not be loaded

**Timeline Cache Retention Window**:
The rolling publication-time interval for which the Flutter application retains Release Timeline history for later reuse. Its duration is shared by an account's app installations; it expresses eligibility for retention, not completeness of the retained history.
_Avoid_: request age, cached-at window when referring to this publication-time interval

**Connected Cached History**:
A repository's retained release history that the current refresh has reached by loading successive release pages back into previously retained records. This connection permits history reuse without establishing complete publication-time coverage.
_Avoid_: complete history, date overlap when referring to a verified connection

**Saved Visible Timeline**:
The most recently saved Release Timeline window exposed by the Flutter application before user display filters, available for offline reading. It excludes retained history disconnected from that window.
_Avoid_: all cached history, per-request snapshot

**Timeline Refresh Baseline**:
The time of the account's previous Release Timeline refresh that returned usable results, including partial results, shared by web and app clients. It distinguishes new releases from earlier ones and does not represent reading progress.
_Avoid_: last read time, reading position

**Recovered Release**:
A previously missing release discovered after the Release Timeline had already shown its publication interval.
_Avoid_: new release when referring to discovery of an earlier omission

**Recovered Release History**:
The user's retained collection of Recovered Releases, preserved across Release Timeline refreshes until explicitly cleared. Clearing it marks those releases as handled, so they do not re-enter the collection.
_Avoid_: unread releases, new releases list

**Oldest Shown Release**:
A Followed Repository's chronologically earliest release on the Release Timeline, marked only when older releases for that repository exist and were not loaded.
_Avoid_: latest, last release when that means the newest

**Unavailable Followed Repository**:
A Followed Repository GitHub reports as missing or unresolvable — not one that failed to load from timeout, rate limit, or a transient error.
_Avoid_: dead repo, invalid star, failed fetch when the identity still exists

**Repository Release List**:
The releases that belong to one repository, including drafts and prereleases.
_Avoid_: Release Timeline

**Entry Release**:
The release open in the Release Drawer when that drawer was opened from the Release Timeline. It stays fixed until the drawer closes; the list marks its row when that row is visible, and one step from the list or another release returns to it.
_Avoid_: current release, latest release, the repository's first release

**Release Drawer**:
The overlay on the Release Timeline that shows one release, or that repository's Repository Release List, without changing page layout or URL. A right drawer on desktop, a bottom sheet on mobile.
_Avoid_: Detail Overlay when referring to this surface

**Release Asset**:
A downloadable file attached to a Release. GitHub's automatically generated source archives are not Release Assets: the API does not return them and no client shows them. The Flutter client calls them 附件 and the web client calls the same files 资源; that wording difference is unresolved and does not name a different concept.
_Avoid_: attachment, download, source archive

**Release Timeline Filter**:
The client-side display filter on the Release Timeline that narrows visible releases by Followed Repository, published date range, and prerelease status.
_Avoid_: timeline search, filter bar, dashboard filters when referring to this surface

**Release Timeline Search**:
The text search used to locate releases on the Release Timeline by repository identity, release title, tag, or optionally release notes.
_Avoid_: Release Timeline Filter when referring to the text search

**Active Timeline Filter**:
The set of Release Timeline Filter conditions currently applied to the Release Timeline.
_Avoid_: applied filters, active filters

**Release Timeline Filter Panel**:
The overlay that holds the Release Timeline Filter controls with a scrim: a right-side panel on desktop and a bottom sheet on mobile, following the Release Drawer layout pattern.
_Avoid_: filter bar, filter popover, filter modal
