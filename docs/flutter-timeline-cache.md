# Flutter timeline retention and offline reading

The native client requires the `provider-discovery` and `release-timeline` backend
capabilities. How much history it keeps is not an account setting and needs no
backend capability: the window is one of the installation's own device preferences
(language, appearance, Followed Repository View, and the window), kept in a local
JSON file beside the cache database. It defaults to 30 whole days and accepts 1
through 90.

The installation's `release_timeline` Drift/SQLite database stores current release
content once per stable repository/release identity. Separate tables record page
cursors, per-cycle segments, page membership, and membership of the Saved Visible
Timeline before display filters. A canonical backend base URL and numeric GitHub
account identity scope the database. Session creation now includes that identity;
sessions issued before this capability was introduced need a new sign-in before
durable caching is available. Passwords and PATs are never written to this cache.

Eligibility uses publication time at or after the current UTC instant minus the
installation's window in 24-hour days, including the exact cutoff. Local date
grouping does not affect eligibility. Older online releases remain readable in
the current session but disappear after reopening. An increased window cannot
recover evicted content.

The window is read before anything is pruned or saved, so a launch never applies a
guessed value: an installation that has no window yet is seeded once from the value
its cache ledger last wrote, and otherwise starts at 30. The seed is then kept as a
device choice, so the next launch needs no seed. A store that cannot be read falls
back to 30 before any write.

Settings shows the window in its whole-day editor and refuses anything outside
1 to 90. Step buttons submit immediately; typed input submits on focus loss. The
editor is disabled until its choose-and-apply operation finishes. That operation
reports separately whether the device remembered the choice and whether local
cache application completed, failed, or could not run (for example, without a
valid session or confirmed follows). Accepted choices run serially. A preference
write failure keeps the choice for the current run and still attempts local
application. A cache failure keeps the choice and still-readable content; Retry
saving retries unfinished synchronization, history replay, pruning and restored
window updates locally, without fetching or advancing the refresh baseline.
Normal startup or follow confirmation adopts the latest device choice after a
deferred application. Pruning already committed is not rolled back, and a later
increase cannot recover deleted history.

The cache ledger records the window last written. Startup restores visible
membership separately from loading retained pagination history. Later local
cleanup compares visible membership and metadata and reuses loaded visible content
when they have not changed, avoiding another release-body read and decode. Expiry
still removes out-of-policy publications from a restored offline window. Older
releases already exposed online remain readable for the current session.

The Settings clear-cache action goes through the timeline facade. It invalidates
in-flight rounds and removes local release content, saved membership, and pagination
provenance without fetching or advancing the shared baseline. It stays available
while a round is loading, because a stuck round is the reason to clear. It preserves
login, Release Follows, account preferences, and the installation's device choices,
including its window (a separate device-local file). Refresh explicitly to repopulate
the cleared history.

Confirmed follow changes are compared by stable repository ID. Removing follows
deletes only those repositories' content, provenance and saved membership. The
remaining live cursors, refresh baseline and cached connection checks survive;
the facade recomputes the shared window without requesting releases. Renames and
reordering update metadata without refreshing. Any addition, including a mixed
add/remove change discovered on another installation, invalidates all local
timeline content, saved membership and pagination provenance before loading first
pages. A failed first round after an addition cannot restore the previous window.
These changes preserve login, the installation's window, and the server-owned baseline.

Schema version 2 adds a pending-follow record, committed before destructive
cleanup. Every subsequent cache operation must finish that cleanup before reading
or writing history. A cleanup failure therefore remains a restore barrier across
process restarts; Retry saving can complete it offline. The version 1 migration
preserves existing content and settings. As with other local persistence, a
failure to write the pending record itself is reported as a cache error.

Startup restores eligible exposed membership and attempts a fresh round. A wholly
failed round preserves the committed view. Fresh usable results replace that view.
Retained page membership and same-cycle continuation cursors determine which
cached page suffixes the fetched chain has reached, separately for each repository.
Shared release identities can connect saved page chains, including across restarts;
dates and an arbitrary stored release cannot. Repeating a separately saved latest
page therefore cannot unlock an older disconnected island.

