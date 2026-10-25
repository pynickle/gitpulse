import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';

/// ADR 0023: a press paints no background anywhere; hover and keyboard focus
/// keep the single half-strength tint. These tests mount the real themed
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

  for (final brightness in Brightness.values) {
    testWidgets('${brightness.name}: buttons press with no background', (
      tester,
    ) async {
      final cases = <(Type, Widget)>[
        (
          IconButton,
          IconButton(onPressed: () {}, icon: const Icon(Icons.refresh)),
        ),
        (TextButton, TextButton(onPressed: () {}, child: const Text('Retry'))),
        (
          OutlinedButton,
          OutlinedButton(onPressed: () {}, child: const Text('Open')),
        ),
      ];

      for (final (type, button) in cases) {
        final theme = await pumpThemed(tester, button, brightness: brightness);
        final gesture = await tester.startGesture(
          tester.getCenter(find.byType(type)),
        );
        await tester.pump();
        final ink = inkInside(tester, type);
        final pressed = {...?ink.statesController?.value};
        await gesture.up();
        await tester.pumpAndSettle();

        expect(pressed, contains(WidgetState.pressed), reason: '$type');
        expect(
          ink.overlayColor!.resolve(pressed),
          Colors.transparent,
          reason: '$type',
        );
        // One tint for the whole app: a button's hover and focus ink is the
        // theme's own hover colour, not a tone that control chose for itself.
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

    testWidgets(
      '${brightness.name}: a filled button keeps its press feedback',
      (tester) async {
        await pumpThemed(
          tester,
          FilledButton.tonal(onPressed: () {}, child: const Text('Retry')),
          brightness: brightness,
        );
        final pressed = inkInside(
          tester,
          FilledButton,
        ).overlayColor!.resolve({WidgetState.pressed});

        // MASTER §3.3 E9: a coloured surface still answers a press, so the
        // resolved ink has to be a colour that paints — not nothing, and not a
        // null that would silently fall back to an equally invisible default.
        expect(pressed, isNotNull);
        expect(pressed!.a, greaterThan(0));
      },
    );

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
  }
}
