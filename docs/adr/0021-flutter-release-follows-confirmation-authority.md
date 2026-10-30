---
status: accepted
---

# Centralize confirmation of Flutter Release Follows

One shared Release Follows module owns confirmation of the signed-in account's
Followed Repositories. Both the Followed Repository View and Release Timeline
consume its confirmed collection. Replace their independent confirmation paths
and the page-driven, one-way synchronization: separate owners can disagree after
a Timeline refresh and allow delayed metadata to restore a removed follow.

Release Follows also owns collection reads, edit-time reads, decoding, writes,
and their shared failure contract. Synchronization returns the confirmed
collection consistent with its shared state, or an explicit failure, rather
than a settings DTO or a confirmation flag requiring a separate state read.
This removes the reverse dependency on Timeline's settings reader and result
types. Authentication rejection remains distinguishable from ordinary read
failures: Timeline decides whether to stop or continue loading, and each
consumer owns its presentation and subsequent actions.

Move the existing shared repository reference and repository-query status into
a neutral repository-model module consumed by Follows, Discovery, Timeline,
and repository surfaces. Preserve the reference's stable GitHub node-ID equality
and the query status's available, unavailable, and transient meanings and wire
values. Their shared use should not require importing Timeline models. This is
a model-ownership change, not a new abstraction or a merger with repository
detail failures.

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
When a refresh overlaps a local edit, apply the save-response rule below.
Consequently, changes from another device are discovered through remote
confirmation rather than merely by switching pages; an overlapping edit does
not force another read after its save response.

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

Synchronization waits for a local edit already in progress or one that
invalidates its collection read, instead of completing with the pre-edit
collection while that edit is unresolved. A successful save supplies the
confirmed collection directly from its validated response; synchronization does
not issue an additional GET. A failed edit preserves the previous confirmed
collection and makes the waiting synchronization explicitly fail, without an
automatic follow-up read. This deliberately trades a longer wait for a result
that has settled the overlapping local edit; it does not promise freshness
against subsequent changes from another client. Existing account-change and
cancellation guards continue to reject obsolete results.

This change addresses consistency within the Flutter client and keeps the
existing settings protocol. That protocol reads the current collection and
submits a replacement collection without a conflict revision. Concurrent edits
from separate clients can therefore still overwrite each other. Server-side
repository commands or revision-based conflict detection require a separate
protocol decision; they are outside this change.
