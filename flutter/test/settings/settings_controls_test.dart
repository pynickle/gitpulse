import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_dialog.dart';
import 'package:gitpulse/presentation/gitpulse_navigation_bar.dart';
import 'package:gitpulse/presentation/gitpulse_progress.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/session/gitpulse_http.dart';
import 'package:gitpulse/session/session_controller.dart';
import 'package:gitpulse/settings/settings_screen.dart';

import '../support/presentation_harness.dart';
import '../support/settling.dart';
import '../timeline/timeline_test_support.dart';

/// The pilot screen, end to end: the shell's bar and the Settings page on the
/// app's own faces, with none of the Material faces the app replaced still
/// rendering behind them (ADR 0032).
void main() {
  Future<void> openSettings(WidgetTester tester) async {
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
  }

  void useWindow(WidgetTester tester, Size size) {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.localesTestValue = [const Locale('en')];
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearAllTestValues);
  }

  int selectedDestination(WidgetTester tester) => tester
      .widget<GitPulseNavigationBar>(find.byType(GitPulseNavigationBar))
      .selectedIndex;

  testWidgets('the shell’s bar carries three destinations, one selected', (
    tester,
  ) async {
    useWindow(tester, const Size(390, 844));
    await openSettings(tester);

    expect(find.byType(NavigationBar), findsNothing);
    expect(find.byType(NavigationDestination), findsNothing);
    for (final label in ['Timeline', 'Follows', 'Settings']) {
      expect(find.text(label), findsOneWidget, reason: label);
    }
    expect(selectedDestination(tester), 2);

    await tester.tap(find.text('Timeline'));
    await tester.pumpAndSettle();
    expect(selectedDestination(tester), 0);

    await tester.tap(find.text('Follows'));
    await tester.pumpAndSettle();
    expect(selectedDestination(tester), 1);

    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();
    expect(selectedDestination(tester), 2);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Settings renders on the app’s faces and none of the replaced '
      'ones', (tester) async {
    useWindow(tester, const Size(390, 844));
    await openSettings(tester);

    final settings = find.byType(SettingsScreen);
    expect(settings, findsOneWidget);
    // It is built from the app's own controls…
    expect(
      find.descendant(of: settings, matching: find.byType(GitPulseButton)),
      findsWidgets,
    );
    expect(
      find.descendant(of: settings, matching: find.byType(GitPulseIconButton)),
      findsWidgets,
    );
    // …and none of the Material faces this change replaced is left in it.
    for (final replaced in <Type>[
      FilledButton,
      OutlinedButton,
      TextButton,
      IconButton,
      NavigationBar,
      CircularProgressIndicator,
      AlertDialog,
      Dialog,
      GitPulseProgressPage,
    ]) {
      expect(
        find.descendant(of: settings, matching: find.byType(replaced)),
        findsNothing,
        reason: '$replaced',
      );
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('the app’s dialog owns the clear-cache confirmation', (
    tester,
  ) async {
    useWindow(tester, const Size(390, 844));
    await openSettings(tester);

    final context = tester.element(find.byType(SettingsScreen));
    final clear = find.widgetWithText(GitPulseButton, 'Clear');
    await tester.ensureVisible(clear);
    await tester.pump();
    await tester.tap(clear);
    await tester.pumpAndSettle();

    expect(find.byType(GitPulseDialog), findsOneWidget);
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.text('Clear the timeline cache?'), findsOneWidget);
    // The confirmation is the app's own surface, at the app's own tone.
    final surface = tester.widget<Material>(
      find
          .ancestor(
            of: find.byType(GitPulseDialog),
            matching: find.byType(Material),
          )
          .first,
    );
    expect(surface.color, toneSurface(context));

    // Thinking better of it clears nothing; the barrier dismisses it too.
    await tester.tap(find.widgetWithText(GitPulseButton, 'Cancel'));
    await tester.pumpAndSettle();
    expect(find.byType(GitPulseDialog), findsNothing);

    await tester.tap(clear);
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.byType(GitPulseDialog),
        matching: find.widgetWithText(GitPulseButton, 'Clear'),
      ),
    );
    await tester.pump();

    // The row that is clearing says so with the app's own indicator, not with a
    // Material spinner.
    expect(find.byType(GitPulseProgressInline), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);

    await settleUi(tester);
    await tester.pumpAndSettle();
    expect(find.byType(GitPulseProgressInline), findsNothing);

    // A clear that landed is reported in the success tone — the one tone that
    // means "this worked" — and never in the Accent (ADR 0031). The mark's tone
    // is the control's to paint, so it is read where the framework resolves it.
    final check = find.byIcon(Icons.check);
    final markInk = IconTheme.of(tester.element(check)).color;
    expect(markInk, toneSuccess(context));
    expect(markInk, isNot(toneAccent(context)));
    expect(tester.takeException(), isNull);
  });
}
