---
status: accepted
---

# Centralize confirmation of Flutter Release Follows

One shared Release Follows module owns confirmation of the signed-in account's
Followed Repositories. Both the Followed Repository View and Release Timeline
consume its confirmed collection. Replace their independent confirmation paths
and the page-driven, one-way synchronization: separate owners can disagree after
a Timeline refresh and allow delayed metadata to restore a removed follow.

Repository metadata may enrich only current members; it cannot establish
membership or restore a removed member. A rename of the same repository is not a
new Release Follow. The Timeline module keeps responsibility for pagination,
Shared Timeline Windows, filtering, and cache consequences. The existing rules
for additions, removals, and renames in `../flutter-timeline-cache.md` remain in
force, alongside ADRs 0015 and 0016.

Show the confirmed collection as soon as membership is available, then enrich
Detailed View independently. Slow or failed metadata requests do not make an
otherwise confirmed collection unavailable. This accepts temporarily incomplete
details in exchange for making the user's follows usable without waiting for
repository enrichment.

Read the remote collection on first load, account changes, an explicit Follows
refresh, or a Timeline refresh. Ordinary page switches reuse the shared confirmed
collection instead of re-reading settings. Coalesce overlapping collection reads.
Consequently, changes from another device are discovered at the next refresh,
not merely by switching pages.

Keep the existing failure semantics: metadata failures and unavailable
repositories do not remove follows, and accepted renames use stable repository
identity. A release-page failure does not roll back a collection already
confirmed by a successful settings read.

Preserve the existing offline boundary. Timeline may restore its Saved Visible
Timeline for offline reading; cached repositories and repositories inferred from
release pages do not establish a current confirmed follow collection. On a cold
start where settings cannot be read, Follows shows a failure with a retry action,
not an empty collection. A failed refresh during the same account session keeps
the last in-memory confirmed collection. This change does not add an offline
Follows snapshot view.

Confirm local follow edits only after a successful server response; a failed edit
preserves the previous confirmed collection. Once an edit succeeds, a settings
read started before that edit cannot replace the collection. A subsequent fresh
read may confirm changes from another client. The shared module owns this
ordering rather than treating response arrival order as freshness.

This change addresses consistency within the Flutter client and keeps the
existing settings protocol. That protocol reads the current collection and
submits a replacement collection without a conflict revision. Concurrent edits
from separate clients can therefore still overwrite each other. Server-side
repository commands or revision-based conflict detection require a separate
protocol decision; they are outside this change.
