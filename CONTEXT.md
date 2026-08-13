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
Current metadata attached to a Notification Subject, including its title, lifecycle state, draft or answer state, issue type, labels, comment count, and author when available.
_Avoid_: Notification Subject State when referring to the full enrichment

**Notification Todo**:
A user-saved Notification snapshot kept for later follow-up.
_Avoid_: Feed item, generic Todo

## Pull Request Review

**PR Review Workspace**:
The three-pane surface for reviewing one pull request: file list, diff, and review submission.
_Avoid_: PR review page, review UI

**Diff Viewer**:
The middle pane of the PR Review Workspace that shows the files in the pull request as diffs.
_Avoid_: middle part, code panel, diff panel

**File Header**:
The chrome bar above one file's diff: path, change status, and addition and deletion counts.
_Avoid_: header, filename header, file bar

**Hunk Header**:
The row that marks a patch hunk with `@@ ... @@` line ranges.
_Avoid_: File Header

**Diff Row**:
A single context, added, deleted, or replaced line in a file diff.
_Avoid_: code line when referring to the review row, including its line numbers and comment controls
