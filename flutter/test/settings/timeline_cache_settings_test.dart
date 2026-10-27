import 'dart:async';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/device/device_preferences_controller.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:path/path.dart' as p;

import '../support/app_overrides.dart';
import '../support/provider_wait.dart';
import '../support/settling.dart';
import '../support/release_timeline_server.dart';

late TimelineHttpServer settingsServer;
int installationId = 0;

/// One installation: a real server, a real SQLite file, and a real device
/// preferences file beside them.
class SettingsInstallation {
  SettingsInstallation(this.directory, this.server, {required this.login});

  final Directory directory;
  final String login;
  final TimelineHttpServer server;
  final now = DateTime.utc(2026, 10, 19, 12);
  late TimelineCache cache;
  late ProviderContainer container;
  bool _opened = false;

  File get deviceFile => File(p.join(directory.path, 'presentation.json'));

  Future<void> open() async {
    _opened = true;
    cache = TimelineCache(
      NativeDatabase(File(p.join(directory.path, 'timeline.sqlite'))),
    );
    container = ProviderContainer(
      overrides: [
        ...gitPulseHarnessOverrides(
          preferencesFile: () async => deviceFile,
          timelineCache: cache,
          timelineNow: () => now,
        ),
      ],
    );
    container.listen(sessionControllerProvider, (_, _) {});
    await container.read(connectionControllerProvider.future);
    final dio = container.read(connectionDioProvider);
    await dio.post<Object?>(
      '${server.address}test/sign-in',
      data: {'githubId': 1, 'login': login},
    );
    await container
        .read(connectionControllerProvider.notifier)
        .connect(server.address.toString());
    await waitForSession(
      container,
      (state) => state.phase == SessionPhase.signedIn && !state.busy,
    );
  }

  Future<void> close() async {
    if (!_opened) return;
    _opened = false;
    container.dispose();
    await cache.close();
  }

  List<String> get releases => container
      .read(releaseTimelineSessionProvider)
      .groups
      .expand((group) => group.items)
      .map((item) => item.key)
      .toList();
}

/// Wait for the operation being driven, then finish its UI transitions.
Future<void> settle(WidgetTester tester, SettingsInstallation app) async {
  // Dispatch dialog completion before observing whether its clear has finished.
  await tester.pump();
  await pumpUntil(
    tester,
    () => !app.container
        .read(releaseTimelineSessionProvider)
        .cacheActions
        .clearing,
    reason: 'finish clearing the timeline cache',
  );
  await tester.pumpAndSettle();
}

Future<SettingsInstallation> startInstallation(WidgetTester tester) async {
  final original = HttpOverrides.current;
  HttpOverrides.global = null;
  addTearDown(() => HttpOverrides.global = original);
  FlutterSecureStorage.setMockInitialValues({});
  return (await tester.runAsync(() async {
    final server = settingsServer;
    final directory = await Directory.systemTemp.createTemp(
      'gitpulse-settings-',
    );
    // Reuse the process, while settings and baselines stay isolated by login.
    // Each installation also gets its own SQLite and device files.
    final app = SettingsInstallation(
      directory,
      server,
      login: 'settings-${++installationId}',
    );
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox.shrink());
      await pumpOperation(tester, app.close, reason: 'close settings cache');
      await tester.runAsync(() => directory.delete(recursive: true));
    });
    await const FlutterSecureStorage().write(
      key: 'last_successful_backend',
      value: server.address.toString(),
    );
    await app.open();
    await app.container
        .read(connectionDioProvider)
        .post<Object?>(
          '${server.address}test/scenario',
          data: {
            'follows': [
              {'id': 'R_alpha', 'owner': 'octo', 'name': 'alpha'},
            ],
            'pages': {
              'R_alpha': {
                ...fixturePage('octo', 'alpha', [
                  fixtureRelease(3, 'recent', '2026-10-19T00:00:00Z'),
                  fixtureRelease(2, 'boundary', '2026-10-18T12:00:00Z'),
                  fixtureRelease(1, 'older', '2026-10-10T00:00:00Z'),
                ]),
                'hasOlderReleases': true,
                'endCursor': 'next-page',
              },
            },
          },
        );
    return app;
  }))!;
}

/// The retention editor: the field the window in force is shown in.
final retentionField = find.byKey(const ValueKey('retention-days'));

/// Asserts the retention editor paints [value]: what the reader sees, not only
/// what the controller behind it holds.
void expectRetentionShown(WidgetTester tester, String value) => expect(
  find.descendant(of: retentionField, matching: find.text(value)),
  findsOneWidget,
);

Future<void> mountSettings(
  WidgetTester tester,
  SettingsInstallation app,
) async {
  await tester.runAsync(() async {
    await app.container.read(devicePreferencesProvider.future);
    await waitForProvider(
      app.container,
      releaseTimelineSessionProvider,
      (state) => state.active && !state.loading,
    );
  });
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: app.container,
      child: const GitPulseApp(),
    ),
  );
  await settle(tester, app);
  await tester.tap(find.text('Settings').last);
  await settle(tester, app);
  await tester.ensureVisible(retentionField);
  await tester.pumpAndSettle();
}

Future<void> reopenOffline(
  WidgetTester tester,
  SettingsInstallation app,
) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.runAsync(() async {
    await app.close();
    await app.open();
    app.container
        .read(connectionDioProvider)
        .interceptors
        .add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              if (options.method == 'GET' &&
                      options.path.endsWith('api/settings') ||
                  options.path.endsWith('api/release-timeline/refresh')) {
                handler.reject(
                  DioException(
                    requestOptions: options,
                    type: DioExceptionType.connectionError,
                  ),
                );
              } else {
                handler.next(options);
              }
            },
          ),
        );
  });
  await mountSettings(tester, app);
}

