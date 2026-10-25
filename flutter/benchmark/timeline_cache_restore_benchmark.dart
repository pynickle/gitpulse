// Run explicitly: flutter test --no-pub benchmark/timeline_cache_restore_benchmark.dart
//   --dart-define=BENCHMARK_LABEL=before --reporter expanded
// Run the identical file and dataset before and after changing restore.
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_models.dart';

void main() {
  test('measure complete restore with 100 repositories and 10000 releases', () async {
    const repositoryCount = 100;
    const releasesPerRepository = 100;
    const warmups = 10;
    const samples = 30;
    const label = String.fromEnvironment(
      'BENCHMARK_LABEL',
      defaultValue: 'current',
    );
    const scope = 'restore-benchmark';
    final now = DateTime.utc(2026, 10, 25, 12);
    final environment = TimelineEnvironment(
      localDateKey: (instant) =>
          instant.toUtc().toIso8601String().substring(0, 10),
    );
    final cache = TimelineCache(NativeDatabase.memory());
    addTearDown(cache.close);
    final repositories = [
      for (var i = 0; i < repositoryCount; i++)
        TimelineRepository(
          id: 'R_${i.toString().padLeft(3, '0')}',
          owner: 'owner$i',
          name: 'repo$i',
        ),
    ];
    final notes = 'Release notes. ' * 80;
    final pages = {
      for (final repository in repositories)
        repository.id: RepositoryPage(
          status: RepositoryPageStatus.available,
          owner: repository.owner,
          name: repository.name,
          hasOlderReleases: true,
          releases: [
            for (var i = 0; i < releasesPerRepository; i++)
              ReleaseItem(
                id: i,
                tagName: 'v$i',
                name: 'Release $i',
                description: '${repository.id}:$i\n$notes',
                publishedAt: now.subtract(Duration(hours: i)),
                isDraft: false,
                isPrerelease: i.isOdd,
                assetCount: i % 5,
                htmlUrl:
                    'https://github.com/${repository.fullName}/releases/tag/v$i',
              ),
          ],
        ),
    };
    final groups = assembleTimelineGroups(repositories, pages, environment);
    final expected = _content(groups);
    await cache.synchronize(
      scope: scope,
      retentionDays: 30,
      repositories: repositories,
      now: now,
      isCurrent: () => true,
    );
    await cache.save(
      scope: scope,
      cycleId: 'benchmark',
      pages: [
        for (final entry in pages.entries)
          (repositoryId: entry.key, cursor: null, page: entry.value),
      ],
      groups: groups,
      cycle: TimelineCycle.empty,
      now: now,
      isCurrent: () => true,
    );

    final timings = <int>[];
    for (var i = 0; i < warmups + samples; i++) {
      final watch = Stopwatch()..start();
      final restored = (await cache.restore(
        scope: scope,
        now: now,
        environment: environment,
      ))!;
      watch.stop();
      if (i >= warmups) timings.add(watch.elapsedMicroseconds);
      // Validation is outside the timed section; every release field must match.
      expect(_content(restored.groups), expected);
      expect(restored.repositories, repositories);
      expect(restored.retentionDays, 30);
    }
    timings.sort();
    final mean = timings.reduce((a, b) => a + b) / timings.length;
    // ignore: avoid_print
    print(
      '$label: repositories=$repositoryCount releases=${repositoryCount * releasesPerRepository} '
      'warmups=$warmups samples=$samples '
      'median_ms=${(timings[samples ~/ 2] / 1000).toStringAsFixed(3)} '
      'p90_ms=${(timings[(samples * .9).ceil() - 1] / 1000).toStringAsFixed(3)} '
      'mean_ms=${(mean / 1000).toStringAsFixed(3)} '
      'content_sha256=${sha256.convert(utf8.encode(expected))}',
    );
  }, timeout: const Timeout(Duration(minutes: 5)));
}

String _content(List<TimelineGroup> groups) => jsonEncode([
  for (final group in groups)
    {
      'date': group.date,
      'items': [
        for (final item in group.items)
          {
            'repository': [
              item.repository.id,
              item.repository.owner,
              item.repository.name,
            ],
            'id': item.id,
            'tag': item.tagName,
            'title': item.title,
            'publishedAt': item.publishedAt.toIso8601String(),
            'notes': item.notes,
            'changelog': item.changelog,
            'truncated': item.changelogTruncated,
            'assets': item.assetCount,
            'prerelease': item.isPrerelease,
            'oldest': item.isOldestShown,
            'url': item.htmlUrl,
          },
      ],
    },
]);
