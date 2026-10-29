import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_dialog.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/timeline/timeline_session.dart';

import '../support/named_actions.dart';
import '../support/presentation_harness.dart';
import '../support/settling.dart';
import '../timeline/timeline_test_support.dart';

/// A signed-in Settings page using the same installation setup as presentation tests.
Future<PresentationHarness> _openSettings(WidgetTester tester) async {
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
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: harness.container,
      child: const GitPulseApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Settings').last);
  await tester.pumpAndSettle();
  return harness;
}

void _useWindow(WidgetTester tester, Size size, {double textScale = 1}) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  tester.platformDispatcher.localesTestValue = [const Locale('en')];
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.platformDispatcher.clearAllTestValues);
}

bool _isSettingCard(Widget widget) {
  if (widget is! DecoratedBox) return false;
  final decoration = widget.decoration;
  if (decoration is! BoxDecoration) return false;
  return decoration.borderRadius ==
          BorderRadius.circular(GitPulseRadius.surface) &&
      decoration.border != null;
}

/// The card that contains [label], and the leading icon that card shows.
void _expectCard(WidgetTester tester, String label, IconData icon) {
  final card = find.ancestor(
    of: find.text(label),
    matching: find.byWidgetPredicate(_isSettingCard),
  );
  expect(card, findsOneWidget);
  expect(
    find.descendant(of: card, matching: find.byIcon(icon)),
    findsOneWidget,
  );
}

void _expectSettingCards(WidgetTester tester) {
  _expectCard(tester, 'Backend', Icons.dns_outlined);
  _expectCard(tester, 'Language', Icons.language);
  _expectCard(tester, 'Appearance', Icons.palette_outlined);
  _expectCard(tester, 'Keep releases for', Icons.history);
  final languageCard = find.ancestor(
    of: find.text('Language'),
    matching: find.byWidgetPredicate(_isSettingCard),
  );
  expect(
    tester
        .widgetList<Text>(
          find.descendant(of: languageCard, matching: find.byType(Text)),
        )
        .map((text) => text.data)
        .toList(),
    ['Language', 'System language', 'English', 'Simplified Chinese'],
  );
}

