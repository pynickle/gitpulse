import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/presentation/gitpulse_toggles.dart';

/// The switch and the checkbox are GitPulse's own (ADR 0032). These tests mount
/// the real controls under the real theme and assert what a reader gets: the
/// value a tap asks for, what a disabled control refuses, the state a screen
/// reader is told, the ink each one answers the pointer with, and the tones it
/// is drawn in. A toggle's face is drawing rather than a skin, so the tones are
/// read from what it painted.
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

  InkWell inkInside(WidgetTester tester, Type face) => tester.widget<InkWell>(
    find
        .descendant(of: find.byType(face), matching: find.byType(InkWell))
        .first,
  );

  /// The fill a toggle painted on the ink layer, which is where a fill has to be
  /// if the app's hover and focus tint is to read over it.
  BoxDecoration inkDecoration(WidgetTester tester, Type face) =>
      tester
              .widget<Ink>(
                find
                    .descendant(
                      of: find.byType(face),
                      matching: find.byType(Ink),
                    )
                    .first,
              )
              .decoration!
          as BoxDecoration;

  /// The one circle a face draws: a switch's thumb.
  BoxDecoration circleIn(WidgetTester tester, Type face) =>
      tester
              .widget<DecoratedBox>(
                find.byWidgetPredicate(
                  (widget) =>
                      widget is DecoratedBox &&
                      (widget.decoration as BoxDecoration?)?.shape ==
                          BoxShape.circle,
                  description: 'circle in $face',
                ),
              )
              .decoration
          as BoxDecoration;

  group('the switch', () {
    Widget switchFace({bool value = false, ValueChanged<bool>? onChanged}) =>
        GitPulseSwitch(
          value: value,
          onChanged: onChanged ?? (_) {},
          label: 'Hide prereleases',
        );

    testWidgets('a tap asks for the other value', (tester) async {
      final asked = <bool>[];
      await pumpThemed(tester, switchFace(onChanged: asked.add));

      await tester.tap(find.byType(GitPulseSwitch));
      await tester.pumpAndSettle();
      expect(asked, [true]);

      await pumpThemed(tester, switchFace(value: true, onChanged: asked.add));
      await tester.tap(find.byType(GitPulseSwitch));
      await tester.pumpAndSettle();
      expect(asked, [true, false]);
    });

    testWidgets('the thumb crosses the track and the track takes the Accent', (
      tester,
    ) async {
      await pumpThemed(tester, switchFace());
      final off = tester.getRect(
        find.byWidgetPredicate(
          (widget) =>
              widget is DecoratedBox &&
              (widget.decoration as BoxDecoration?)?.shape == BoxShape.circle,
        ),
      );

      await pumpThemed(tester, switchFace(value: true));
      await tester.pumpAndSettle();
      final on = tester.getRect(
        find.byWidgetPredicate(
          (widget) =>
              widget is DecoratedBox &&
              (widget.decoration as BoxDecoration?)?.shape == BoxShape.circle,
        ),
      );

      // The two positions are two places, not one knob twitched sideways.
      expect(on.left, greaterThan(off.left + gitPulseSwitchThumb / 2));
    });

    testWidgets('a disabled switch refuses and quietly says so', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      await pumpThemed(
        tester,
        const GitPulseSwitch(
          value: false,
          onChanged: null,
          label: 'Hide prereleases',
        ),
      );

      // Nothing is asked of a switch with no handler: the tap finds no pressable.
      await tester.tap(find.byType(GitPulseSwitch), warnIfMissed: false);
      await tester.pumpAndSettle();

      final context = tester.element(find.byType(GitPulseSwitch));
      expect(
        tester.getSemantics(find.byType(GitPulseSwitch)),
        isSemantics(
          label: 'Hide prereleases',
          hasToggledState: true,
          isToggled: false,
          hasEnabledState: true,
          isEnabled: false,
          hasTapAction: false,
        ),
      );
      // A switch that cannot be operated is drawn in the palette's quietest
      // steps, and keeps its shape so the row does not re-flow.
      expect(
        inkDecoration(tester, GitPulseSwitch).color,
        toneSurfaceMuted(context),
      );
      expect(circleIn(tester, GitPulseSwitch).color, toneTextSubtle(context));
      semantics.dispose();
    });

    testWidgets('the switch states its role, its state and its name', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      await pumpThemed(tester, switchFace(value: true));

      expect(
        tester.getSemantics(find.byType(GitPulseSwitch)),
        isSemantics(
          label: 'Hide prereleases',
          hasToggledState: true,
          isToggled: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
        ),
      );
      semantics.dispose();
    });

    testWidgets('a press paints nothing and hover paints the one tint', (
      tester,
    ) async {
      final theme = await pumpThemed(tester, switchFace());
      final ink = inkInside(tester, GitPulseSwitch);
      final tint = gitPulseHoverTint(theme.colorScheme);

      expect(
        ink.overlayColor!.resolve({WidgetState.pressed}),
        Colors.transparent,
      );
      expect(ink.overlayColor!.resolve({WidgetState.hovered}), tint);
      expect(ink.overlayColor!.resolve({WidgetState.focused}), tint);
    });

    testWidgets('a pointer over the switch starts the app’s tint', (
      tester,
    ) async {
      await pumpThemed(tester, switchFace());
      expect(tester.binding.transientCallbackCount, 0);

      final gesture = await tester.createGesture(kind: PointerDeviceKind.mouse);
      await gesture.addPointer(location: Offset.zero);
      addTearDown(gesture.removePointer);
      await tester.pump();
      await gesture.moveTo(tester.getCenter(find.byType(GitPulseSwitch)));
      await tester.pump();

      expect(tester.binding.transientCallbackCount, greaterThan(0));
    });

    testWidgets('the track is the app’s own step in both states', (
      tester,
    ) async {
      for (final brightness in Brightness.values) {
        await pumpThemed(tester, switchFace(), brightness: brightness);
        await tester.pumpAndSettle();
        final context = tester.element(find.byType(GitPulseSwitch));
        // Off is the palette's step under a knob, framed by one hairline so the
        // track is told apart from the surface it stands on.
        final offTrack = inkDecoration(tester, GitPulseSwitch);
        expect(offTrack.color, toneSurfaceActive(context));
        expect(
          (offTrack.border! as Border).top.color,
          toneBorderStrong(context),
        );
        expect((offTrack.border! as Border).top.width, GitPulseStroke.hairline);
        expect(circleIn(tester, GitPulseSwitch).color, toneTextSubtle(context));

        await pumpThemed(
          tester,
          switchFace(value: true),
          brightness: brightness,
        );
        await tester.pumpAndSettle();
        // On is the Accent, and the thumb is the tone that reads on it.
        final onContext = tester.element(find.byType(GitPulseSwitch));
        expect(
          inkDecoration(tester, GitPulseSwitch).color,
          toneAccent(onContext),
        );
        expect(circleIn(tester, GitPulseSwitch).color, toneOnAccent(onContext));
      }
    });

    testWidgets('the switch clears the app’s tap-target floor', (tester) async {
      await pumpThemed(tester, switchFace());
      final size = tester.getSize(find.byType(GitPulseSwitch));

      expect(size.width, gitPulseSwitchTrack.width);
      expect(size.height, greaterThanOrEqualTo(GitPulseHeight.standard));
    });
  });

  group('the checkbox', () {
    Widget box({
      bool? value = false,
      ValueChanged<bool?>? onChanged,
      bool tristate = false,
      double? target,
    }) => GitPulseCheckbox(
      value: value,
      onChanged: onChanged ?? (_) {},
      tristate: tristate,
      label: 'octo/alpha',
      target: target ?? GitPulseHeight.standard,
    );

    testWidgets('a tap asks for the other value', (tester) async {
      final asked = <bool?>[];
      await pumpThemed(tester, box(onChanged: asked.add));

      await tester.tap(find.byType(GitPulseCheckbox));
      await tester.pumpAndSettle();
      expect(asked, [true]);

      await pumpThemed(tester, box(value: true, onChanged: asked.add));
      await tester.tap(find.byType(GitPulseCheckbox));
      await tester.pumpAndSettle();
      expect(asked, [true, false]);
    });

    testWidgets('a disabled checkbox refuses and quietly says so', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      await pumpThemed(
        tester,
        const GitPulseCheckbox(
          value: false,
          onChanged: null,
          label: 'octo/alpha',
        ),
      );

      await tester.tap(find.byType(GitPulseCheckbox), warnIfMissed: false);
      await tester.pumpAndSettle();

      final context = tester.element(find.byType(GitPulseCheckbox));
      expect(
        tester.getSemantics(find.byType(GitPulseCheckbox)),
        isSemantics(
          label: 'octo/alpha',
          hasCheckedState: true,
          isChecked: false,
          hasEnabledState: true,
          isEnabled: false,
          hasTapAction: false,
        ),
      );
      expect(inkDecoration(tester, GitPulseCheckbox).color, isNull);
      expect(
        (inkDecoration(tester, GitPulseCheckbox).border! as Border).top.color,
        toneBorder(context),
      );
      semantics.dispose();
    });

    testWidgets('the checkbox states its role, its state and its name', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      await pumpThemed(tester, box(value: true));

      expect(
        tester.getSemantics(find.byType(GitPulseCheckbox)),
        isSemantics(
          label: 'octo/alpha',
          hasCheckedState: true,
          isChecked: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
          hasToggledState: false,
        ),
      );
      semantics.dispose();
    });

    testWidgets('a mixed box announces a state of its own', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpThemed(tester, box(value: null, tristate: true));

      expect(
        tester.getSemantics(find.byType(GitPulseCheckbox)),
        isSemantics(
          hasCheckedState: true,
          isChecked: false,
          isCheckStateMixed: true,
        ),
      );
      semantics.dispose();
    });

    testWidgets('a press paints nothing and focus paints the one tint', (
      tester,
    ) async {
      final theme = await pumpThemed(tester, box());
      final ink = inkInside(tester, GitPulseCheckbox);
      final tint = gitPulseHoverTint(theme.colorScheme);

      expect(
        ink.overlayColor!.resolve({WidgetState.pressed}),
        Colors.transparent,
      );
      expect(ink.overlayColor!.resolve({WidgetState.hovered}), tint);
      expect(ink.overlayColor!.resolve({WidgetState.focused}), tint);
    });

    testWidgets('a pointer over the box starts the app’s tint', (tester) async {
      await pumpThemed(tester, box());
      expect(tester.binding.transientCallbackCount, 0);

      final gesture = await tester.createGesture(kind: PointerDeviceKind.mouse);
      await gesture.addPointer(location: Offset.zero);
      addTearDown(gesture.removePointer);
      await tester.pump();
      await gesture.moveTo(tester.getCenter(find.byType(GitPulseCheckbox)));
      await tester.pump();

      expect(tester.binding.transientCallbackCount, greaterThan(0));
    });

    testWidgets('the box is the app’s own: a hairline when clear, the Accent '
        'when chosen', (tester) async {
      for (final brightness in Brightness.values) {
        await pumpThemed(tester, box(), brightness: brightness);
        await tester.pumpAndSettle();
        final context = tester.element(find.byType(GitPulseCheckbox));
        final clear = inkDecoration(tester, GitPulseCheckbox);
        expect(clear.color, isNull);
        expect((clear.border! as Border).top.color, toneBorderStrong(context));
        expect((clear.border! as Border).top.width, GitPulseStroke.hairline);

        await pumpThemed(tester, box(value: true), brightness: brightness);
        await tester.pumpAndSettle();
        final chosen = inkDecoration(tester, GitPulseCheckbox);
        expect(chosen.color, toneAccent(context));
        expect(chosen.border, isNull);
        // The mark is drawn, not a Material glyph.
        expect(
          find.descendant(
            of: find.byType(GitPulseCheckbox),
            matching: find.byType(Icon),
          ),
          findsNothing,
        );
      }
    });

    testWidgets('the mark crosses from one state to the other', (tester) async {
      await pumpThemed(tester, box());
      final clear = inkDecoration(tester, GitPulseCheckbox).color;

      await pumpThemed(tester, box(value: true));
      await tester.pump(const Duration(milliseconds: 90));
      final crossing = inkDecoration(tester, GitPulseCheckbox).color;

      await tester.pumpAndSettle();
      final chosen = inkDecoration(tester, GitPulseCheckbox).color;

      // The fill is on its way across rather than already arrived: the box
      // answers the hand over time, as Material's did.
      expect(crossing, isNot(clear));
      expect(crossing, isNot(chosen));
    });

    testWidgets('the box stands in the target its caller gives it', (
      tester,
    ) async {
      await pumpThemed(tester, box());
      expect(
        tester.getSize(find.byType(GitPulseCheckbox)),
        const Size.square(GitPulseHeight.standard),
      );

      // A row that is the tap target itself gives the box the room it has left,
      // so the row keeps the height it already had.
      await pumpThemed(tester, box(target: GitPulseHeight.rowMin - 12));
      expect(
        tester.getSize(find.byType(GitPulseCheckbox)),
        const Size.square(GitPulseHeight.rowMin - 12),
      );
    });
  });
}
