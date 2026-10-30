import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite3/common.dart';

import '../follows/release_follows_dto.dart';
import 'timeline_dto.dart';
import 'timeline_models.dart';
import 'timeline_history.dart';
import '../repositories/repository_models.dart';

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
  int get schemaVersion => 4;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onUpgrade: (migrator, from, to) async {
      // Previous content has no server-supplied search text. Refill it from the
      // current backend; session and device preferences live outside this cache.
      for (final table in allTables.toList().reversed) {
        await customStatement(
          'DROP TABLE IF EXISTS "${table.actualTableName}"',
        );
      }
      await migrator.createAll();
    },
  );

  Future<void> _pending = Future.value();
  int _revision = 0;
  bool _clearRequired = false;
  bool _historyClearRequired = false;
  Future<void>? _closing;

  // Content writes invalidate loaded visible content; expiry and membership
  // changes are detected separately without reading release bodies.
  int _contentRevision = 0;

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

  /// Expires retained history without loading the saved visible window.
  ///
  /// [retentionDays] is the window the caller is keeping; the ledger's own value
  /// is only the fallback, so a window this device has since changed cannot be
  /// overruled by the one its last write recorded.
  Future<void> prune({
    required String scope,
    required DateTime now,
    required bool Function() isCurrent,
    int? retentionDays,
  }) => _writeCurrent(isCurrent, () async {
    final account = await customSelect(
      'SELECT retention_days FROM cache_account WHERE scope = ?',
      variables: [Variable(scope)],
    ).getSingleOrNull();
    final days = retentionDays ?? account?.readNullable<int>('retention_days');
    if (days != null) await _prune(now, days);
  });

  /// The retention window this installation last wrote for [scope].
  ///
  /// It is only a snapshot of the device policy that produced the saved history.
  /// An installation that has not chosen a window of its own is seeded from it,
  /// so upgrading keeps the records the account already saved.
  Future<int?> lastSavedRetentionDays({required String scope}) => _queue(
    () => transaction(() async {
      await _claim(scope);
      final account = await customSelect(
        'SELECT retention_days FROM cache_account WHERE scope = ?',
        variables: [Variable(scope)],
      ).getSingleOrNull();
      return account?.readNullable<int>('retention_days');
    }),
  );

  Future<SavedTimeline?> restore({
    required String scope,
    required DateTime now,
    required TimelineEnvironment environment,
    int? retentionDays,
    SavedTimeline? previous,
    bool Function()? isCurrent,
  }) => _queue(
    () => transaction(() async {
      if (isCurrent != null && !isCurrent()) throw const _ObsoleteWrite();
      await _claim(scope);
      final account = await customSelect(
        'SELECT * FROM cache_account WHERE scope = ?',
        variables: [Variable(scope)],
      ).getSingle();
      final days = retentionDays ?? account.readNullable<int>('retention_days');
      if (days == null) return null;
      await _prune(now, days);
      final repositories = await _repositories();
      // Membership and repository metadata are enough to detect expiry or follow
      // cleanup. Content writes invalidate reuse without reading release bodies.
      final members = await customSelect(
        'SELECT repository_id, release_id, oldest_shown FROM cache_visible ORDER BY repository_id, release_id',
      ).get();
      final fingerprint = jsonEncode([
        scope,
        _contentRevision,
        account.readNullable<int>('saved_at'),
        account.readNullable<int>('lower_bound'),
        account.readNullable<String>('baseline'),
        account.read<int>('partial'),
        for (final repository in repositories)
          [repository.id, repository.owner, repository.name],
        for (final member in members) member.data,
      ]);
      if (isCurrent != null && !isCurrent()) throw const _ObsoleteWrite();
      final List<TimelineGroup> groups;
      if (previous?.visibleFingerprint == fingerprint) {
        groups = previous!.groups;
      } else {
        final rows = await customSelect(
          '''SELECT r.*, v.oldest_shown FROM cache_visible v
      JOIN cache_releases r ON r.repository_id = v.repository_id AND r.id = v.release_id''',
        ).get();
        final rowsByRepository = <String, List<QueryRow>>{};
        for (final row in rows) {
          (rowsByRepository[row.read<String>('repository_id')] ??= []).add(row);
        }
        final pages = <String, RepositoryPage>{};
        for (final repository in repositories) {
          final records = rowsByRepository[repository.id] ?? const <QueryRow>[];
          pages[repository.id] = RepositoryPage(
            status: RepositoryQueryStatus.available,
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
        groups = assembleTimelineGroups(repositories, pages, environment);
      }
      final timestamp = account.readNullable<int>('saved_at');
      if (isCurrent != null && !isCurrent()) throw const _ObsoleteWrite();
      return SavedTimeline(
        visibleFingerprint: fingerprint,
        repositories: repositories,
        groups: groups,
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

  Future<List<RepositoryReference>> _repositories() async => [
    for (final row in await customSelect(
      'SELECT * FROM cache_repositories ORDER BY id',
    ).get())
      RepositoryReference(
        id: row.read<String>('id'),
        owner: row.read<String>('owner'),
        name: row.read<String>('name'),
      ),
  ];

  Future<void> synchronize({
    required String scope,
    required int? retentionDays,
    required List<RepositoryReference> repositories,
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
    _contentRevision++;
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
      final segment = await customInsert(
        'INSERT INTO cache_segments(repository_id, cycle, request_cursor, end_cursor, has_older, incomplete) VALUES (?, ?, ?, ?, ?, ?)',
        variables: [
          Variable(entry.repositoryId),
          Variable(cycleId),
          Variable(entry.cursor),
          Variable(page.endCursor),
          Variable(page.hasOlderReleases ? 1 : 0),
          Variable(page.incomplete ? 1 : 0),
        ],
      );
      // Drift reuses SQL templates and sends one ordered batch per page. Row
      // statements still execute individually, including interleaved deletions.
      await batch((batch) {
        for (final item in page.releases) {
          final authoritative = authoritativeMembers[entry.repositoryId];
          if (authoritative != null && !authoritative.contains(item.id)) {
            continue;
          }
          if (!item.isPublished || item.publishedAt!.isBefore(cutoff)) {
            // A latest response can unpublish or move a formerly retained item.
            batch.customStatement(
              'DELETE FROM cache_releases WHERE repository_id = ? AND id = ?',
              [entry.repositoryId, item.id],
            );
            continue;
          }
          batch.customStatement(
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
                'notesSearchText': item.notesSearchText,
                'publishedAt': item.publishedAt!.toUtc().toIso8601String(),
                'isDraft': item.isDraft,
                'isPrerelease': item.isPrerelease,
                'assetCount': item.assetCount,
                'htmlUrl': item.htmlUrl,
              }),
            ],
          );
          batch.customStatement(
            'INSERT OR IGNORE INTO cache_page_members(segment_id, repository_id, release_id) VALUES (?, ?, ?)',
            [segment, entry.repositoryId, item.id],
          );
        }
        // Repeating a page within a cycle updates its provenance in place.
        batch.customStatement(
          '''DELETE FROM cache_page_members WHERE segment_id IN
          (SELECT id FROM cache_segments WHERE repository_id = ? AND cycle = ? AND request_cursor IS ? AND id != ?)''',
          [entry.repositoryId, cycleId, entry.cursor, segment],
        );
        batch.customStatement(
          'DELETE FROM cache_segments WHERE repository_id = ? AND cycle = ? AND request_cursor IS ? AND id != ?',
          [entry.repositoryId, cycleId, entry.cursor, segment],
        );
      });
    }
    await customStatement('DELETE FROM cache_visible');
    // Three parameters per row, below even SQLite's older 999-variable limit.
    // Only the current chunk's SQL and arguments are materialized.
    const chunkSize = 300;
    final members = groups.expand((group) => group.items).iterator;
    while (true) {
      final arguments = <Object?>[];
      var count = 0;
      while (count < chunkSize && members.moveNext()) {
        final item = members.current;
        arguments.addAll([
          item.repository.id,
          item.id,
          item.isOldestShown ? 1 : 0,
        ]);
        count++;
      }
      if (count == 0) break;
      final values = List.filled(count, '(?, ?, ?)').join(',');
      await customStatement(
        '''WITH visible(repository_id, release_id, oldest_shown) AS (VALUES $values)
          INSERT INTO cache_visible(repository_id, release_id, oldest_shown)
          SELECT r.repository_id, r.id, v.oldest_shown FROM visible v
          JOIN cache_releases r ON r.repository_id = v.repository_id AND r.id = v.release_id''',
        arguments,
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
    this.visibleFingerprint,
    required this.repositories,
    required this.groups,
    required this.retentionDays,
    required this.savedAt,
    required this.lowerBound,
    required this.baseline,
    required this.partial,
  });

  final String? visibleFingerprint;
  final List<RepositoryReference> repositories;
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
