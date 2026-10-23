import 'dart:async';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/backend_service.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/connection/native_capabilities.dart';
import 'package:gitpulse/presentation/presentation_preferences.dart';
import 'package:gitpulse/presentation/presentation_preferences_controller.dart';
import 'package:gitpulse/presentation/presentation_preferences_store.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:path/path.dart' as p;

import '../timeline/timeline_test_support.dart';

const _capabilities = NativeCapabilities(
  protocolVersion: 1,
  capabilities: ['timeline-retention'],
  providers: SignInProviders(
    personalMode: false,
    patEnabled: true,
    oauthEnabled: false,
    mode: 'pat',
  ),
);

BackendConnectionState connectedConnection() => BackendConnectionState(
  rememberedAddress: 'https://gitpulse.example/',
  backend: ConnectedBackend(
    Uri.parse('https://gitpulse.example/'),
    _capabilities,
  ),
);

class _TestConnectionController extends ConnectionController {
  _TestConnectionController(this._connection);

  final BackendConnectionState Function() _connection;

  @override
  Future<BackendConnectionState> build() async => _connection();
}

/// One installation: a temporary preferences file and a local timeline cache.
/// Closing and opening it again models a later app launch.
class PresentationHarness {
  PresentationHarness({
    required this.directory,
    required this.preferencesFile,
    this.connection = connectedConnection,
    this.session,
    this.handlers = const {},
  });

  final Directory directory;
  final File preferencesFile;
  final BackendConnectionState Function() connection;
  final SessionState? session;
  final Map<String, FutureOr<BackendResult> Function()> handlers;
  late ProviderContainer container;
  late TimelineCache cache;
  bool _open = false;

  Future<void> open() async {
    _open = true;
    cache = TimelineCache(NativeDatabase.memory());
    container = ProviderContainer(
      overrides: [
        presentationPreferencesFileProvider.overrideWithValue(
          () async => preferencesFile,
        ),
        timelineCacheProvider.overrideWithValue(cache),
        connectionControllerProvider.overrideWith(
          () => _TestConnectionController(connection),
        ),
        sessionControllerProvider.overrideWith(() {
          return FakeSessionController(
            session ?? const SessionState(phase: SessionPhase.signedOut),
          )..handlers.addAll(handlers);
        }),
      ],
    );
    container.listen(sessionControllerProvider, (_, _) {});
    await container.read(presentationPreferencesProvider.future);
  }

  Future<void> close() async {
    if (!_open) return;
    _open = false;
    container.dispose();
    await cache.close();
  }

  /// Releases the installation without awaiting device I/O, for teardown
  /// outside the widget test's real-async window.
  void dispose() {
    if (!_open) return;
    _open = false;
    container.dispose();
  }
}

PresentationHarness harnessFor(
  WidgetTester tester, {
  BackendConnectionState Function() connection = connectedConnection,
  SessionState? session,
  Map<String, FutureOr<BackendResult> Function()> handlers = const {},
}) {
  final directory = Directory.systemTemp.createTempSync(
    'gitpulse-presentation-',
  );
  final harness = PresentationHarness(
    directory: directory,
    preferencesFile: File(
      p.join(directory.path, 'presentation_preferences.json'),
    ),
    connection: connection,
    session: session,
    handlers: handlers,
  );
  addTearDown(() {
    harness.dispose();
    try {
      directory.deleteSync(recursive: true);
    } on FileSystemException {
      // A leftover temporary directory must not fail an otherwise finished
      // test run.
    }
  });
  return harness;
}

/// Advances a fixed number of frames, bounded so an indeterminate progress
/// indicator elsewhere on the page can never stall the test.
Future<void> pumpFrames(WidgetTester tester, {int frames = 8}) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// Waits for real file and HTTP work while the widget clock advances.
Future<void> settleUi(WidgetTester tester) async {
  for (var i = 0; i < 30; i++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 5)),
    );
    await tester.pump(const Duration(milliseconds: 20));
  }
}

Future<void> pumpApp(WidgetTester tester, PresentationHarness harness) async {
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: harness.container,
      child: const GitPulseApp(),
    ),
  );
  await settleUi(tester);
}

Future<void> restart(WidgetTester tester, PresentationHarness harness) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.runAsync(() async {
    await harness.close();
    await harness.open();
  });
  await pumpApp(tester, harness);
}

Future<void> openSettings(WidgetTester tester, String label) async {
  await tester.tap(find.text(label).last);
  await settleUi(tester);
}

