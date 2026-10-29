import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

/// The button family is GitPulse's own (ADR 0032). These tests mount the real
/// controls under the real theme and assert what a reader gets: the ink each
/// variant hands the framework, the tones each one paints, the tap-target
/// floor, and what a disabled control refuses to do.
void main() {
  Future<ThemeData> pumpThemed(
    WidgetTester tester,
    Widget child, {
    Brightness brightness = Brightness.light,
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

  InkWell inkInside(WidgetTester tester) => tester.widget<InkWell>(
    find
        .descendant(
          of: find.byType(GitPulseButton),
          matching: find.byType(InkWell),
        )
        .first,
  );

  Widget textButton({VoidCallback? onPressed}) => GitPulseButton(
    label: 'Retry',
    onPressed: onPressed ?? () {},
    variant: GitPulseButtonVariant.text,
  );

  for (final variant in GitPulseButtonVariant.values) {
    for (final brightness in Brightness.values) {
      testWidgets('${variant.name}/${brightness.name}: a plain surface presses '
          'with nothing, a filled one keeps its answer', (tester) async {
        final theme = await pumpThemed(
          tester,
          GitPulseButton(label: 'Retry', onPressed: () {}, variant: variant),
          brightness: brightness,
        );
        final ink = inkInside(tester);
        final pressed = ink.overlayColor!.resolve({WidgetState.pressed});
        final filled =
            variant == GitPulseButtonVariant.filled ||
            variant == GitPulseButtonVariant.tonal;

        if (filled) {
          // A coloured surface still answers a press, so the ink has to be a
          // colour that paints rather than nothing.
          expect(pressed, isNotNull, reason: '$variant');
          expect(pressed!.a, greaterThan(0), reason: '$variant');
        } else {
          expect(pressed, Colors.transparent, reason: '$variant');
        }
        // One tint for the whole app, whatever the variant: hover and keyboard
        // focus read as the theme's own hover tone.
        expect(
          ink.overlayColor!.resolve({WidgetState.hovered}),
          gitPulseHoverTint(theme.colorScheme),
          reason: '$variant',
        );
        expect(
          ink.overlayColor!.resolve({WidgetState.focused}),
          gitPulseHoverTint(theme.colorScheme),
          reason: '$variant',
        );
      });
    }
  }

  testWidgets('a pointer over a button starts the app’s tint', (tester) async {
    await pumpThemed(tester, textButton());
    expect(tester.binding.transientCallbackCount, 0);

    final gesture = await tester.createGesture(kind: PointerDeviceKind.mouse);
    await gesture.addPointer(location: Offset.zero);
    addTearDown(gesture.removePointer);
    await tester.pump();
    await gesture.moveTo(tester.getCenter(find.byType(GitPulseButton)));
    await tester.pump();

    // The tint fades in over the control: the pointer found the pressable the
    // contract lives on, and that pressable answered with the app's one tint
    // instead of with nothing.
    expect(tester.binding.transientCallbackCount, greaterThan(0));
  });

  testWidgets('each variant carries its own tone', (tester) async {
    for (final variant in GitPulseButtonVariant.values) {
      await pumpThemed(
        tester,
        GitPulseButton(label: 'Retry', onPressed: () {}, variant: variant),
      );
      final context = tester.element(find.byType(GitPulseButton));
      final label = tester.widget<Text>(
        find.descendant(
          of: find.byType(GitPulseButton),
          matching: find.byType(Text),
        ),
      );
      final expectedLabel = switch (variant) {
        // The Accent's own tone reads back on the accents it fills.
        GitPulseButtonVariant.filled => toneOnAccent(context),
        GitPulseButtonVariant.tonal => toneAccent(context),
        // A plain surface is read as its own text; the Accent is what an action
        // that has no shape at all is.
        GitPulseButtonVariant.outlined => toneText(context),
        GitPulseButtonVariant.text => toneAccent(context),
      };
      expect(label.style?.color, expectedLabel, reason: '$variant');

      final fill = tester
          .widget<Material>(
            find
                .descendant(
                  of: find.byType(GitPulseButton),
                  matching: find.byType(Material),
                )
                .first,
          )
          .color;
      final expectedFill = switch (variant) {
        GitPulseButtonVariant.filled => toneAccent(context),
        GitPulseButtonVariant.tonal => toneAccentSoft(context),
        GitPulseButtonVariant.outlined || GitPulseButtonVariant.text => null,
      };
      expect(fill, expectedFill, reason: '$variant');
    }
  });

  testWidgets('a button’s label is the table’s control role', (tester) async {
    await pumpThemed(tester, textButton());
    final style = tester
        .widget<Text>(
          find.descendant(
            of: find.byType(GitPulseButton),
            matching: find.byType(Text),
          ),
        )
        .style!;
    final row = gitPulseTypeTableOf(tester.element(find.byType(GitPulseButton)))
        .labelMedium;

    // No literal size in a control: the label is a row of the type table.
    expect(style.fontSize, row.size);
    expect(style.fontWeight, row.weight);
    expect(style.letterSpacing, row.letterSpacing);
  });

  testWidgets('a button clears the app’s tap-target floor', (tester) async {
    for (final variant in GitPulseButtonVariant.values) {
      await pumpThemed(
        tester,
        GitPulseButton(label: 'Retry', onPressed: () {}, variant: variant),
      );
      expect(
        tester.getSize(find.byType(GitPulseButton)).height,
        greaterThanOrEqualTo(GitPulseHeight.compact),
        reason: '$variant',
      );
    }
    await pumpThemed(
      tester,
      GitPulseIconButton(
        tooltip: 'Reload',
        icon: const Icon(Icons.refresh),
        onPressed: () {},
      ),
    );
    expect(
      tester.getSize(find.byType(GitPulseIconButton)),
      const Size.square(GitPulseHeight.standard),
    );
  });

  testWidgets('a button runs its action once', (tester) async {
    var taps = 0;
    await pumpThemed(tester, textButton(onPressed: () => taps++));
    await tester.tap(find.byType(GitPulseButton));
    await tester.pumpAndSettle();
    expect(taps, 1);
  });

  testWidgets('a disabled button does nothing and says so', (tester) async {
    final semantics = tester.ensureSemantics();
    var taps = 0;
    await pumpThemed(
      tester,
      GitPulseButton(
        label: 'Retry',
        onPressed: null,
        variant: GitPulseButtonVariant.outlined,
      ),
    );

    await tester.tap(find.byType(GitPulseButton), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(taps, 0);
    expect(
      tester.getSemantics(find.byType(GitPulseButton)),
      isSemantics(isButton: true, isEnabled: false, hasTapAction: false),
    );
    // Disabled ink is the quietest the app draws, not a faded accent.
    expect(
      tester
          .widget<Text>(
            find.descendant(
              of: find.byType(GitPulseButton),
              matching: find.byType(Text),
            ),
          )
          .style
          ?.color,
      toneTextSubtle(tester.element(find.byType(GitPulseButton))),
    );
    semantics.dispose();
  });

  testWidgets('an icon button is named by its tooltip and refuses when '
      'disabled', (tester) async {
    final semantics = tester.ensureSemantics();
    var taps = 0;
    await pumpThemed(
      tester,
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GitPulseIconButton(
            tooltip: 'Reload',
            icon: const Icon(Icons.refresh),
            onPressed: () => taps++,
          ),
          GitPulseIconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: null,
          ),
        ],
      ),
    );

    expect(find.byTooltip('Reload'), findsOneWidget);
    await tester.tap(find.byTooltip('Reload'));
    await tester.pumpAndSettle();
    expect(taps, 1);

    await tester.tap(find.byTooltip('Sign out'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(taps, 1);
    expect(
      tester.getSemantics(
        find.ancestor(
          of: find.byTooltip('Sign out'),
          matching: find.byType(GitPulseIconButton),
        ),
      ),
      isSemantics(isEnabled: false),
    );
    semantics.dispose();
  });

  testWidgets('an emphasised icon action is the Accent, the rest muted', (
    tester,
  ) async {
    await pumpThemed(
      tester,
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GitPulseIconButton(
            tooltip: 'Copy',
            icon: const Icon(Icons.copy),
            onPressed: () {},
            emphasized: true,
          ),
          GitPulseIconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () {},
          ),
        ],
      ),
    );
    final context = tester.element(find.byType(GitPulseIconButton).first);
    expect(
      IconTheme.of(tester.element(find.byIcon(Icons.copy))).color,
      toneAccent(context),
    );
    expect(
      IconTheme.of(tester.element(find.byIcon(Icons.logout))).color,
      toneTextMuted(context),
    );
  });

  testWidgets('an icon action inside a control stands at the control’s own '
      'measure', (tester) async {
    await pumpThemed(
      tester,
      GitPulseIconButton(
        tooltip: 'Clear',
        icon: const Icon(Icons.close),
        onPressed: () {},
        size: GitPulseIconSize.inControl,
        dimension: GitPulseHeight.compact,
      ),
    );

    // A clear mark drawn inside a field stands in the field's own square, so the
    // mark never grows the field it sits in; its glyph keeps the in-control
    // measure rather than the action's.
    expect(
      tester.getSize(find.byType(GitPulseIconButton)),
      const Size.square(GitPulseHeight.compact),
    );
    expect(
      IconTheme.of(tester.element(find.byIcon(Icons.close))).size,
      GitPulseIconSize.inControl,
    );
  });

  testWidgets('a button can keep its whole name for a screen reader', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    // The Repository page's primary action shortens its label to the ink it has
    // room for; the destination's whole name still reaches a reader who cannot
    // see the shortening.
    await pumpThemed(
      tester,
      GitPulseButton(
        label: 'Releases',
        semanticsLabel: 'Repository releases',
        variant: GitPulseButtonVariant.tonal,
        onPressed: () {},
      ),
    );

    expect(find.text('Releases'), findsOneWidget);
    expect(find.bySemanticsLabel('Repository releases'), findsOneWidget);
    expect(find.bySemanticsLabel('Releases'), findsNothing);
    semantics.dispose();
  });

  testWidgets('an icon button can arrive with the keyboard focus', (
    tester,
  ) async {
    await pumpThemed(
      tester,
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GitPulseIconButton(
            tooltip: 'Close',
            icon: const Icon(Icons.close),
            onPressed: () {},
            autofocus: true,
          ),
          GitPulseIconButton(
            tooltip: 'Reload',
            icon: const Icon(Icons.refresh),
            onPressed: () {},
          ),
        ],
      ),
    );

    // The surface that opens with one action — a sheet's close — puts the
    // keyboard on it, so Escape and the focus ring both have somewhere to be.
    final focus = tester.binding.focusManager.primaryFocus;
    expect(focus, isNotNull);
    expect(
      focus!.context?.findAncestorWidgetOfExactType<GitPulseIconButton>(),
      isNotNull,
    );
  });

  testWidgets('a floating icon action is a disc inside one hairline', (
    tester,
  ) async {
    await pumpThemed(
      tester,
      GitPulseIconButton(
        tooltip: 'Back to top',
        icon: const Icon(Icons.arrow_upward),
        onPressed: () {},
        floating: true,
      ),
    );
    final context = tester.element(find.byType(GitPulseIconButton));
    final material = tester.widget<Material>(
      find
          .descendant(
            of: find.byType(GitPulseIconButton),
            matching: find.byType(Material),
          )
          .first,
    );
    final shape = material.shape! as CircleBorder;

    // The action stands over the list on a surface of its own, told apart from
    // the cards beneath it by a boundary — the app raises nothing with a shadow.
    expect(material.color, toneShell(context));
    expect(shape.side.color, toneEdge(Theme.of(context).colorScheme));
    expect(shape.side.width, GitPulseStroke.hairline);
    expect(
      IconTheme.of(tester.element(find.byIcon(Icons.arrow_upward))).color,
      toneText(context),
    );
    expect(
      tester.getSize(find.byType(GitPulseIconButton)),
      const Size.square(GitPulseHeight.standard),
    );
  });
}
