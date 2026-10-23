import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite3/common.dart';

import '../session/gitpulse_http.dart';
import 'timeline_dto.dart';
import 'timeline_models.dart';
import 'timeline_history.dart';

part 'timeline_cache.g.dart';

typedef TimelineCachePage = ({
  String repositoryId,
  String? cursor,
  RepositoryPage page,
});

final timelineClockProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);

final timelineCacheFileProvider = Provider<Future<File> Function()>(
  (ref) =>
      () async => File(
        p.join(
          (await getApplicationSupportDirectory()).path,
          'release_timeline.sqlite',
        ),
      ),
);

final timelineCacheRebuildProvider =
    Provider<Future<void> Function(bool Function())>((ref) {
      return (isCurrent) async {
        final file = await ref.read(timelineCacheFileProvider)();
        if (!isCurrent()) return;
        await ref.read(timelineCacheProvider).close();
        // Close the connection before removing only this database and its journals.
        // Retrying a failed rebuild repeats this same, idempotent operation.
        try {
          if (!isCurrent()) return;
          for (final suffix in ['', '-wal', '-shm', '-journal']) {
            final target = File('${file.path}$suffix');
            if (await target.exists()) await target.delete();
          }
        } finally {
          if (ref.mounted) ref.invalidate(timelineCacheProvider);
        }
      };
    });

final timelineCacheProvider = Provider<TimelineCache>((ref) {
  final databaseFile = ref.read(timelineCacheFileProvider);
  final cache = TimelineCache(
    driftDatabase(
      name: 'release_timeline',
      native: DriftNativeOptions(
        databasePath: () async => (await databaseFile()).path,
      ),
    ),
  );
  ref.onDispose(() => unawaited(cache.close().catchError((Object _) {})));
  return cache;
});