void main() {
  for (final height in [600.0, 900.0]) {
    testWidgets(
      'confirming cache clear preserves the settings scroll position at $height',
      (tester) async {
        _useWindow(tester, Size(390, height));
        final harness = await _openSettings(tester);
        final clear = find.widgetWithText(GitPulseButton, 'Clear');
        await tester.scrollUntilVisible(
          clear,
          300,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        final position = tester
            .state<ScrollableState>(find.byType(Scrollable).first)
            .position;
        final offset = position.pixels;
        expect(offset, greaterThan(0));

        await tester.tap(clear);
        await tester.pumpAndSettle();
        await tester.tap(
          find.descendant(
            of: find.byType(GitPulseDialog),
            matching: find.widgetWithText(GitPulseButton, 'Clear'),
          ),
        );
        await tester.pump();
        await pumpUntil(
          tester,
          () => !harness.container
              .read(releaseTimelineSessionProvider)
              .cacheActions
              .clearing,
          reason: 'finish clearing the timeline cache',
        );
        await tester.pumpAndSettle();
        expect(
          harness.container
              .read(releaseTimelineSessionProvider)
              .cacheActions
              .cleared,
          isTrue,
        );
        expect(position.pixels, closeTo(offset, 1));
        expect(clear.hitTestable(), findsOneWidget);
        await tester.pump(const Duration(milliseconds: 900));
        await tester.pumpAndSettle();
        expect(position.pixels, closeTo(offset, 1));
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('a phone stacks each label over its control and keeps both fits', (
    tester,
  ) async {
    _useWindow(tester, const Size(390, 844));
    await _openSettings(tester);
    _expectSettingCards(tester);

    final languageLabel = tester.getRect(find.text('Language'));
    final languageChoice = tester.getRect(
      find.widgetWithText(ChoiceChip, 'System language'),
    );
    final appearanceLabel = tester.getRect(find.text('Appearance'));
    final appearanceChoice = tester.getRect(
      find.widgetWithText(ChoiceChip, 'System appearance'),
    );

    // The title sits above its control. The control uses the card's width, and
    // the title follows the leading icon, so it starts to the right of that.
    expect(languageChoice.top, greaterThan(languageLabel.bottom));
    expect(appearanceChoice.top, greaterThan(appearanceLabel.bottom));
    expect(languageChoice.left, lessThan(languageLabel.left));
    expect(appearanceChoice.left, lessThan(appearanceLabel.left));
    expect(appearanceChoice.left, languageChoice.left);
    final name = tester.getRect(find.text('octocat'));
    final signOut = tester.getRect(findNamedAction('Sign out'));
    // The name and sign-out stay above the backend card, on one line. The
    // action is the app's own full touch target, so it begins where the name's
    // line ends rather than leaving a margin of its own.
    expect(name.bottom, lessThan(tester.getRect(find.text('Backend')).top));
    expect(name.bottom, lessThan(languageLabel.top));
    expect(signOut.left, greaterThanOrEqualTo(name.right));
    expect((signOut.center.dy - name.center.dy).abs(), lessThan(24));
    await tester.scrollUntilVisible(
      find.text('Timeline cache'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    _expectCard(tester, 'Timeline cache', Icons.storage_outlined);
    final cacheTitle = tester.getRect(find.text('Timeline cache'));
    final clear = tester.getRect(find.widgetWithText(GitPulseButton, 'Clear'));
    expect(clear.left, greaterThan(cacheTitle.right));
    expect((clear.center.dy - cacheTitle.center.dy).abs(), lessThan(24));
    expect(tester.takeException(), isNull);
  });

  testWidgets('a wide window keeps the same one column of cards', (
    tester,
  ) async {
    _useWindow(tester, const Size(1280, 900));
    await _openSettings(tester);
    _expectSettingCards(tester);
    _expectCard(tester, 'Timeline cache', Icons.storage_outlined);

    final languageChoice = tester.getRect(
      find.widgetWithText(ChoiceChip, 'System language'),
    );
    final appearanceChoice = tester.getRect(
      find.widgetWithText(ChoiceChip, 'System appearance'),
    );
    expect(appearanceChoice.left, languageChoice.left);
    final languageLabel = tester.getRect(find.text('Language'));
    final appearanceLabel = tester.getRect(find.text('Appearance'));
    expect(languageChoice.top, greaterThan(languageLabel.bottom));
    expect(appearanceChoice.top, greaterThan(appearanceLabel.bottom));
    expect(languageChoice.left, lessThan(languageLabel.left));

    // The account still opens the one column instead of taking a trailing
    // column of its own, and the cards keep the scanning ceiling rather than
    // stretching across the window.
    final account = tester.getRect(find.text('octocat'));
    expect(account.bottom, lessThan(languageLabel.top));
    final card = tester.getRect(
      find.ancestor(
        of: find.text('Language'),
        matching: find.byWidgetPredicate(_isSettingCard),
      ),
    );
    final pageLeft = 1280 / 2 - GitPulseWidth.settingsTable / 2;
    expect(card.left, closeTo(pageLeft + GitPulseSpace.gutter, 1));
    expect(card.right, closeTo(1280 - pageLeft - GitPulseSpace.gutter, 1));
    expect(tester.takeException(), isNull);
  });
  testWidgets('large text neither clips nor overflows the row controls', (
    tester,
  ) async {
    _useWindow(tester, const Size(390, 844), textScale: 2);
    await _openSettings(tester);

    expect(find.text('Language'), findsOneWidget);
    expect(find.text('System appearance'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the backend card shows its status and copies the address', (
    tester,
  ) async {
    _useWindow(tester, const Size(390, 844));
    await _openSettings(tester);
    expect(find.text('Connected'), findsOneWidget);
    // The state is a glyph and a word, not a word alone.
    expect(find.byIcon(Icons.cloud_done_outlined), findsOneWidget);
    expect(find.text('https://gitpulse.example/'), findsOneWidget);

    String? copied;
    final messenger = tester.binding.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        copied = (call.arguments as Map)['text'] as String?;
      }
      return null;
    });
    addTearDown(
      () => messenger.setMockMethodCallHandler(SystemChannels.platform, null),
    );

    await tester.tap(findNamedAction('Copy backend address'));
    await tester.pump();
    expect(copied, 'https://gitpulse.example/');
    expect(find.byIcon(Icons.check), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.check), findsNothing);
    expect(find.byIcon(Icons.copy_outlined), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('signed out, the page keeps the installation and the device '
      'choices, and asks nobody to sign in', (tester) async {
    _useWindow(tester, const Size(390, 844));
    final harness = harnessFor(tester);
    await tester.runAsync(harness.open);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: harness.container,
        child: const GitPulseApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Settings').last);
    await tester.pumpAndSettle();

    // This installation's own facts and choices stay…
    _expectCard(tester, 'Backend', Icons.dns_outlined);
    _expectCard(tester, 'Language', Icons.language);
    _expectCard(tester, 'Appearance', Icons.palette_outlined);
    // …while the choices that describe a signed-in reader's saved history are
    // not drawn, because there is no such history to describe.
    expect(find.text('Keep releases for'), findsNothing);
    expect(find.byKey(const ValueKey('retention-days')), findsNothing);
    expect(find.text('Timeline cache'), findsNothing);
    // Nor is this page a way in: signing in belongs to Timeline and Follows.
    expect(find.text('Sign in with a token'), findsNothing);
    expect(find.text('Sign in with GitPulse'), findsNothing);
    expect(find.byType(TextField), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
