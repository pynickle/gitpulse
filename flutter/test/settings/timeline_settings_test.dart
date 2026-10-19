import 'dart:io';
import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:drift/native.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:path/path.dart' as p;

import '../release_timeline_http_test.dart';

class SettingsInstallation {
  SettingsInstallation(this.directory, this.server);

  final Directory directory;
  final TimelineHttpServer server;
  final now = DateTime.utc(2026, 10, 19, 12);
  late TimelineCache cache;
  late ProviderContainer container;
  bool _opened = false;

  Future<void> open() async {
    _opened = true;
    cache = TimelineCache(
      NativeDatabase(File(p.join(directory.path, 'timeline.sqlite'))),
    );
    container = ProviderContainer(
      overrides: [
        timelineCacheProvider.overrideWithValue(cache),
        timelineClockProvider.overrideWithValue(() => now),
      ],
    );
    container.listen(sessionControllerProvider, (_, _) {});
    await container.read(connectionControllerProvider.future);
    final dio = container.read(connectionDioProvider);
    await dio.post<Object?>(
      '${server.address}test/sign-in',
      data: {'githubId': 1},
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

Future<void> settleUi(WidgetTester tester) async {
  // Real HTTP and SQLite need the host event loop, outside the widget clock.
  for (var i = 0; i < 40; i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 10)),
    );
    await tester.pump(const Duration(milliseconds: 50));
  }
}

