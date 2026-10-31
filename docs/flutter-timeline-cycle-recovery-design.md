# Flutter timeline cycle recovery

Design for architecture review candidate 04, “封装当前轮次的页面记录与提交进度”. The user chose behavior preservation, complete recovery ownership, and the best complete architecture without considering refactoring cost, then confirmed implementation.

## Agreed scope

- Preserve existing behavior, including refresh/load-older completion after the local save attempt, known local-save retries without fetching or advancing the refresh baseline, and recovery of every uncommitted fetched page. Preserve the existing uninitialized-retention fallback described below.
- Choose a recovery module that owns save, local retry, rebuild and retention-window application orchestration, rather than extracting only page storage and a committed-page counter. The aim is to concentrate recovery rules as well as their state.
- Prefer complete ownership and a coherent final design over minimizing edits or preserving the current internal interface. This is permission to design the full affected lifecycle, not to change product behavior.

## Existing constraints

[Timeline cache behavior](flutter-timeline-cache.md), [ADR 0016](adr/0016-flutter-timeline-cache-reconnection.md) and [ADR 0024](adr/0024-flutter-device-timeline-cache-retention.md) remain authoritative. The new module is internal to the timeline session boundary; this design does not transfer SQL or account isolation out of the cache module.

A current cycle spans a usable refresh and its subsequent pagination/retry rounds. Its journal records actual returned pages in reception order. Connected cached extensions are not fetched pages. These are implementation concepts, not additions to the domain vocabulary in `CONTEXT.md`.

## Selected architecture

Use one account-scoped timeline content module, internal to the app-facing timeline session. It owns both current content and recovery state. Internally, a cycle model concentrates page acceptance and replay; recovery orchestration operates on that same model. This avoids a recovery-only module taking mutable cycle/groups snapshots from session and sending replacements back.

The existing app-facing session becomes the adapter for account lifecycle, remote loading and presentation. Its rendered projection is derived from the content module's read-only snapshot and the user's current filters, rather than a second writable copy of timeline content.

| Owner                     | Responsibility                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeline content module   | Current cycle and unfiltered groups; fetched-page journal and cycle ID; commit acknowledgement; retained-history connection; restored saved window; synchronization, corruption and unfinished-retention state; save, local retry, replay, rebuild, restore, clear and prune orchestration. |
| App-facing session        | Account/backend lifecycle and its existing generation authority; remote request execution; current filters, search and reading position integration; presentation notifications.                                                                                                            |
| Device preferences module | Installation-owned retention choice, persistence and preference-write result, alongside the other device choices.                                                                                                                                                                           |
| Choose-and-apply facade   | Ordered execution of each complete choice: remember the preference, then await local application and report the two outcomes separately. It may remain an app-facing session command.                                                                                                       |
| Cache module              | SQL, database transactions and queue, pruning implementation, provenance storage, cleanup barriers and account isolation.                                                                                                                                                                   |

### Interface and completion

Expose semantic commands for accepting a fetched round, updating confirmed follows, restoring history, applying a retention window, retrying saving, rebuilding, clearing and pruning. Method spelling is an implementation choice. Do not expose setters for journal counters or require callers to perform recovery steps in a particular order.

Commands operate on the module's single content model and publish read-only changes. Fresh accepted content and a fetched-only rebuilt window become readable before their save attempt completes. The command's Future completes after that attempt, allowing the facade to preserve loading semantics. A final return value alone is insufficient to express these intermediate readable states.

Recovery outcomes preserve partial progress: a successful preference write survives a cache failure; pruning already committed is not rolled back; a failed save retains its uncommitted fetched pages and the previous saved timestamp. Display filters never narrow saved membership, and an asynchronous completion uses the user's current filters.

### Lifecycle rules

- A usable fresh window starts a new cycle. A wholly failed refresh keeps the previous readable content and journal. Later pagination and repository retries continue the current cycle.
- Record actual returned pages in reception order, including failed or incomplete page records within an accepted usable round. Cached extensions participate in content calculation without entering the fetched-page journal.
- Confirm only successfully saved fetched pages after the existing validity checks pass. Later saves include all earlier unconfirmed pages.
- On follow removal, retain surviving journal entries and recompute their committed prefix together. Rename/reorder updates metadata without fetching. Follow additions invalidate the previous timeline before loading fresh first pages, preserving the existing failed-cleanup restore barrier.
- Rebuild replaces the database, clears commit acknowledgement and retained extensions, and reconstructs content from actual fetched pages. It preserves the current filters, failure information and baseline, then attempts saving again.
- Account/backend changes, sign-out and clear invalidate obsolete work using the existing session generation and cache validity checks. After admission, operations such as rebuild request lifecycle invalidation through that same authority; there is no second account generation.
- Resolve the installation's retention choice before local writes. Apply a changed window by completing unfinished synchronization/saving, replaying the fetched chain, pruning and updating a restored window. Ordinary resume pruning remains local and does not refresh the currently read online timeline.

