import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_navigation_bar.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';

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
        tooltip: 'Reload',
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

  /// The Material families the app has not replaced yet. They stay here until
  /// the screens that still use them are migrated; the contract they answer
  /// with is the same one.
  final retainedControls = <(Type, Widget)>[
    (IconButton, IconButton(onPressed: () {}, icon: const Icon(Icons.refresh))),
    (TextButton, TextButton(onPressed: () {}, child: const Text('Retry'))),
    (
      OutlinedButton,
      OutlinedButton(onPressed: () {}, child: const Text('Open')),
    ),
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

    testWidgets('${brightness.name}: list rows press through the theme', (
      tester,
    ) async {
      final theme = await pumpThemed(
        tester,
        ListTile(title: const Text('GitPulse'), onTap: () {}),
        brightness: brightness,
      );

      // ListTileThemeData carries no overlay field, so a row's press falls
      // through to the theme-wide ink: these are the colours its press and
      // hover are judged by.
      expect(theme.highlightColor.a, 0);
      expect(theme.splashColor.a, 0);
      expect(theme.hoverColor.a, greaterThan(0));
      expect(theme.focusColor, theme.hoverColor);
    });

    testWidgets('${brightness.name}: a checkbox presses with no background', (
      tester,
    ) async {
      final theme = await pumpThemed(
        tester,
        Checkbox(value: true, onChanged: (_) {}),
        brightness: brightness,
      );

      // A checkbox paints its press reaction itself instead of inking through
      // an InkWell, so the overlay it resolves is where its states are judged:
      // the same nothing on press and the same one tint on hover and focus.
      final overlay = CheckboxTheme.of(tester.element(find.byType(Checkbox)))
          .overlayColor!;

      // A checked box resolves its states with `selected` alongside them.
      expect(
        overlay.resolve({WidgetState.selected, WidgetState.pressed}),
        Colors.transparent,
      );
      expect(
        overlay.resolve({WidgetState.selected, WidgetState.hovered}),
        theme.hoverColor,
      );
      expect(
        overlay.resolve({WidgetState.selected, WidgetState.focused}),
        theme.hoverColor,
      );
    });
  }
}
