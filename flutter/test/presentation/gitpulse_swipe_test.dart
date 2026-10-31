import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_swipe.dart';

Future<void> pumpSwipe(
  WidgetTester tester, {
  required VoidCallback onSwipeLeft,
  required Widget child,
}) => tester.pumpWidget(
  MaterialApp(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: GitPulseSwipe(onSwipeLeft: onSwipeLeft, child: child),
    ),
  ),
);

void main() {
  testWidgets('a left fling over the surface reports a swipe', (tester) async {
    var swipes = 0;
    await pumpSwipe(
      tester,
      onSwipeLeft: () => swipes++,
      child: const Center(child: Text('a line of text')),
    );
    await tester.fling(
      find.text('a line of text'),
      const Offset(-300, 0),
      1000,
    );
    await tester.pumpAndSettle();
    expect(swipes, 1);
  });

  testWidgets('a tap, and a drag that is not sideways, stay with the content', (
    tester,
  ) async {
    var swipes = 0;
    var taps = 0;
    await pumpSwipe(
      tester,
      onSwipeLeft: () => swipes++,
      child: ListView(
        children: [
          for (var index = 0; index < 30; index++)
            InkWell(
              onTap: () => taps++,
              child: SizedBox(
                height: 60,
                child: Center(child: Text('row $index')),
              ),
            ),
        ],
      ),
    );
    await tester.tap(find.text('row 2'));
    await tester.pumpAndSettle();
    expect(taps, 1, reason: 'a finger that lands and lifts is the row’s');
    expect(swipes, 0);

    final scrollable = tester.state<ScrollableState>(
      find.byType(Scrollable).first,
    );
    final before = scrollable.position.pixels;
    await tester.fling(find.text('row 3'), const Offset(0, -300), 1000);
    await tester.pumpAndSettle();
    expect(
      scrollable.position.pixels,
      isNot(before),
      reason: 'the list scrolls',
    );
    expect(swipes, 0);

    await tester.tap(find.text('row 8'));
    await tester.pumpAndSettle();
    expect(taps, 2, reason: 'the list still answers taps after a swipe');
  });
}
