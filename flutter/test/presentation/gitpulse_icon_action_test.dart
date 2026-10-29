import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_icon_action.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

/// The row action a Follows row and the Repository page's action row share.
///
/// It used to draw Material's own icon button; it is now the app's icon button
/// with the app's own arguments (ADR 0032), so what a reader gets is unchanged
/// in behaviour and owned in drawing.
void main() {
  Future<void> pumpThemed(WidgetTester tester, Widget child) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: gitPulseTheme(Brightness.light),
        home: Scaffold(body: Center(child: child)),
      ),
    );
  }

  testWidgets('a row action is the app’s icon button, not Material’s', (
    tester,
  ) async {
    var taps = 0;
    await pumpThemed(
      tester,
      GitPulseIconAction(
        tooltip: 'Follow releases',
        icon: Icons.bookmark_add_outlined,
        onPressed: () => taps++,
      ),
    );

    // The face a reader touches is the app's, and it is named by its tooltip.
    expect(find.byType(GitPulseIconButton), findsOneWidget);
    expect(find.byType(IconButton), findsNothing);
    expect(find.byTooltip('Follow releases'), findsOneWidget);

    await tester.tap(find.byTooltip('Follow releases'));
    await tester.pumpAndSettle();
    expect(taps, 1);
    // The action keeps the app's own touch target.
    expect(
      tester.getSize(find.byType(GitPulseIconAction)),
      const Size.square(GitPulseHeight.standard),
    );
  });

  testWidgets('a row action refuses to run when it is disabled', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    var taps = 0;
    await pumpThemed(
      tester,
      GitPulseIconAction(
        tooltip: 'Unfollow',
        icon: Icons.bookmark_remove_outlined,
        onPressed: null,
      ),
    );

    await tester.tap(find.byTooltip('Unfollow'), warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(taps, 0);
    // The action announces itself as a button that is not available, exactly as
    // the disabled control it wraps does.
    expect(
      find.descendant(
        of: find.byType(GitPulseIconAction),
        matching: find.byWidgetPredicate(
          (widget) =>
              widget is Semantics &&
              widget.properties.button == true &&
              widget.properties.enabled == false,
        ),
      ),
      findsOneWidget,
    );
    // A disabled action quiets to the subtlest ink the palette has, so the row
    // still says the action is there without offering it.
    expect(
      IconTheme.of(tester.element(find.byIcon(Icons.bookmark_remove_outlined)))
          .color,
      toneTextSubtle(tester.element(find.byType(GitPulseIconAction))),
    );
    semantics.dispose();
  });

  testWidgets('an emphasised action is the Accent and the rest are muted', (
    tester,
  ) async {
    await pumpThemed(
      tester,
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GitPulseIconAction(
            tooltip: 'Unfollow',
            icon: Icons.bookmark,
            emphasized: true,
            onPressed: () {},
          ),
          GitPulseIconAction(
            tooltip: 'Share',
            icon: Icons.ios_share,
            onPressed: () {},
          ),
        ],
      ),
    );
    final context = tester.element(find.byType(GitPulseIconAction).first);
    // "Already followed" is the one thing a row may say in the Accent; the
    // action that merely acts stays in the surface's own muted ink.
    expect(
      IconTheme.of(tester.element(find.byIcon(Icons.bookmark))).color,
      toneAccent(context),
    );
    expect(
      IconTheme.of(tester.element(find.byIcon(Icons.ios_share))).color,
      toneTextMuted(context),
    );
  });
}
