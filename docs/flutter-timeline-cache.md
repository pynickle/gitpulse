# Flutter timeline retention and offline reading

The native client requires the `timeline-retention` backend capability. Account
settings expose `releaseTimeline.retentionDays`, defaulting to 30, with integer
values from 1 through 90. Settings patches preserve unrelated preferences and use
the existing filesystem, Redis, or Upstash settings driver.

The installation's `release_timeline` Drift/SQLite database stores current release
content once per stable repository/release identity. Separate tables record page
cursors, per-cycle segments, page membership, and membership of the Saved Visible
Timeline before display filters. A canonical backend base URL and numeric GitHub
account identity scope the database. Session creation now includes that identity;
sessions issued before this capability was introduced need a new sign-in before
durable caching is available. Passwords and PATs are never written to this cache.

Eligibility uses publication time at or after the current UTC instant minus the
synchronized number of 24-hour days, including the exact cutoff. Local date
grouping does not affect eligibility. Older online releases remain readable in
the current session but disappear after reopening. An increased preference cannot
recover evicted content. A failed preference synchronization uses the installation's
last valid account value; without a valid value, fresh results remain session-only.

Settings shows the synchronized retention value in its whole-day editor, offers the
save action only once the field holds a different value, and states the policy that
is still in force under a pending or rejected change. Only a successful online
settings patch applies a new policy; failed synchronization and failed saves are
shown separately. Shrinking prunes content and its provenance; older online browsing
stays readable for the current session.

The Settings clear-cache action goes through the timeline facade. It invalidates
in-flight rounds and removes local release content, saved membership, and pagination
provenance without fetching or advancing the shared baseline. It stays available
while a round is loading, because a stuck round is the reason to clear. It preserves
login, Release Follows, account preferences, the installation's language/appearance
choices (a separate device-local file), and the last locally synchronized retention
value for offline startup. Refresh explicitly to repopulate the cleared history.

Confirmed follow changes are compared by stable repository ID. Removing follows
deletes only those repositories' content, provenance and saved membership. The
remaining live cursors, refresh baseline and cached connection checks survive;
the facade recomputes the shared window without requesting releases. Renames and
reordering update metadata without refreshing. Any addition, including a mixed
add/remove change discovered on another installation, invalidates all local
timeline content, saved membership and pagination provenance before loading first
pages. A failed first round after an addition cannot restore the previous window.
These changes preserve login, retention preferences and the server-owned baseline.

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
incomplete pages and failures cannot establish exhaustion. Updating retention
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

Timeline and Settings expose **Retry saving** after a local write failure. The
facade keeps the current cycle's fetched pages until they can be committed with
the exposed membership, so a later successful page cannot silently omit an
earlier failed write. Retrying a known local write does not fetch releases or
advance the shared refresh baseline. Failed cache clearing remains pending:
subsequent reads must complete it before any saved history can be restored.

Damaged SQLite files and malformed cached content show a separate **Rebuild
cache** action. Rebuilding closes the old database, removes only the timeline
file and its SQLite journals, and opens a new database. It preserves the secure
session and server-owned follows/preferences/baseline. Fresh pages from the
current cycle are saved again under the synchronized retention policy; discarded
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
still requires the owner's Windows and Android checks.

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

`flutter test test/settings/timeline_settings_test.dart` drives Settings through
the real session and Nitro settings handlers with independent account sessions and
temporary SQLite files, including failed/pending saves, cross-installation policy
sync, shrink/expand, and clear-cache during pagination followed by offline reopen.
