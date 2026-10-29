import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_dialog.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

/// One function opens the app's dialogs (ADR 0032), the way one function opens
/// its sheets. It owns the route, the barrier, the surface and the Escape key; a
/// body decides only its content. These tests drive the real overlay and assert
/// what a reader gets.
void main() {
  late Future<int?>? opened;

  Future<void> pumpOpener(
    WidgetTester tester, {
    Brightness brightness = Brightness.light,
    bool withContent = false,
  }) async {
    openDialog() => showGitPulseDialog<int>(
      tester.element(find.byType(GitPulseButton)),
      builder: (context) => GitPulseDialog(
        title: const Text('Clear the timeline cache?'),
        content: withContent ? const Text('Saved releases only') : null,
        actions: [
          GitPulseButton(
            label: 'Cancel',
            variant: GitPulseButtonVariant.text,
            onPressed: () => Navigator.of(context).pop(),
          ),
          GitPulseButton(
            label: 'Clear',
            onPressed: () => Navigator.of(context).pop(7),
          ),
        ],
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: gitPulseTheme(brightness),
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: GitPulseButton(
                label: 'Open',
                onPressed: () => opened = openDialog(),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> open(WidgetTester tester) async {
    await tester.tap(find.byType(GitPulseButton));
    await tester.pumpAndSettle();
  }

  testWidgets('a dialog arrives on the app’s own surface', (tester) async {
    await pumpOpener(tester);
    await open(tester);

    expect(find.byType(GitPulseDialog), findsOneWidget);
    expect(find.text('Clear the timeline cache?'), findsOneWidget);
    // None of Material's own dialog is behind it.
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.byType(Dialog), findsNothing);

    final context = tester.element(find.byType(GitPulseDialog));
    final surface = tester.widget<Material>(
      find
          .ancestor(
            of: find.byType(GitPulseDialog),
            matching: find.byType(Material),
          )
          .first,
    );
    // The tone every one of the app's overlays is drawn on, at the app's surface
    // corner rather than at a shape of the platform's.
    expect(surface.color, toneSurface(context));
    expect(surface.borderRadius, BorderRadius.circular(GitPulseRadius.surface));
  });

  testWidgets('the barrier is named by the platform’s own words, so a caller '
      'never has to repeat them', (tester) async {
    await pumpOpener(tester);
    await open(tester);

    // Every call site used to pass the same localised string, which is a rule the entry point can
    // hold itself: the barrier a reader taps away is named by the platform's own label, and a
    // caller that supplies nothing still hands a screen reader a name for it.
    final context = tester.element(find.byType(GitPulseDialog));
    final label = MaterialLocalizations.of(context).modalBarrierDismissLabel;
    final barriers = tester.widgetList<ModalBarrier>(
      find.byType(ModalBarrier, skipOffstage: false),
    );
    expect(
      barriers.map((barrier) => barrier.semanticsLabel),
      contains(label),
      reason: 'the dialog ‘s barrier is named without the caller saying so',
    );
  });

  testWidgets('an action closes the dialog with its answer', (tester) async {
    await pumpOpener(tester);
    await open(tester);

    await tester.tap(find.text('Clear'));
    await tester.pumpAndSettle();
    expect(find.byType(GitPulseDialog), findsNothing);
    expect(await opened, 7);
  });

  testWidgets('the barrier dismisses without an answer', (tester) async {
    await pumpOpener(tester);
    await open(tester);

    // The page behind the dialog is what a reader taps to think better of it.
    await tester.tapAt(const Offset(4, 4));
    await tester.pumpAndSettle();
    expect(find.byType(GitPulseDialog), findsNothing);
    expect(await opened, isNull);
  });

  testWidgets('Escape dismisses a dialog as it dismisses a sheet', (
    tester,
  ) async {
    await pumpOpener(tester);
    await open(tester);

    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    await tester.pumpAndSettle();
    expect(find.byType(GitPulseDialog), findsNothing);
    expect(await opened, isNull);
  });

  testWidgets('a dialog body is content, and keeps its own height', (
    tester,
  ) async {
    await pumpOpener(tester, withContent: true);
    await open(tester);

    expect(find.text('Saved releases only'), findsOneWidget);
    final withBody = tester.getSize(find.byType(GitPulseDialog)).height;

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    await pumpOpener(tester);
    await open(tester);
    // The body decides the content, so a dialog without one is exactly its
    // title and its actions.
    expect(find.text('Saved releases only'), findsNothing);
    expect(
      tester.getSize(find.byType(GitPulseDialog)).height,
      lessThan(withBody),
    );
  });
}
