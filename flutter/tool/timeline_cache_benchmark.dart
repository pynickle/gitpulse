// Run with flutter test tool/timeline_cache_benchmark.dart --reporter expanded
// --dart-define=CACHE_BENCH_OUTPUT=<absolute JSON path>.
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:path/path.dart' as p;
import 'package:gitpulse/repositories/repository_models.dart';

const _scope = 'benchmark';
const _repo = RepositoryReference(id: 'R_a', owner: 'octo', name: 'alpha');
final _now = DateTime.utc(2026, 10, 25, 12);
final _environment = TimelineEnvironment(localDateKey: systemLocalDateKey);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('complete on-disk cache operations', () async {
    final directory = await Directory.systemTemp.createTemp('gitpulse-bench-');
    final output = <Map<String, Object?>>[];
    try {
      for (final size in [100, 1000, 3000]) {
        for (final expiredPercent in [0, 50, 90]) {
          final fixture = _fixture(size, expiredPercent);
          final visible = assembleTimelineGroups(
            [_repo],
            {
              _repo.id: RepositoryPage(
                status: RepositoryQueryStatus.available,
                releases: fixture
                    .expand((entry) => entry.page.releases)
                    .toList(),
                hasOlderReleases: true,
              ),
            },
            _environment,
          );
          final continued = _page(size, 100, expiredPercent: 0);
          final expanded = assembleTimelineGroups(
            [_repo],
            {
              _repo.id: RepositoryPage(
                status: RepositoryQueryStatus.available,
                releases: [
                  ...fixture.expand((entry) => entry.page.releases),
                  ...continued.releases,
                ],
                hasOlderReleases: true,
              ),
            },
            _environment,
          );
          const selected = String.fromEnvironment('CACHE_BENCH_OPERATIONS');
          final operations = selected.isEmpty
              ? ['initial', 'repeat', 'continue', 'prune', 'expire-save']
              : selected.split(',');
          for (final operation in operations) {
            final samples = <int>[];
            Map<String, int>? counts;
            // Two warmups followed by eleven independently prepared samples.
            for (var sample = -2; sample < 11; sample++) {
              final queries = _Queries();
              final path = p.join(directory.path, 'sample.sqlite');
              final cache = TimelineCache(
                driftDatabase(
                  name: 'timeline-cache-benchmark',
                  native: DriftNativeOptions(
                    databasePath: () async => path,
                    tempDirectoryPath: () async => directory.path,
                  ),
                ).interceptWith(queries),
              );
              try {
                await cache.synchronize(
                  scope: _scope,
                  retentionDays: 30,
                  repositories: [_repo],
                  now: _now,
                  isCurrent: () => true,
                );
                Future<void> save(
                  List<TimelineCachePage> pages,
                  List<TimelineGroup> groups,
                  String cycle, {
                  DateTime? at,
                }) => cache.save(
                  scope: _scope,
                  cycleId: cycle,
                  pages: pages,
                  groups: groups,
                  cycle: TimelineCycle(
                    windowLowerBound: 123,
                    previousBaseline: '2026-10-01T00:00:00Z',
                  ),
                  now: at ?? _now,
                  isCurrent: () => true,
                );
                if (operation != 'initial') {
                  await save(fixture, visible, 'seed');
                }
                queries.reset();
                final clock = Stopwatch()..start();
                switch (operation) {
                  case 'initial':
                    await save(fixture, visible, 'seed');
                  case 'repeat':
                    await save(fixture, visible, 'repeat');
                  case 'continue':
                    await save(
                      [
                        (
                          repositoryId: _repo.id,
                          cursor: 'p$size',
                          page: continued,
                        ),
                      ],
                      expanded,
                      'seed',
                    );
                  case 'prune':
                    await cache.prune(
                      scope: _scope,
                      now: _now.add(const Duration(days: 2)),
                      isCurrent: () => true,
                    );
                  case 'expire-save':
                    await save(
                      fixture,
                      visible,
                      'repeat',
                      at: _now.add(const Duration(days: 2)),
                    );
                }
                clock.stop();
                if (sample >= 0) {
                  samples.add(clock.elapsedMicroseconds);
                  counts = queries.summary;
                }
                // Sanity check public restoration outside the measured interval.
                final saved = await cache.restore(
                  scope: _scope,
                  now: _now,
                  environment: _environment,
                );
                expect(
                  saved?.savedAt,
                  operation == 'expire-save'
                      ? _now.add(const Duration(days: 2))
                      : _now,
                );
                if (size == 100 &&
                    expiredPercent == 0 &&
                    sample == 0 &&
                    operation == 'initial') {
                  output.add({'diagnostics': await _diagnostics(cache)});
                }
              } finally {
                await cache.close();
                for (final suffix in ['', '-wal', '-shm', '-journal']) {
                  final file = File('$path$suffix');
                  if (await file.exists()) await file.delete();
                }
              }
            }
            samples.sort();
            final row = <String, Object?>{
              'size': size,
              'expiredPercent': expiredPercent,
              'operation': operation,
              'medianUs': samples[5],
              'p95Us': samples[10],
              'samplesUs': samples,
              ...counts!,
            };
            output.add(row);
            // ignore: avoid_print
            print(jsonEncode(row));
          }
        }
      }
      const target = String.fromEnvironment('CACHE_BENCH_OUTPUT');
      if (target.isNotEmpty) {
        await File(target).writeAsString(
          const JsonEncoder.withIndent('  ').convert({
            'os': Platform.operatingSystemVersion,
            'dart': Platform.version,
            'results': output,
          }),
        );
      }
    } finally {
      await directory.delete(recursive: true);
    }
  }, timeout: const Timeout(Duration(minutes: 15)));
}

