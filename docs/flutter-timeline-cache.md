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
failed round preserves the committed view. Fresh usable results replace that view
without importing older stored segments: online segment reconnection belongs to
the next cache slice. Foreground return prunes expired records without refreshing
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
