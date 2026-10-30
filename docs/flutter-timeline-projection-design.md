# Flutter Release Timeline projection

The architecture review's candidate 03 identifies repeated assembly of related
Release Timeline view fields across online rounds, restoration, follow changes
and cache rebuilding. This design centralizes their ownership while preserving
observable behavior. The design was confirmed during the interview and is
implemented by `TimelineProjection` and the Timeline Session.

## Confirmed behavior

- Display filtering and search operate only on the exposed Shared Timeline
  Window. Disconnected retained history cannot enter results or counts.
- The loaded-new release count uses the filtered releases and the captured
  Timeline Refresh Baseline.
- Whether the baseline is exposed depends on the window boundary, independently
  of display filters. The UI positions the marker among the filtered cards.
- The Saved Visible Timeline is saved before display filtering. Offline readers
  can change filters to reveal other releases within that saved window.

These preserve the boundaries in [ADR 0016](./adr/0016-flutter-timeline-cache-reconnection.md)
and the search behavior in [ADR 0036](./adr/0036-server-owned-release-note-search-text.md).
Any discovered behavior defect requires a separate explicit decision.

## Confirmed module boundary

The projection module receives an already exposed window, its lower boundary,
the captured refresh baseline, and the current filter and search conditions. It
owns the filtered groups, loaded-new count, baseline exposure and reuse of
prepared search data.

Page merging and cache-history connection remain upstream: they determine which
releases belong to the exposed window. The Session retains requests, retries,
persistence, loading and failure state. This work does not move reading-position
coordination or page-commit bookkeeping into the projection module.

## Confirmed state ownership

`TimelineViewState` holds one immutable projection object. Window inputs and
derived results change together; callers cannot write `visibleGroups`,
`loadedNewCount` or `baselineExposed` independently. Existing consumers read the
same property names through read-only getters.

A shared calculation function with independently writable view fields was
rejected because every new update path would still need to maintain their
consistency manually.

## Window provenance and transitions

The projection carries the baseline and lower boundary of its own exposed
window. These inputs are independent of the Session's pagination cycle: offline
restoration publishes a saved window without populating that cycle. A failed
refresh retains the previous window's projection.

An empty window may still carry a baseline, so emptiness alone does not clear
the baseline. Preserve the current distinction between starting with no follows
(no baseline) and removing the final follow (retained baseline, no exposed
boundary, no marker). Retention pruning does not infer a new boundary from the
remaining cards.

## Search preparation

Preserve lazy search preparation and reuse for the same immutable source
window. Changing the query, notes switch or display filters reuses the prepared
source data. Replacing the window invalidates that reuse; signing out or
changing account or backend clears it. Clearing the query does not require
discarding reusable preparation. The module exposes immutable projections even
if its internal preparation cache has a lifecycle.

## Verification

Exercise real Timeline Session operations for filtering and search, online
refresh and partial failure, follow removal, offline restoration, retention
pruning and cache rebuilding. Assert exposed and filtered releases, loaded-new
counts and baseline exposure together. Preserve the existing checks that
filtering makes no requests, empty filtered results can load older releases,
and disconnected cached history cannot enter search or counts. Verify marker
placement through the existing layout behavior tests.

Migrate toolbar fixtures that currently supply a count without any releases to
construct valid projection inputs, including the large-count layout case.
Provide no production constructor that accepts contradictory derived fields for
test convenience. Verification uses Dart formatting, Flutter analysis and the
Flutter behavior suite alongside the repository's root checks.
