# Flutter Timeline Cache Retention Window application

Status: implemented for [GitHub issue #141](https://github.com/pynickle/gitpulse/issues/141).
The issue and companion specification record the agreed requirements; this document
retains the design rationale. Current behavior and verification commands are in
[Flutter timeline retention and offline reading](flutter-timeline-cache.md).

## Confirmed scope

Treat architecture-review candidate B and redundant restored-window work as one
work item with two independent acceptance criteria:

- Callers and behavior tests can await application of the Timeline Cache
  Retention Window and observe its result without polling the cache ledger.
- When the Saved Visible Timeline has not changed, avoid rereading, decoding,
  and rebuilding the same restored window. Preserve necessary updates when
  publications expire or other relevant state changes.

Application completes after the relevant synchronization, current-page replay,
pruning, and necessary visible-window updates finish. Callers can distinguish
success, failure, and non-application caused by a session change. Whether the
device choice was remembered is a separate outcome.

Device Preferences remain the authority for the installation's choice. Preserve
account isolation, retention eligibility, confirmed Release Follows, history
reconnection, and offline visible membership as defined in ADRs 0016, 0021, and
0024 and `flutter-timeline-cache.md`.

## Confirmed application contract

Settings and behavior tests use the same awaitable choose-and-apply entry. Its
result reports preference persistence and cache application separately. Callers
do not coordinate the preference listener, synchronization, replay, or pruning.
Device Preferences continue to own the choice; the Timeline Session continues
to own its cache consequences. A failed preference write does not prevent an
attempt to apply the choice for the current run.

A cache application failure preserves the chosen window and still-readable
content. The existing Retry saving action retries application of that same
chosen window without making requests or advancing the Timeline Refresh
Baseline. An unchanged day value cannot suppress retry of incomplete
application. This requires distinguishing the chosen window from whether its
application finished successfully.

Accepted choices execute serially. The retention editor is disabled while its
choose-and-apply operation is pending. Every accepted submission receives its
own outcome; a later submission cannot be dropped merely because its day value
matches the Session's value before an earlier queued operation executes.
Increasing the window does not recover history an earlier decrease deleted.

Without a valid session or confirmed Followed Repositories, remember the device
choice and return a non-applied outcome with a reason. Do not fetch or wait
indefinitely for these prerequisites. Normal startup or follow confirmation
adopts the latest device choice once local application becomes eligible.

Optimization targets the redundant second visible-window restoration (the third
decode of overlapping visible content). Preserve initial visible restoration
and retained-history loading as distinct operations. This work does not require
decoding every release only once across startup or promise a startup latency
improvement.

## Implementation shape

Expose one choose-and-apply command to Settings and behavior tests, with a
completion result containing separate preference-persistence and
cache-application outcomes. The latter distinguishes applied, failed, and
not-applied with a reason. An already satisfied choice can complete successfully;
incomplete application of the same choice must still be retried.

The command coordinates the existing device preference owner and Timeline
Session. Device Preferences do not acquire knowledge of timeline SQL, and
Settings do not acquire cache orchestration. Route explicit choices through
this command so an asynchronous preference listener does not start a second,
independently observable application of that same submission. Startup resolution
and seeding continue to honor the device choice before local writes.

Keep one internal application path for synchronization, loading and replaying
current pages, pruning, and updating a restored visible window. Its completion
must reflect failures in every stage: helpers cannot merely set a view-state
error and let the command report success. Retry saving uses this same path for
incomplete retention application. Existing session/generation checks and cache
cleanup barriers remain effective throughout execution.

Use SQL cleanup results or minimal visible-membership information to establish
whether the restored window changed, without rereading release bodies solely
to answer that question. Reuse the existing visible content when unchanged;
update it when expiry or relevant membership/metadata changes require it. A
matching day value alone is insufficient. Stored buffers and disconnected
history remain hidden. Older releases in a live online window remain readable
for the current session, as before.

## Acceptance

- Settings and tests await the same command. Block a later application stage
  after the ledger updates and verify that the command remains pending until
  the complete operation finishes. Remove ledger polling as a completion test.
- Exercise preference-write failure independently from cache-application
  failure. The current-run choice survives a failed preference write, and the
  two returned outcomes accurately describe that submission.
- Fail synchronization, history loading/replay, and restored-window update;
  verify failed completion, preservation of readable content, and successful
  Retry saving of the same choice without requests or baseline advancement.
- Verify accepted successive submissions, including 30 to 7 to 30 behind a
  blocked cache action: every operation terminates and the final Session and
  ledger policy agree with the last device choice. Verify the editor is disabled
  during application. Do not expect a later increase to recover evicted records.
- Without application prerequisites, verify prompt non-applied completion and
  adoption of the latest choice by the normal startup/follow-confirmation path.
  A session change invalidates outstanding application to the old session.
- On unchanged startup and retention-application paths, verify that the extra
  visible-window release-body read/decode and reconstruction do not occur. Use
  executed query/adapter observations and public behavior, not source matching.
  Cover the exact retention cutoff and expiry-driven offline-window updates.
- Reopen actual temporary SQLite files and verify Saved Visible Timeline
  membership, full notes, account isolation, follows changes, connected-history
  rules, and failed-cleanup barriers. Preserve existing online-window behavior.

Run the relevant Flutter behavior tests during implementation, then
`flutter analyze`, Dart formatting checks, and the full Flutter suite. The
previous 10-test result below verifies the existing baseline, not these new
acceptance criteria. No browser or device run is part of this design agreement.

## Verified behavior before implementation

The initial `restore` decodes Saved Visible Timeline members. On the startup
branch where follows are obtained, cache synchronization succeeds, and the view
remains restored, `readHistory` decodes retained history before
`pruneRetainedHistory` invokes `restore` again. A surviving visible release can
therefore be decoded three times. This is conditional, not a property of every
cold start. The initial view is exposed before the later reads; no timing
measurement establishes a startup bottleneck.

`TimelineCache._prune` already uses SQL without decoding release content. The
extra visible decode comes from the Session's second `restore`. The visible
window and retained pagination history have different semantics and must not be
merged merely because their content overlaps. Equal retention-day values alone
do not prove the visible window is unchanged, because time advances.

`selectRetentionDays` awaits the device preference write. A Session listener
starts cache application asynchronously. The test helper
`waitForSavedRetention` observes the ledger written during synchronization, which
does not establish that later history replay and visible-window updates finished.

Existing retention and pruning tests passed: 10 tests, using
`flutter test test/timeline/timeline_pruning_test.dart test/timeline/timeline_retention_test.dart --reporter expanded --timeout 30s`.
Those tests do not establish a cold-start decode-count or unchanged-window reuse
contract.

The current UI accepts additional choices while retention application runs. If
another cache action blocks a queued change from 30 to 7, a subsequent choice of
30 can be ignored by the listener's comparison with the still-current Session
value. The queued 7 can then execute despite the device holding 30. If 7 has
already started, its committed pruning can delete history before 30 is applied.

Current Retry saving does not rerun every retention stage: after synchronization
it can save current pages or clear the error without reloading/replaying history
or updating the restored window. Helpers that catch errors internally also make
Future completion alone insufficient to determine application success.

## Resolved documentation discrepancy

Before implementation, `flutter-timeline-cache.md` described a confirm action for
a changed retention field, while `device_settings.dart` applied step buttons
immediately and committed typed input on focus loss. The implementation preserves
that interaction and corrects the cache documentation.
