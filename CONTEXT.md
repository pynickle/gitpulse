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
