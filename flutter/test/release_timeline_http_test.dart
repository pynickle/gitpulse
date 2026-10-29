import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:drift/native.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:gitpulse/timeline/timeline_filters.dart';

import 'support/app_overrides.dart';
import 'support/release_timeline_server.dart';
import 'support/provider_wait.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('the real routes load the timeline, advance the shared baseline on usable rounds, and keep it on failed ones', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final overrides = HttpOverrides.current;
    HttpOverrides.global = null;
    addTearDown(() => HttpOverrides.global = overrides);
    final server = await TimelineHttpServer.start();
    addTearDown(server.close);
    final backend = server.address;
    await const FlutterSecureStorage().write(
      key: 'last_successful_backend',
      value: backend.toString(),
    );
    final cache = TimelineCache(NativeDatabase.memory());
    addTearDown(cache.close);
    final container = ProviderContainer(
      overrides: [...gitPulseHarnessOverrides(timelineCache: cache)],
    );
    addTearDown(container.dispose);
    container.listen(sessionControllerProvider, (_, _) {});
    container.listen(releaseTimelineSessionProvider, (_, _) {});
    await container.read(connectionControllerProvider.future);
    final dio = container.read(connectionDioProvider);

    final signIn = await dio.post<Object?>('${backend}test/sign-in');
    expect(signIn.statusCode, 200);

    await container
        .read(connectionControllerProvider.notifier)
        .connect(backend.toString());
    await waitForSession(
      container,
      (state) => state.phase == SessionPhase.signedIn,
    );
    expect(
      container.read(sessionControllerProvider).identity?.login,
      'octocat',
    );

    Future<Object?> setScenario(Map<String, Object?> body) async {
      final response = await dio.post<Object?>(
        '${backend}test/scenario',
        data: body,
      );
      expect(response.statusCode, 200);
      return response.data;
    }

    Future<Object?> readBaseline() async {
      final response = await dio.get<Object?>('${backend}test/baseline');
      expect(response.statusCode, 200);
      return (response.data as Map)['baseline'];
    }

    final facade = container.read(releaseTimelineSessionProvider.notifier);
    await setScenario({
      'follows': [
        {'id': 'R_alpha', 'owner': 'octo', 'name': 'alpha'},
      ],
      'pages': {
        'R_alpha': fixturePage('octo', 'alpha', [
          fixtureRelease(
            12,
            'v1.2',
            '2026-10-05T10:00:00Z',
            description:
                '修复 **登录** 问题 [docs](https://example.com/HIDDENPATH) '
                'before![badge](https://img.example/HIDDENSRC)after',
          ),
          fixtureRelease(11, 'v1.1', '2026-10-04T10:00:00Z'),
        ]),
      },
    });

    await facade.refresh();

    var state = container.read(releaseTimelineSessionProvider);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key),
      ['R_alpha:12', 'R_alpha:11'],
    );
    expect(state.failure, isNull);
    expect(
      state.groups.first.items.first.notesSearchText,
      '修复 登录 问题 docs before badge after',
    );
    facade.applyFilters(
      const TimelineFilterState(query: '"修复 登录 问题"', includeReleaseNotes: true),
    );
    expect(
      container
          .read(releaseTimelineSessionProvider)
          .visibleGroups
          .expand((g) => g.items)
          .map((item) => item.key),
      ['R_alpha:12'],
    );
    facade.applyFilters(
      const TimelineFilterState(
        query: '"before badge after"',
        includeReleaseNotes: true,
      ),
    );
    expect(
      container
          .read(releaseTimelineSessionProvider)
          .visibleGroups
          .expand((g) => g.items)
          .map((item) => item.key),
      ['R_alpha:12'],
    );
    facade.applyFilters(
      const TimelineFilterState(query: 'HIDDENPATH', includeReleaseNotes: true),
    );
    expect(
      container.read(releaseTimelineSessionProvider).visibleGroups,
      isEmpty,
    );
    facade.applyFilters(const TimelineFilterState());
    // The first usable round establishes the shared baseline without calling
    // the loaded history new.
    expect(state.previousBaseline, isNull);
    expect(state.loadedNewCount, 0);
    final firstBaseline = await readBaseline();
    expect(firstBaseline, isNotNull);

    // A release published after the captured baseline counts as loaded new.
    await setScenario({
      'pages': {
        'R_alpha': fixturePage('octo', 'alpha', [
          fixtureRelease(13, 'v1.3', DateTime.now().toUtc().toIso8601String()),
          fixtureRelease(12, 'v1.2', '2026-10-05T10:00:00Z'),
          fixtureRelease(11, 'v1.1', '2026-10-04T10:00:00Z'),
        ]),
      },
    });

    await facade.refresh();

    state = container.read(releaseTimelineSessionProvider);
    expect(state.previousBaseline, firstBaseline);
    expect(state.loadedNewCount, 1);
    expect(
      state.groups.expand((group) => group.items).map((item) => item.key).first,
      'R_alpha:13',
    );
    expect(await readBaseline(), isNot(firstBaseline));

    // Pagination and recovery read the real GET route, so they cannot advance
    // the shared account baseline, even when they return usable releases.
    await setScenario({
      'pages': {
        'R_alpha': {
          ...fixturePage('octo', 'alpha', [
            fixtureRelease(13, 'v1.3', '2026-10-06T10:00:00Z'),
          ]),
          'hasOlderReleases': true,
          'endCursor': 'cursor-1',
        },
      },
    });
    await facade.refresh();
    final pagingBaseline = await readBaseline();
    final capturedBaseline = container
        .read(releaseTimelineSessionProvider)
        .previousBaseline;
    await setScenario({
      'pages': {
        'R_alpha': {'status': 'transient'},
      },
    });
    await facade.loadOlder();
    expect(container.read(releaseTimelineSessionProvider).canRetry, isTrue);
    expect(await readBaseline(), pagingBaseline);
    await setScenario({
      'pages': {
        'R_alpha': fixturePage('octo', 'alpha', [
          fixtureRelease(11, 'v1.1', '2026-10-04T10:00:00Z'),
        ]),
      },
    });
    await facade.retryFailed();
    state = container.read(releaseTimelineSessionProvider);
    expect(state.groups.last.items.last.notesSearchText, '');
    expect(state.groups.expand((g) => g.items).map((item) => item.key), [
      'R_alpha:13',
      'R_alpha:11',
    ]);
    expect(state.canRetry, isFalse);
    expect(state.previousBaseline, capturedBaseline);
    expect(await readBaseline(), pagingBaseline);

    // A wholly failed round reports a retryable failure, keeps what is
    // readable, and must not move the shared baseline.
    final baselineBeforeFailure = await readBaseline();
    await setScenario({
      'pages': {
        'R_alpha': {'status': 'transient'},
      },
    });

    await facade.refresh();

    state = container.read(releaseTimelineSessionProvider);
    expect(state.failure, isNotNull);
    expect(state.canRetry, isTrue);
    expect(state.hasReleases, isTrue);
    expect(state.previousBaseline, capturedBaseline);
    expect(await readBaseline(), baselineBeforeFailure);

    // Another installation already refreshed later: the shared baseline must
    // survive this client's next usable round instead of regressing to it.
    await setScenario({
      'pages': {
        'R_alpha': fixturePage('octo', 'alpha', [
          fixtureRelease(11, 'v1.1', '2026-10-04T10:00:00Z'),
        ]),
      },
    });
    final futureBaseline = DateTime.now()
        .toUtc()
        .add(const Duration(days: 1))
        .toIso8601String();
    final seeded = await dio.post<Object?>(
      '${backend}test/seed-baseline',
      data: {'baseline': futureBaseline},
    );
    expect(seeded.statusCode, 200);

    await facade.refresh();

    state = container.read(releaseTimelineSessionProvider);
    expect(state.previousBaseline, futureBaseline);
    expect(state.loadedNewCount, 0);
    expect(await readBaseline(), futureBaseline);
  });

  test('follow changes and a different account invalidate the window through the real routes', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final overrides = HttpOverrides.current;
    HttpOverrides.global = null;
    addTearDown(() => HttpOverrides.global = overrides);
    final server = await TimelineHttpServer.start();
    addTearDown(server.close);
    final backend = server.address;
    await const FlutterSecureStorage().write(
      key: 'last_successful_backend',
      value: backend.toString(),
    );
    final cache = TimelineCache(NativeDatabase.memory());
    addTearDown(cache.close);
    final container = ProviderContainer(
      overrides: [...gitPulseHarnessOverrides(timelineCache: cache)],
    );
    addTearDown(container.dispose);
    container.listen(sessionControllerProvider, (_, _) {});
    container.listen(releaseTimelineSessionProvider, (_, _) {});
    await container.read(connectionControllerProvider.future);
    final dio = container.read(connectionDioProvider);

    await dio.post<Object?>('${backend}test/sign-in');
    await container
        .read(connectionControllerProvider.notifier)
        .connect(backend.toString());
    await waitForSession(
      container,
      (state) => state.phase == SessionPhase.signedIn,
    );

    Future<void> setScenario(Map<String, Object?> body) async {
      final response = await dio.post<Object?>(
        '${backend}test/scenario',
        data: body,
      );
      expect(response.statusCode, 200);
    }

    await setScenario({
      'follows': [
        {'id': 'R_alpha', 'owner': 'octo', 'name': 'alpha'},
      ],
      'pages': {
        'R_alpha': fixturePage('octo', 'alpha', [
          fixtureRelease(11, 'v1.1', '2026-10-04T10:00:00Z'),
        ]),
      },
    });
    final settings = await dio.get<Object?>('${backend}api/settings');
    expect(settings.statusCode, 200);
    expect(
      (settings.data as Map)['followedRepositories'],
      hasLength(1),
      reason: 'the fixture stored the Followed Repository for this account',
    );

    final facade = container.read(releaseTimelineSessionProvider.notifier);
    await facade.refresh();
    var first = container.read(releaseTimelineSessionProvider);
    expect(first.loading, isFalse);
    expect(first.failure, isNull);
    expect(first.hasFollows, isTrue);
    expect(
      first.groups.expand((group) => group.items).map((item) => item.key),
      ['R_alpha:11'],
    );

    // Following a different repository starts a new cycle with its own page.
    await setScenario({
      'follows': [
        {'id': 'R_beta', 'owner': 'octo', 'name': 'beta'},
      ],
      'pages': {
        'R_beta': fixturePage('octo', 'beta', [
          fixtureRelease(21, 'v2.0', '2026-10-04T11:00:00Z'),
        ]),
      },
    });
    await facade.reloadFollows();
    expect(
      container
          .read(releaseTimelineSessionProvider)
          .groups
          .expand((group) => group.items)
          .map((item) => item.key),
      ['R_beta:21'],
    );

    // Another account never inherits the previous account's window.
    await container.read(sessionControllerProvider.notifier).leaveBackend();
    await dio.post<Object?>('${backend}test/sign-in', data: {'login': 'hubot'});
    await container
        .read(connectionControllerProvider.notifier)
        .connect(backend.toString());
    await waitForSession(
      container,
      (state) => state.identity?.login == 'hubot',
    );

    final state = container.read(releaseTimelineSessionProvider);
    expect(state.active, isTrue);
    expect(state.hasFollows, isFalse);
    expect(state.groups, isEmpty);
  });
}
