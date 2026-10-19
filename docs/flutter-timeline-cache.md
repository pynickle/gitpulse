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
connection. Successful exhaustion without an anchor removes only that repository's
obsolete history, retaining records fetched in the current cycle.

The facade exposes waiting repositories and a connection state alongside partial
coverage and retry actions. Connected cache uses the same publication ordering,
buffering, latest-content deduplication, fixed baseline and saved visible membership
as online results. Search and counts consume only that exposed window.
Foreground return prunes expired records without refreshing
the currently read timeline. Stored buffers and disconnected history never become
visible merely because they are present in SQLite.

The last verified backend capabilities are retained for offline startup at that
same address. Secure session restoration still controls access. Explicit rejection
hides the timeline; same-account reauthentication may restore it. Explicit logout
and backend/account changes clear local timeline data and invalidate outstanding
writes. Database writes and exposed membership updates commit transactionally;
failed writes leave fresh results readable with a cache-error indication.

Offline release details use complete notes from the exposed timeline, with offline
and saved-update indicators. Repository README, images, and current release asset
metadata are outside this cache's offline guarantee.

Run the behavior suite with `flutter test test/timeline/timeline_cache_test.dart`
from `flutter/`. It closes and reopens actual temporary SQLite files and covers
retention boundaries, isolation, deduplication, saved membership, full notes,
transaction rollback, and lifecycle invalidation. `flutter test` includes the
HTTP/session and mounted offline-startup checks. Native device/plugin behavior
still requires the owner's Windows and Android checks.
