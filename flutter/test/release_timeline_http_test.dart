import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

/// Runs the real Nitro timeline routes behind a fixture that supplies only the
/// GitHub reads, so the app exercises the server's own contracts.
class TimelineHttpServer {
  TimelineHttpServer._(this.address);

  final Uri address;

  static Future<TimelineHttpServer> start() async {
    final directory = await Directory.systemTemp.createTemp(
      'gitpulse-timeline-http-',
    );
    // The fixture's `#shared/*` and `#server/*` imports resolve through the
    // generated Nuxt tsconfig, which a plain `bun script.ts` run does not read.
    final process = await Process.start('bun', [
      '--tsconfig-override',
      File('../.nuxt/tsconfig.json').absolute.path,
      '../tests/fixtures/release-timeline-server.ts',
      directory.path,
    ]);
    final output = StringBuffer();
    final address = Completer<String>();
    void collect(String line) {
      output.write('$line\n');
      if (!address.isCompleted && line.startsWith('http')) {
        address.complete(line);
      }
    }

    process.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(collect);
    process.stderr
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(collect);
    addTearDown(() async {
      process.kill();
      await process.exitCode.timeout(const Duration(seconds: 10));
      await directory.delete(recursive: true);
    });
    final ready =
        await Future.any<String>([
          address.future,
          process.exitCode.then(
            (code) => throw StateError('Fixture exited with $code: $output'),
          ),
        ]).timeout(
          const Duration(seconds: 20),
          onTimeout: () => throw StateError('Fixture did not start: $output'),
        );
    return TimelineHttpServer._(Uri.parse(ready));
  }
}

Future<void> waitForSession(
  ProviderContainer container,
  bool Function(SessionState) matches,
) async {
  final deadline = DateTime.now().add(const Duration(seconds: 15));
  while (!matches(container.read(sessionControllerProvider))) {
    if (DateTime.now().isAfter(deadline)) {
      throw StateError('Timed out waiting for the session');
    }
    await Future<void>.delayed(const Duration(milliseconds: 25));
  }
}

Map<String, Object?> fixtureRelease(
  int id,
  String tag,
  String publishedAt, {
  String? description,
}) => {
  'id': id,
  'tagName': tag,
  'name': null,
  'description': description,
  'publishedAt': publishedAt,
  'isDraft': false,
  'isPrerelease': false,
  'assetCount': 0,
  'htmlUrl': 'https://github.test/octo/alpha/releases/tag/$tag',
  'reactions': const <Object?>[],
};

Map<String, Object?> fixturePage(
  String owner,
  String name,
  List<Map<String, Object?>> releases,
) => {
  'status': 'available',
  'owner': owner,
  'name': name,
  'hasOlderReleases': false,
  'endCursor': null,
  'incomplete': false,
  'releases': releases,
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('the real routes load the timeline, advance the shared baseline on usable rounds, and keep it on failed ones', () async {
    FlutterSecureStorage.setMockInitialValues({});
    final overrides = HttpOverrides.current;
    HttpOverrides.global = null;
    addTearDown(() => HttpOverrides.global = overrides);
    final server = await TimelineHttpServer.start();
    final backend = server.address;
    await const FlutterSecureStorage().write(
      key: 'last_successful_backend',
      value: backend.toString(),
    );
    final container = ProviderContainer();
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
          fixtureRelease(12, 'v1.2', '2026-10-05T10:00:00Z'),
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
    final backend = server.address;
    await const FlutterSecureStorage().write(
      key: 'last_successful_backend',
      value: backend.toString(),
    );
    final container = ProviderContainer();
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
