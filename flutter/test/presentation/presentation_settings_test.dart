import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/backend_service.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/presentation/presentation_preferences.dart';
import 'package:gitpulse/presentation/presentation_preferences_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import '../support/settling.dart';
import '../support/presentation_harness.dart';
import '../timeline/timeline_test_support.dart';

/// Advances a fixed number of frames, bounded so an indeterminate progress
/// indicator elsewhere on the page can never stall the test.
Future<void> pumpFrames(WidgetTester tester, {int frames = 8}) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

Future<void> pumpApp(WidgetTester tester, PresentationHarness harness) async {
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: harness.container,
      child: const GitPulseApp(),
    ),
  );
  await tester.pumpAndSettle();
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
  await tester.pumpAndSettle();
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

      final clear = find.widgetWithText(OutlinedButton, '清除');
      await tester.ensureVisible(clear);
      await pumpFrames(tester);
      await tester.tap(clear);
      await settleUi(tester);
      expect(
        harness.container
            .read(releaseTimelineSessionProvider)
            .cacheSettings
            .cleared,
        isTrue,
      );

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
    expect(find.text('Keep releases for'), findsOneWidget);
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