Fresh results stay readable while repositories with retained history wait for
connection. Only after every required repository connects (or successfully exhausts
upstream without an anchor) do reachable cached suffixes enter the existing shared
window calculation. Unavailable repositories remain visible blockers. Incomplete
pages cannot connect or prove exhaustion; empty complete pages can continue using
their returned cursor. Explicit load-older and retry actions each perform one round,
keeping live cursors rather than treating a cursor from an old cycle as a fresh
connection. Successful exhaustion replaces that repository's retained membership
with the records actually fetched in the current cycle, even when a cache anchor
survives. This removes deleted or unpublished releases previously supplied by a
cached tail. Successful retries replace the membership of the retried page;
incomplete pages and failures cannot establish exhaustion. Changing the window
replays the current fetched pages so it cannot lose the live chain's provenance.

Repeated refreshes with identical per-repository page graphs share one retained
graph. Compaction compares all page members, cursors, completion flags and empty
continuations together; equal first pages with different suffixes remain separate.

The facade exposes waiting repositories and a connection state alongside partial
coverage and retry actions. Connected cache uses the same publication ordering,
buffering, latest-content deduplication, fixed baseline and saved visible membership
as online results. Search and counts consume only that exposed window.
Foreground return prunes expired records without refreshing
the currently read timeline. Online windows use queued, account-scoped cleanup
without reading or decoding saved releases; a displayed restored window is still
restored after pruning so expired publications disappear from offline reading.
Stored buffers and disconnected history never become
visible merely because they are present in SQLite.

The last verified backend capabilities are reused immediately at that same
address while discovery refreshes in the background. A matching securely stored
identity and usable session cookie allow the Saved Visible Timeline to appear
before the server's session check finishes. Account API requests wait for that
check; local restoration uses a single loading surface rather than the sign-in
form. See [startup behavior](flutter-startup-spec.md). Explicit rejection
hides the timeline; same-account reauthentication may restore it. Explicit logout
and backend/account changes clear local timeline data and invalidate outstanding
writes. Database writes and exposed membership updates commit transactionally;
failed writes leave fresh results readable with a cache-error indication.

Refresh and load-older wait for the local save attempt before clearing loading.
A completed refresh does not guarantee that saving succeeded: a failed attempt
keeps fresh results readable and leaves the unsaved pages available for retry.
Cache write optimizations preserve this completion contract, the serial operation
queue, transactional rollback, and invalidation of writes after an account change
or cache clear.

Timeline and Settings expose **Retry saving** after a local write failure. The
facade keeps the current cycle's fetched pages until they can be committed with
the exposed membership, so a later successful page cannot silently omit an
earlier failed write. Retrying a known local write does not fetch releases or
advance the shared refresh baseline. Failed cache clearing remains pending:
subsequent reads must complete it before any saved history can be restored.

The timeline session owns the current cycle's fetched-page journal, commit
acknowledgement and retry/rebuild orchestration. The cache module owns SQL,
transaction ordering, pruning and account isolation. Write-path optimizations
remain behind that module's existing interface.

Damaged SQLite files and malformed cached content show a separate **Rebuild
cache** action. Rebuilding closes the old database, removes only the timeline
file and its SQLite journals, and opens a new database. It preserves the secure
session and server-owned follows/preferences/baseline. Fresh pages from the
current cycle are saved again under the installation's window; discarded
cached extensions are not treated as fetched pages. A failed rebuild remains
retryable. The old database's queued writes cannot enter its replacement.

Offline release details use complete notes from the exposed timeline, with offline
and saved-update indicators. Repository README, images, and current release asset
metadata are outside this cache's offline guarantee.

Run the behavior suite with `flutter test test/timeline/timeline_cache_test.dart`
from `flutter/`. It closes and reopens actual temporary SQLite files and covers
retention boundaries, isolation, deduplication, saved membership, full notes,
transaction rollback, and lifecycle invalidation. `flutter test` includes the
HTTP/session and mounted offline-startup checks. Native device/plugin behavior
still requires the owner's Android check.

