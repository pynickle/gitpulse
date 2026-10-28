# Flutter timeline cache write measurements

Issue [#142](https://github.com/pynickle/gitpulse/issues/142), measured on
2026-10-28. Baseline: `9411d51c5a5e75b62a95ce19918aff9df485985f`.

The retained implementation adds the two query-matched indexes, uses Drift's
generated-ID insert and ordered per-page row batches, and replaces the complete
visible membership with joined `VALUES` chunks of at most 300 rows / 900 parameters.
The cache interface, save transaction, queue, validity checks and session-owned
page journal remain in place. Refresh and pagination still await the save attempt.

On this host, full saves improved across the measured shapes. Pruning with many
expired rows was dominated by deletion work and showed little improvement at the
largest size. These results support retaining this candidate; they establish
neither Android performance nor a fixed speedup on other devices. No additional
set-based content/page-member candidate was selected or measured: those writes
remain ordered row executions inside each page's batch.

## Environment and method

- Windows 11 build 26200, x64; AMD Ryzen 7 5800H, 8 cores / 16 logical processors.
- Flutter 3.47.8 stable, Dart 3.13.7, Drift 2.35.3, drift_flutter 0.3.1,
  SQLite 3.54.1; SQLite journal mode `delete` with default connection settings.
- Run through `flutter test`, using actual temporary on-disk SQLite files.
  `driftDatabase` and `DriftNativeOptions` are the production connection path:
  `NativeDatabase.createBackgroundConnection`, with SQL on a background isolate.
  Only the database and temporary directory paths are redirected to test-owned
  directories. No developer cache is opened or removed.
- One repository, histories of 100 / 1,000 / 3,000 releases, pages of 100, about
  960 characters of complete notes per release. Visible membership contains the
  whole history (100 / 1,000 / 3,000); continuation expands it by another 100.
- Two warmups per scenario, then 11 independent samples. Each sample opens a new
  database, synchronizes policy/follows and prepares its seed outside the timer.
  DTO creation, group assembly, connection opening, schema installation, fixture
  seeding, verification, close and file removal are excluded. The timed interval
  awaits the public `save()` or `prune()` Future, including its queue, transaction,
  metadata, final pruning, compaction and commit.
- `initial` saves into an empty synchronized database. `repeat` seeds the complete
  graph then saves it in a new cycle, including duplicate-graph compaction.
  `continue` seeds the graph then adds one page in the same cycle while replacing
  the enlarged visible membership. These three operations use the fixture clock.
- `prune` and `expire-save` advance that clock by two days. Respectively 0%, 50%
  or 90% of the seed's publications are 29 days old at setup; the others are one
  day old. With 30-day retention, the selected fraction expires at measurement.
  `expire-save` repeats the full graph at that later time: it includes ordered
  expiry deletions, eligibility filtering, visible replacement and final pruning.
  Earlier save scenarios retain all records, regardless of the age mix.
- Measurements were serial, baseline before optimized. The four original
  scenarios and the added `expire-save` scenario ran in separate invocations
  with the same runner and fixtures. Some baseline samples overlapped development
  tooling, so host load and JIT warmup are possible confounders. These are useful
  desktop observations, not controlled hardware or owner-manual device acceptance.
- Median is sample 6 after sorting. p95 is nearest-rank sample 11 (the maximum
  with this sample count), so tails have limited precision. Raw microsecond samples,
  operation counts and query plans are retained in
  [baseline JSON](flutter-timeline-cache-writes-baseline.json) and
  [optimized JSON](flutter-timeline-cache-writes-optimized.json).

## Complete operation times

Ratio is baseline median divided by optimized median. Values above 1 indicate a
shorter optimized interval; no threshold is asserted by the tests.

| Releases | Expire % | Operation   | Before median / p95 (ms) | After median / p95 (ms) | Median ratio |
| -------- | -------- | ----------- | ------------------------ | ----------------------- | ------------ |
| 100      | 0        | initial     | 69.22 / 88.49            | 19.15 / 36.26           | 3.61×        |
| 100      | 0        | repeat      | 55.20 / 64.56            | 18.72 / 20.16           | 2.95×        |
| 100      | 0        | continue    | 62.05 / 64.07            | 16.74 / 17.48           | 3.71×        |
| 100      | 0        | prune       | 2.99 / 3.88              | 2.93 / 3.33             | 1.02×        |
| 100      | 0        | expire-save | 63.25 / 82.15            | 21.07 / 22.73           | 3.00×        |
| 100      | 50       | initial     | 48.36 / 53.48            | 16.54 / 21.49           | 2.92×        |
| 100      | 50       | repeat      | 52.99 / 60.48            | 17.22 / 19.64           | 3.08×        |
| 100      | 50       | continue    | 60.78 / 68.05            | 16.10 / 16.91           | 3.78×        |
| 100      | 50       | prune       | 12.60 / 13.65            | 11.76 / 12.97           | 1.07×        |
| 100      | 50       | expire-save | 43.65 / 55.57            | 17.80 / 22.32           | 2.45×        |
| 100      | 90       | initial     | 52.11 / 55.33            | 14.89 / 15.80           | 3.50×        |
| 100      | 90       | repeat      | 57.43 / 62.11            | 16.72 / 21.98           | 3.44×        |
| 100      | 90       | continue    | 66.46 / 76.37            | 15.79 / 21.00           | 4.21×        |
| 100      | 90       | prune       | 16.88 / 18.00            | 12.11 / 13.13           | 1.39×        |
| 100      | 90       | expire-save | 36.80 / 46.73            | 16.53 / 21.19           | 2.23×        |
| 1,000    | 0        | initial     | 344.88 / 415.47          | 40.47 / 41.98           | 8.52×        |
| 1,000    | 0        | repeat      | 340.24 / 348.83          | 64.74 / 70.77           | 5.26×        |
| 1,000    | 0        | continue    | 133.20 / 137.25          | 20.80 / 21.44           | 6.40×        |
| 1,000    | 0        | prune       | 3.46 / 3.77              | 3.21 / 3.65             | 1.08×        |
| 1,000    | 0        | expire-save | 451.61 / 492.49          | 68.25 / 69.20           | 6.62×        |
| 1,000    | 50       | initial     | 342.47 / 390.78          | 40.54 / 42.22           | 8.45×        |
| 1,000    | 50       | repeat      | 375.17 / 413.67          | 64.50 / 65.72           | 5.82×        |
| 1,000    | 50       | continue    | 146.85 / 169.74          | 20.18 / 22.02           | 7.28×        |
| 1,000    | 50       | prune       | 23.33 / 25.08            | 18.05 / 19.06           | 1.29×        |
| 1,000    | 50       | expire-save | 362.02 / 450.96          | 49.93 / 53.46           | 7.25×        |
| 1,000    | 90       | initial     | 317.73 / 335.75          | 34.60 / 36.19           | 9.18×        |
| 1,000    | 90       | repeat      | 355.45 / 360.37          | 57.18 / 59.36           | 6.22×        |
| 1,000    | 90       | continue    | 139.04 / 143.29          | 20.87 / 21.54           | 6.66×        |
| 1,000    | 90       | prune       | 28.00 / 29.13            | 26.57 / 27.80           | 1.05×        |
| 1,000    | 90       | expire-save | 328.05 / 363.26          | 37.81 / 40.26           | 8.68×        |
| 3,000    | 0        | initial     | 977.69 / 1099.74         | 106.83 / 115.27         | 9.15×        |
| 3,000    | 0        | repeat      | 1096.70 / 1201.71        | 186.77 / 213.64         | 5.87×        |
| 3,000    | 0        | continue    | 408.98 / 650.02          | 29.46 / 30.84           | 13.88×       |
| 3,000    | 0        | prune       | 13.71 / 15.78            | 4.36 / 4.62             | 3.15×        |
| 3,000    | 0        | expire-save | 1040.09 / 1341.64        | 193.96 / 197.34         | 5.36×        |
| 3,000    | 50       | initial     | 1294.03 / 1429.63        | 104.06 / 120.42         | 12.44×       |
| 3,000    | 50       | repeat      | 1371.19 / 1752.48        | 193.84 / 211.11         | 7.07×        |
| 3,000    | 50       | continue    | 470.09 / 534.53          | 30.92 / 39.31           | 15.20×       |
| 3,000    | 50       | prune       | 57.75 / 63.51            | 55.89 / 63.92           | 1.03×        |
| 3,000    | 50       | expire-save | 828.19 / 856.77          | 135.37 / 143.46         | 6.12×        |
| 3,000    | 90       | initial     | 1247.67 / 1381.28        | 110.12 / 116.21         | 11.33×       |
| 3,000    | 90       | repeat      | 1044.45 / 1446.06        | 212.54 / 218.67         | 4.91×        |
| 3,000    | 90       | continue    | 331.42 / 367.59          | 30.99 / 33.34           | 10.70×       |
| 3,000    | 90       | prune       | 68.21 / 71.44            | 68.65 / 73.45           | 0.99×        |
| 3,000    | 90       | expire-save | 653.81 / 670.70          | 93.45 / 96.34           | 7.00×        |

At 3,000 releases / 90% expiry, prune changed from 68.21 to 68.65 ms median,
and 71.44 to 73.45 ms p95. At 50% expiry its p95 changed from 63.51 to 63.92 ms.
These small regressions do not support claiming uniformly faster pruning. The
same 90% fixture's full expiry save improved from 653.81 to 93.45 ms median.
The indexes add maintenance work to release writes; that cost is included in the
full-operation measurements, where the combined candidate remains beneficial.
The surviving correlated outer segment scan and deletion of releases, visible
members and page members explain why a better lookup plan alone promises little
when most rows need removal. No broader cleanup rewrite was added.

## Supporting execution and query-plan evidence

Counts below are for the zero-expiry shapes. They exclude SQLite transaction
control and connection setup. `executorCalls` counts query-executor invocations,
including a whole batch as one call; it is a proxy for asynchronous/isolate work,
not a trace of every isolate message or Dart await. SQL executions count every
argument row inside a batch separately.

| Releases | Operation | SQL executions before → after | Executor calls before → after | Batches after |
| -------- | --------- | ----------------------------- | ----------------------------- | ------------- |
| 100      | initial   | 314 → 214                     | 314 → 13                      | 1             |
| 1,000    | initial   | 3,059 → 2,053                 | 3,059 → 43                    | 10            |
| 3,000    | initial   | 9,159 → 6,139                 | 9,159 → 109                   | 30            |
| 3,000    | repeat    | 9,161 → 6,141                 | 9,161 → 111                   | 30            |
| 3,000    | continue  | 3,314 → 224                   | 3,314 → 23                    | 1             |
| 3,000    | prune     | 6 → 6                         | 6 → 6                         | 0             |

An ordinary retained page uses four templates in one batch: content upsert,
member insertion and two repeated-page cleanup statements. A page with mixed
eligible/expired input uses a fifth deletion template. The batch executes each
row in its original order; it does not turn all rows into one SQLite statement.
The separate visible-membership chunks reduce statement executions, and direct
segment insertion removes one `last_insert_rowid()` select per page.

`EXPLAIN QUERY PLAN` used the actual schema, the expiry delete, cycle and repeated
page lookup subqueries, and the cycle-aware orphan-segment delete. These are
diagnostics, with no permanent assertion on SQLite plan wording:

| Query                                    | Baseline                                  | Indexed                                                          |
| ---------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Release expiry                           | Release table scan                        | `cache_releases_published_at` range search                       |
| Repository + cycle                       | Segment table scan                        | Composite covering index, first two columns                      |
| Repository + cycle + null request cursor | Segment table scan                        | Composite covering index, all three columns                      |
| Cycle-aware orphan-segment delete        | Outer segment scan and inner segment scan | Outer scan remains; inner repository/cycle covering-index search |

The existing member primary-key index still handles segment-member lookup.
Keeping empty continuation nodes while a cycle has retained members is unchanged.
Schema version 3 installs the indexes on new databases and through the existing
upgrade path; committed Drift output is regenerated from the schema declaration.

## Reproduce

From `flutter/`, run the checked-in runner (Flutter is required because the cache
module includes Flutter providers):

```powershell
flutter test tool/timeline_cache_benchmark.dart --reporter expanded --dart-define=CACHE_BENCH_OUTPUT=D:/Temp/cache-optimized.json
```

The output parent directory must exist. Omit the output define for console JSON.
To measure only expiry saves, add `--dart-define=CACHE_BENCH_OPERATIONS=expire-save`;
a comma-separated subset of `initial,repeat,continue,prune,expire-save` is supported.

For a baseline, create a disposable checkout at the fixed revision, copy only the
same benchmark runner into it, and install its pinned Flutter dependencies:

```powershell
git worktree add --detach D:/Temp/gitpulse-cache-baseline 9411d51c5a5e75b62a95ce19918aff9df485985f
Copy-Item flutter/tool/timeline_cache_benchmark.dart D:/Temp/gitpulse-cache-baseline/flutter/tool/timeline_cache_benchmark.dart
Push-Location D:/Temp/gitpulse-cache-baseline/flutter
flutter pub get --enforce-lockfile
flutter test tool/timeline_cache_benchmark.dart --reporter expanded --dart-define=CACHE_BENCH_OUTPUT=D:/Temp/cache-baseline.json
Pop-Location
```

Run the variants serially under comparable host load. Compare the same operation,
history size and expiry fraction. Keep fixture setup outside the measured interval.

## Behavior verification

`timeline_cache_writes_test.dart` exercises the public cache and timeline facade
with actual background SQLite connections: loading completion, readable results
after failure, local retry without network/baseline changes, later saves including
previously unsaved pages, pre-filter membership, full notes and oldest markers,
exact cutoff and online-only exclusions, multi-chunk and empty membership,
ordered duplicate/update/unpublication/expiry handling, repeated null/non-null
cursors, empty continuation nodes, suffix-sensitive graph compaction, late write
failure rollback and clear/account/generation invalidation after mutations begin.
Assertions use restored content/history or observable timeline state.

The existing follow-cache suite reconstructs versions 1 and 2 before reopening,
and verifies saved content and retention survive upgrade. The broader behavior
suite continues to cover reconnection, authoritative exhaustion, incomplete/error
pages, failed cleanup barriers, retention replay, offline startup and rebuild.

Verification completed on this host:

- `flutter analyze --no-pub`: no issues.
- `dart format --output=none --set-exit-if-changed lib test tool/timeline_cache_benchmark.dart`: unchanged.
- Targeted write/follow-cache suites: 26 tests passed; full `flutter test`: 506 passed.
- Root format, lint and Nuxt typecheck passed; `bun test --parallel`: 983 passed.
- Both benchmark variants completed all 45 scenarios, each with 11 measured samples.

References: [Drift writes and batches](https://drift.simonbinder.eu/dart_api/writes/),
[Drift SQL schemas](https://drift.simonbinder.eu/sql_api/drift_files/),
[SQLite limits](https://www.sqlite.org/limits.html).