void main() {
  setUpAll(() async => settingsServer = await TimelineHttpServer.start());
  tearDownAll(() => settingsServer.close());

  testWidgets(
    'a follow reload waits for a blocked SQLite clear and leaves actions usable',
    (tester) async {
      final app = await startInstallation(tester);
      await mountSettings(tester, app);
      late Completer<void> releaseStorage;
      late Future<void> storageLock;
      // Hold a real SQLite transaction to make the clear/follow overlap deterministic.
      await tester.runAsync(() async {
        releaseStorage = Completer<void>();
        final locked = Completer<void>();
        storageLock = app.cache.transaction(() async {
          await app.cache.customSelect('SELECT 1').get();
          locked.complete();
          await releaseStorage.future;
        });
        await locked.future;
      });
      addTearDown(() async {
        if (!releaseStorage.isCompleted) releaseStorage.complete();
        await pumpOperation(
          tester,
          () => storageLock,
          reason: 'release the SQLite transaction',
        );
      });
      final clear = find.widgetWithText(OutlinedButton, 'Clear');
      await tester.ensureVisible(clear);
      await tester.tap(clear);
      await tester.pump();
      await tester.runAsync(
        () => tester.tap(find.widgetWithText(TextButton, 'Clear')),
      );
      await tester.pump();
      expect(
        app.container
            .read(releaseTimelineSessionProvider)
            .cacheActions
            .clearing,
        isTrue,
      );
      await pumpOperation(tester, () async {
        final follows = app.container
            .read(releaseTimelineSessionProvider.notifier)
            .reloadFollows();
        releaseStorage.complete();
        await storageLock;
        await follows;
      }, reason: 'reload follows after clearing the cache');
      await settle(tester, app);
      expect(
        app.container
            .read(releaseTimelineSessionProvider)
            .cacheActions
            .clearing,
        isFalse,
      );
      await pumpOperation(tester, () async {
        // Reverse ordering must also leave clear completion current.
        final facade = app.container.read(
          releaseTimelineSessionProvider.notifier,
        );
        final reload = facade.reloadFollows();
        final clear = facade.clearCache();
        await Future.wait([reload, clear]);
      }, reason: 'finish overlapping reload and cache clear');
      expect(
        app.container
            .read(releaseTimelineSessionProvider)
            .cacheActions
            .clearing,
        isFalse,
      );
      expect(app.releases, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'clear-cache invalidates in-flight pagination and survives reopening without account changes',
    (tester) async {
      final app = await startInstallation(tester);
      await mountSettings(tester, app);
      late Map<String, dynamic> before;
      expect(
        app.container.read(releaseTimelineSessionProvider).canLoadOlder,
        isTrue,
      );
      late Object? baseline;
      await tester.runAsync(() async {
        final dio = app.container.read(connectionDioProvider);
        before = (await dio.get<Map<String, dynamic>>(
          '${app.server.address}api/settings',
        )).data!;
        baseline = (await dio.get<Map<String, dynamic>>(
          '${app.server.address}test/baseline',
        )).data!['baseline'];
      });
      late Completer<RequestInterceptorHandler> held;
      app.container
          .read(connectionDioProvider)
          .interceptors
          .add(
            InterceptorsWrapper(
              onRequest: (options, handler) {
                if (options.method == 'GET' &&
                    options.uri.path.endsWith('/api/release-timeline')) {
                  held.complete(handler);
                } else {
                  handler.next(options);
                }
              },
            ),
          );
      late Future<void> pagination;
      await tester.runAsync(() async {
        held = Completer<RequestInterceptorHandler>();
        pagination = app.container
            .read(releaseTimelineSessionProvider.notifier)
            .loadOlder();
        await held.future.timeout(const Duration(seconds: 5));
      });
      await tester.pump();
      final clear = find.widgetWithText(OutlinedButton, 'Clear');
      await tester.ensureVisible(clear);
      await tester.tap(clear);
      await tester.pump();
      await tester.runAsync(
        () => tester.tap(find.widgetWithText(TextButton, 'Clear')),
      );
      await settle(tester, app);
      expect(app.releases, isEmpty);
      expect(
        app.container.read(releaseTimelineSessionProvider).canLoadOlder,
        isFalse,
      );
      await tester.runAsync(() async {
        final handler = await held.future;
        handler.resolve(
          Response(
            requestOptions: RequestOptions(),
            statusCode: 200,
            data: {
              'pages': {
                'R_alpha': fixturePage('octo', 'alpha', [
                  fixtureRelease(4, 'late', '2026-10-19T01:00:00Z'),
                ]),
              },
            },
          ),
        );
        await pagination;
        final dio = app.container.read(connectionDioProvider);
        expect(
          (await dio.get<Map<String, dynamic>>(
            '${app.server.address}api/settings',
          )).data,
          before,
        );
        expect(
          (await dio.get<Map<String, dynamic>>(
            '${app.server.address}test/baseline',
          )).data!['baseline'],
          baseline,
        );
        expect(
          app.container.read(sessionControllerProvider).phase,
          SessionPhase.signedIn,
        );
      });
      expect(app.releases, isEmpty);
      await reopenOffline(tester, app);
      expect(app.releases, isEmpty);
      // Clearing saves nothing about the window: the device keeps its own.
      expectRetentionShown(tester, '30');
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
