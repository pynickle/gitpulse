import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

import '../support/named_actions.dart';

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

  testWidgets('a status mark is the one mark a caller may tone, and the rest '
      'take the variant’s ink', (tester) async {
    // An ordinary action hands its mark no colour at all: the control decides, so a button
    // reads as one control in whichever standing it is drawn (ADR 0032).
    await pumpThemed(
      tester,
      GitPulseButton(
        label: 'Manage',
        onPressed: () {},
        variant: GitPulseButtonVariant.tonal,
        icon: const Icon(Icons.bookmarks_outlined),
      ),
    );
    var icon = find.descendant(
      of: find.byType(GitPulseButton),
      matching: find.byType(Icon),
    );
    expect(
      IconTheme.of(tester.element(icon)).color,
      toneAccent(tester.element(find.byType(GitPulseButton))),
      reason: 'the control owns its mark’s tone',
    );

    // A mark that *is* the status — the one case where the status is the whole point and no line
    // of text says it — reads the status tone the caller names.
    final danger = toneDanger(tester.element(find.byType(GitPulseButton)));
    await pumpThemed(
      tester,
      GitPulseButton(
        label: 'Manage',
        onPressed: () {},
        variant: GitPulseButtonVariant.tonal,
        icon: const Icon(Icons.bookmarks_outlined),
        statusMarkTone: danger,
      ),
    );
    icon = find.descendant(
      of: find.byType(GitPulseButton),
      matching: find.byType(Icon),
    );
    expect(IconTheme.of(tester.element(icon)).color, danger);
  });

  testWidgets('a disabled action quiets its status mark with the rest of it', (
    tester,
  ) async {
    // A first pump hands the test the theme's own tones to compare against.
    await pumpThemed(tester, textButton());
    final context = tester.element(find.byType(GitPulseButton));

    await pumpThemed(
      tester,
      GitPulseButton(
        label: 'Clear',
        onPressed: null,
        variant: GitPulseButtonVariant.outlined,
        icon: const Icon(Icons.check),
        statusMarkTone: toneSuccess(context),
      ),
    );
    expect(
      IconTheme.of(
        tester.element(
          find.descendant(
            of: find.byType(GitPulseButton),
            matching: find.byType(Icon),
          ),
        ),
      ).color,
      toneTextSubtle(context),
      reason: 'a status the action can no longer report is not painted',
    );
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
        label: 'Reload',
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

  testWidgets('an icon button is named for a screen reader, raises no hint and '
      'refuses when disabled', (tester) async {
    final semantics = tester.ensureSemantics();
    var taps = 0;
    await pumpThemed(
      tester,
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GitPulseIconButton(
            label: 'Reload',
            icon: const Icon(Icons.refresh),
            onPressed: () => taps++,
          ),
          GitPulseIconButton(
            label: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: null,
          ),
        ],
      ),
    );

    // The mark draws no text, so the name on the control's own node is the whole
    // account a screen reader has of it.
    expect(
      tester.getSemantics(find.byType(GitPulseIconButton).first),
      isSemantics(label: 'Reload', isButton: true, isEnabled: true),
    );
    // Nothing the reader touches raises a bubble over the page: the words are
    // spoken, never drawn (ADR 0032).
    await tester.longPress(findNamedAction('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Sign out').hitTestable(), findsNothing);
    expect(taps, 0);

    await tester.tap(findNamedAction('Reload'));
    await tester.pumpAndSettle();
    expect(taps, 1);

    await tester.tap(findNamedAction('Sign out'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(taps, 1);
    expect(
      tester.getSemantics(findNamedAction('Sign out')),
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
            label: 'Copy',
            icon: const Icon(Icons.copy),
            onPressed: () {},
            emphasized: true,
          ),
          GitPulseIconButton(
            label: 'Sign out',
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
        label: 'Clear',
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
            label: 'Close',
            icon: const Icon(Icons.close),
            onPressed: () {},
            autofocus: true,
          ),
          GitPulseIconButton(
            label: 'Reload',
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
        label: 'Back to top',
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
