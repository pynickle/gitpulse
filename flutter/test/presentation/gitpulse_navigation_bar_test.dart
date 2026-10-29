import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_navigation_bar.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

import '../support/navigation_step.dart';

/// The app's bottom bar is its own face (ADR 0032). These tests assert what a
/// reader gets: one destination per label, a selected state that reads in both
/// presentations, the app's one ink contract, and the label-and-selected
/// semantics a screen reader already received from Material's bar.
void main() {
  /// The ink one destination's label is set in.
  Color labelInk(WidgetTester tester, String label) =>
      tester.widget<Text>(find.text(label)).style!.color!;

  const destinations = [
    GitPulseNavigationDestination(
      icon: Icons.view_timeline_outlined,
      label: 'Timeline',
    ),
    GitPulseNavigationDestination(
      icon: Icons.bookmarks_outlined,
      label: 'Follows',
    ),
    GitPulseNavigationDestination(
      icon: Icons.settings_outlined,
      label: 'Settings',
    ),
  ];

  /// Where a compartment's step stands once the bar is at rest.
  double stepLeftOf(int index, double barWidth) =>
      navigationStepLeft(index, barWidth, count: destinations.length);

  Future<void> pumpBar(
    WidgetTester tester, {
    required int selected,
    ValueChanged<int>? onSelected,
    Brightness brightness = Brightness.light,
    bool reduceMotion = false,
  }) => tester.pumpWidget(
    MaterialApp(
      theme: gitPulseTheme(brightness),
      builder: (context, child) => reduceMotion
          ? MediaQuery(
              data: MediaQuery.of(context).copyWith(disableAnimations: true),
              child: child!,
            )
          : child!,
      home: Scaffold(
        bottomNavigationBar: GitPulseNavigationBar(
          destinations: destinations,
          selectedIndex: selected,
          onDestinationSelected: onSelected ?? (_) {},
        ),
      ),
    ),
  );

  InkWell inkOf(WidgetTester tester, String label) => tester.widget<InkWell>(
    find.ancestor(of: find.text(label), matching: find.byType(InkWell)).first,
  );

  for (final brightness in Brightness.values) {
    testWidgets('${brightness.name}: one destination per label, one selected', (
      tester,
    ) async {
      await pumpBar(tester, selected: 2, brightness: brightness);

      for (final destination in destinations) {
        expect(find.text(destination.label), findsOneWidget);
        expect(find.byIcon(destination.icon), findsOneWidget);
      }
      // None of Material's own bar is left behind it.
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.byType(NavigationDestination), findsNothing);

      final context = tester.element(find.byType(GitPulseNavigationBar));
      // The active step stands over the selected destination — the only one
      // filled — and that destination's mark is the Accent; the others are read
      // as quiet chrome.
      final step = navigationStepRect(tester);
      final mark = tester.getRect(find.byIcon(Icons.settings_outlined));
      expect(step.left, lessThan(mark.center.dx));
      expect(step.right, greaterThan(mark.center.dx));
      expect(
        IconTheme.of(tester.element(find.byIcon(Icons.settings_outlined)))
            .color,
        toneAccent(context),
      );
      expect(
        IconTheme.of(tester.element(find.byIcon(Icons.view_timeline_outlined)))
            .color,
        toneTextMuted(context),
      );
    });
  }

  testWidgets('a destination reports its own index', (tester) async {
    var chosen = <int>[];
    await pumpBar(tester, selected: 0, onSelected: chosen.add);

    await tester.tap(find.text('Follows'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();
    expect(chosen, [1, 2]);
  });

  testWidgets('the active step travels to the destination a reader chose', (
    tester,
  ) async {
    await pumpBar(tester, selected: 0);

    final barWidth = tester.getSize(find.byType(GitPulseNavigationBar)).width;
    final atRest = navigationStepRect(tester);
    expect(atRest.left, moreOrLessEquals(stepLeftOf(0, barWidth)));
    expect(
      atRest.width,
      moreOrLessEquals(
        barWidth / 3 - GitPulseSpace.destinationStepInset * 2,
        epsilon: 0.5,
      ),
    );

    // The step leaves the destination that was marked before it arrives at the
    // one chosen, in one movement rather than by reappearing.
    await pumpBar(tester, selected: 2);
    expect(navigationStepRect(tester).left, moreOrLessEquals(atRest.left));
    await tester.pump(const Duration(milliseconds: 110));
    final travelling = navigationStepRect(tester).left;
    expect(travelling, greaterThan(atRest.left));
    expect(travelling, lessThan(stepLeftOf(2, barWidth)));

    await tester.pumpAndSettle();
    expect(
      navigationStepRect(tester).left,
      moreOrLessEquals(stepLeftOf(2, barWidth)),
    );
  });

  testWidgets('a destination’s word and mark cross to the Accent as it '
      'arrives', (tester) async {
    await pumpBar(tester, selected: 0);
    final context = tester.element(find.byType(GitPulseNavigationBar));
    expect(labelInk(tester, 'Follows'), toneTextMuted(context));

    await pumpBar(tester, selected: 1);
    await tester.pump(const Duration(milliseconds: 110));

    final crossing = labelInk(tester, 'Follows');
    expect(crossing, isNot(toneTextMuted(context)));
    expect(crossing, isNot(toneAccent(context)));
    expect(
      IconTheme.of(tester.element(find.byIcon(Icons.bookmarks_outlined))).color,
      crossing,
      reason: 'the mark crosses with the word it belongs to',
    );

    await tester.pumpAndSettle();
    expect(labelInk(tester, 'Follows'), toneAccent(context));
    expect(labelInk(tester, 'Timeline'), toneTextMuted(context));
  });

  testWidgets('reduced motion puts the step in place without travelling', (
    tester,
  ) async {
    await pumpBar(tester, selected: 0, reduceMotion: true);
    await pumpBar(tester, selected: 2, reduceMotion: true);
    await tester.pump();

    final barWidth = tester.getSize(find.byType(GitPulseNavigationBar)).width;
    expect(
      navigationStepRect(tester).left,
      moreOrLessEquals(stepLeftOf(2, barWidth)),
    );
    final context = tester.element(find.byType(GitPulseNavigationBar));
    expect(labelInk(tester, 'Settings'), toneAccent(context));
  });

  testWidgets('the bar keeps the app’s own row and rule geometry', (
    tester,
  ) async {
    await pumpBar(tester, selected: 0);

    // The bar is taller than one control, because a destination is a mark above
    // a word rather than a mark alone.
    expect(
      tester.getSize(find.byType(GitPulseNavigationBar)).height,
      greaterThanOrEqualTo(GitPulseHeight.standard),
    );
    // It is a surface of its own, told apart from the page by the hairline above
    // it rather than by a shadow.
    final bar = tester.widget<DecoratedBox>(
      find
          .descendant(
            of: find.byType(GitPulseNavigationBar),
            matching: find.byType(DecoratedBox),
          )
          .first,
    );
    final decoration = bar.decoration as BoxDecoration;
    expect(decoration.border, isNotNull);
    expect(decoration.boxShadow, isNull);
  });

  testWidgets('the bar stands on the device, not on the keyboard', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewPadding);
    addTearDown(tester.view.resetPadding);
    addTearDown(tester.view.resetViewInsets);

    await pumpBar(tester, selected: 0);
    final withoutInset = tester
        .getSize(find.byType(GitPulseNavigationBar))
        .height;
    // A phone's gesture area, reported the way the platform reports it.
    tester.view.viewPadding = const FakeViewPadding(bottom: 24);
    tester.view.padding = const FakeViewPadding(bottom: 24);
    await tester.pump();
    final onDevice = tester.getSize(find.byType(GitPulseNavigationBar)).height;
    expect(onDevice, withoutInset + 24, reason: 'the bar pads for the gesture');

    // The keyboard consumes what the inset left the page, and this bar keeps its
    // height anyway: the shell sizes the page above the bar by it, so a bar that
    // answered the keyboard would move the page by the gesture inset on every
    // tap into a search field.
    tester.view.viewInsets = const FakeViewPadding(bottom: 320);
    tester.view.padding = FakeViewPadding.zero;
    await tester.pump();
    expect(
      tester.getSize(find.byType(GitPulseNavigationBar)).height,
      onDevice,
      reason: 'the bar stands on the device, not on the keyboard',
    );
  });

  testWidgets('each destination carries the app’s ink contract', (
    tester,
  ) async {
    await pumpBar(tester, selected: 1);
    final theme = Theme.of(tester.element(find.byType(GitPulseNavigationBar)));

    for (final destination in destinations) {
      final ink = inkOf(tester, destination.label);
      expect(
        ink.overlayColor!.resolve({WidgetState.pressed}),
        Colors.transparent,
        reason: destination.label,
      );
      expect(
        ink.overlayColor!.resolve({WidgetState.hovered}),
        gitPulseHoverTint(theme.colorScheme),
        reason: destination.label,
      );
      expect(
        ink.overlayColor!.resolve({WidgetState.focused}),
        gitPulseHoverTint(theme.colorScheme),
        reason: destination.label,
      );
    }
  });

  testWidgets('a screen reader hears the label and whether it is selected', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await pumpBar(tester, selected: 1);

    expect(
      tester.getSemantics(find.text('Follows')),
      isSemantics(
        label: 'Follows',
        isButton: true,
        isSelected: true,
        isInMutuallyExclusiveGroup: true,
        hasTapAction: true,
      ),
    );
    expect(
      tester.getSemantics(find.text('Settings')),
      isSemantics(
        label: 'Settings',
        isButton: true,
        isSelected: false,
        isInMutuallyExclusiveGroup: true,
        hasTapAction: true,
      ),
    );
    semantics.dispose();
  });
}
