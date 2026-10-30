import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_dto.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:path/path.dart' as p;

import 'timeline_test_support.dart';

import 'package:gitpulse/repositories/repository_models.dart';

void main() {
  final environment = TimelineEnvironment(localDateKey: utcPlusEight);
  const scope = 'restore-test';
  final now = DateTime.utc(2026, 10, 25, 12);

  test('restore keeps empty repositories, per-repository oldest markers and sorted full content after reopening', () async {
    final directory = await Directory.systemTemp.createTemp(
      'gitpulse-restore-',
    );
    var cache = TimelineCache(
      NativeDatabase(File(p.join(directory.path, 'cache.sqlite'))),
    );
    addTearDown(() async {
      await cache.close();
      await directory.delete(recursive: true);
    });
    const repositories = [
      RepositoryReference(id: 'R_b', owner: 'other', name: 'beta'),
      RepositoryReference(id: 'R_empty', owner: 'octo', name: 'empty'),
      RepositoryReference(id: 'R_a', owner: 'renamed', name: 'alpha'),
    ];
    final notes = 'Full release notes. ' * 60;
    final visiblePages = {
      'R_a': _page('renamed', 'alpha', [
        releaseJson(30, 'v30', '2026-10-24T18:00:00Z'),
        releaseJson(50, 'v50', '2026-10-23T18:00:00Z'),
        releaseJson(
          20,
          'v20',
          '2026-10-24T12:00:00Z',
          name: '  Alpha twenty  ',
          description: notes,
          isPrerelease: true,
          assetCount: 7,
          htmlUrl: 'https://github.com/renamed/alpha/releases/tag/v20',
        ),
      ], hasOlderReleases: true),
      'R_b': _page('other', 'beta', [
        releaseJson(20, 'b20', '2026-10-24T12:00:00Z'),
        releaseJson(9, 'b9', '2026-10-22T18:00:00Z'),
        releaseJson(10, 'b10', '2026-10-24T12:00:00Z'),
      ]),
      'R_empty': _page('octo', 'empty', [], hasOlderReleases: true),
    };
    final pages = {
      ...visiblePages,
      'R_a': RepositoryPage(
        status: RepositoryQueryStatus.available,
        owner: 'renamed',
        name: 'alpha',
        hasOlderReleases: true,
        releases: [
          ...visiblePages['R_a']!.releases,
          ReleaseItemDto.fromJson(
            releaseJson(1, 'hidden', '2026-10-21T12:00:00Z'),
          ).toDomain(),
        ],
      ),
    };
    await cache.synchronize(
      scope: scope,
      retentionDays: 30,
      repositories: repositories,
      now: now,
      isCurrent: () => true,
    );
    await cache.save(
      scope: scope,
      cycleId: 'saved',
      pages: [
        for (final entry in pages.entries)
          (repositoryId: entry.key, cursor: null, page: entry.value),
      ],
      groups: assembleTimelineGroups(repositories, visiblePages, environment),
      cycle: const TimelineCycle(
        windowLowerBound: 123,
        previousBaseline: '2026-10-22T00:00:00Z',
        partial: true,
      ),
      now: now,
      isCurrent: () => true,
    );
    await cache.close();
    cache = TimelineCache(
      NativeDatabase(File(p.join(directory.path, 'cache.sqlite'))),
    );

    final saved = (await cache.restore(
      scope: scope,
      now: now,
      environment: environment,
    ))!;

    expect(saved.repositories.map((repo) => (repo.id, repo.fullName)), [
      ('R_a', 'renamed/alpha'),
      ('R_b', 'other/beta'),
      ('R_empty', 'octo/empty'),
    ]);
    expect(
      saved.groups.map(
        (group) => [group.date, group.items.map((item) => item.key).toList()],
      ),
      [
        [
          '2026-10-25',
          ['R_a:30'],
        ],
        [
          '2026-10-24',
          ['R_a:20', 'R_b:10', 'R_b:20', 'R_a:50'],
        ],
        [
          '2026-10-23',
          ['R_b:9'],
        ],
      ],
    );
    final items = saved.groups.expand((group) => group.items).toList();
    expect(items.map((item) => (item.key, item.isOldestShown)), [
      ('R_a:30', false),
      ('R_a:20', false),
      ('R_b:10', false),
      ('R_b:20', false),
      ('R_a:50', true),
      ('R_b:9', false),
    ]);
    final alpha = items[1];
    expect(
      (
        alpha.repository.fullName,
        alpha.id,
        alpha.tagName,
        alpha.title,
        alpha.publishedAt,
        alpha.notes,
        alpha.changelog,
        alpha.changelogTruncated,
        alpha.assetCount,
        alpha.isPrerelease,
        alpha.htmlUrl,
      ),
      (
        'renamed/alpha',
        20,
        'v20',
        'Alpha twenty',
        DateTime.utc(2026, 10, 24, 12),
        notes,
        notes.substring(0, 500),
        true,
        7,
        true,
        'https://github.com/renamed/alpha/releases/tag/v20',
      ),
    );
    expect(
      (
        saved.retentionDays,
        saved.savedAt,
        saved.lowerBound,
        saved.baseline,
        saved.partial,
      ),
      (30, now, 123, '2026-10-22T00:00:00Z', true),
    );
  });

  test('restore prunes expired oldest markers independently and retains repositories with no surviving rows', () async {
    final cache = TimelineCache(NativeDatabase.memory());
    addTearDown(cache.close);
    const repositories = [
      RepositoryReference(id: 'R_a', owner: 'octo', name: 'alpha'),
      RepositoryReference(id: 'R_b', owner: 'octo', name: 'beta'),
      RepositoryReference(id: 'R_empty', owner: 'octo', name: 'empty'),
    ];
    final pages = {
      'R_a': _page('octo', 'alpha', [
        releaseJson(2, 'new', '2026-10-25T12:00:00Z'),
        releaseJson(1, 'boundary', '2026-10-24T12:00:00Z'),
      ], hasOlderReleases: true),
      'R_b': _page('octo', 'beta', [
        releaseJson(1, 'boundary', '2026-10-24T12:00:00Z'),
      ], hasOlderReleases: true),
      'R_empty': _page('octo', 'empty', []),
    };
    await cache.synchronize(
      scope: scope,
      retentionDays: 1,
      repositories: repositories,
      now: now,
      isCurrent: () => true,
    );
    await cache.save(
      scope: scope,
      cycleId: 'boundary',
      pages: [
        for (final entry in pages.entries)
          (repositoryId: entry.key, cursor: null, page: entry.value),
      ],
      groups: assembleTimelineGroups(repositories, pages, environment),
      cycle: TimelineCycle.empty,
      now: now,
      isCurrent: () => true,
    );

    final boundary = (await cache.restore(
      scope: scope,
      now: now,
      environment: environment,
    ))!;
    expect(
      boundary.groups
          .expand((group) => group.items)
          .map((item) => (item.key, item.isOldestShown)),
      [('R_a:2', false), ('R_a:1', true), ('R_b:1', true)],
    );
    final pruned = (await cache.restore(
      scope: scope,
      now: now.add(const Duration(microseconds: 1)),
      environment: environment,
    ))!;
    expect(pruned.repositories, repositories);
    expect(
      pruned.groups.single.items.map((item) => (item.key, item.isOldestShown)),
      [('R_a:2', false)],
    );
    expect(pruned.retentionDays, 1);
    final empty = (await cache.restore(
      scope: scope,
      now: now.add(const Duration(days: 2)),
      environment: environment,
    ))!;
    expect(empty.repositories, repositories);
    expect(empty.groups, isEmpty);
  });
}

RepositoryPage _page(
  String owner,
  String name,
  List<Map<String, Object?>> releases, {
  bool hasOlderReleases = false,
}) => RepositoryPage(
  status: RepositoryQueryStatus.available,
  owner: owner,
  name: name,
  hasOlderReleases: hasOlderReleases,
  releases: releases
      .map((json) => ReleaseItemDto.fromJson(json).toDomain())
      .toList(),
);
