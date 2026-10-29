import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_sheet.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';

/// One function opens the app's sheets (ADR 0029), the way one function opens
/// its dialogs. It owns the route, the barrier, the slide the sheet makes and
/// the Escape key; a body decides only its content and height. These tests drive
/// that real overlay and assert what a reader gets.
void main() {
  const window = Size(390, 844);

  Future<void> pumpOpener(WidgetTester tester) async {
    tester.view.physicalSize = window;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: gitPulseTheme(Brightness.light),
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: GitPulseButton(
                label: 'Open',
                onPressed: () => showGitPulseSheet(
                  context,
                  barrierLabel: 'Dismiss',
                  builder: (context) => SizedBox(
                    height: 400,
                    child: Column(
                      children: [
                        const Text('Sheet body'),
                        GitPulseButton(
                          label: 'Close',
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  testWidgets('a sheet arrives from below the bottom edge', (tester) async {
    await pumpOpener(tester);
    await tester.tap(find.text('Open'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 60));
    final arriving = tester.getRect(find.text('Sheet body'));

    await tester.pumpAndSettle();
    final resting = tester.getRect(find.text('Sheet body'));
    expect(
      arriving.top,
      greaterThan(resting.top),
      reason: 'a third of the way in, it is still on its way up',
    );
    expect(resting.bottom, lessThanOrEqualTo(window.height));
  });

  testWidgets('a sheet leaves by sliding down the screen, never by fading', (
    tester,
  ) async {
    await pumpOpener(tester);
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    final resting = tester.getRect(find.text('Sheet body'));

    await tester.tap(find.text('Close'));
    await tester.pump();
    final tops = <double>[];
    for (var frame = 0; frame < 20; frame++) {
      final body = find.text('Sheet body');
      if (body.evaluate().isEmpty) break;
      // A platform view keeps its own opacity, so a sheet that carries one —
      // a release's notes — must never be faded: the notes stay lit while the
      // chrome and the barrier go, and the frame the route is removed on can be
      // presented with the whole sheet back at full strength.
      for (final veil in <Type>[FadeTransition, Opacity, AnimatedOpacity]) {
        expect(
          find.ancestor(of: body, matching: find.byType(veil)),
          findsNothing,
          reason: 'the sheet is faded by $veil on frame $frame',
        );
      }
      tops.add(tester.getRect(body).top);
      await tester.pump(const Duration(milliseconds: 16));
    }
    await tester.pumpAndSettle();

    expect(find.text('Sheet body'), findsNothing);
    expect(tops.first, greaterThanOrEqualTo(resting.top));
    for (var frame = 1; frame < tops.length; frame++) {
      expect(
        tops[frame],
        greaterThanOrEqualTo(tops[frame - 1]),
        reason: 'the sheet moves back up on frame $frame',
      );
    }
    // It travelled down the screen to get off it rather than dissolving where
    // it stood: the whole of its own height is the distance it takes.
    expect(tops.last - resting.top, greaterThan(300));
  });
}