List<TimelineCachePage> _fixture(int size, int expiredPercent) => [
  for (var offset = 0; offset < size; offset += 100)
    (
      repositoryId: _repo.id,
      cursor: offset == 0 ? null : 'p$offset',
      page: _page(
        offset,
        math.min(100, size - offset),
        expiredPercent: expiredPercent,
      ),
    ),
];

RepositoryPage _page(int offset, int count, {required int expiredPercent}) =>
    RepositoryPage(
      status: RepositoryQueryStatus.available,
      owner: 'octo',
      name: 'alpha',
      hasOlderReleases: true,
      endCursor: 'p${offset + count}',
      releases: [
        for (var i = offset; i < offset + count; i++)
          ReleaseItem(
            id: i,
            tagName: 'v$i',
            name: 'Release $i',
            description: 'Complete release notes. ' * 40,
            notesSearchText: 'complete release notes. ' * 40,
            // All rows are initially retained. Advancing two days expires the chosen
            // fraction during prune; save still writes the same number of rows.
            publishedAt: _now.subtract(
              Duration(days: i % 100 < expiredPercent ? 29 : 1),
            ),
            isDraft: false,
            isPrerelease: false,
            assetCount: 2,
            htmlUrl: 'https://github.com/octo/alpha/releases/tag/v$i',
          ),
      ],
    );

Future<Map<String, Object?>> _diagnostics(TimelineCache cache) async => {
  'sqlite':
      (await cache.customSelect('SELECT sqlite_version() AS v').getSingle())
          .read<String>('v'),
  'journal': (await cache.customSelect('PRAGMA journal_mode').getSingle()).data,
  'plans': {
    for (final sql in [
      'DELETE FROM cache_releases WHERE published_at < 1',
      "SELECT id FROM cache_segments WHERE repository_id = 'R_a' AND cycle = 'seed'",
      "SELECT id FROM cache_segments WHERE repository_id = 'R_a' AND cycle = 'seed' AND request_cursor IS NULL AND id != 1",
      '''DELETE FROM cache_segments WHERE NOT EXISTS (
      SELECT 1 FROM cache_page_members m JOIN cache_segments s ON s.id = m.segment_id
      WHERE s.repository_id = cache_segments.repository_id AND s.cycle = cache_segments.cycle)''',
    ])
      sql: [
        for (final row
            in await cache.customSelect('EXPLAIN QUERY PLAN $sql').get())
          row.data,
      ],
  },
};

class _Queries extends QueryInterceptor {
  int executions = 0;
  int calls = 0;
  int batches = 0;
  int templates = 0;
  Map<String, int> get summary => {
    'executions': executions,
    'executorCalls': calls,
    'batches': batches,
    'batchTemplates': templates,
  };
  void reset() {
    executions = calls = batches = templates = 0;
  }

  void single() {
    executions++;
    calls++;
  }

  @override
  Future<void> runCustom(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) {
    single();
    return executor.runCustom(statement, args);
  }

  @override
  Future<int> runInsert(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) {
    single();
    return executor.runInsert(statement, args);
  }

  @override
  Future<List<Map<String, Object?>>> runSelect(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) {
    single();
    return executor.runSelect(statement, args);
  }

  @override
  Future<void> runBatched(
    QueryExecutor executor,
    BatchedStatements statements,
  ) {
    calls++;
    batches++;
    executions += statements.arguments.length;
    templates += statements.statements.length;
    return executor.runBatched(statements);
  }
}