`flutter test test/timeline/timeline_recovery_test.dart` covers mounted save and
rebuild actions, an invalid-cursor retry, failed-clear recovery, rejected-session
pruning, and delayed cache connections overtaken by refresh, unfollow, clear,
logout, backend changes, or account changes. Assertions include offline reopen
through the public facade, using temporary on-disk SQLite databases.

`flutter test test/timeline/timeline_follow_cache_test.dart` covers additions,
removals, rename/reorder, delayed requests, failed cleanup and offline retry,
authoritative exhaustion and version 1 migration. The companion
`timeline_cache_compaction_test.dart` verifies bounded duplicate provenance and
continuation after compaction and reopening.

`flutter test test/timeline/timeline_pruning_test.dart` checks foreground cleanup
without saved-window reads or decoding, offline window expiry, account switches,
generation rollback, and retrying failed clear/follow cleanup barriers.

`flutter test test/settings/timeline_cache_settings_test.dart` drives the cache band
through the real session and Nitro handlers with temporary SQLite and device files,
including a clear that waits for a blocked transaction, and clearing during
pagination followed by an offline reopen.

`flutter test test/settings/device_settings_test.dart` covers this installation's
own choices through the whole app: the window's default, a submitted change pruning
saved history at once, a window outside 1 to 90 refused, and a device that cannot
remember a choice saying so while keeping it for the run.

`flutter test test/timeline/timeline_retention_test.dart` covers the startup gate:
nothing is pruned or saved before this installation's window is known, a round
started during that wait saves nothing, a window chosen offline prunes without a
request, and a window changed after the session ended leaves saved history alone.

`flutter test test/timeline/timeline_retention_application_test.dart` exercises the
same awaitable choose-and-apply command Settings uses, with delayed and failed
SQLite stages, independent preference failures, queued choices, session changes,
unchanged-window query observations, and a close/offline-reopen check.

## Accepted write-path optimization plan

Implementation is pending and tracked in [issue #142](https://github.com/pynickle/gitpulse/issues/142).
Keep the completion contract and module ownership described above; optimize
behind the existing cache interface.

- Add a `cache_releases(published_at)` index for expiry and a
  `cache_segments(repository_id, cycle, request_cursor)` index for cycle lookups
  and repeated-page cleanup. Do not add a redundant repository/cycle index.
  Schema creation and version handling must install the indexes; preserving old
  cache formats is not an acceptance requirement for this work.
- Insert each segment with an operation that returns its generated ID, removing
  the separate `last_insert_rowid()` query. Batch that page's release mutations,
  membership writes and repeated-page cleanup in their existing order. Later
  pages can change the content or retention eligibility of the same release, so
  do not globally reorder deletions and upserts.
- Replace per-release visible-membership inserts with bounded, chunked `VALUES`
  input joined to `cache_releases`. Preserve the join: online results can include
  releases that are not eligible for durable retention. Replacing the visible
  membership, including all chunks, stays inside the existing save transaction.
- Preserve authoritative-exhaustion filtering, the inclusive retention cutoff,
  final pruning and graph compaction, and both pre-write and pre-commit validity
  checks. Empty pagination continuations remain part of retained page graphs.

Validate through the existing cache and timeline interfaces using actual SQLite
databases: rollback after a failed write, invalidation during a write, local retry
of unsaved pages, account isolation and close/offline-reopen behavior must survive.
Compare complete `save()` and `prune()` operations against the original
implementation using equivalent on-disk fixtures and the production background
connection, across different data sizes and expiry proportions. Report latency
distributions as well as SQL executions and query plans. A row batch reduces
preparation and asynchronous round trips, not the number of SQLite row statements;
further set-based content/member writes are selected by the same full-path
benchmark. No fixed speedup is assumed, and desktop results do not establish
Android device performance.
