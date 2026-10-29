import 'dart:async';
import 'dart:io';

import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift_flutter/drift_flutter.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_filters.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:path/path.dart' as p;

import 'timeline_cache_test_support.dart';
import 'timeline_test_support.dart';

const _scope = 'write-test';
const _repo = TimelineRepository(id: 'R_a', owner: 'octo', name: 'alpha');
final _now = DateTime.utc(2026, 10, 25, 12);
final _environment = TimelineEnvironment(localDateKey: systemLocalDateKey);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  for (final action in ['refresh', 'load older']) {
    test(
      '$action waits for saving, then exposes failure and retries locally',
      () async {
        final disk = await _Disk.create();
        var now = _now;
        final h = createHarness(cache: disk.cache, now: () => now);
        configure(h, releases: []);
        h.session.handlers['POST api/release-timeline/refresh'] = () =>
            _response(1, 'p1');
        await settle(h.container);
        final timeline = h.container.read(
          releaseTimelineSessionProvider.notifier,
        );
        timeline.applyFilters(const TimelineFilterState(query: 'no match'));
        final savedAt = readState(h.container).savedAt;
        now = _now.add(const Duration(hours: 1));
        h.session.handlers['POST api/release-timeline/refresh'] = () =>
            _response(2, 'p2');
        h.session.handlers[pageRequest({'R_a': 'p1'})] = () =>
            _response(2, 'p2');
        await disk.cache.customStatement(
          '''CREATE TEMP TRIGGER fail_visible
        BEFORE INSERT ON cache_visible BEGIN SELECT RAISE(ABORT, 'disk full'); END''',
        );
        final held = disk.queries.pause();
        var finished = false;
        final saving =
            (action == 'refresh' ? timeline.refresh() : timeline.loadOlder())
              ..then((_) => finished = true);
        await held.started;
        expect(finished, isFalse);
        expect(readState(h.container).loading, isTrue);
        expect(keys(h.container), contains('R_a:2'));
        expect(readState(h.container).visibleGroups, isEmpty);
        expect(readState(h.container).savedAt, savedAt);
        held.release();
        await saving;
        expect(readState(h.container).loading, isFalse);
        expect(readState(h.container).cacheFailed, isTrue);
        expect(readState(h.container).savedAt, savedAt);
        final requests = h.session.requests.toList();
        final baseline = readState(h.container).previousBaseline;
        await disk.cache.customStatement('DROP TRIGGER fail_visible');
        await timeline.retryCache();
        expect(h.session.requests, requests);
        expect(readState(h.container).previousBaseline, baseline);
        expect(readState(h.container).cacheFailed, isFalse);
        expect(readState(h.container).savedAt, now);
        // A display filter never narrows the durable saved membership.
        final scope = TimelineCache.scopeOf(h.session.state.identity!)!;
        h.container.dispose();
        await disk.reopen();
        final saved = (await disk.cache.restore(
          scope: scope,
          now: now,
          environment: _environment,
        ))!;
        expect(
          saved.groups.expand((group) => group.items).map((item) => item.id),
          action == 'refresh' ? [2] : [1, 2],
        );
        expect(
          saved.groups
              .expand((group) => group.items)
              .where((item) => item.isOldestShown)
              .map((item) => item.id),
          [2],
        );
      },
    );
  }

  test(
    'a later successful page also commits the earlier page that failed saving',
    () async {
      final disk = await _Disk.create();
      final h = createHarness(cache: disk.cache, now: () => _now);
      configure(h, releases: []);
      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          _response(1, 'p1');
      h.session.handlers[pageRequest({'R_a': 'p1'})] = () => _response(2, 'p2');
      h.session.handlers[pageRequest({'R_a': 'p2'})] = () => _response(3, 'p3');
      await settle(h.container);
      final timeline = h.container.read(
        releaseTimelineSessionProvider.notifier,
      );
      await disk.cache.customStatement(
        '''CREATE TEMP TRIGGER fail_page
      BEFORE INSERT ON cache_visible BEGIN SELECT RAISE(ABORT, 'disk full'); END''',
      );
      await timeline.loadOlder();
      expect(readState(h.container).cacheFailed, isTrue);
      expect(keys(h.container), ['R_a:1', 'R_a:2']);
      await disk.cache.customStatement('DROP TRIGGER fail_page');
      await timeline.loadOlder();
      expect(readState(h.container).cacheFailed, isFalse);
      final scope = TimelineCache.scopeOf(h.session.state.identity!)!;
      h.container.dispose();
      await disk.reopen();
      final saved = (await disk.cache.restore(
        scope: scope,
        now: _now,
        environment: _environment,
      ))!;
      expect(
        saved.groups.expand((group) => group.items).map((item) => item.id),
        [1, 2, 3],
      );
      final history = await disk.cache.readHistory(scope: scope, now: _now);
      expect(
        history.repositories['R_a']!.pages
            .singleWhere((page) => page.requestCursor == 'p1')
            .members,
        {2},
      );
    },
  );

  test('a large saved window reopens with full notes, cutoff and oldest markers', () async {
    final disk = await _Disk.create();
    final cutoff = _now.subtract(const Duration(days: 30));
    final releases = [
      for (var id = 1; id <= 1100; id++) _release(id),
      _release(1101, publishedAt: cutoff),
      _release(
        1102,
        publishedAt: cutoff.subtract(const Duration(microseconds: 1)),
      ),
    ];
    final page = _page(releases);
    // Membership is supplied before display filtering and can include an item
    // whose content was never retained (an online-only result).
    final groups = _groups(_page([...releases, _release(9999)]));
    await disk.save([page], groups: groups);
    await disk.reopen();
    final saved = (await disk.restore())!;
    final items = saved.groups.expand((group) => group.items).toList();
    expect(items, hasLength(1101));
    expect(items.map((item) => item.id), containsAll([1, 1100, 1101]));
    expect(items.map((item) => item.id), isNot(contains(9999)));
    expect(
      items.singleWhere((item) => item.id == 1100).notes,
      'Complete notes for 1100. ' * 80,
    );
    // The online oldest item is outside retention: its marker must not migrate.
    expect(items.where((item) => item.isOldestShown), isEmpty);
    expect(
      (saved.savedAt, saved.lowerBound, saved.baseline, saved.partial),
      (_now, 123, 'baseline', true),
    );
    await disk.save([], groups: []);
    await disk.reopen();
    expect((await disk.restore())!.groups, isEmpty);
  });

  test(
    'duplicate occurrences keep page order through deletion and republication',
    () async {
      final disk = await _Disk.create();
      final first = _page([
        _release(1),
        _release(2),
        _release(1, draft: true),
        _release(1, notes: 'republished'),
        _release(3),
      ]);
      final second = _page([
        _release(1, notes: 'latest body'),
        _release(2, draft: true),
        _release(3, publishedAt: _now.subtract(const Duration(days: 31))),
      ]);
      await disk.save([
        first,
        second,
      ], groups: _groups(_page([_release(1), _release(2), _release(3)])));
      await disk.reopen();
      final saved = (await disk.restore())!;
      expect(saved.groups.single.items.map((item) => (item.id, item.notes)), [
        (1, 'latest body'),
      ]);
      final history = await disk.cache.readHistory(scope: _scope, now: _now);
      expect(history.repositories[_repo.id]!.releases.keys, [1]);
    },
  );

  test('repeated first and continuation pages replace their membership including empty nodes', () async {
    final disk = await _Disk.create();
    await disk.save(
      [
        _page([_release(1)]),
        _page([_release(2)]),
        _page([]),
        _page([_release(3)]),
      ],
      cursors: [null, null, 'next', 'tail'],
      groups: _groups(_page([_release(2), _release(3)])),
    );
    await disk.save(
      [
        _page([_release(4)]),
        _page([]),
      ],
      cursors: [null, 'tail'],
      groups: _groups(_page([_release(4)])),
    );
    await disk.reopen();
    final history = await disk.cache.readHistory(scope: _scope, now: _now);
    final pages = history.repositories[_repo.id]!.pages;
    expect(pages, hasLength(3));
    expect(pages.singleWhere((page) => page.requestCursor == null).members, {
      4,
    });
    expect(
      pages.singleWhere((page) => page.requestCursor == 'next').members,
      isEmpty,
    );
    expect(
      pages.singleWhere((page) => page.requestCursor == 'tail').members,
      isEmpty,
    );
  });

  test('a failure late in a large membership replacement rolls back content and metadata', () async {
    final disk = await _Disk.create();
    await disk.save([
      _page([_release(1, notes: 'committed')]),
    ]);
    await disk.cache.customStatement('''CREATE TEMP TRIGGER fail_late
      BEFORE INSERT ON cache_visible WHEN NEW.release_id = 900
      BEGIN SELECT RAISE(ABORT, 'disk full'); END''');
    final page = _page([for (var id = 1; id <= 1100; id++) _release(id)]);
    await expectLater(
      disk.save([page], now: _now.add(const Duration(hours: 1))),
      throwsException,
    );
    await disk.reopen();
    final saved = (await disk.restore())!;
    expect(saved.groups.single.items.map((item) => (item.id, item.notes)), [
      (1, 'committed'),
    ]);
    expect(saved.savedAt, _now);
    final history = await disk.cache.readHistory(scope: _scope, now: _now);
    expect(history.repositories[_repo.id]!.releases.keys, [1]);
  });

  test('graphs sharing first pages keep different suffixes through compaction and reopen', () async {
    final disk = await _Disk.create();
    for (final (cycle, tail) in [('a', 2), ('b', 3), ('c', 3)]) {
      await disk.save(
        [
          _page([_release(1)]),
          _page([], next: 'tail'),
          _page([_release(tail)], next: null),
        ],
        cursors: [null, 'next', 'tail'],
        cycleId: cycle,
        groups: _groups(_page([_release(1), _release(tail)], next: null)),
      );
    }
    await disk.reopen();
    final history = await disk.cache.readHistory(scope: _scope, now: _now);
    final pages = history.repositories[_repo.id]!.pages;
    // b and c are identical complete graphs; a has a different reachable tail.
    expect(pages.map((page) => page.cycle).toSet(), {'a', 'c'});
    expect(
      pages
          .where((page) => page.requestCursor == 'tail')
          .map((page) => page.members),
      [
        {2},
        {3},
      ],
    );
    expect(
      pages
          .where((page) => page.requestCursor == 'next')
          .every((page) => page.members.isEmpty && page.endCursor == 'tail'),
      isTrue,
    );
    expect(
      (await disk.restore())!.groups
          .expand((group) => group.items)
          .map((item) => item.id),
      [1, 3],
    );
  });

  for (final invalidation in ['generation', 'clear', 'account']) {
    test(
      '$invalidation invalidates an in-flight write after mutations begin',
      () async {
        final disk = await _Disk.create();
        await disk.save([
          _page([_release(1, notes: 'committed')]),
        ]);
        var current = true;
        final held = disk.queries.pause();
        final action = disk.save([
          _page([for (var id = 1; id <= 1100; id++) _release(id)]),
        ], isCurrent: () => current);
        final rejected = expectLater(action, throwsException);
        await held.started;
        Future<void>? replacement;
        switch (invalidation) {
          case 'generation':
            current = false;
          case 'clear':
            replacement = disk.cache.clearHistory();
          case 'account':
            current = false;
            replacement = disk.cache.synchronize(
              scope: 'other-account',
              retentionDays: 30,
              repositories: [_repo],
              now: _now,
              isCurrent: () => true,
            );
        }
        held.release();
        await rejected;
        await replacement;
        await disk.reopen();
        final saved = await disk.cache.restore(
          scope: invalidation == 'account' ? 'other-account' : _scope,
          now: _now,
          environment: _environment,
        );
        if (invalidation == 'generation') {
          expect(saved!.groups.single.items.single.notes, 'committed');
          expect(saved.savedAt, _now);
        } else {
          expect(saved!.groups, isEmpty);
          expect(saved.savedAt, isNull);
        }
      },
    );
  }
}

