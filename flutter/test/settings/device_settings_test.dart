import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/connection/backend_service.dart';
import 'package:gitpulse/connection/connection_controller.dart';
import 'package:gitpulse/device/device_preferences.dart';
import 'package:gitpulse/device/device_preferences_controller.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_cache.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import '../support/device_preferences_support.dart';
import '../support/settling.dart';
import '../support/presentation_harness.dart';
import '../timeline/timeline_cache_test_support.dart';
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

/// The retention value the reader sees, and the field once they choose to type.
final retentionField = find.byKey(const ValueKey('retention-days'));

/// Brings the retention field on screen without waiting out a cursor blink.
Future<void> showRetention(WidgetTester tester) async {
  await tester.scrollUntilVisible(
    retentionField,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await pumpFrames(tester);
}

/// Types a window and leaves the field, which is what saves it.
Future<void> confirmRetention(WidgetTester tester, String value) async {
  await showRetention(tester);
  await tester.enterText(retentionField, value);
  await tester.pump();
  tester.binding.focusManager.primaryFocus?.unfocus();
  await settleUi(tester);
}

IconButton retentionStep(WidgetTester tester, String tooltip) =>
    tester.widget<IconButton>(
      find.ancestor(
        of: find.byTooltip(tooltip),
        matching: find.byType(IconButton),
      ),
    );

/// The saved window this device would read back, in timeline order.
///
/// Shortening the window prunes what is kept, while releases already on screen
/// stay readable: the history is what a later launch reads.
Future<List<String>> savedHistory(PresentationHarness harness) async {
  final identity = harness.container.read(sessionControllerProvider).identity!;
  final saved = await harness.cache.restore(
    scope: TimelineCache.scopeOf(identity)!,
    now: DateTime.now().toUtc(),
    environment: harness.container.read(timelineEnvironmentProvider),
  );
  return saved == null
      ? const []
      : saved.groups
            .expand((group) => group.items)
            .map((item) => item.key)
            .toList();
}

/// What the device remembered, read from its own file.
///
/// The write is real IO, so the caller stands outside the fake clock.
Future<int?> rememberedWindow(PresentationHarness harness) async {
  for (var i = 0; i < 100; i++) {
    if (await harness.preferencesFile.exists()) {
      final saved = jsonDecode(
        await harness.preferencesFile.readAsString(),
      ) as Map<String, dynamic>;
      if (saved['retentionDays'] case final int days) return days;
    }
    await Future<void>.delayed(const Duration(milliseconds: 5));
  }
  return null;
}

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
          identity: signedInIdentity(githubId: '1'),
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
      await tester.pump();
      await tester.tap(find.text('取消'));
      await tester.pump();
      expect(
        harness.container
            .read(releaseTimelineSessionProvider)
            .cacheActions
            .cleared,
        isFalse,
      );

      await tester.tap(clear);
      await tester.pump();
      await tester.tap(find.widgetWithText(TextButton, '清除'));
      await settleUi(tester);
      expect(
        harness.container
            .read(releaseTimelineSessionProvider)
            .cacheActions
            .cleared,
        isTrue,
      );
      expect(find.byIcon(Icons.check), findsOneWidget);

      expect(
        harness.container
            .read(devicePreferencesProvider)
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
        identity: signedInIdentity(githubId: '1'),
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
        identity: signedInIdentity(githubId: '1'),
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

  testWidgets(
    'the retention window applies at once, offline, and the device keeps it',
    (tester) async {
      useNarrowWindow(tester);
      tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
      addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
      final now = DateTime.now().toUtc();
      final harness = harnessFor(
        tester,
        session: SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(githubId: '1'),
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
                    2,
                    'recent',
                    now.subtract(const Duration(hours: 2)).toIso8601String(),
                  ),
                  releaseJson(
                    1,
                    'fortnight',
                    now.subtract(const Duration(days: 14)).toIso8601String(),
                  ),
                ]),
              },
            ),
          ),
        },
      );
      await tester.runAsync(harness.open);
      await pumpApp(tester, harness);
      expect(keys(harness.container), ['R_alpha:2', 'R_alpha:1']);

      await openSettings(tester, 'Settings');
      await tester.ensureVisible(retentionField);
      await tester.pumpAndSettle();
      expect(
        find.descendant(of: retentionField, matching: find.text('30')),
        findsOneWidget,
      );

      // The reader types a one-day window, so only the newest release stays.
      // Nothing is asked of the backend for it.
      await confirmRetention(tester, '1');

      expect(
        harness.container
            .read(devicePreferencesProvider)
            .value!
            .preferences
            .retentionDays,
        1,
      );
      expect(await tester.runAsync(() => savedHistory(harness)), ['R_alpha:2']);
      expect(await tester.runAsync(() => rememberedWindow(harness)), 1);
    },
  );

  testWidgets(
    'retention editor stays locked until local application completes',
    (tester) async {
      useNarrowWindow(tester);
      tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
      addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
      final harness = harnessFor(
        tester,
        session: SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(githubId: '1'),
        ),
        handlers: {
          'GET api/settings': () =>
              BackendResult(statusCode: 200, data: settingsJson(const [])),
        },
      );
      await tester.runAsync(harness.open);
      await pumpApp(tester, harness);
      await openSettings(tester, 'Settings');
      await showRetention(tester);
      final started = Completer<void>();
      final release = Completer<void>();
      late Future<void> blocker;
      await tester.runAsync(() async {
        blocker = harness.cache.transaction(() async {
          started.complete();
          await release.future;
        });
      });
      await pumpUntil(
        tester,
        () => started.isCompleted,
        reason: 'cache transaction begins',
      );
      await tester.tap(find.byTooltip('Decrease retention'));
      await settleUi(tester);
      expect(tester.widget<TextField>(retentionField).enabled, isFalse);
      expect(retentionStep(tester, 'Decrease retention').onPressed, isNull);
      expect(retentionStep(tester, 'Increase retention').onPressed, isNull);
      expect(
        harness.container
            .read(devicePreferencesStateProvider)
            .preferences
            .retentionDays,
        29,
      );
      await pumpOperation(tester, () async {
        release.complete();
        await blocker;
      }, reason: 'release blocked cache transaction');
      await settleUi(tester);
      expect(tester.widget<TextField>(retentionField).enabled, isTrue);
      expect(retentionStep(tester, 'Decrease retention').onPressed, isNotNull);
      expect(retentionStep(tester, 'Increase retention').onPressed, isNotNull);
    },
  );

  testWidgets('a window outside one to ninety days is refused', (tester) async {
    useNarrowWindow(tester);
    tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
    addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
    final harness = harnessFor(
      tester,
      session: SessionState(
        phase: SessionPhase.signedIn,
        identity: signedInIdentity(githubId: '1'),
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

    final before = harness.container
        .read(devicePreferencesProvider)
        .value!
        .preferences;
    for (final value in ['0', '91', '1.5', '']) {
      await confirmRetention(tester, value);
      expect(find.text('Use 1–90'), findsOneWidget);
      expect(
        find.descendant(of: retentionField, matching: find.text('30')),
        findsOneWidget,
      );
    }
    await tester.pump(const Duration(seconds: 3));
    expect(find.text('Use 1–90'), findsNothing);
    // A refused window leaves this installation's choice exactly as it was.
    expect(
      harness.container.read(devicePreferencesProvider).value!.preferences,
      before,
    );
  });

  testWidgets('a device that cannot remember the window says so', (
    tester,
  ) async {
    useNarrowWindow(tester);
    tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
    addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
    final now = DateTime.now().toUtc();
    final harness = harnessFor(
      tester,
      session: SessionState(
        phase: SessionPhase.signedIn,
        identity: signedInIdentity(githubId: '1'),
      ),
      // A device whose storage refuses every write.
      deviceStore: InMemoryDevicePreferencesStore()..failWrites = true,
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
                  2,
                  'recent',
                  now.subtract(const Duration(hours: 2)).toIso8601String(),
                ),
                releaseJson(
                  1,
                  'fortnight',
                  now.subtract(const Duration(days: 14)).toIso8601String(),
                ),
              ]),
            },
          ),
        ),
      },
    );
    await tester.runAsync(harness.open);
    await pumpApp(tester, harness);
    await openSettings(tester, 'Settings');

    await confirmRetention(tester, '1');

    expect(
      find.text('Applied, but this device could not remember the choice.'),
      findsOneWidget,
    );
    // The choice still applies to this run: the history it keeps is pruned.
    expect(await tester.runAsync(() => savedHistory(harness)), ['R_alpha:2']);
  });

  testWidgets(
    'retention steps one day at once and refuses a step past either end',
    (tester) async {
      useNarrowWindow(tester);
      tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
      addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
      final harness = harnessFor(
        tester,
        session: SessionState(
          phase: SessionPhase.signedIn,
          identity: signedInIdentity(githubId: '1'),
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
      await showRetention(tester);

      final decrease = find.byTooltip('Decrease retention');
      expect(retentionStep(tester, 'Decrease retention').onPressed, isNotNull);
      expect(retentionStep(tester, 'Increase retention').onPressed, isNotNull);

      await tester.tap(decrease);
      await settleUi(tester);
      expect(
        find.descendant(of: retentionField, matching: find.text('29')),
        findsOneWidget,
      );
      expect(
        harness.container
            .read(devicePreferencesProvider)
            .value!
            .preferences
            .retentionDays,
        29,
      );

      await confirmRetention(tester, '1');
      expect(retentionStep(tester, 'Decrease retention').onPressed, isNull);
      expect(retentionStep(tester, 'Increase retention').onPressed, isNotNull);
      expect(
        harness.container
            .read(devicePreferencesProvider)
            .value!
            .preferences
            .retentionDays,
        1,
      );

      await confirmRetention(tester, '90');
      expect(retentionStep(tester, 'Increase retention').onPressed, isNull);
      expect(
        harness.container
            .read(devicePreferencesProvider)
            .value!
            .preferences
            .retentionDays,
        90,
      );

      await tester.scrollUntilVisible(
        decrease,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(decrease);
      await settleUi(tester);
      expect(
        find.descendant(of: retentionField, matching: find.text('89')),
        findsOneWidget,
      );
      expect(
        harness.container
            .read(devicePreferencesProvider)
            .value!
            .preferences
            .retentionDays,
        89,
      );
    },
  );

  testWidgets('an offline session shows the backend as offline', (
    tester,
  ) async {
    useNarrowWindow(tester);
    tester.binding.platformDispatcher.localesTestValue = [const Locale('en')];
    addTearDown(tester.binding.platformDispatcher.clearAllTestValues);
    final harness = harnessFor(
      tester,
      session: SessionState(
        phase: SessionPhase.signedIn,
        identity: signedInIdentity(githubId: '1'),
        offline: true,
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
    expect(find.text('Offline'), findsOneWidget);
  });
}
