import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_navigation_bar.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_toggles.dart';

/// ADR 0032: the app's controls press with no background anywhere, hover and
/// keyboard focus keep the single half-strength tint, and a filled or tonal
/// surface keeps an answer to a press. These tests mount the real themed
/// widgets and read the ink contract they hand to the framework, so a
/// reintroduced pressed tint fails here rather than in a screenshot review.
/// Both brightnesses run, because the tint and the transparent press have to
/// hold on either surface ramp.
void main() {
  Future<ThemeData> pumpThemed(
    WidgetTester tester,
    Widget child, {
    required Brightness brightness,
  }) async {
    late ThemeData theme;
    await tester.pumpWidget(
      MaterialApp(
        theme: gitPulseTheme(brightness),
        home: Scaffold(
          body: Builder(
            builder: (context) {
              theme = Theme.of(context);
              return Center(child: child);
            },
          ),
        ),
      ),
    );
    return theme;
  }

  InkWell inkInside(WidgetTester tester, Type widgetType) =>
      tester.widget<InkWell>(
        find
            .descendant(
              of: find.byType(widgetType),
              matching: find.byType(InkWell),
            )
            .first,
      );

  /// The controls the app draws itself: every one of them answers a pointer
  /// through the theme's ink and not through a tint it chose.
  List<(Type, Widget)> appControls() => [
    (
      GitPulseButton,
      GitPulseButton(
        label: 'Retry',
        onPressed: () {},
        variant: GitPulseButtonVariant.text,
      ),
    ),
    (
      GitPulseButton,
      GitPulseButton(
        label: 'Open',
        onPressed: () {},
        variant: GitPulseButtonVariant.outlined,
      ),
    ),
    (
      GitPulseIconButton,
      GitPulseIconButton(
        label: 'Reload',
        onPressed: () {},
        icon: const Icon(Icons.refresh),
      ),
    ),
    (
      GitPulseNavigationBar,
      GitPulseNavigationBar(
        selectedIndex: 0,
        onDestinationSelected: (_) {},
        destinations: const [
          GitPulseNavigationDestination(
            icon: Icons.view_timeline_outlined,
            label: 'Timeline',
          ),
          GitPulseNavigationDestination(
            icon: Icons.bookmarks_outlined,
            label: 'Follows',
          ),
        ],
      ),
    ),
  ];

  /// The Material families the theme still inks, because a retained control a
  /// reader operates draws them (ADR 0032): the platform's back affordance —
  /// `BackButton` is an `IconButton` — in the repository pages' bar, and the date
  /// picker's own actions and mode toggle. They answer with the app's contract,
  /// so the rule holds in the one place a reader still meets Material's drawing.
  ///
  /// `OutlinedButton` is not here any more: no screen draws one and no retained
  /// control builds one, so the theme installs no ink for it.
  final retainedControls = <(Type, Widget)>[
    (IconButton, IconButton(onPressed: () {}, icon: const Icon(Icons.refresh))),
    (BackButton, BackButton(onPressed: () {})),
    (TextButton, TextButton(onPressed: () {}, child: const Text('Retry'))),
  ];

  for (final brightness in Brightness.values) {
    testWidgets('${brightness.name}: the app’s controls press with nothing', (
      tester,
    ) async {
      for (final (type, control) in appControls()) {
        final theme = await pumpThemed(tester, control, brightness: brightness);
        final gesture = await tester.startGesture(
          tester.getCenter(find.byType(type)),
        );
        await tester.pump();
        final ink = inkInside(tester, type);

        // The press reached the control: its ink response started painting
        // something. What it paints while pressed is the point of the test.
        expect(
          tester.binding.transientCallbackCount,
          greaterThan(0),
          reason: '$type',
        );
        expect(
          ink.overlayColor!.resolve({WidgetState.pressed}),
          Colors.transparent,
          reason: '$type',
        );
        // One tint for the whole app: a control's hover and focus ink is the
        // theme's own hover colour, not a tone the control chose for itself.
        expect(
          ink.overlayColor!.resolve({WidgetState.hovered}),
          theme.hoverColor,
          reason: '$type',
        );
        expect(
          ink.overlayColor!.resolve({WidgetState.focused}),
          theme.hoverColor,
          reason: '$type',
        );
        await gesture.up();
        await tester.pumpAndSettle();
      }
    });

    testWidgets('${brightness.name}: a filled surface keeps its press '
        'feedback', (tester) async {
      for (final variant in [
        GitPulseButtonVariant.filled,
        GitPulseButtonVariant.tonal,
      ]) {
        await pumpThemed(
          tester,
          GitPulseButton(label: 'Retry', onPressed: () {}, variant: variant),
          brightness: brightness,
        );
        final pressed = inkInside(
          tester,
          GitPulseButton,
        ).overlayColor!.resolve({WidgetState.pressed});

        // A coloured surface still answers a press, so the resolved ink has to
        // be a colour that paints — not nothing, and not a null that would
        // silently fall back to an equally invisible default.
        expect(pressed, isNotNull, reason: '$variant');
        expect(pressed!.a, greaterThan(0), reason: '$variant');
      }
    });

    testWidgets('${brightness.name}: the Material families still in use keep '
        'the same contract', (tester) async {
      for (final (type, control) in retainedControls) {
        final theme = await pumpThemed(tester, control, brightness: brightness);
        final ink = inkInside(tester, type);
        expect(
          ink.overlayColor!.resolve({WidgetState.pressed}),
          Colors.transparent,
          reason: '$type',
        );
        expect(
          ink.overlayColor!.resolve({WidgetState.hovered}),
          theme.hoverColor,
          reason: '$type',
        );
        expect(
          ink.overlayColor!.resolve({WidgetState.focused}),
          theme.hoverColor,
          reason: '$type',
        );
      }
    });

    testWidgets('${brightness.name}: the theme installs no Material entry the '
        'client does not draw', (tester) async {
      final theme = await pumpThemed(
        tester,
        const SizedBox.shrink(),
        brightness: brightness,
      );

      // The overrides that existed only to undo Material, retired with the last
      // surface that drew the family they styled (ADR 0032): no screen mounts an
      // `OutlinedButton`, and no Material dialog is opened, so an entry for
      // either is an override with nothing to override.
      expect(theme.outlinedButtonTheme.style, isNull);
      expect(theme.dialogTheme.backgroundColor, isNull);
      expect(theme.checkboxTheme.overlayColor, isNull);
      expect(theme.switchTheme.overlayColor, isNull);

      // What stays is what a retained control reads: the two families the bar's
      // back affordance and the date picker's own buttons draw.
      expect(theme.iconButtonTheme.style?.overlayColor, isNotNull);
      expect(theme.textButtonTheme.style?.overlayColor, isNotNull);
    });

    testWidgets('${brightness.name}: the app’s toggles paint the one ink rule '
        'and the theme installs none of their own', (tester) async {
      final theme = await pumpThemed(
        tester,
        GitPulseCheckbox(value: true, onChanged: (_) {}),
        brightness: brightness,
      );

      // The client draws no Material checkbox or switch, so the theme installs
      // no ink for either: what is left is a Material entry with nothing to
      // override, which is what this asserts is gone (ADR 0032).
      expect(theme.checkboxTheme.overlayColor, isNull);
      expect(theme.switchTheme.overlayColor, isNull);

      // A toggle is a control with no fill of its own, so it answers with the
      // app's rule: nothing on press, the one tint on hover and focus.
      final ink = inkInside(tester, GitPulseCheckbox);
      expect(
        ink.overlayColor!.resolve({WidgetState.pressed}),
        Colors.transparent,
      );
      expect(
        ink.overlayColor!.resolve({WidgetState.hovered}),
        theme.hoverColor,
      );
      expect(
        ink.overlayColor!.resolve({WidgetState.focused}),
        theme.hoverColor,
      );
    });
  }
}