BackendResult _response(int id, String next) => BackendResult(
  statusCode: 200,
  data: {
    ...roundJson(
      pages: {
        'R_a': pageJson(
          'octo',
          'alpha',
          [
            releaseJson(
              id,
              'v$id',
              _now.subtract(Duration(minutes: id)).toIso8601String(),
            ),
          ],
          hasOlderReleases: true,
          endCursor: next,
        ),
      },
    ),
    'refresh': {
      'previousBaseline': '2026-10-01T00:00:00Z',
      'startedAt': _now.toIso8601String(),
    },
  },
);

ReleaseItem _release(
  int id, {
  String? notes,
  DateTime? publishedAt,
  bool draft = false,
}) => ReleaseItem(
  id: id,
  tagName: 'v$id',
  name: null,
  description: notes ?? 'Complete notes for $id. ' * 80,
  notesSearchText: '',
  publishedAt: publishedAt ?? _now.subtract(Duration(minutes: id)),
  isDraft: draft,
  isPrerelease: false,
  assetCount: 2,
  htmlUrl: null,
);

RepositoryPage _page(List<ReleaseItem> items, {String? next = 'next'}) =>
    RepositoryPage(
      status: RepositoryPageStatus.available,
      owner: 'octo',
      name: 'alpha',
      releases: items,
      hasOlderReleases: next != null,
      endCursor: next,
    );
