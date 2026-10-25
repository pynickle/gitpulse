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
import 'package:gitpulse/presentation/presentation_preferences_controller.dart';
import 'package:gitpulse/presentation/presentation_preferences_store.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_session.dart';
import 'package:path/path.dart' as p;

import '../support/release_timeline_server.dart';
import '../support/provider_wait.dart';
import '../support/settling.dart';

late TimelineHttpServer settingsServer;
int installationId = 0;

class SettingsInstallation {
  SettingsInstallation(this.directory, this.server, {required this.login});

  final Directory directory;
  final String login;
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
        presentationPreferencesFileProvider.overrideWithValue(
          () async => File(p.join(directory.path, 'presentation.json')),
        ),
        timelineClockProvider.overrideWithValue(() => now),
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
  await tester.runAsync(
    () => waitForProvider(
      app.container,
      releaseTimelineSessionProvider,
      (state) => !state.cacheSettings.saving && !state.cacheSettings.clearing,
    ),
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
    // Each installation also gets its own SQLite and presentation files.
    final app = SettingsInstallation(
      directory,
      server,
      login: 'settings-${++installationId}',
    );
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

/// The retention editor: the field the account's synchronized policy is shown
/// in, and the only text field Settings carries for a signed-in account.
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
    await app.container.read(presentationPreferencesProvider.future);
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

Future<void> saveDays(
  WidgetTester tester,
  SettingsInstallation app,
  String days, {
  bool pending = false,
}) async {
  await tester.enterText(retentionField, days);
  await tester.pump();
  final save = find.byTooltip('Save retention');
  await tester.ensureVisible(save);
  await tester.runAsync(() => tester.tap(save));
  if (pending) {
    await tester.pump();
  } else {
    await settle(tester, app);
  }
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
      final clear = find.widgetWithText(OutlinedButton, 'Clear');
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
      await settle(tester, app);
      expect(
        app.container
            .read(releaseTimelineSessionProvider)
            .cacheSettings
            .clearing,
        isFalse,
      );
      await saveDays(tester, app, '1');
      expectRetentionShown(tester, '1');
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
      final saveStarted = Completer<void>();
      app.container
          .read(connectionDioProvider)
          .interceptors
          .add(
            InterceptorsWrapper(
              onRequest: (options, handler) {
                if (options.method == 'PUT') {
                  pending = options;
                  confirmation = handler;
                  saveStarted.complete();
                } else {
                  handler.next(options);
                }
              },
            ),
          );
      await saveDays(tester, app, '1', pending: true);
      await pumpUntil(
        tester,
        () => saveStarted.isCompleted,
        reason: 'the retention save reached the held PUT request',
      );
      // The save is in flight: the editor says so, and the account is still on
      // the policy it last synchronized.
      expect(
        app.container.read(releaseTimelineSessionProvider).cacheSettings.saving,
        isTrue,
      );
      expect(find.byTooltip('Save retention'), findsNothing);
      expect(
        app.container
            .read(releaseTimelineSessionProvider)
            .cacheSettings
            .retentionDays,
        30,
      );
      await tester.runAsync(() async {
        final follows = app.container
            .read(releaseTimelineSessionProvider.notifier)
            .reloadFollows();
        confirmation.next(pending);
        await follows;
      });
      await settle(tester, app);
      expectRetentionShown(tester, '1');
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
      await saveDays(tester, app, '1');
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.runAsync(() async {
        await app.close();
        final web = createGitPulseDio(CookieJar())
          ..options.baseUrl = app.server.address.toString();
        addTearDown(() => web.close(force: true));
        await web.post<Object?>('test/sign-in', data: {'login': app.login});
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
        final other = SettingsInstallation(
          directory,
          app.server,
          login: app.login,
        );
        try {
          await other.open();
          await waitForProvider(
            other.container,
            releaseTimelineSessionProvider,
            (state) => state.active && !state.loading,
          );
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
    await saveDays(tester, app, '1');
    // The online browsing window remains readable, including old publications.
    expect(app.releases, ['R_alpha:3', 'R_alpha:2', 'R_alpha:1']);
    await reopenOffline(tester, app);
    expect(app.releases, ['R_alpha:3', 'R_alpha:2']);
    expectRetentionShown(tester, '1');
    await saveDays(tester, app, '90');
    expect(app.releases, ['R_alpha:3', 'R_alpha:2']);
    await reopenOffline(tester, app);
    expect(app.releases, ['R_alpha:3', 'R_alpha:2']);
    expectRetentionShown(tester, '90');
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
        await saveDays(tester, app, value);
        expect(find.text('Enter a whole number from 1 to 90.'), findsOneWidget);
      }
      failRequests(
        app,
        (options) =>
            options.method == 'PUT' && options.path.endsWith('api/settings'),
      );
      await saveDays(tester, app, '1');
      expect(find.textContaining('Could not save retention.'), findsOneWidget);
      // The rejected edit stays in the editor to be retried, and the policy that
      // is still in force is stated beside it.
      expectRetentionShown(tester, '1');
      expect(find.text('Last synchronized retention: 30 days'), findsOneWidget);
      await reopenOffline(tester, app);
      expect(app.releases, ['R_alpha:3', 'R_alpha:2', 'R_alpha:1']);
      expect(find.textContaining('Using the last valid value'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'the editor offers a save, and Enter sends, only for an unsaved value',
    (tester) async {
      final app = await startInstallation(tester);
      await mountSettings(tester, app);
      var writes = 0;
      app.container
          .read(connectionDioProvider)
          .interceptors
          .add(
            InterceptorsWrapper(
              onRequest: (options, handler) {
                if (options.method == 'PUT') writes++;
                handler.next(options);
              },
            ),
          );

      expectRetentionShown(tester, '30');
      // The field holds the policy the account already has: there is nothing to
      // offer, and Enter cannot put that policy back on the wire.
      expect(find.byTooltip('Save retention'), findsNothing);
      await tester.enterText(retentionField, '30');
      await tester.pump();
      expect(find.byTooltip('Save retention'), findsNothing);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await settle(tester, app);
      expect(writes, 0);

      // A different value is the only thing a save is for.
      await tester.enterText(retentionField, '31');
      await tester.pump();
      expect(find.byTooltip('Save retention'), findsOneWidget);
      // The save is a filled action on a coloured surface, so it keeps a press
      // wash even though the theme's shared overlay paints nothing (MASTER §3.3
      // E9): a transparent press here would read as a dead primary action.
      final saveStyle = tester
          .widget<IconButton>(
            find.ancestor(
              of: find.byTooltip('Save retention'),
              matching: find.byType(IconButton),
            ),
          )
          .style;
      expect(
        saveStyle?.overlayColor?.resolve({WidgetState.pressed})?.a,
        greaterThan(0),
      );
      await tester.runAsync(() => tester.tap(find.byTooltip('Save retention')));
      await settle(tester, app);
      expect(writes, 1);
      expectRetentionShown(tester, '31');
      expect(find.byTooltip('Save retention'), findsNothing);
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
      final clear = find.widgetWithText(OutlinedButton, 'Clear');
      await tester.ensureVisible(clear);
      await tester.runAsync(() => tester.tap(clear));
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
      expectRetentionShown(tester, '30');
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
        await web.post<Object?>('test/sign-in', data: {'login': app.login});
        await web.put<Object?>(
          'api/settings',
          data: {
            'navigation': {'linkTarget': 'github'},
            'releaseTimeline': {'showReactions': false},
          },
        );
      });
      await mountSettings(tester, app);
      expectRetentionShown(tester, '30');
      await saveDays(tester, app, '1');
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