### Dependencies and ordering

Page acceptance, merging and replay are in-process implementation. SQLite and device preference files are local-substitutable dependencies. Retain the existing cache interface and real SQLite test adapters; no new remote protocol or generic event framework is needed.

Resolve the active cache when needed rather than permanently capturing its instance: rebuild closes and replaces the database. Keep clocks and environment dependencies replaceable through existing seams. Pass a narrowly scoped operation context for session validity and lifecycle invalidation, not an object exposing all session fields or arbitrary setters.

Preserve the three existing scheduling policies separately: complete retention choices execute in submission order; ordinary cache actions are ignored when another cache action is busy while designated startup/follow/choice paths wait; SQL operations remain serialized with their cleanup barriers. Unifying ownership does not merge these into one queue or change whether a command waits, executes or is ignored.

### Existing retry fallback

`retryCache()` currently calls `refresh()` when the retention window remains unresolved, after earlier retention-retry and saved-window-restore branches. Timeline and Settings bind their cache retry actions to this method, but an execution demonstrating the fallback through the rendered UI has not been established; ordinary save-failure retries already have a resolved window.

Preserve this existing branch under behavior preservation. The local content module requests initialization through an awaitable callback; the app-facing facade supplies the existing refresh fallback. The cache-action admission remains held until initialization completes, preserving busy-action behavior. Do not inject a remote transport into local recovery for this branch. The documentation's general statement that known local retries do not fetch remains the normal contract; this uninitialized branch is an implementation exception that must not silently become a new behavior decision.

## Alternatives considered

1. Extract journal storage and counters only. This leaves retry/rebuild/retention orchestration scattered and does not meet the user's choice of complete recovery ownership.
2. Extract a recovery coordinator while session keeps mutable cycle/groups. Recovery must repeatedly obtain and replace content across the seam, with intermediate updates and wide callbacks or snapshots. This improves locality partially but leaves two cooperating state owners.
3. Own current content and recovery together, with explicit commands and read-only publication. This is selected: it concentrates both state transitions and recovery rules while keeping device persistence, SQL and remote transport with their existing owners.

Avoid a generic command bus or a single giant dispatch method introduced merely to reduce the public method count. Interface depth includes ordering and failure knowledge, not just the number of methods.

## Behavioral acceptance

Keep existing public-facade, mounted-action and actual SQLite close/reopen coverage. Add focused combinations that exercise the newly unified responsibilities:

- A failed page save followed by another successful page saves both and survives reopening, including page-cursor provenance.
- Multiple fetched pages plus a connected cached extension followed by rebuild restore only the fetched content, without certifying the discarded extension as fetched history.
- A failed save followed by follow removal, rename/reorder and retry/rebuild or retention application preserves every surviving fetched page, correct metadata and valid commit progress on reopening.
- Preference persistence and cache application fail independently; queued choices keep their existing order, partial cleanup remains retryable and retry does not advance the refresh baseline.
- Delayed recovery overtaken by clear, refresh, follow addition, sign-out, account or backend changes cannot publish or persist obsolete content. Busy-action admission and loading completion remain unchanged.
- Fresh content stays readable during a save; rebuilt content stays readable if its subsequent save fails; current filters survive delayed recovery.

Test through the content interface and app-facing facade with actual temporary SQLite databases and existing local adapters. Assert observable content, requests, timestamps and reopened history. Retain tests with distinct integration coverage; remove only obsolete internal tests whose behavior is covered at the new seam.

## Implementation

`TimelineContentController` in `flutter/lib/timeline/timeline_content.dart` owns the current content and recovery lifecycle. Its private fetched-page journal in `timeline_content_journal.dart` concentrates append, commit acknowledgement, repository retention and both forms of replay. `TimelineContentState` publishes an immutable unfiltered window; `ReleaseTimelineSession` derives the presentation projection with current filters and retains account/network and device-choice coordination.

The linked [ADR](adr/0038-flutter-timeline-content-and-recovery-ownership.md) records the accepted ownership decision. Keep `CONTEXT.md` as the repository's domain glossary; journal, commit acknowledgement and recovery commands are implementation concepts and do not warrant new glossary entries.