List<TimelineGroup> _groups(RepositoryPage page) =>
    assembleTimelineGroups([_repo], {_repo.id: page}, _environment);

class _Disk {
  _Disk(this.directory);
  final Directory directory;
  final queries = _PauseWrites();
  late TimelineCache cache;
  void open() {
    cache = TimelineCache(
      driftDatabase(
        name: 'cache-writes-test',
        native: DriftNativeOptions(
          databasePath: () async => p.join(directory.path, 'cache.sqlite'),
          tempDirectoryPath: () async => directory.path,
        ),
      ).interceptWith(queries),
    );
  }

  static Future<_Disk> create() async {
    final disk = _Disk(
      await Directory.systemTemp.createTemp('gitpulse-writes-'),
    );
    disk.open();
    addTearDown(() async {
      await disk.cache.close();
      await disk.directory.delete(recursive: true);
    });
    await disk.cache.synchronize(
      scope: _scope,
      retentionDays: 30,
      repositories: [_repo],
      now: _now,
      isCurrent: () => true,
    );
    return disk;
  }

  Future<void> reopen() async {
    await cache.close();
    open();
  }

  Future<SavedTimeline?> restore() =>
      cache.restore(scope: _scope, now: _now, environment: _environment);
  Future<void> save(
    List<RepositoryPage> pages, {
    List<TimelineGroup>? groups,
    List<String?>? cursors,
    DateTime? now,
    bool Function()? isCurrent,
    String cycleId = 'cycle',
  }) => cache.save(
    scope: _scope,
    cycleId: cycleId,
    pages: [
      for (var i = 0; i < pages.length; i++)
        (
          repositoryId: _repo.id,
          cursor: cursors == null ? (i == 0 ? null : 'p$i') : cursors[i],
          page: pages[i],
        ),
    ],
    groups: groups ?? _groups(pages.last),
    cycle: const TimelineCycle(
      windowLowerBound: 123,
      previousBaseline: 'baseline',
      partial: true,
    ),
    now: now ?? _now,
    isCurrent: isCurrent ?? () => true,
  );
}

class _PauseWrites extends QueryInterceptor {
  Future<void> Function()? _hold;
  ({Future<void> started, void Function() release}) pause() {
    final started = Completer<void>();
    final resume = Completer<void>();
    _hold = () async {
      started.complete();
      await resume.future;
    };
    return (started: started.future, release: resume.complete);
  }

  Future<void> _afterMutation() async {
    final hold = _hold;
    _hold = null;
    await hold?.call();
  }

  @override
  Future<void> runBatched(
    QueryExecutor executor,
    BatchedStatements statements,
  ) async {
    await executor.runBatched(statements);
    await _afterMutation();
  }

  @override
  Future<void> runCustom(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) async {
    await executor.runCustom(statement, args);
    if (statement.startsWith('INSERT OR REPLACE INTO cache_releases')) {
      await _afterMutation();
    }
  }
}
