import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_navigation_bar.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

/// The app's bottom bar is its own face (ADR 0032). These tests assert what a
/// reader gets: one destination per label, a selected state that reads in both
/// presentations, the app's one ink contract, and the label-and-selected
/// semantics a screen reader already received from Material's bar.
void main() {
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

  Future<void> pumpBar(
    WidgetTester tester, {
    required int selected,
    ValueChanged<int>? onSelected,
    Brightness brightness = Brightness.light,
  }) => tester.pumpWidget(
    MaterialApp(
      theme: gitPulseTheme(brightness),
      home: Scaffold(
        bottomNavigationBar: GitPulseNavigationBar(
          destinations: destinations,
          selectedIndex: selected,
          onDestinationSelected: onSelected ?? (_) {},
        ),
      ),
    ),
  );

  /// The surface one destination is painted on.
  Material surfaceOf(WidgetTester tester, String label) =>
      tester.widget<Material>(
        find
            .ancestor(of: find.text(label), matching: find.byType(Material))
            .first,
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
      // The selected destination is the only one filled with the active step,
      // and its mark is the Accent; the others are read as quiet chrome.
      expect(surfaceOf(tester, 'Settings').color, toneSurfaceActive(context));
      expect(
        IconTheme.of(tester.element(find.byIcon(Icons.settings_outlined)))
            .color,
        toneAccent(context),
      );
      expect(
        surfaceOf(tester, 'Timeline').color,
        isNot(toneSurfaceActive(context)),
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
