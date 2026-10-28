import 'dart:async';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/device/device_preferences.dart';
import 'package:gitpulse/device/device_preferences_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:path/path.dart' as p;

import 'timeline_cache_test_support.dart';
import 'timeline_test_support.dart';

const historyRead = 'SELECT * FROM cache_releases';
const visibleMembers =
    'SELECT repository_id, release_id, oldest_shown FROM cache_visible';
const policyWrite = 'UPDATE cache_account SET retention_days';

class RetentionQueries extends QueryInterceptor {
  final selects = <String>[];
  String? fail;
  String? hold;
  final started = Completer<void>();
  final resume = Completer<void>();

  Future<void> before(String statement) async {
    if (fail != null && statement.startsWith(fail!)) {
      throw const FileSystemException('storage unavailable');
    }
    if (hold != null && statement.startsWith(hold!)) {
      hold = null;
      started.complete();
      await resume.future;
    }
  }

  @override
  Future<List<Map<String, Object?>>> runSelect(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) async {
    selects.add(statement);
    await before(statement);
    return executor.runSelect(statement, args);
  }

  @override
  Future<void> runCustom(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) async {
    await before(statement);
    await executor.runCustom(statement, args);
  }
}

Future<({DiskTimeline disk, TimelineHarness h, RetentionQueries queries})>
restoredHarness({DateTime Function()? now}) async {
  final disk = await DiskTimeline.create();
  var h = disk.open();
  configure(
    h,
    releases: [
      releaseJson(
        3,
        'recent',
        disk.now.toIso8601String(),
        description: 'Full notes',
      ),
      releaseJson(
        2,
        'boundary',
        disk.now.subtract(const Duration(days: 7)).toIso8601String(),
      ),
      releaseJson(
        1,
        'expired',
        disk.now.subtract(const Duration(days: 14)).toIso8601String(),
      ),
    ],
  );
  final refresh = h.session.handlers['POST api/release-timeline/refresh']!;
  h.session.handlers['POST api/release-timeline/refresh'] = () async {
    final response = await refresh();
    return BackendResult(
      statusCode: 200,
      data: {
        ...response.data as Map<String, dynamic>,
        'refresh': {
          'previousBaseline': '2026-10-01T00:00:00.000Z',
          'startedAt': '2026-10-19T12:00:00.000Z',
        },
      },
    );
  };
  await settle(h.container);
  await disk.close();
  final queries = RetentionQueries();
  final cache = TimelineCache(
    NativeDatabase(File(p.join(disk.directory.path, 'timeline.sqlite')))
        .interceptWith(queries),
  );
  h = createHarness(
    cache: cache,
    device: disk.device,
    now: now ?? () => disk.now,
  );
  disk.container = h.container;
  addTearDown(disk.close);
  h.session.handlers['GET api/settings'] = () => BackendResult(
    statusCode: 200,
    data: settingsJson([followJson('R_a', 'octo', 'alpha')]),
  );
  h.session.handlers['POST api/release-timeline/refresh'] = () =>
      const BackendResult(problem: BackendProblem.network);
  await settle(h.container);
  expect(readState(h.container).restored, isTrue);
  return (disk: disk, h: h, queries: queries);
}

