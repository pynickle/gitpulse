# Flutter retention-window application specification

Implemented for [GitHub issue #141](https://github.com/pynickle/gitpulse/issues/141).
The requirements below preserve the agreed specification and its investigation
context. Current behavior is documented in [Flutter timeline retention and offline
reading](flutter-timeline-cache.md).

## Problem Statement

A Flutter reader can change the Timeline Cache Retention Window without being
able to tell whether the choice was remembered, whether it was applied to saved
history, or whether application failed. The preference write finishes separately
from asynchronous cache application. Tests currently infer progress by polling
the cache ledger, even though its update precedes completion of history replay
and visible-window updates.

Failures and successive choices expose practical gaps. Retry saving does not
repeat every failed application stage. A choice of 30 days following a queued
change to 7 days can be ignored while the Session still holds 30, allowing the
cache to end at 7 despite Device Preferences holding 30.

Startup can also repeat expensive work: after restoring the Saved Visible
Timeline, it reads retained history and then restores the visible window again.
An overlapping visible release can be decoded three times when the successful
startup branch remains restored. This duplicate work is confirmed; its impact
on startup latency is not measured.

## Solution

Provide one awaitable choose-and-apply operation used by Settings and behavior
tests. Report whether the choice was remembered separately from whether cache
application succeeded, failed, or could not run. Complete application only after
the required synchronization, current-page replay, pruning, and visible-window
updates finish.

Keep the reader's choice and still-readable content after application failure.
Retry saving must retry incomplete application of that same choice locally.
Process accepted choices serially and disable the retention editor while its
operation is pending. When application prerequisites are absent, remember the
choice and return promptly with a reason; the normal startup or follow
confirmation flow later adopts the latest device choice.

As part of the same work, skip the extra visible-window read, decode, and rebuild
when the Saved Visible Timeline has not changed. Preserve the separate meanings
of the Saved Visible Timeline and Connected Cached History. Completion semantics
and redundant-work reduction are independent acceptance criteria.

## User Stories

1. As a Flutter reader, I want one retention choice to control how much Release Timeline history this installation keeps, so that its offline policy is consistent across my accounts and backends.
2. As a Flutter reader, I want to change the Timeline Cache Retention Window offline, so that I can manage local history without reaching the backend.
3. As a Flutter reader, I want a valid choice from 1 through 90 whole days to retain its existing meaning, so that this change does not alter the range or publication-time eligibility rules.
4. As a Flutter reader, I want to know whether my choice was remembered, so that I understand whether it will survive a restart.
5. As a Flutter reader, I want cache-application success to be distinct from preference-save success, so that a saved choice does not imply that pruning and visible updates finished.
6. As a Flutter reader, I want my current-run choice to remain effective when the device cannot remember it, so that a preference-file failure does not discard my choice.
7. As a Flutter reader, I want application to finish all required local stages before reporting success, so that a completed operation has a reliable meaning.
8. As a Flutter reader, I want an application failure to preserve my chosen window, so that I do not have to re-enter it to retry.
9. As a Flutter reader, I want still-readable content to remain available after an application failure, so that a local cache error does not unnecessarily interrupt reading.
10. As a Flutter reader, I want Retry saving to retry incomplete retention application, so that failures in history loading, replay, or restored-window updates can recover.
11. As a Flutter reader, I want retrying the same day value to perform unfinished work, so that an unchanged choice does not falsely count as a successful application.
12. As a Flutter reader, I want retention retries to make no network requests or advance the Timeline Refresh Baseline, so that retrying local persistence does not become a refresh.
13. As a Flutter reader, I want the retention editor disabled while my operation is pending, so that I do not submit another interactive choice during pruning.
14. As a caller submitting accepted successive choices, I want them processed serially with a result for each, so that a later choice cannot silently disappear.
15. As a Flutter reader, I want the final Session and saved policy to agree with my last accepted choice when application succeeds, so that a queued 30-to-7-to-30 sequence cannot leave the cache governed by 7 days.
16. As a Flutter reader, I want increasing the window to respect what remains locally available, so that the app does not claim to restore history an earlier decrease deleted.
17. As a Flutter reader, I want a choice remembered even when no valid session is available, so that Device Preferences remain independent of an account session.
18. As a Flutter reader, I want an explicit non-applied result when Followed Repositories are not confirmed, so that unconfirmed membership cannot authorize cache changes.
19. As a Flutter reader, I want unavailable application prerequisites to produce a prompt result with a reason, so that a choice does not trigger extra requests or wait indefinitely.
20. As a Flutter reader, I want normal startup or follow confirmation to adopt the latest device choice when application becomes eligible, so that a previously deferred choice is not lost.
21. As a Flutter reader, I want session changes to invalidate outstanding application to the old session, so that one account's operation cannot modify another account's saved history.
22. As a Flutter reader, I want startup to read my device choice before local pruning or saving, so that a guessed retention window cannot delete history.
23. As a Flutter reader, I want an unchanged Saved Visible Timeline to reuse its loaded visible content, so that the app avoids redundant release-body decoding and reconstruction.
24. As a Flutter reader, I want expired publications removed from a restored offline window, so that avoiding redundant work does not leave out-of-policy content visible.
25. As a Flutter reader, I want publications exactly at the retention cutoff to remain eligible, so that the existing inclusive boundary is preserved.
26. As a Flutter reader, I want retained buffers and disconnected history to stay hidden, so that an optimization cannot expose releases outside the Saved Visible Timeline or permitted connected history.
27. As a Flutter reader, I want older releases already exposed in a live online window to remain readable for the current session, so that retention changes preserve existing browsing behavior.
28. As a Flutter reader, I want my Saved Visible Timeline and full release notes to survive a successful close and offline reopen, so that local application has a durable, observable result.
29. As a Flutter reader, I want confirmed follow changes, history reconnection, and pending-cleanup barriers to retain their existing behavior, so that the new operation does not weaken cache membership rules.
30. As a maintainer, I want Settings and behavior tests to cross the same awaitable interface, so that tests verify the operation readers actually use without guessing completion from storage internals.
31. As a maintainer, I want completion failures and redundant cache reads verified by executing behavior, so that tests remain meaningful after internal refactoring.

## Implementation Decisions

- Keep Device Preferences as the authority for the installation's choice and the Timeline Session as the owner of pagination, visible-window state, and cache consequences. Preserve ADRs 0016, 0021, and 0024.
- Expose one choose-and-apply command at the highest practical existing application seam. It coordinates the existing owners; Settings and tests must not coordinate listeners, SQL, replay, or pruning. A generic storage framework is unnecessary.
- Return separate preference-persistence and cache-application outcomes for the submission. Cache application distinguishes applied, failed, and not applied with a reason, including session invalidation or unavailable prerequisites. Do not infer a submission's result solely from a shared error flag.
- A successful application means every required stage completed, including any necessary visible-window update. Intermediate helpers that catch errors must still communicate failure to the operation; Future completion or a ledger update alone does not imply success.
- Track whether the chosen policy has been fully applied. A matching day value may avoid already completed work, but must not suppress incomplete application or expiry-related updates.
- Route explicit choices through the shared command without a second independent application being started by the preference listener. Preserve startup resolution and first-choice seeding before writes.
- Run accepted choices serially, with a terminal outcome for each. Disable the retention editor while its choose-and-apply operation is pending. Preserve immediate step-button submission and typed-input submission on focus loss, apart from the agreed pending-state lock.
- A failed preference write retains the current-run choice and does not prevent an attempt to apply it. A cache failure retains the choice and still-readable content. This does not promise rollback of pruning that already committed.
- Retry saving uses the same complete local application path for unfinished retention work, including history loading/replay and restored-window updates. This retry performs no network requests and does not advance the Timeline Refresh Baseline. Do not route that retention retry through a network refresh fallback.
- Without a valid session or confirmed Followed Repositories, persist the choice, return promptly as not applied with a reason, and avoid extra requests or an indefinite prerequisite wait. Normal startup or follow confirmation uses the latest device choice once eligible.
- Preserve existing account/backend scoping, generation invalidation, transactional writes, queue ordering, and failed-clear/follow cleanup barriers. No new account settings or backend capability contract is introduced.
- Keep retention eligibility based on publication time, with the exact cutoff included. Increasing the window cannot recover evicted history. Keep live online exposure distinct from what remains eligible for offline retention.
- The decode optimization targets the second visible-window restoration after initial restoration and history loading. Use SQL cleanup results or minimal visible-membership information to establish whether a visible update is necessary, without rereading release bodies merely to detect a change.
- Reuse unchanged loaded visible content. Update restored windows for relevant expiry, membership, or metadata changes. Equal retention-day values alone are insufficient evidence that the window is unchanged.
- Preserve the separate semantic contracts of Saved Visible Timeline and Connected Cached History. The initial visible restoration and retained-history load remain distinct responsibilities; retained records are not automatically authorized for exposure.
- Reuse the existing SQLite and device-preference storage implementations. No schema migration is required by the agreed behavior; avoid adding persistence solely to expose operation progress.
- Keep interface copy concise and use the existing error/retry presentation. Do not add explanatory labels for state already evident from the controls.

## Testing Decisions

- The primary seam is the same awaitable choose-and-apply operation Settings uses. This seam was explicitly agreed during design. Prefer existing provider overrides, the device preference adapters, and actual temporary SQLite databases; avoid parallel public interfaces only for tests.
- Execute commands, mount Settings, or exercise the existing Session facade and assert returned outcomes, rendered behavior, requests, visible releases, or persisted offline behavior. Never assert source-file text.
- Delay a required stage after the ledger updates and assert the operation remains pending. Release the stage and verify the returned result and visible state. Replace ledger polling as the application-completion oracle.
- Independently fail device preference writes and cache application. Verify per-submission outcomes and preservation of the current-run choice. Inject failures at synchronization, history loading/replay, and restored-window update, then verify complete same-value recovery through Retry saving.
- Observe outgoing requests and the Timeline Refresh Baseline during local application and retry. Assert no requests or baseline advancement attributable to these operations.
- Block another cache action, submit accepted choices of 7 and then 30 from an initial 30, and verify every result terminates and the final chosen, Session, and saved policies agree. Cover the case where the earlier decrease already committed without expecting deleted history to reappear.
- Mount Settings to verify pending-state locking and its release when the operation terminates. Preserve step-button and focus-loss submission behavior and existing invalid-input handling.
- Test missing session, unconfirmed follows, later normal eligibility, and session/account/backend changes during queued or active application. Assert prompt reasoned non-application and preservation of existing isolation and cleanup guarantees.
- On unchanged startup and retention-application paths, use executed query or existing adapter observations to demonstrate that the extra visible release-body read/decode is skipped. Verify reuse of the exposed content and correct public results. Do not freeze incidental helper-call counts or require every startup release to be decoded exactly once.
- Advance the existing injected clock across expiry, include a release exactly at the cutoff, and verify required restored-window updates. Preserve the existing online foreground cleanup contract that performs no saved-release decoding.
- Close and reopen actual temporary SQLite databases and inspect offline output through the public facade. Assert full notes, saved membership, device ownership, connected-history rules, follows additions/removals/renames, and failed-cleanup barriers.
- Prior art includes the existing retention startup-gate tests, pruning tests with malformed cached content proving no decode on online cleanup, disk-backed restoration/recovery/follow-cache tests, and mounted device-settings tests. Extend those patterns rather than building a parallel storage test framework.
- During implementation, run the relevant behavior tests, Flutter static analysis, Dart formatting checks, and the full Flutter suite. Run one Flutter test process at a time. Browser and native device runs are outside this specification's verification scope.

## Out of Scope

- Architecture-review candidates A and C.
- A general startup-performance project, a measured latency improvement claim, or a requirement that every release be decoded only once across startup.
- Merging visible-window restoration and retained pagination history into one semantic operation, or changing reconnection, follow-confirmation, account-isolation, and offline-visibility rules.
- A generic cache/storage framework, new backend APIs or capabilities, account-owned retention settings, or an unrelated schema redesign.
- Coalescing accepted choices into a latest-only queue, automatically fetching evicted history after a window increase, or adding network refresh to local retry.
- A new retention confirmation interaction, additional descriptive UI copy, or an automatic device-preference-file retry feature beyond the existing preference contract.
- Transactional rollback across the preference file, all cache stages, and visible state. Preserve existing transactional storage guarantees without promising recovery of already deleted history.
- Native device acceptance, browser testing, distribution builds, and implementation or publication of other review candidates.

## Further Notes

- This specification consolidates architecture-review candidate B with the verified redundant-read finding. The two acceptance criteria remain independently reviewable.
- The conditional startup sequence is: restore visible members, load all retained history, and restore visible members again while the view remains restored. The underlying pruning implementation already uses SQL without decoding release content; the additional decode is introduced by visible-window restoration.
- The initial cached view is exposed before the later reads. Duplicate work alone does not establish a first-render or startup bottleneck.
- Existing retention and pruning baseline tests were run during investigation: 10 of 10 passed. They do not establish the new completion, retry, scheduling, or unchanged-window optimization contracts.
- Existing cache documentation describes a confirm action, while current Settings submits step-button changes immediately and typed input on focus loss. Follow the current interaction and correct that documentation discrepancy during implementation.
- All seven design questions were accepted. The user explicitly requested publication as a specification; this issue describes work to implement, not work already implemented.