Future<SettingsInstallation> startInstallation(WidgetTester tester) async {
  final original = HttpOverrides.current;
  HttpOverrides.global = null;
  addTearDown(() => HttpOverrides.global = original);
  FlutterSecureStorage.setMockInitialValues({});
  return (await tester.runAsync(() async {
    final server = await TimelineHttpServer.start();
    final directory = await Directory.systemTemp.createTemp(
      'gitpulse-settings-',
    );
    final app = SettingsInstallation(directory, server);
    addTearDown(() async {
      await app.close();
      await directory.delete(recursive: true);
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

Future<void> mountSettings(
  WidgetTester tester,
  SettingsInstallation app,
) async {
  await tester.runAsync(() async {
    app.container.read(releaseTimelineSessionProvider);
    final deadline = DateTime.now().add(const Duration(seconds: 10));
    while (!app.container.read(releaseTimelineSessionProvider).active ||
        app.container.read(releaseTimelineSessionProvider).loading) {
      if (DateTime.now().isAfter(deadline)) {
        throw StateError('Timeline did not settle');
      }
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
  });
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: app.container,
      child: const GitPulseApp(),
    ),
  );
  await settleUi(tester);
  await tester.tap(find.text('Settings').last);
  await settleUi(tester);
  await tester.ensureVisible(find.byType(TextFormField));
  await tester.pumpAndSettle();
}

Future<void> saveDays(WidgetTester tester, String days) async {
  await tester.enterText(find.byType(TextFormField), days);
  await tester.ensureVisible(find.text('Save retention'));
  await tester.runAsync(() => tester.tap(find.text('Save retention')));
  await settleUi(tester);
}

void failRequests(
  SettingsInstallation app,
  bool Function(RequestOptions) matches,
) {
  app.container
      .read(connectionDioProvider)
      .interceptors
      .add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (matches(options)) {
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
}

Future<void> reopenOffline(
  WidgetTester tester,
  SettingsInstallation app,
) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.runAsync(() async {
    await app.close();
    await app.open();
    failRequests(
      app,
      (options) =>
          options.method == 'GET' && options.path.endsWith('api/settings') ||
          options.path.endsWith('api/release-timeline/refresh'),
    );
  });
  await mountSettings(tester, app);
}

void main() {
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
      final clear = find.text('Clear local timeline cache');
      await tester.ensureVisible(clear);
      await tester.runAsync(() => tester.tap(clear));
      await tester.pump();
      expect(
        app.container
            .read(releaseTimelineSessionProvider)
            .cacheSettings
            .clearing,
        isTrue,
      );
      await tester.runAsync(() async {
        final follows = app.container
            .read(releaseTimelineSessionProvider.notifier)
            .reloadFollows();
        releaseStorage.complete();
        await storageLock;
        await follows;
      });
      await settleUi(tester);
      expect(
        app.container
            .read(releaseTimelineSessionProvider)
            .cacheSettings
            .clearing,
        isFalse,
      );
      await saveDays(tester, '1');
      expect(find.text('Last synchronized retention: 1 days'), findsOneWidget);
      await tester.runAsync(() async {
        // Reverse ordering must also leave clear completion current.
        final facade = app.container.read(
          releaseTimelineSessionProvider.notifier,
        );
        final reload = facade.reloadFollows();
        final clear = facade.clearCache();
        await Future.wait([reload, clear]);
      });
      expect(
        app.container
            .read(releaseTimelineSessionProvider)
            .cacheSettings
            .clearing,
        isFalse,
      );
      expect(app.releases, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'a pending save keeps the old policy and completes before a concurrent follow reload',
    (tester) async {
      final app = await startInstallation(tester);
      await mountSettings(tester, app);
      late RequestOptions pending;
      late RequestInterceptorHandler confirmation;
      app.container
          .read(connectionDioProvider)
          .interceptors
          .add(
            InterceptorsWrapper(
              onRequest: (options, handler) {
                if (options.method == 'PUT') {
                  pending = options;
                  confirmation = handler;
                } else {
                  handler.next(options);
                }
              },
            ),
          );
      await saveDays(tester, '1');
      expect(find.text('Saving retention…'), findsOneWidget);
      expect(find.text('Last synchronized retention: 30 days'), findsOneWidget);
      await tester.runAsync(() async {
        final follows = app.container
            .read(releaseTimelineSessionProvider.notifier)
            .reloadFollows();
        confirmation.next(pending);
        await follows;
      });
      await settleUi(tester);
      expect(find.text('Last synchronized retention: 1 days'), findsOneWidget);
      await reopenOffline(tester, app);
      expect(app.releases, ['R_alpha:3', 'R_alpha:2']);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'retention synchronizes across installations and server validation isolates accounts',
    (tester) async {
      final app = await startInstallation(tester);
      await mountSettings(tester, app);
      await saveDays(tester, '1');
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.runAsync(() async {
        await app.close();
        final web = createGitPulseDio(CookieJar())
          ..options.baseUrl = app.server.address.toString();
        addTearDown(() => web.close(force: true));
        await web.post<Object?>('test/sign-in');
        expect(
          (await web.get<Map<String, dynamic>>('api/settings'))
              .data!['releaseTimeline']['retentionDays'],
          1,
        );
        for (final days in [0, 91, 1.5, '30', null]) {
          final rejected = await web.put<Object?>(
            'api/settings',
            data: {
              'releaseTimeline': {'retentionDays': days},
            },
            options: Options(validateStatus: (_) => true),
          );
          expect(rejected.statusCode, 400);
        }
        final directory = await Directory.systemTemp.createTemp(
          'gitpulse-second-installation-',
        );
        final other = SettingsInstallation(directory, app.server);
        try {
          await other.open();
          other.container.read(releaseTimelineSessionProvider);
          while (!other.container.read(releaseTimelineSessionProvider).active ||
              other.container.read(releaseTimelineSessionProvider).loading) {
            await Future<void>.delayed(const Duration(milliseconds: 10));
          }
          expect(
            other.container
                .read(releaseTimelineSessionProvider)
                .cacheSettings
                .retentionDays,
            1,
            reason:
                'failure=${other.container.read(releaseTimelineSessionProvider).failure?.kind} cache=${other.container.read(releaseTimelineSessionProvider).cacheFailed} sync=${other.container.read(releaseTimelineSessionProvider).cacheSettings.syncFailed}',
          );
          await web.put<Object?>(
            'api/settings',
            data: {
              'releaseTimeline': {'retentionDays': 90},
            },
          );
          expect(
            other.container
                .read(releaseTimelineSessionProvider)
                .cacheSettings
                .retentionDays,
            1,
          );
          await other.container
              .read(releaseTimelineSessionProvider.notifier)
              .refresh();
          expect(
            other.container
                .read(releaseTimelineSessionProvider)
                .cacheSettings
                .retentionDays,
            90,
          );
          await web.post<Object?>('test/sign-in', data: {'login': 'hubot'});
          expect(
            (await web.get<Map<String, dynamic>>('api/settings'))
                .data!['releaseTimeline']['retentionDays'],
            30,
          );
        } finally {
          await other.close();
          await directory.delete(recursive: true);
        }
      });
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('shortening prunes durable history; expanding needs a new fetch', (
    tester,
  ) async {
    final app = await startInstallation(tester);
    await mountSettings(tester, app);
    expect(app.releases, ['R_alpha:3', 'R_alpha:2', 'R_alpha:1']);
    await saveDays(tester, '1');
    // The online browsing window remains readable, including old publications.
    expect(app.releases, ['R_alpha:3', 'R_alpha:2', 'R_alpha:1']);
    await reopenOffline(tester, app);
    expect(app.releases, ['R_alpha:3', 'R_alpha:2']);
    expect(find.text('Last synchronized retention: 1 days'), findsOneWidget);
    await saveDays(tester, '90');
    expect(app.releases, ['R_alpha:3', 'R_alpha:2']);
    await reopenOffline(tester, app);
    expect(app.releases, ['R_alpha:3', 'R_alpha:2']);
    expect(find.text('Last synchronized retention: 90 days'), findsOneWidget);
    await tester.runAsync(() async {
      app.container.read(connectionDioProvider).interceptors.removeLast();
      await app.container
          .read(releaseTimelineSessionProvider.notifier)
          .refresh();
    });
    expect(app.releases, ['R_alpha:3', 'R_alpha:2', 'R_alpha:1']);
    await reopenOffline(tester, app);
    expect(app.releases, ['R_alpha:3', 'R_alpha:2', 'R_alpha:1']);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'invalid input and failed saves keep the last synchronized policy',
    (tester) async {
      final app = await startInstallation(tester);
      await mountSettings(tester, app);
      for (final value in ['0', '91', '1.5', '']) {
        await saveDays(tester, value);
        expect(find.text('Enter a whole number from 1 to 90.'), findsOneWidget);
      }
      failRequests(
        app,
        (options) =>
            options.method == 'PUT' && options.path.endsWith('api/settings'),
      );
      await saveDays(tester, '1');
      expect(find.textContaining('Could not save retention.'), findsOneWidget);
      expect(find.text('Last synchronized retention: 30 days'), findsOneWidget);
      await reopenOffline(tester, app);
      expect(app.releases, ['R_alpha:3', 'R_alpha:2', 'R_alpha:1']);
      expect(find.textContaining('Using the last valid value'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'a new identity reports missing synchronization and keeps fresh data session-only',
    (tester) async {
      final app = await startInstallation(tester);
      failRequests(
        app,
        (options) =>
            options.method == 'GET' && options.path.endsWith('api/settings'),
      );
      await mountSettings(tester, app);
      expect(app.releases, ['R_alpha:3', 'R_alpha:2', 'R_alpha:1']);
      expect(find.text('No synchronized retention value yet.'), findsOneWidget);
      expect(find.textContaining('will not be saved until'), findsOneWidget);
      await reopenOffline(tester, app);
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
      final clear = find.text('Clear local timeline cache');
      await tester.ensureVisible(clear);
      await tester.runAsync(() => tester.tap(clear));
      await settleUi(tester);
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
      expect(find.text('Last synchronized retention: 30 days'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'Settings saves account retention without replacing other preferences',
    (tester) async {
      final app = await startInstallation(tester);
      await tester.runAsync(() async {
        final web = createGitPulseDio(CookieJar())
          ..options.baseUrl = app.server.address.toString();
        addTearDown(() => web.close(force: true));
        await web.post<Object?>('test/sign-in');
        await web.put<Object?>(
          'api/settings',
          data: {
            'navigation': {'linkTarget': 'github'},
            'releaseTimeline': {'showReactions': false},
          },
        );
      });
      await mountSettings(tester, app);
      expect(find.widgetWithText(TextFormField, '30'), findsOneWidget);
      await saveDays(tester, '1');
      await tester.runAsync(() async {
        final settings =
            (await app.container
                    .read(connectionDioProvider)
                    .get<Map<String, dynamic>>(
                      '${app.server.address}api/settings',
                    )
                    .timeout(const Duration(seconds: 5)))
                .data!;
        expect(settings['releaseTimeline'], {
          'showReactions': false,
          'retentionDays': 1,
        });
        expect(settings['navigation'], {'linkTarget': 'github'});
      });
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