void main() {
  test('completion waits beyond the policy write for history and visible updates', () async {
    final fixture = await restoredHarness();
    final h = fixture.h;
    final queries = fixture.queries..hold = historyRead;
    final requests = h.session.requests.toList();
    final baseline = readState(h.container).previousBaseline;
    var completed = false;
    final choice =
        h.container
            .read(releaseTimelineSessionProvider.notifier)
            .chooseRetentionWindow(7)
          ..then((_) => completed = true);
    await queries.started.future;
    // This query runs after synchronization committed; it is deliberately held.
    expect(completed, isFalse);
    expect(h.device.value.retentionDays, 7);
    expect(keys(h.container), ['R_a:3', 'R_a:2', 'R_a:1']);
    queries.resume.complete();
    final result = await choice;
    expect(result.remembered, isTrue);
    expect(result.application, RetentionApplication.applied);
    expect(keys(h.container), ['R_a:3', 'R_a:2']);
    expect(readState(h.container).previousBaseline, baseline);
    expect(h.session.requests, requests);
    await fixture.disk.close();
    final reopened = fixture.disk.open();
    await settle(reopened.container);
    expect(keys(reopened.container), ['R_a:3', 'R_a:2']);
    expect(
      reopened.container
          .read(releaseTimelineSessionProvider.notifier)
          .savedRelease(owner: 'octo', repository: 'alpha', id: 3)!
          .notes,
      'Full notes',
    );
  });

  for (final stage in [policyWrite, historyRead, visibleMembers]) {
    test(
      'Retry saving recovers incomplete application after $stage fails',
      () async {
        final fixture = await restoredHarness();
        final h = fixture.h;
        final controller = h.container.read(
          releaseTimelineSessionProvider.notifier,
        );
        final requests = h.session.requests.toList();
        final baseline = readState(h.container).previousBaseline;
        fixture.queries.fail = stage;
        final result = await controller.chooseRetentionWindow(7);
        expect(result.remembered, isTrue);
        expect(result.application, RetentionApplication.failed);
        expect(readState(h.container).cacheFailed, isTrue);
        expect(keys(h.container), ['R_a:3', 'R_a:2', 'R_a:1']);
        expect(h.device.value.retentionDays, 7);
        fixture.queries.fail = null;
        await controller.retryCache();
        expect(readState(h.container).cacheFailed, isFalse);
        expect(keys(h.container), ['R_a:3', 'R_a:2']);
        expect(readState(h.container).previousBaseline, baseline);
        expect(h.session.requests, requests);
        expect(
          (await controller.chooseRetentionWindow(7)).application,
          RetentionApplication.applied,
        );
      },
    );
  }

  test(
    'preference failure preserves the current-run choice and still applies it',
    () async {
      final fixture = await restoredHarness();
      final h = fixture.h;
      h.device.failWrites = true;
      final controller = h.container.read(
        releaseTimelineSessionProvider.notifier,
      );
      final result = await controller.chooseRetentionWindow(7);
      expect(result.remembered, isFalse);
      expect(result.application, RetentionApplication.applied);
      expect(
        h.container
            .read(devicePreferencesStateProvider)
            .preferences
            .retentionDays,
        7,
      );
      expect(keys(h.container), ['R_a:3', 'R_a:2']);
      // The unchanged choice is not silently reported as remembered on retry.
      expect((await controller.chooseRetentionWindow(7)).remembered, isFalse);
    },
  );

  test('retention application cannot hide an unsaved current page', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(
      h,
      releases: [releaseJson(1, 'saved', disk.now.toIso8601String())],
    );
    await settle(h.container);
    await disk.cache!.customStatement(
      "CREATE TEMP TRIGGER fail_save BEFORE INSERT ON cache_visible BEGIN SELECT RAISE(ABORT, 'disk full'); END",
    );
    configure(
      h,
      releases: [
        releaseJson(
          2,
          'unsaved',
          disk.now.toIso8601String(),
          description: 'Fresh full notes',
        ),
      ],
    );
    final controller = h.container.read(
      releaseTimelineSessionProvider.notifier,
    );
    await controller.refresh();
    expect(keys(h.container), ['R_a:2']);
    expect(readState(h.container).cacheFailed, isTrue);
    final requests = h.session.requests.toList();
    final result = await controller.chooseRetentionWindow(7);
    expect(result.application, RetentionApplication.failed);
    expect(readState(h.container).cacheFailed, isTrue);
    expect(keys(h.container), ['R_a:2']);
    await disk.cache!.customStatement('DROP TRIGGER fail_save');
    await controller.retryCache();
    expect(readState(h.container).cacheFailed, isFalse);
    expect(h.session.requests, requests);
    await disk.close();
    h = disk.open();
    await settle(h.container);
    expect(keys(h.container), ['R_a:2']);
    expect(
      h.container
          .read(releaseTimelineSessionProvider.notifier)
          .savedRelease(owner: 'octo', repository: 'alpha', id: 2)!
          .notes,
      'Fresh full notes',
    );
  });

  test('an unrelated preference failure does not erase a remembered retention choice', () async {
    final fixture = await restoredHarness();
    final h = fixture.h;
    h.device.failWrites = true;
    await h.container
        .read(devicePreferencesProvider.notifier)
        .selectLanguage(AppLanguage.simplifiedChinese);
    expect(
      h.container.read(devicePreferencesStateProvider).rememberFailed,
      isTrue,
    );
    final result = await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .chooseRetentionWindow(30);
    expect(result.remembered, isTrue);
    expect(result.application, RetentionApplication.applied);
  });

  test('accepted decreases and increases finish serially and never resurrect evicted history', () async {
    final fixture = await restoredHarness();
    final h = fixture.h;
    final controller = h.container.read(
      releaseTimelineSessionProvider.notifier,
    );
    fixture.queries.hold = historyRead;
    final first = controller.chooseRetentionWindow(7);
    await fixture.queries.started.future;
    var laterCompleted = false;
    final last = controller.chooseRetentionWindow(30)
      ..then((_) => laterCompleted = true);
    expect(laterCompleted, isFalse);
    fixture.queries.resume.complete();
    expect((await first).application, RetentionApplication.applied);
    expect((await last).application, RetentionApplication.applied);
    expect(h.device.value.retentionDays, 30);
    expect(
      await fixture.disk.cache!.lastSavedRetentionDays(
        scope: TimelineCache.scopeOf(h.session.state.identity!)!,
      ),
      30,
    );
    expect(keys(h.container), ['R_a:3', 'R_a:2']);
  });

  test(
    'choices queued behind another cache action each finish in order',
    () async {
      final fixture = await restoredHarness();
      final controller = fixture.h.container.read(
        releaseTimelineSessionProvider.notifier,
      );
      fixture.queries.hold = 'DELETE FROM cache_visible';
      final clearing = controller.clearCache();
      await fixture.queries.started.future;
      final decrease = controller.chooseRetentionWindow(7);
      final increase = controller.chooseRetentionWindow(30);
      fixture.queries.resume.complete();
      await clearing;
      expect((await decrease).application, RetentionApplication.applied);
      expect((await increase).application, RetentionApplication.applied);
      expect(fixture.h.device.value.retentionDays, 30);
      expect(
        await fixture.disk.cache!.lastSavedRetentionDays(
          scope: TimelineCache.scopeOf(fixture.h.session.state.identity!)!,
        ),
        30,
      );
    },
  );

  test(
    'same-value application updates expiry while retaining the exact cutoff',
    () async {
      var now = DateTime.utc(2026, 10, 19, 12);
      final fixture = await restoredHarness(now: () => now);
      final controller = fixture.h.container.read(
        releaseTimelineSessionProvider.notifier,
      );
      now = now.add(const Duration(days: 23));
      expect(
        (await controller.chooseRetentionWindow(30)).application,
        RetentionApplication.applied,
      );
      expect(keys(fixture.h.container), ['R_a:3', 'R_a:2']);
      now = now.add(const Duration(microseconds: 1));
      expect(
        (await controller.chooseRetentionWindow(30)).application,
        RetentionApplication.applied,
      );
      expect(keys(fixture.h.container), ['R_a:3']);
    },
  );

  test('unconfirmed follows defer promptly, then normal confirmation adopts the choice', () async {
    final disk = await DiskTimeline.create();
    final h = disk.open();
    await settle(h.container);
    final requests = h.session.requests.toList();
    final controller = h.container.read(
      releaseTimelineSessionProvider.notifier,
    );
    final result = await controller
        .chooseRetentionWindow(7)
        .timeout(const Duration(seconds: 2));
    expect(result.remembered, isTrue);
    expect(result.application, RetentionApplication.notApplied);
    expect(result.reason, RetentionNotAppliedReason.followsUnconfirmed);
    expect(h.session.requests, requests);
    configure(
      h,
      releases: [releaseJson(1, 'recent', disk.now.toIso8601String())],
    );
    await controller.refresh();
    expect(
      await disk.cache!.lastSavedRetentionDays(
        scope: TimelineCache.scopeOf(h.session.state.identity!)!,
      ),
      7,
    );
  });

  test(
    'a signed-out choice is remembered without touching saved history',
    () async {
      final fixture = await restoredHarness();
      final h = fixture.h;
      h.session.emit(const SessionState(phase: SessionPhase.signedOut));
      final requests = h.session.requests.toList();
      final result = await h.container
          .read(releaseTimelineSessionProvider.notifier)
          .chooseRetentionWindow(1);
      expect(result.remembered, isTrue);
      expect(result.reason, RetentionNotAppliedReason.noSession);
      expect(result.application, RetentionApplication.notApplied);
      expect(h.session.requests, requests);
    },
  );

  for (final change in ['account', 'backend']) {
    test(
      'active and queued choices are invalidated by a $change change',
      () async {
        final fixture = await restoredHarness();
        final h = fixture.h;
        fixture.queries.hold = historyRead;
        final controller = h.container.read(
          releaseTimelineSessionProvider.notifier,
        );
        final choice = controller.chooseRetentionWindow(7);
        await fixture.queries.started.future;
        final queued = controller.chooseRetentionWindow(30);
        configure(
          h,
          releases: [
            releaseJson(99, 'new session', fixture.disk.now.toIso8601String()),
          ],
        );
        final identity = change == 'account'
            ? signedInIdentity(login: 'other', githubId: '2')
            : AuthenticatedIdentity(
                backend: Uri.parse('https://other.example/'),
                githubId: '1',
                login: 'octocat',
                name: 'octocat',
                avatarUrl: '',
              );
        h.session.emit(
          SessionState(phase: SessionPhase.signedIn, identity: identity),
        );
        fixture.queries.resume.complete();
        for (final result in [await choice, await queued]) {
          expect(result.application, RetentionApplication.notApplied);
          expect(result.reason, RetentionNotAppliedReason.sessionInvalidated);
          expect(result.remembered, isTrue);
        }
        await settle(h.container);
        expect(keys(h.container), ['R_a:99']);
        expect(h.device.value.retentionDays, 30);
        expect(
          await fixture.disk.cache!.lastSavedRetentionDays(
            scope: TimelineCache.scopeOf(identity)!,
          ),
          30,
        );
      },
    );
  }

  test('unchanged startup and retention reuse exposed content without a second visible-body read', () async {
    final fixture = await restoredHarness();
    final h = fixture.h;
    // Initial visible restoration and retained-history loading remain separate.
    final bodyReads = fixture.queries.selects
        .where((sql) => sql.startsWith('SELECT r.*, v.oldest_shown'))
        .length;
    expect(bodyReads, 1);
    final groups = readState(h.container).groups;
    fixture.queries.selects.clear();
    final result = await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .chooseRetentionWindow(30);
    expect(result.application, RetentionApplication.applied);
    expect(readState(h.container).groups, same(groups));
    expect(
      fixture.queries.selects.where(
        (sql) => sql.startsWith('SELECT r.*, v.oldest_shown'),
      ),
      isEmpty,
    );
  });
}
