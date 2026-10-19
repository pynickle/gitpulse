import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../session/gitpulse_http.dart';
import 'timeline_dto.dart';
import 'timeline_models.dart';
import 'timeline_history.dart';

part 'timeline_cache.g.dart';

final timelineClockProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);

final timelineCacheProvider = Provider<TimelineCache>((ref) {
  final cache = TimelineCache(
    driftDatabase(
      name: 'release_timeline',
      native: const DriftNativeOptions(
        databaseDirectory: getApplicationSupportDirectory,
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
  int get schemaVersion => 1;

  Future<void> _pending = Future.value();
  int _revision = 0;
  bool _clearRequired = false;

  // One queue orders account changes, pruning and writes even when different
  // presentation controllers initiate operations concurrently.
  Future<T> _queue<T>(Future<T> Function() action) {
    final next = _pending.then((_) async {
      if (_clearRequired) {
        await transaction(_deleteAll);
        _clearRequired = false;
      }
      return action();
    });
    _pending = next.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return next;
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
  }) => _writeCurrent(isCurrent, () async {
    await _claim(scope);
    if (retentionDays != null) {
      await customStatement(
        'UPDATE cache_account SET retention_days = ? WHERE scope = ?',
        [retentionDays, scope],
      );
    }
    final old = await _repositories();
    final ids = repositories.map((item) => item.id).toSet();
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
    final account = await customSelect(
      'SELECT retention_days FROM cache_account WHERE scope = ?',
      variables: [Variable(scope)],
    ).getSingle();
    final days = account.readNullable<int>('retention_days');
    if (days != null) await _prune(now, days);
  });

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
    required Map<String, RepositoryPage> pages,
    required Map<String, String?> cursors,
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
      final currentIds = {
        for (final item in cycle.pages[id]?.releases ?? const <ReleaseItem>[])
          item.id,
      };
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
    for (final entry in pages.entries) {
      final page = entry.value;
      if (!page.isAvailable) continue;
      if (page.owner.isNotEmpty && page.name.isNotEmpty) {
        await customStatement(
          'UPDATE cache_repositories SET owner = ?, name = ? WHERE id = ?',
          [page.owner, page.name, entry.key],
        );
      }
      // A page stores provenance and stable membership, never a response copy.
      await customStatement(
        'INSERT INTO cache_segments(repository_id, cycle, request_cursor, end_cursor, has_older, incomplete) VALUES (?, ?, ?, ?, ?, ?)',
        [
          entry.key,
          cycleId,
          cursors[entry.key],
          page.endCursor,
          page.hasOlderReleases ? 1 : 0,
          page.incomplete ? 1 : 0,
        ],
      );
      final segment = (await customSelect(
        'SELECT last_insert_rowid() AS id',
      ).getSingle()).read<int>('id');
      for (final item in page.releases) {
        if (!item.isPublished || item.publishedAt!.isBefore(cutoff)) {
          // A latest response can unpublish or move a formerly retained item.
          await customStatement(
            'DELETE FROM cache_releases WHERE repository_id = ? AND id = ?',
            [entry.key, item.id],
          );
          continue;
        }
        await customStatement(
          'INSERT OR REPLACE INTO cache_releases(repository_id, id, published_at, content) VALUES (?, ?, ?, ?)',
          [
            entry.key,
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
          [segment, entry.key, item.id],
        );
      }
      // Repeating a page within a cycle updates its provenance in place.
      await customStatement(
        '''DELETE FROM cache_page_members WHERE segment_id IN
          (SELECT id FROM cache_segments WHERE repository_id = ? AND cycle = ? AND request_cursor IS ? AND id != ?)''',
        [entry.key, cycleId, cursors[entry.key], segment],
      );
      await customStatement(
        'DELETE FROM cache_segments WHERE repository_id = ? AND cycle = ? AND request_cursor IS ? AND id != ?',
        [entry.key, cycleId, cursors[entry.key], segment],
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
  });

  @override
  Future<void> close() async {
    await _pending;
    await super.close();
  }
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
