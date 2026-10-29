import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_navigation_bar.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

/// Where the app's bar paints the block that says the reader is here (ADR 0034).
///
/// The two tests that read it assert the same property from either end — one the
/// bar on its own, one the whole client — so the query lives here rather than
/// twice.
Rect navigationStepRect(WidgetTester tester) {
  final context = tester.element(find.byType(GitPulseNavigationBar));
  final active = toneSurfaceActive(context);
  final step = find.descendant(
    of: find.byType(GitPulseNavigationBar),
    matching: find.byWidgetPredicate(
      (widget) =>
          widget is DecoratedBox &&
          widget.decoration is BoxDecoration &&
          (widget.decoration as BoxDecoration).color == active,
    ),
  );
  expect(step, findsOneWidget, reason: 'one surface carries the active step');
  return tester.getRect(step);
}

/// Where a compartment's step stands once the bar is at rest.
double navigationStepLeft(int index, double barWidth, {required int count}) =>
    barWidth / count * index + GitPulseSpace.destinationStepInset;
