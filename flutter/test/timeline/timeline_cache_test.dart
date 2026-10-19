import 'dart:async';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/releases/release_detail_service.dart';
import 'package:path/path.dart' as p;

import 'timeline_test_support.dart';
import 'timeline_cache_test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('reopening SQLite restores only eligible exposed releases and their full bodies offline', () async {
    final directory = await Directory.systemTemp.createTemp('gitpulse-cache-');
    final file = File(p.join(directory.path, 'timeline.sqlite'));
    final now = DateTime.utc(2026, 10, 19, 12);
    final body = List.filled(300, 'Complete release notes.\n').join();
    var cache = TimelineCache(NativeDatabase(file));
    addTearDown(() async {
      await cache.close();
      await directory.delete(recursive: true);
    });
    final first = createHarness(cache: cache, now: () => now);
    first.session.handlers['GET api/settings'] = () => BackendResult(
      statusCode: 200,
      data: {
        ...settingsJson([
          followJson('R_a', 'octo', 'alpha'),
          followJson('R_b', 'octo', 'beta'),
        ]),
        'releaseTimeline': {'retentionDays': 30},
      },
    );
    first.session.handlers['POST api/release-timeline/refresh'] = () =>
        BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_a': pageJson('octo', 'alpha', [
                releaseJson(3, 'v3', '2026-10-19T12:00:00Z', description: body),
                releaseJson(2, 'v2', '2026-09-19T12:00:00Z'),
                releaseJson(1, 'v1', '2026-09-19T11:59:59.999Z'),
              ]),
              'R_b': pageJson(
                'octo',
                'beta',
                [releaseJson(4, 'v4', '2026-10-19T12:00:00Z')],
                hasOlderReleases: true,
                endCursor: 'b1',
              ),
            },
          ),
        );
    await settle(first.container);
    expect(keys(first.container), ['R_a:3', 'R_b:4']);
    first.container.dispose();
    await cache.close();

    cache = TimelineCache(NativeDatabase(file));
    final offline = createHarness(cache: cache, now: () => now);
    offline.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    offline.session.handlers['POST api/release-timeline/refresh'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(offline.container);
    expect(keys(offline.container), ['R_a:3', 'R_b:4']);
    final state = readState(offline.container);
    expect(state.offline, isTrue);
    expect(state.savedAt, now);
    expect(state.groups.first.items.first.notes, body);
    offline.session.handlers['GET api/releases/octo/alpha/3'] = () =>
        const BackendResult(problem: BackendProblem.network);
    final detail = await offline.container.read(
      releaseDetailProvider((
        owner: 'octo',
        repository: 'alpha',
        id: 3,
        tag: null,
      )).future,
    );
    expect(detail.release?.body, body);
    expect(detail.release?.offline, isTrue);
    expect(
      offline.container
          .read(releaseTimelineSessionProvider.notifier)
          .savedRelease(owner: 'octo', repository: 'alpha', id: 3)
          ?.notes,
      body,
    );
    offline.container.dispose();
    await cache.close();
  });

  for (final days in [1, 30, 90]) {
    test(
      'retains the exact UTC $days-day cutoff across a changed grouping zone',
      () async {
        final disk = await DiskTimeline.create();
        final cutoff = disk.now.subtract(Duration(days: days));
        final first = disk.open();
        configure(
          first,
          days: days,
          releases: [
            releaseJson(2, 'boundary', cutoff.toIso8601String()),
            releaseJson(
              1,
              'expired',
              cutoff
                  .subtract(const Duration(microseconds: 1))
                  .toIso8601String(),
            ),
          ],
        );
        await settle(first.container);
        expect(keys(first.container), ['R_a:2', 'R_a:1']);
        await disk.close();
        final offline = disk.open(
          localDateKey: (date) =>
              date.toUtc().toIso8601String().substring(0, 10),
        );
        offline.session.handlers['GET api/settings'] = () =>
            const BackendResult(problem: BackendProblem.network);
        await settle(offline.container);
        expect(keys(offline.container), ['R_a:2']);
      },
    );
  }

  test('fresh results keep disconnected islands hidden after repeated refreshes and restarts', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(
      h,
      releases: [
        releaseJson(8, 'v8', '2026-10-10T00:00:00Z'),
        releaseJson(7, 'v7', '2026-10-09T00:00:00Z'),
      ],
    );
    await settle(h.container);
    configure(h, releases: [releaseJson(12, 'v12', '2026-10-18T00:00:00Z')]);
    await h.container.read(releaseTimelineSessionProvider.notifier).refresh();
    expect(keys(h.container), ['R_a:12']);
    await disk.close();
    h = disk.open();
    configure(h, releases: [releaseJson(12, 'v12', '2026-10-18T00:00:00Z')]);
    await settle(h.container);
    expect(keys(h.container), ['R_a:12']);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:12']);
    expect(
      h.container
          .read(releaseTimelineSessionProvider.notifier)
          .savedRelease(owner: 'octo', repository: 'alpha', id: 8),
      isNull,
    );
  });

  test('a release edit and repository rename replace current content without duplicating identities', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(
      h,
      releases: [
        releaseJson(3, 'v3', '2026-10-18T00:00:00Z', description: 'old body'),
      ],
    );
    await settle(h.container);
    configure(
      h,
      owner: 'renamed',
      releases: [
        releaseJson(
          3,
          'v3',
          '2026-10-18T00:00:00Z',
          description: 'latest body',
        ),
      ],
    );
    await h.container.read(releaseTimelineSessionProvider.notifier).refresh();
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:3']);
    final item = readState(h.container).groups.single.items.single;
    expect(item.notes, 'latest body');
    expect(item.repository.fullName, 'renamed/alpha');
  });

  test('a failed refresh preserves the last committed view, and a failed preference read uses the saved policy', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(3, 'v3', '2026-10-18T00:00:00Z')]);
    await settle(h.container);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await h.container.read(releaseTimelineSessionProvider.notifier).refresh();
    expect(keys(h.container), ['R_a:3']);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:3']);
    expect(readState(h.container).savedAt, disk.now);
  });

  test('a new identity without a synchronized preference can read online but cannot retain it', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(
      h,
      days: null,
      releases: [releaseJson(3, 'v3', '2026-10-18T00:00:00Z')],
    );
    await settle(h.container);
    expect(keys(h.container), ['R_a:3']);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
  });

  test('rejection hides history and same-account reauthentication restores it; logout deletes it', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(3, 'v3', '2026-10-18T00:00:00Z')]);
    await settle(h.container);
    final identity = h.session.state.identity;
    h.session.emit(
      SessionState(phase: SessionPhase.rejected, identity: identity),
    );
    expect(keys(h.container), isEmpty);
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    h.session.emit(
      SessionState(phase: SessionPhase.signedIn, identity: identity),
    );
    await settle(h.container);
    expect(keys(h.container), ['R_a:3']);
    h.session.emit(const SessionState());
    expect(keys(h.container), isEmpty);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
  });

  test('a different backend or stable account cannot restore another identity and clears its history', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(3, 'v3', '2026-10-18T00:00:00Z')]);
    await settle(h.container);
    await disk.close();
    h = disk.open(login: 'other');
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
  });
  test(
    'shrinking then expanding retention cannot recover evicted releases',
    () async {
      final disk = await DiskTimeline.create();
      var h = disk.open();
      configure(
        h,
        releases: [
          releaseJson(3, 'v3', '2026-10-18T12:00:00Z'),
          releaseJson(2, 'v2', '2026-10-10T00:00:00Z'),
        ],
      );
      await settle(h.container);
      configure(
        h,
        days: 1,
        releases: [releaseJson(3, 'v3', '2026-10-18T12:00:00Z')],
      );
      await h.container.read(releaseTimelineSessionProvider.notifier).refresh();
      await disk.close();
      h = disk.open();
      configure(h, days: 90, releases: []);
      h.session.handlers['POST api/release-timeline/refresh'] = () =>
          const BackendResult(problem: BackendProblem.network);
      await settle(h.container);
      expect(keys(h.container), ['R_a:3']);
      await disk.close();
      h = disk.open();
      h.session.handlers['GET api/settings'] = () =>
          const BackendResult(problem: BackendProblem.network);
      await settle(h.container);
      expect(keys(h.container), ['R_a:3']);
    },
  );

  test('a failed transaction preserves the committed view while fresh results stay readable', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(3, 'v3', '2026-10-18T00:00:00Z')]);
    await settle(h.container);
    // Inject a mid-transaction storage fault without replacing SQLite or
    // inspecting its records to assert behavior.
    await disk.cache!.customStatement(
      "CREATE TEMP TRIGGER fail_cache BEFORE INSERT ON cache_visible BEGIN SELECT RAISE(ABORT, 'disk full'); END",
    );
    configure(h, releases: [releaseJson(4, 'v4', '2026-10-19T00:00:00Z')]);
    await h.container.read(releaseTimelineSessionProvider.notifier).refresh();
    expect(keys(h.container), ['R_a:4']);
    expect(readState(h.container).cacheFailed, isTrue);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:3']);
  });

  test('foreground pruning expires saved publications without refreshing the timeline', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(
      h,
      days: 1,
      releases: [releaseJson(3, 'v3', '2026-10-18T12:00:00Z')],
    );
    await settle(h.container);
    await disk.close();
    var currentTime = disk.now;
    h = disk.open(now: () => currentTime);
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:3']);
    final before = h.session.requests.toList();
    currentTime = currentTime.add(const Duration(microseconds: 1));
    await h.container
        .read(releaseTimelineSessionProvider.notifier)
        .pruneRetainedHistory();
    expect(keys(h.container), isEmpty);
    expect(h.session.requests, before);
  });

  test('stable account identity survives a login rename but cannot cross a backend base path', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(3, 'v3', '2026-10-18T00:00:00Z')]);
    await settle(h.container);
    await disk.close();
    final original = signedInIdentity(githubId: '1');
    h = disk.open(
      identity: AuthenticatedIdentity(
        backend: original.backend,
        githubId: original.githubId,
        login: 'renamed-account',
        name: '',
        avatarUrl: '',
      ),
    );
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:3']);
    await disk.close();
    h = disk.open(
      identity: AuthenticatedIdentity(
        backend: Uri.parse('https://gitpulse.example/other-base/'),
        githubId: original.githubId,
        login: original.login,
        name: '',
        avatarUrl: '',
      ),
    );
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
  });

  test('logout prevents an outstanding response from republishing or persisting records', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(3, 'v3', '2026-10-18T00:00:00Z')]);
    await settle(h.container);
    final held = Completer<BackendResult>();
    h.session.handlers['POST api/release-timeline/refresh'] = () => held.future;
    final action = h.container
        .read(releaseTimelineSessionProvider.notifier)
        .refresh();
    await pumpEventQueue(times: 30);
    h.session.emit(const SessionState());
    held.complete(
      BackendResult(
        statusCode: 200,
        data: roundJson(
          pages: {
            'R_a': pageJson('octo', 'alpha', [
              releaseJson(4, 'v4', '2026-10-19T00:00:00Z'),
            ]),
          },
        ),
      ),
    );
    await action;
    expect(keys(h.container), isEmpty);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
  });
  test('a failed first settings fetch permits fresh session-only reading while caching waits', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(3, 'v3', '2026-10-18T00:00:00Z')]);
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:3']);
    expect(readState(h.container).savedAt, isNull);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), isEmpty);
  });
  test('a failed policy write cannot persist fresh content using the previous longer window', () async {
    final disk = await DiskTimeline.create();
    var h = disk.open();
    configure(h, releases: [releaseJson(3, 'v3', '2026-10-18T00:00:00Z')]);
    await settle(h.container);
    await disk.cache!.customStatement(
      "CREATE TEMP TRIGGER fail_policy BEFORE UPDATE OF retention_days ON cache_account WHEN NEW.retention_days = 1 BEGIN SELECT RAISE(ABORT, 'disk full'); END",
    );
    configure(
      h,
      days: 1,
      releases: [releaseJson(4, 'v4', '2026-10-19T00:00:00Z')],
    );
    await h.container.read(releaseTimelineSessionProvider.notifier).refresh();
    expect(keys(h.container), ['R_a:4']);
    expect(readState(h.container).cacheFailed, isTrue);
    await disk.close();
    h = disk.open();
    h.session.handlers['GET api/settings'] = () =>
        const BackendResult(problem: BackendProblem.network);
    h.session.handlers['POST api/release-timeline/refresh'] = () =>
        const BackendResult(problem: BackendProblem.network);
    await settle(h.container);
    expect(keys(h.container), ['R_a:3']);
  });
}