/// Scrolls a choice into view before selecting it, as a reader would.
Future<void> tapChoice(WidgetTester tester, String label) async {
  final choice = find.text(label);
  await tester.ensureVisible(choice);
  await pumpFrames(tester);
  await tester.tap(choice);
  await settleUi(tester);
}

Brightness scaffoldBrightness(WidgetTester tester) =>
    Theme.of(tester.element(find.byType(Scaffold).first)).brightness;

void main() {
  void useNarrowWindow(WidgetTester tester) {
    tester.view.physicalSize = const Size(500, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets(
    'a chosen language and appearance apply in place and reopen with the app',
    (tester) async {
      useNarrowWindow(tester);
      tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
      addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
      final harness = harnessFor(tester);
      await tester.runAsync(harness.open);
      await pumpApp(tester, harness);

      // Signed out, connected: the system language is in use and Settings is
      // reachable before any sign-in.
      expect(find.byType(AppBar), findsNothing);
      expect(find.text('Timeline'), findsOneWidget);
      await openSettings(tester, 'Settings');
      expect(find.text('Language'), findsOneWidget);

      await tapChoice(tester, 'Simplified Chinese');
      expect(find.text('语言'), findsOneWidget);
      expect(find.byType(AppBar), findsNothing);
      expect(find.text('设置'), findsOneWidget);

      await tapChoice(tester, '深色');
      expect(
        Theme.of(tester.element(find.text('语言'))).brightness,
        Brightness.dark,
      );
      // Changing presentation never leaves the page that is being read.
      expect(
        tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
        2,
      );

      await restart(tester, harness);
      expect(find.byType(AppBar), findsNothing);
      expect(find.text('时间线'), findsOneWidget);
      expect(scaffoldBrightness(tester), Brightness.dark);
    },
  );

  testWidgets('system preferences follow the platform until one is chosen', (
    tester,
  ) async {
    useNarrowWindow(tester);
    tester.binding.platformDispatcher.localesTestValue = [const Locale('zh')];
    tester.binding.platformDispatcher.platformBrightnessTestValue =
        Brightness.dark;
    addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
    final harness = harnessFor(tester);
    await tester.runAsync(harness.open);
    await pumpApp(tester, harness);

    expect(find.byType(AppBar), findsNothing);
    expect(find.text('时间线'), findsOneWidget);
    expect(scaffoldBrightness(tester), Brightness.dark);

    await openSettings(tester, '设置');
    await tapChoice(tester, 'English');
    expect(find.text('Language'), findsOneWidget);

    await tapChoice(tester, 'Light');
    expect(
      Theme.of(tester.element(find.text('Language'))).brightness,
      Brightness.light,
    );

    // A later platform change cannot override an explicit choice.
    tester.binding.platformDispatcher.platformBrightnessTestValue =
        Brightness.dark;
    await pumpFrames(tester);
    expect(
      Theme.of(tester.element(find.text('Language'))).brightness,
      Brightness.light,
    );
  });

  testWidgets('language and appearance work before the backend is reachable', (
    tester,
  ) async {
    useNarrowWindow(tester);
    tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
    addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
    final harness = harnessFor(
      tester,
      connection: () => const BackendConnectionState(
        rememberedAddress: 'https://gitpulse.example/',
        problem: ConnectionProblem.unreachable,
      ),
    );
    await tester.runAsync(harness.open);
    await pumpApp(tester, harness);

    expect(find.text('Connect to GitPulse'), findsOneWidget);
    await tester.tap(find.byTooltip('Language and appearance'));
    await settleUi(tester);
    expect(find.byType(AlertDialog), findsOneWidget);

    await tapChoice(tester, 'Simplified Chinese');
    // The open dialog re-localizes in place instead of closing.
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(find.text('语言与外观'), findsOneWidget);
    expect(find.text('语言'), findsOneWidget);
  });

  testWidgets(
    'clearing the local timeline cache keeps the remembered language',
    (tester) async {
      useNarrowWindow(tester);
      tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
      addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
      final harness = harnessFor(
        tester,
        session: SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(),
        ),
        handlers: {
          'GET api/settings': () =>
              BackendResult(statusCode: 200, data: settingsJson(const [])),
          'POST api/release-timeline/refresh': () => BackendResult(
            statusCode: 200,
            data: roundJson(
              refresh: const {
                'previousBaseline': '2026-10-01T00:00:00.000Z',
                'startedAt': '2026-10-05T00:00:00.000Z',
              },
            ),
          ),
        },
      );
      await tester.runAsync(harness.open);
      await pumpApp(tester, harness);

      await openSettings(tester, 'Settings');
      await tapChoice(tester, 'Simplified Chinese');

      final clear = find.text('清除本机时间线缓存');
      await tester.ensureVisible(clear);
      await pumpFrames(tester);
      await tester.tap(clear);
      await settleUi(tester);

      expect(
        harness.container
            .read(presentationPreferencesProvider)
            .value!
            .preferences
            .language,
        AppLanguage.simplifiedChinese,
      );
      // The cache controls sit below the presentation controls; return to them
      // to confirm the chosen language is still shown after clearing.
      await tester.scrollUntilVisible(
        find.text('语言'),
        -200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('语言'), findsOneWidget);

      await restart(tester, harness);
      expect(find.byType(AppBar), findsNothing);
      expect(find.text('时间线'), findsOneWidget);
    },
  );

  testWidgets('phone destinations do not repeat their navigation label', (
    tester,
  ) async {
    useNarrowWindow(tester);
    tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
    addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
    final harness = harnessFor(
      tester,
      session: SessionState(
        phase: SessionPhase.signedIn,
        identity: signedInIdentity(),
      ),
      handlers: {
        'GET api/settings': () =>
            BackendResult(statusCode: 200, data: settingsJson(const [])),
        'POST api/release-timeline/refresh': () => BackendResult(
          statusCode: 200,
          data: roundJson(
            refresh: const {
              'previousBaseline': '2026-10-01T00:00:00.000Z',
              'startedAt': '2026-10-05T00:00:00.000Z',
            },
          ),
        ),
      },
    );
    await tester.runAsync(harness.open);
    await pumpApp(tester, harness);

    expect(find.byType(AppBar), findsNothing);
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Timeline'), findsOneWidget);

    await tester.tap(find.text('Follows'));
    await settleUi(tester);
    expect(find.byType(AppBar), findsNothing);
    expect(find.text('Release Follows'), findsNothing);
    expect(find.textContaining('Follow releases independently'), findsNothing);
    expect(find.text('Starred'), findsOneWidget);
    expect(find.text('Search'), findsOneWidget);
    expect(find.byKey(const ValueKey('manage-follows')), findsOneWidget);
    expect(find.text('Follows'), findsOneWidget);
    expect(find.text('Timeline'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);

    await openSettings(tester, 'Settings');
    expect(find.byType(AppBar), findsNothing);
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('Timeline cache'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);

    tester.view.physicalSize = const Size(1200, 900);
    await pumpFrames(tester);
    expect(find.byType(NavigationRail), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.byType(AppBar), findsNothing);
    expect(find.text('Settings'), findsOneWidget);
  });

  testWidgets('timeline dates and counts follow the chosen language', (
    tester,
  ) async {
    useNarrowWindow(tester);
    tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
    addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
    final harness = harnessFor(
      tester,
      session: SessionState(
        phase: SessionPhase.signedIn,
        identity: signedInIdentity(),
      ),
      handlers: {
        'GET api/settings': () => BackendResult(
          statusCode: 200,
          data: settingsJson([followJson('R_alpha', 'octo', 'alpha')]),
        ),
        'POST api/release-timeline/refresh': () => BackendResult(
          statusCode: 200,
          data: roundJson(
            pages: {
              'R_alpha': pageJson('octo', 'alpha', [
                releaseJson(
                  1,
                  'v1.0',
                  '2026-10-04T12:00:00Z',
                  assetCount: 1234,
                ),
              ]),
            },
            refresh: const {
              'previousBaseline': '2026-10-01T00:00:00.000Z',
              'startedAt': '2026-10-05T00:00:00.000Z',
            },
          ),
        ),
      },
    );
    await tester.runAsync(harness.open);
    await pumpApp(tester, harness);

    expect(find.text('Oct 4, 2026'), findsOneWidget);
    expect(find.text('1,234 assets'), findsOneWidget);

    await openSettings(tester, 'Settings');
    await tapChoice(tester, 'Simplified Chinese');
    await tester.tap(find.text('时间线').last);
    await settleUi(tester);

    expect(find.text('2026年10月4日'), findsOneWidget);
    expect(find.text('1,234 个附件'), findsOneWidget);
  });
}