@DriftDatabase(include: {'timeline_cache.drift'})
class TimelineCache extends _$TimelineCache {
  TimelineCache(super.executor);

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onUpgrade: (migrator, from, to) async {
      if (from < 2) {
        await customStatement(
          'ALTER TABLE cache_account ADD COLUMN pending_follows TEXT',
        );
      }
    },
  );

  Future<void> _pending = Future.value();
  int _revision = 0;
  bool _clearRequired = false;
  bool _historyClearRequired = false;
  Future<void>? _closing;

  // One queue orders account changes, pruning and writes even when different
  // presentation controllers initiate operations concurrently.
  Future<T> _queue<T>(Future<T> Function() action) {
    if (_closing != null) return Future.error(const _ObsoleteWrite());
    final next = _pending.then((_) async {
      if (_clearRequired) {
        await transaction(_deleteAll);
        _clearRequired = false;
        _historyClearRequired = false;
      } else if (_historyClearRequired) {
        await transaction(_deleteHistory);
        _historyClearRequired = false;
      }
      await transaction(_finishPendingFollows);
      return action();
    });
    _pending = next.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return next.catchError((Object error, StackTrace stack) {
      if (error is SqliteException &&
              (error.resultCode == 11 || error.resultCode == 26) ||
          error is FormatException ||
          error is TypeError) {
        Error.throwWithStackTrace(const TimelineCacheCorruption(), stack);
      }
      Error.throwWithStackTrace(error, stack);
    });
  }

  Future<void> _writeCurrent(
    bool Function() isCurrent,
    Future<void> Function() write,
  ) {
    final revision = _revision;
    void check() {
      if (revision != _revision || !isCurrent()) {
        throw const _ObsoleteWrite();
      }
    }

    return _queue(
      () => transaction(() async {
        check();
        await write();
        check();
      }),
    );
  }

  static String? scopeOf(AuthenticatedIdentity identity) =>
      identity.githubId == null
      ? null
      : jsonEncode([identity.backend.toString(), identity.githubId]);

  Future<void> clear() {
    _revision++;
    _clearRequired = true;
    return _queue(() async {});
  }

  /// Removes this installation's history while keeping its last account policy.
  Future<void> clearHistory() {
    _revision++;
    _historyClearRequired = true;
    return _queue(() async {});
  }

  Future<void> _deleteHistory() async {
    for (final table in [
      'cache_visible',
      'cache_page_members',
      'cache_segments',
      'cache_releases',
    ]) {
      await customStatement('DELETE FROM $table');
    }
    await customStatement(
      'UPDATE cache_account SET saved_at = NULL, lower_bound = NULL, baseline = NULL, partial = 0',
    );
  }

  Future<void> _deleteAll() async {
    for (final table in [
      'cache_visible',
      'cache_page_members',
      'cache_segments',
      'cache_releases',
      'cache_repositories',
      'cache_account',
    ]) {
      await customStatement('DELETE FROM $table');
    }
  }

  Future<void> _claim(String scope) async {
    final account = await customSelect('SELECT scope FROM cache_account')
        .getSingleOrNull();
    if (account != null && account.read<String>('scope') != scope) {
      await _deleteAll();
    }
    await customStatement(
      'INSERT OR IGNORE INTO cache_account(scope) VALUES (?)',
      [scope],
    );
  }

  Future<void> _prune(DateTime now, int days) async {
    final cutoff = now
        .toUtc()
        .subtract(Duration(days: days))
        .microsecondsSinceEpoch;
    await customStatement('DELETE FROM cache_releases WHERE published_at < ?', [
      cutoff,
    ]);
    await customStatement(
      '''DELETE FROM cache_visible WHERE NOT EXISTS (
      SELECT 1 FROM cache_releases r WHERE r.repository_id = cache_visible.repository_id AND r.id = cache_visible.release_id)''',
    );
    await customStatement(
      '''DELETE FROM cache_page_members WHERE NOT EXISTS (
      SELECT 1 FROM cache_releases r WHERE r.repository_id = cache_page_members.repository_id AND r.id = cache_page_members.release_id)''',
    );
    await customStatement(
      '''DELETE FROM cache_segments WHERE NOT EXISTS (
      SELECT 1 FROM cache_page_members m JOIN cache_segments s ON s.id = m.segment_id
      WHERE s.repository_id = cache_segments.repository_id AND s.cycle = cache_segments.cycle)''',
    );
  }

  Future<SavedTimeline?> restore({
    required String scope,
    required DateTime now,
    required TimelineEnvironment environment,
  }) => _queue(
    () => transaction(() async {
      await _claim(scope);
      final account = await customSelect(
        'SELECT * FROM cache_account WHERE scope = ?',
        variables: [Variable(scope)],
      ).getSingle();
      final days = account.readNullable<int>('retention_days');
      if (days == null) return null;
      await _prune(now, days);
      final repositories = await _repositories();
      final rows = await customSelect(
        '''SELECT r.*, v.oldest_shown FROM cache_visible v
      JOIN cache_releases r ON r.repository_id = v.repository_id AND r.id = v.release_id''',
      ).get();
      final pages = <String, RepositoryPage>{};
      for (final repository in repositories) {
        final records = rows.where(
          (row) => row.read<String>('repository_id') == repository.id,
        );
        pages[repository.id] = RepositoryPage(
          status: RepositoryPageStatus.available,
          owner: repository.owner,
          name: repository.name,
          hasOlderReleases: records.any(
            (row) => row.read<int>('oldest_shown') == 1,
          ),
          releases: records
              .map(
                (row) => ReleaseItemDto.fromJson(
                  jsonDecode(row.read<String>('content'))
                      as Map<String, dynamic>,
                ).toDomain(),
              )
              .toList(),
        );
      }
      final timestamp = account.readNullable<int>('saved_at');
      return SavedTimeline(
        repositories: repositories,
        groups: assembleTimelineGroups(repositories, pages, environment),
        retentionDays: days,
        savedAt: timestamp == null
            ? null
            : DateTime.fromMillisecondsSinceEpoch(timestamp, isUtc: true),
        lowerBound: account.readNullable<int>('lower_bound'),
        baseline: account.readNullable<String>('baseline'),
        partial: account.read<int>('partial') == 1,
      );
    }),
  );

  Future<List<TimelineRepository>> _repositories() async => [
    for (final row in await customSelect(
      'SELECT * FROM cache_repositories ORDER BY id',
    ).get())
      TimelineRepository(
        id: row.read<String>('id'),
        owner: row.read<String>('owner'),
        name: row.read<String>('name'),
      ),
  ];

  Future<void> synchronize({
    required String scope,
    required int? retentionDays,
    required List<TimelineRepository> repositories,
    required DateTime now,
    required bool Function() isCurrent,
  }) {
    final revision = _revision;
    void check() {
      if (revision != _revision || !isCurrent()) throw const _ObsoleteWrite();
    }

    return _queue(() async {
      // Commit the confirmed follow set before attempting destructive cleanup.
      // A failed cleanup or process exit leaves a replayable restore barrier.
      await transaction(() async {
        check();
        await _claim(scope);
        final old = await _repositories();
        if (old.length != repositories.length ||
            repositories.any(
              (repo) => !old.any(
                (previous) =>
                    previous.id == repo.id &&
                    previous.fullName == repo.fullName,
              ),
            )) {
          await customStatement(
            'UPDATE cache_account SET pending_follows = ? WHERE scope = ?',
            [
              jsonEncode([
                for (final repo in repositories)
                  {'id': repo.id, 'owner': repo.owner, 'name': repo.name},
              ]),
              scope,
            ],
          );
        }
        if (retentionDays != null) {
          await customStatement(
            'UPDATE cache_account SET retention_days = ? WHERE scope = ?',
            [retentionDays, scope],
          );
        }
        check();
      });
      await transaction(() async {
        check();
        await _finishPendingFollows();
        final account = await customSelect(
          'SELECT retention_days FROM cache_account WHERE scope = ?',
          variables: [Variable(scope)],
        ).getSingle();
        final days = account.readNullable<int>('retention_days');
        if (days != null) await _prune(now, days);
        check();
      });
    });
  }

  Future<void> _finishPendingFollows() async {
    final account = await customSelect(
      'SELECT pending_follows FROM cache_account',
    ).getSingleOrNull();
    final pending = account?.readNullable<String>('pending_follows');
    if (pending == null) return;
    final repositories = (jsonDecode(pending) as List<dynamic>)
        .map(
          (json) =>
              FollowedRepositoryDto.fromJson(json as Map<String, dynamic>)
                  .toDomain(),
        )
        .toList();
    final old = await _repositories();
    final ids = repositories.map((item) => item.id).toSet();
    final oldIds = old.map((item) => item.id).toSet();
    if (ids.difference(oldIds).isNotEmpty) await _deleteHistory();
    for (final removed in old.where((item) => !ids.contains(item.id))) {
      for (final table in [
        'cache_visible',
        'cache_page_members',
        'cache_segments',
        'cache_releases',
      ]) {
        await customStatement('DELETE FROM $table WHERE repository_id = ?', [
          removed.id,
        ]);
      }
      await customStatement('DELETE FROM cache_repositories WHERE id = ?', [
        removed.id,
      ]);
    }
    for (final repository in repositories) {
      await customStatement(
        'INSERT OR REPLACE INTO cache_repositories(id, owner, name) VALUES (?, ?, ?)',
        [repository.id, repository.owner, repository.name],
      );
    }
    await customStatement('UPDATE cache_account SET pending_follows = NULL');
  }

  Future<RetainedTimelineHistory> readHistory({
    required String scope,
    required DateTime now,
  }) => _queue(
    () => transaction(() async {
      await _claim(scope);
      final account = await customSelect(
        'SELECT retention_days FROM cache_account WHERE scope = ?',
        variables: [Variable(scope)],
      ).getSingle();
      final days = account.readNullable<int>('retention_days');
      if (days == null) return const RetainedTimelineHistory();
      await _prune(now, days);
      final releases = <String, Map<int, ReleaseItem>>{};
      for (final row in await customSelect(
        'SELECT * FROM cache_releases',
      ).get()) {
        final item = ReleaseItemDto.fromJson(
          jsonDecode(row.read<String>('content')) as Map<String, dynamic>,
        ).toDomain();
        releases.putIfAbsent(
          row.read<String>('repository_id'),
          () => {},
        )[item.id] = item;
      }
      final members = <int, Set<int>>{};
      for (final row in await customSelect(
        'SELECT * FROM cache_page_members',
      ).get()) {
        members
            .putIfAbsent(row.read<int>('segment_id'), () => {})
            .add(row.read<int>('release_id'));
      }
      final pages = <String, List<RetainedTimelinePage>>{};
      for (final row in await customSelect(
        'SELECT * FROM cache_segments',
      ).get()) {
        final id = row.read<int>('id');
        pages
            .putIfAbsent(row.read<String>('repository_id'), () => [])
            .add(
              RetainedTimelinePage(
                id: id,
                cycle: row.read<String>('cycle'),
                requestCursor: row.readNullable<String>('request_cursor'),
                endCursor: row.readNullable<String>('end_cursor'),
                hasOlder: row.read<int>('has_older') == 1,
                incomplete: row.read<int>('incomplete') == 1,
                members: members[id] ?? const {},
              ),
            );
      }
      return RetainedTimelineHistory(
        repositories: {
          for (final entry in releases.entries)
            entry.key: RetainedRepositoryHistory(
              releases: entry.value,
              pages: pages[entry.key] ?? const [],
            ),
        },
      );
    }),
  );

  Future<void> save({
    required String scope,
    required String cycleId,
    required List<TimelineCachePage> pages,
    required List<TimelineGroup> groups,
    required TimelineCycle cycle,
    required DateTime now,
    required bool Function() isCurrent,
    Set<String> obsoleteRepositories = const {},
  }) => _writeCurrent(isCurrent, () async {
    final account = await customSelect(
      'SELECT retention_days FROM cache_account WHERE scope = ?',
      variables: [Variable(scope)],
    ).getSingleOrNull();
    final days = account?.readNullable<int>('retention_days');
    if (days == null) return;
    final cutoff = now.toUtc().subtract(Duration(days: days));
    final authoritativeMembers = {
      for (final id in obsoleteRepositories)
        id: {
          for (final item in cycle.pages[id]?.releases ?? const <ReleaseItem>[])
            item.id,
        },
    };
    for (final id in obsoleteRepositories) {
      await customStatement(
        '''DELETE FROM cache_page_members WHERE segment_id IN
        (SELECT id FROM cache_segments WHERE repository_id = ? AND cycle != ?)''',
        [id, cycleId],
      );
      await customStatement(
        'DELETE FROM cache_segments WHERE repository_id = ? AND cycle != ?',
        [id, cycleId],
      );
      final currentIds = authoritativeMembers[id]!;
      final stored = await customSelect(
        'SELECT id FROM cache_releases WHERE repository_id = ?',
        variables: [Variable(id)],
      ).get();
      for (final row in stored) {
        final releaseId = row.read<int>('id');
        if (!currentIds.contains(releaseId)) {
          await customStatement(
            'DELETE FROM cache_releases WHERE repository_id = ? AND id = ?',
            [id, releaseId],
          );
        }
      }
    }
    for (final entry in pages) {
      final page = entry.page;
      if (!page.isAvailable) continue;
      if (page.owner.isNotEmpty && page.name.isNotEmpty) {
        await customStatement(
          'UPDATE cache_repositories SET owner = ?, name = ? WHERE id = ?',
          [page.owner, page.name, entry.repositoryId],
        );
      }
      // A page stores provenance and stable membership, never a response copy.
      await customStatement(
        'INSERT INTO cache_segments(repository_id, cycle, request_cursor, end_cursor, has_older, incomplete) VALUES (?, ?, ?, ?, ?, ?)',
        [
          entry.repositoryId,
          cycleId,
          entry.cursor,
          page.endCursor,
          page.hasOlderReleases ? 1 : 0,
          page.incomplete ? 1 : 0,
        ],
      );
      final segment = (await customSelect(
        'SELECT last_insert_rowid() AS id',
      ).getSingle()).read<int>('id');
      for (final item in page.releases) {
        final authoritative = authoritativeMembers[entry.repositoryId];
        if (authoritative != null && !authoritative.contains(item.id)) continue;
        if (!item.isPublished || item.publishedAt!.isBefore(cutoff)) {
          // A latest response can unpublish or move a formerly retained item.
          await customStatement(
            'DELETE FROM cache_releases WHERE repository_id = ? AND id = ?',
            [entry.repositoryId, item.id],
          );
          continue;
        }
        await customStatement(
          'INSERT OR REPLACE INTO cache_releases(repository_id, id, published_at, content) VALUES (?, ?, ?, ?)',
          [
            entry.repositoryId,
            item.id,
            item.publishedAt!.microsecondsSinceEpoch,
            jsonEncode({
              'id': item.id,
              'tagName': item.tagName,
              'name': item.name,
              'description': item.description,
              'publishedAt': item.publishedAt!.toUtc().toIso8601String(),
              'isDraft': item.isDraft,
              'isPrerelease': item.isPrerelease,
              'assetCount': item.assetCount,
              'htmlUrl': item.htmlUrl,
            }),
          ],
        );
        await customStatement(
          'INSERT OR IGNORE INTO cache_page_members(segment_id, repository_id, release_id) VALUES (?, ?, ?)',
          [segment, entry.repositoryId, item.id],
        );
      }
      // Repeating a page within a cycle updates its provenance in place.
      await customStatement(
        '''DELETE FROM cache_page_members WHERE segment_id IN
          (SELECT id FROM cache_segments WHERE repository_id = ? AND cycle = ? AND request_cursor IS ? AND id != ?)''',
        [entry.repositoryId, cycleId, entry.cursor, segment],
      );
      await customStatement(
        'DELETE FROM cache_segments WHERE repository_id = ? AND cycle = ? AND request_cursor IS ? AND id != ?',
        [entry.repositoryId, cycleId, entry.cursor, segment],
      );
    }
    await customStatement('DELETE FROM cache_visible');
    for (final item in groups.expand((group) => group.items)) {
      await customStatement(
        '''INSERT INTO cache_visible(repository_id, release_id, oldest_shown)
          SELECT repository_id, id, ? FROM cache_releases WHERE repository_id = ? AND id = ?''',
        [item.isOldestShown ? 1 : 0, item.repository.id, item.id],
      );
    }
    await customStatement(
      'UPDATE cache_account SET saved_at = ?, lower_bound = ?, baseline = ?, partial = ? WHERE scope = ?',
      [
        now.toUtc().millisecondsSinceEpoch,
        cycle.windowLowerBound,
        cycle.previousBaseline,
        cycle.partial ? 1 : 0,
        scope,
      ],
    );
    await _prune(now, days);
    await _compactProvenance(
      pages.map((page) => page.repositoryId).toSet(),
      cycleId,
    );
  });

  Future<void> _compactProvenance(
    Set<String> repositoryIds,
    String currentCycle,
  ) async {
    for (final repositoryId in repositoryIds) {
      final rows = await customSelect(
        '''SELECT s.*, m.release_id FROM cache_segments s
        LEFT JOIN cache_page_members m ON m.segment_id = s.id
        WHERE s.repository_id = ? ORDER BY s.id, m.release_id''',
        variables: [Variable(repositoryId)],
      ).get();
      final segments = <int, ({String cycle, List<Object?> shape})>{};
      for (final row in rows) {
        final segment = segments.putIfAbsent(
          row.read<int>('id'),
          () => (
            cycle: row.read<String>('cycle'),
            shape: <Object?>[
              row.readNullable<String>('request_cursor'),
              row.readNullable<String>('end_cursor'),
              row.read<int>('has_older'),
              row.read<int>('incomplete'),
            ],
          ),
        );
        final member = row.readNullable<int>('release_id');
        if (member != null) segment.shape.add(member);
      }
      final cycles = <String, List<String>>{};
      for (final segment in segments.values) {
        cycles
            .putIfAbsent(segment.cycle, () => [])
            .add(jsonEncode(segment.shape));
      }
      final seen = <String>{};
      // Compare complete per-repository graphs, including empty pages and cursor
      // edges. Equal individual pages can have different reachable suffixes.
      // Keep the live cycle so subsequent fetched pages extend the retained graph.
      for (final cycle in [
        if (cycles.containsKey(currentCycle)) currentCycle,
        ...cycles.keys.where((cycle) => cycle != currentCycle),
      ]) {
        final shape = cycles[cycle]!..sort();
        if (seen.add(jsonEncode(shape))) continue;
        await customStatement(
          '''DELETE FROM cache_page_members WHERE segment_id IN
          (SELECT id FROM cache_segments WHERE repository_id = ? AND cycle = ?)''',
          [repositoryId, cycle],
        );
        await customStatement(
          'DELETE FROM cache_segments WHERE repository_id = ? AND cycle = ?',
          [repositoryId, cycle],
        );
      }
    }
  }

  @override
  Future<void> close() {
    _revision++;
    return _closing ??= _pending.then((_) => super.close());
  }
}

class TimelineCacheCorruption implements Exception {
  const TimelineCacheCorruption();
}

class SavedTimeline {
  const SavedTimeline({
    required this.repositories,
    required this.groups,
    required this.retentionDays,
    required this.savedAt,
    required this.lowerBound,
    required this.baseline,
    required this.partial,
  });

  final List<TimelineRepository> repositories;
  final List<TimelineGroup> groups;
  final int retentionDays;
  final DateTime? savedAt;
  final int? lowerBound;
  final String? baseline;
  final bool partial;
}

class _ObsoleteWrite implements Exception {
  const _ObsoleteWrite();
}
