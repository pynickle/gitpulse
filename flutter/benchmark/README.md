# Timeline cache restore benchmark

From `flutter/`, run the same benchmark file against each implementation:

```sh
flutter test --no-pub benchmark/timeline_cache_restore_benchmark.dart --dart-define=BENCHMARK_LABEL=before --reporter expanded
flutter test --no-pub benchmark/timeline_cache_restore_benchmark.dart --dart-define=BENCHMARK_LABEL=after --reporter expanded
```

Use the original `timeline_cache.dart` for `before` and the grouped implementation
for `after`; the label only names the output. The original implementation for the
measurement below is at `66a306ba23c924a7d5c00c84783025950540a3a0`.

The deterministic fixture contains 100 repositories, each with 100 releases,
overlapping release IDs and publication times, and roughly 1.1 KB of notes per
release. It uses a fixed UTC clock, 30-day retention and in-memory SQLite populated
through `synchronize` and `save`. All releases are within retention. Each run warms
up 10 times and measures 30 complete `restore` calls, including queueing,
transactions, pruning, SQLite reads, JSON decoding, assembly and sorting. Setup
and full-field result validation are outside the stopwatch. The reported median
uses the upper middle sample. This benchmark runs explicitly, outside `flutter test`'s
default `test/` suite.

Measured on Windows on 2026-10-25 with Flutter 3.47.7 / Dart 3.13.5 in the Flutter
test runner (JIT), with no concurrent analysis or test suites:

| Implementation | Median (ms) | P90 (ms) | Mean (ms) |
| --- | ---: | ---: | ---: |
| Per-repository `rows.where` | 740.773 | 800.955 | 745.161 |
| Single-pass grouping | 295.749 | 331.195 | 294.522 |

The median fell by 60.1% (about 2.50× faster). Every iteration matched all expected
timeline fields. Both runs reported content SHA-256
`2eb8529c2e2328897cc20ebc8413d475b3df5e694aafb3dd642a65980bc2f633`.
These are local warm-cache measurements, not device startup or release-build
latency guarantees. Retention, pruning and cache membership policies are unchanged.
