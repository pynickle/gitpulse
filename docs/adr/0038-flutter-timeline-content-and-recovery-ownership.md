---
status: accepted
---

# Keep Flutter timeline content and recovery under one owner

The timeline's fetched-page journal, commit progress and cache connection are coupled to the current unfiltered content: rebuild, retention application and follow changes update them together. Place them in one content module inside the app-facing timeline session, including save/retry/rebuild/restore/clear/prune orchestration. Prefer this complete ownership over a journal-only extraction or a recovery coordinator that exchanges mutable content snapshots with session; both leave callers coordinating the state that recovery needs.

The app-facing session remains the adapter for account/network lifecycle and presentation, with its existing generation authority. Device preferences keep installation-owned choices, the choose-and-apply facade preserves ordered preference/application results, and the cache module keeps SQL, transactions and account isolation. Preserve existing completion, admission, retry and invalidation behavior; the refactor changes ownership rather than timeline semantics.

See the [design and behavioral acceptance criteria](../flutter-timeline-cycle-recovery-design.md). The user selected the best complete architecture without considering refactoring cost and confirmed implementation of this design.
