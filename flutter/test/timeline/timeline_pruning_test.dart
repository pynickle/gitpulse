import 'dart:async';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_models.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import 'timeline_cache_test_support.dart';
import 'timeline_test_support.dart';

void main() {
  final binding = TestWidgetsFlutterBinding.ensureInitialized();

  test('online pruning leaves the live window intact without reading saved releases', () async {
    final queries = _CacheQueries();
    final cache = TimelineCache(NativeDatabase.memory().interceptWith(queries));
    addTearDown(cache.close);
    var now = DateTime.utc(2026, 10, 19, 12);
    final h = createHarness(cache: cache, now: () => now);
    configure(
      h,
      days: 1,
      releases: [
        releaseJson(2, 'retained', '2026-10-19T12:00:00Z'),
        releaseJson(1, 'boundary', '2026-10-18T12:00:00Z'),
      ],
    );
    await settle(h.container);
    final before = readState(h.container);
    expect(before.restored, isFalse);
    final requests = h.session.requests.toList();
    queries.selects.clear();
    now = now.add(const Duration(microseconds: 1));

    final foregroundPrune = Completer<void>();
    queries.pruned = foregroundPrune;
    binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await foregroundPrune.future.timeout(const Duration(seconds: 5));
    await pumpEventQueue();

    expect(queries.windowReads, isEmpty);
    expect(readState(h.container), same(before));
    expect(h.session.requests, requests);
    final saved = await cache.restore(
      scope: TimelineCache.scopeOf(h.session.state.identity!)!,
      now: now,
      environment: TimelineEnvironment(localDateKey: utcPlusEight),
    );
    expect(
      saved!.groups.expand((group) => group.items).map((item) => item.key),
      ['R_a:2'],
    );

    // A surviving malformed body must not be decoded by cleanup either.
    await cache.customStatement(
      "UPDATE cache_releases SET content = 'invalid json'",
    );
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .pruneRetainedHistory();
    expect(readState(h.container).cacheCorrupted, isFalse);
    expect(h.session.requests, requests);
  });

  test(
    'offline pruning updates the restored window without fetching',
    () async {
      final disk = await DiskTimeline.create();
      var h = disk.open();
      configure(
        h,
        days: 1,
        releases: [
          releaseJson(2, 'retained', '2026-10-19T12:00:00Z'),
          releaseJson(1, 'boundary', '2026-10-18T12:00:00Z'),
        ],
      );
      await settle(h.container);
      await disk.close();
      var now = disk.now;
      h = disk.open(now: () => now);
      h.session.handlers['GET api/settings'] = () =>
          const BackendResult(problem: BackendProblem.network);
      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          const BackendResult(problem: BackendProblem.network);
      await settle(h.container);
      expect(readState(h.container).restored, isTrue);
      expect(keys(h.container), ['R_a:2', 'R_a:1']);
      final before = readState(h.container);
      final requests = h.session.requests.toList();
      now = now.add(const Duration(microseconds: 1));

      await h.container
          .read(releaseTimelineSessionProvider.notifier)
          .pruneRetainedHistory();

      expect(keys(h.container), ['R_a:2']);
      final after = readState(h.container);
      expect(
        after.visibleGroups
            .expand((group) => group.items)
            .map((item) => item.key),
        ['R_a:2'],
      );
      expect(after.savedAt, before.savedAt);
      expect(after.previousBaseline, before.previousBaseline);
      expect(after.offline, isTrue);
      expect(after.cacheFailed, isFalse);
      expect(h.session.requests, requests);
    },
  );

  test(
    'an in-flight prune cannot change the replacement account window or cache',
    () async {
      final queries = _CacheQueries();
      final cache = TimelineCache(
        NativeDatabase.memory().interceptWith(queries),
      );
      addTearDown(cache.close);
      final now = DateTime.utc(2026, 10, 19, 12);
      final h = createHarness(cache: cache, now: () => now);
      configure(
        h,
        releases: [releaseJson(1, 'old account', '2026-10-18T12:00:00Z')],
      );
      await settle(h.container);
      final oldScope = TimelineCache.scopeOf(h.session.state.identity!)!;
      final held = queries.pauseNextRetentionRead();
      final pruning = h.container
          .read(releaseTimelineSessionProvider.notifier)
          .pruneRetainedHistory();
      await held.started;
      final identity = signedInIdentity(login: 'other', githubId: '2');
      configure(
        h,
        releases: [releaseJson(99, 'new account', '2026-10-19T12:00:00Z')],
      );
      h.session.emit(
        SessionState(phase: SessionPhase.signedIn, identity: identity),
      );
      held.release();
      await pruning;
      await settle(h.container);
      expect(keys(h.container), ['R_a:99']);
      expect(readState(h.container).cacheFailed, isFalse);
      final requests = h.session.requests.toList();

      // An old caller must not claim the new account, even with a valid ticket.
      await cache.prune(
        scope: oldScope,
        now: now.add(const Duration(days: 100)),
        isCurrent: () => true,
      );
      final saved = await cache.restore(
        scope: TimelineCache.scopeOf(identity)!,
        now: now,
        environment: TimelineEnvironment(localDateKey: utcPlusEight),
      );
      expect(
        saved!.groups.expand((group) => group.items).map((item) => item.key),
        ['R_a:99'],
      );
      expect(h.session.requests, requests);
    },
  );

  test(
    'pruning rolls back when its generation expires during cleanup',
    () async {
      final queries = _CacheQueries();
      final cache = TimelineCache(
        NativeDatabase.memory().interceptWith(queries),
      );
      addTearDown(cache.close);
      final now = DateTime.utc(2026, 10, 19, 12);
      final h = createHarness(cache: cache, now: () => now);
      configure(h, releases: [releaseJson(1, 'saved', '2026-10-18T12:00:00Z')]);
      await settle(h.container);
      final scope = TimelineCache.scopeOf(h.session.state.identity!)!;
      var current = true;
      final held = queries.pauseNextRetentionRead();
      final pruning = cache.prune(
        scope: scope,
        now: now.add(const Duration(days: 100)),
        isCurrent: () => current,
      );
      final rejected = expectLater(pruning, throwsException);
      await held.started;
      current = false;
      held.release();
      await rejected;
      final saved = await cache.restore(
        scope: scope,
        now: now,
        environment: TimelineEnvironment(localDateKey: utcPlusEight),
      );
      expect(
        saved!.groups.expand((group) => group.items).map((item) => item.key),
        ['R_a:1'],
      );
    },
  );

  for (final barrier in ['clear', 'follows']) {
    test('pruning respects and retries a failed $barrier barrier', () async {
      final queries = _CacheQueries();
      final cache = TimelineCache(
        NativeDatabase.memory().interceptWith(queries),
      );
      addTearDown(cache.close);
      final now = DateTime.utc(2026, 10, 19, 12);
      final h = createHarness(cache: cache, now: () => now);
      configure(h, releases: [releaseJson(1, 'saved', '2026-10-18T12:00:00Z')]);
      await settle(h.container);
      final scope = TimelineCache.scopeOf(h.session.state.identity!)!;
      await cache.customStatement(
        "CREATE TEMP TRIGGER fail_cleanup BEFORE DELETE ON cache_releases BEGIN SELECT RAISE(ABORT, 'disk full'); END",
      );
      await expectLater(
        barrier == 'clear'
            ? cache.clearHistory()
            : cache.synchronize(
                scope: scope,
                retentionDays: 30,
                repositories: const [],
                now: now,
                isCurrent: () => true,
              ),
        throwsException,
      );
      queries.selects.clear();
      await expectLater(
        cache.prune(scope: scope, now: now, isCurrent: () => true),
        throwsException,
      );
      expect(queries.windowReads, isEmpty);
      await cache.customStatement('DROP TRIGGER fail_cleanup');
      await cache.prune(scope: scope, now: now, isCurrent: () => true);
      expect(queries.windowReads, isEmpty);
      final saved = await cache.restore(
        scope: scope,
        now: now,
        environment: TimelineEnvironment(localDateKey: utcPlusEight),
      );
      expect(saved!.groups, isEmpty);
      expect(saved.retentionDays, 30);
    });
  }
}

class _CacheQueries extends QueryInterceptor {
  final selects = <String>[];
  Completer<void>? pruned;
  Future<void> Function()? _beforeRetentionRead;

  ({Future<void> started, void Function() release}) pauseNextRetentionRead() {
    final started = Completer<void>();
    final resume = Completer<void>();
    _beforeRetentionRead = () async {
      started.complete();
      await resume.future;
    };
    return (started: started.future, release: () => resume.complete());
  }

  Iterable<String> get windowReads => selects.where(
    (sql) =>
        RegExp(r'cache_(releases|visible|page_members|segments)\b')
            .hasMatch(sql),
  );

  @override
  Future<List<Map<String, Object?>>> runSelect(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) async {
    selects.add(statement);
    if (statement.startsWith('SELECT retention_days')) {
      final before = _beforeRetentionRead;
      _beforeRetentionRead = null;
      await before?.call();
    }
    return executor.runSelect(statement, args);
  }

  @override
  Future<void> runCustom(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) async {
    await executor.runCustom(statement, args);
    if (statement.startsWith('DELETE FROM cache_segments WHERE')) {
      pruned?.complete();
      pruned = null;
    }
  }
}
