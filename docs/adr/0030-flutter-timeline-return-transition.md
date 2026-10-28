---
status: accepted
---

# Bound distant Flutter Timeline returns with a content transition

Long-distance return to top previously scrolled through variable-height release
cards in 240ms. The user accepts skipping intermediate history to keep the
animation light and has approved a roughly 360ms fade and small content movement.

Use the existing 120ms fade and 240ms movement durations in sequence. While the
list is invisible, clear its reading center and recreate both its scroll controller
and center layout key at the actual first row. Retaining the center GlobalKey
would transplant the old sliver layout and rebuild skipped rows in one frame.
This avoids traversing intermediate card windows and avoids
treating a restored centered sliver's estimated negative extent as an exact top.
Nearby returns without a restored reading center retain continuous scrolling.

Register `GitPulseMotion.timelineReturnShift = 12dp` as a paint-only motion role.
Layout-spacing tokens describe other jobs and must not double as motion values.
Only the list moves; toolbar and floating-control layout remain stable. System
reduced motion skips the transition, and manual input cancels it.

This partly supersedes the continuous-240ms rule in the Timeline refresh and
navigation design/spec. It does not change refresh, filtering, pagination, cache,
or Timeline Refresh Baseline semantics. Device frame rate remains owner-verified;
widget tests establish behavior and bounded traversal, not Android frame timings.
