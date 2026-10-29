import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/app.dart';
import 'package:gitpulse/presentation/gitpulse_navigation_bar.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/settings/account_gate.dart';
import 'package:gitpulse/settings/settings_screen.dart';

import 'support/navigation_step.dart';
import 'support/presentation_harness.dart';

/// The shell's bar belongs to the shell, not to whichever destination is on
/// screen: a switch moves its active step and lets the page cross over the one it
/// replaces, instead of the whole screen being replaced (ADR 0034).
void main() {
  Future<void> pumpApp(WidgetTester tester, PresentationHarness harness) async {
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: harness.container,
        child: const GitPulseApp(),
      ),
    );
    await tester.pumpAndSettle();
  }

  /// How opaque the page that carries [screen] is drawn right now.
  double pageOpacity(WidgetTester tester, Type screen) => tester
      .widget<FadeTransition>(
        find
            .ancestor(
              of: find.byType(screen),
              matching: find.byType(FadeTransition),
            )
            .first,
      )
      .opacity
      .value;

  /// Taps one of the bar's destinations, not a word the page happens to print.
  Future<void> openDestination(WidgetTester tester, String label) async {
    await tester.tap(
      find.descendant(
        of: find.byType(GitPulseNavigationBar),
        matching: find.text(label),
      ),
    );
  }

  testWidgets('a switch moves the bar’s step while the page arrives under it', (
    tester,
  ) async {
    final harness = harnessFor(tester);
    await tester.runAsync(harness.open);
    await pumpApp(tester, harness);

    final barWidth = tester.getSize(find.byType(GitPulseNavigationBar)).width;
    final atRest = navigationStepRect(tester);
    expect(atRest.left, moreOrLessEquals(GitPulseSpace.destinationStepInset));
    expect(find.byType(AccountGate), findsOneWidget);

    await openDestination(tester, 'Settings');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 90));

    // The bar is the shell's, so the switch never takes it off screen: one bar,
    // and its step half way between the destination left and the one chosen.
    expect(find.byType(GitPulseNavigationBar), findsOneWidget);
    final travelling = navigationStepRect(tester).left;
    expect(travelling, greaterThan(atRest.left));
    expect(
      travelling,
      lessThan(barWidth * 2 / 3 + GitPulseSpace.destinationStepInset),
    );

    // The page it reveals is opaque, on the page's own tone, and crosses over
    // the one it replaces while the step travels: one answer to one tap.
    expect(pageOpacity(tester, SettingsScreen), inExclusiveRange(0, 1));
    final ground = tester.widget<ColoredBox>(
      find
          .ancestor(
            of: find.byType(SettingsScreen),
            matching: find.byType(ColoredBox),
          )
          .first,
    );
    expect(
      ground.color,
      tonePage(tester.element(find.byType(GitPulseNavigationBar))),
      reason: 'a destination page is opaque over the page it crosses',
    );

    await tester.pumpAndSettle();
    expect(find.byType(SettingsScreen), findsOneWidget);
    expect(pageOpacity(tester, SettingsScreen), 1);
    expect(find.byType(AccountGate), findsNothing);
    expect(
      navigationStepRect(tester).left,
      moreOrLessEquals(barWidth * 2 / 3 + GitPulseSpace.destinationStepInset),
    );
  });

  testWidgets(
    'each destination is still reached and still the only one shown',
    (tester) async {
      final harness = harnessFor(tester);
      await tester.runAsync(harness.open);
      await pumpApp(tester, harness);

      for (final label in ['Follows', 'Settings', 'Timeline']) {
        await openDestination(tester, label);
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<GitPulseNavigationBar>(find.byType(GitPulseNavigationBar))
              .selectedIndex,
          ['Timeline', 'Follows', 'Settings'].indexOf(label),
          reason: label,
        );
        expect(
          find.byType(GitPulseNavigationBar),
          findsOneWidget,
          reason: label,
        );
        expect(
          find.byType(SettingsScreen),
          label == 'Settings' ? findsOneWidget : findsNothing,
          reason: label,
        );
        expect(
          find.byType(AccountGate),
          label == 'Settings' ? findsNothing : findsOneWidget,
          reason: label,
        );
      }
    },
  );
}
