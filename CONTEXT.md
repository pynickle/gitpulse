# GitPulse

GitPulse presents GitHub activity for focused review and follow-up in one dashboard.

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

**PR Review Workspace**:
The three-pane surface for reviewing one pull request: file list, diff, and review submission.
_Avoid_: PR review page, review UI

**Diff Viewer**:
The middle pane of the PR Review Workspace that shows the files in the pull request as diffs.
_Avoid_: middle part, code panel, diff panel

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
The Markdown Composer for a pending comment on a Diff Row in the PR Review Workspace.
_Avoid_: inline draft, line comment box

**Review Submit Composer**:
The Markdown Composer for the review summary in the PR Review Workspace submit rail. Always Tabbed Layout.
_Avoid_: submit bar, review panel textarea

**Conversation Composer Default Layout**:
The user setting that seeds Composer Layout when a Conversation Composer opens.

**Review Inline Composer Default Layout**:
The user setting that seeds Composer Layout when a Review Inline Composer opens.

## Detail Overlays

**Detail Overlay**:
The full-screen surface that opens over the dashboard to show one subject in depth: a pull request, issue, discussion, or repository.
_Avoid_: detail page, detail view

**Detail Sidebar**:
The metadata column on the right side of a Detail Overlay, holding cards such as labels, assignees, and actions. Present on pull request, issue, discussion, and repository Detail Overlays.
_Avoid_: right panel, metadata column, "sidebar" used alone

**Tab Sidebar**:
The dashboard's left navigation sidebar listing tabs and tab groups.
_Avoid_: left menu, main sidebar
