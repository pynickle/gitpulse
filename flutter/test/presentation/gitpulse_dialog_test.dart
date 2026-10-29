import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_buttons.dart';
import 'package:gitpulse/presentation/gitpulse_dialog.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

/// One function opens the app's dialogs (ADR 0032), the way one function opens
/// its sheets. It owns the route, the barrier, the surface, the space the dialog
/// stands in and the Escape key; a body decides only its content. These tests
/// drive the real overlay and assert what a reader gets.
void main() {
  late Future<int?>? opened;

  Future<void> pumpOpener(
    WidgetTester tester, {
    Brightness brightness = Brightness.light,
    Widget? content,
  }) async {
    openDialog() => showGitPulseDialog<int>(
      tester.element(find.byType(GitPulseButton)),
      builder: (context) => GitPulseDialog(
        title: const Text('Clear the timeline cache?'),
        content: content,
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

  testWidgets('a dialog stands in what the keyboard leaves', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    // The status bar is drawn over the top of the page on a phone, and the
    // dialog stands between it and the keys rather than under either.
    tester.view.padding = const FakeViewPadding(top: 24);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPadding);
    addTearDown(tester.view.resetViewInsets);

    await pumpOpener(tester, content: const Text('Saved releases only'));
    await open(tester);
    final before = tester.getRect(find.byType(GitPulseDialog));

    // A body may hold a field, and the keyboard a field raises is answered by
    // moving the dialog, not by standing across it.
    tester.view.viewInsets = const FakeViewPadding(bottom: 320);
    await tester.pumpAndSettle();

    const statusBar = 24.0;
    const keyboardTop = 844.0 - 320;
    final after = tester.getRect(find.byType(GitPulseDialog));
    expect(
      after.height,
      moreOrLessEquals(before.height, epsilon: 1),
      reason: 'the dialog moves; its body is content and is not squashed',
    );
    expect(
      after.center.dy,
      moreOrLessEquals((statusBar + keyboardTop) / 2, epsilon: 1),
      reason: 'it stays vertically centred in what the keyboard left',
    );
    expect(after.bottom, lessThanOrEqualTo(keyboardTop));
  });

  testWidgets('a dialog opened with the keyboard already up arrives where it '
      'leaves, not behind it', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);

    // The page behind may already have answered a field of its own, so the
    // dialog is placed in the room the keys have already taken — it does not
    // arrive centred and climb.
    tester.view.viewInsets = const FakeViewPadding(bottom: 320);
    await pumpOpener(tester);
    await open(tester);

    const keyboardTop = 844.0 - 320;
    expect(
      tester.getRect(find.byType(GitPulseDialog)).center.dy,
      moreOrLessEquals(keyboardTop / 2, epsilon: 1),
    );
  });

  testWidgets('a small phone with the keyboard up gets a dialog that scrolls, '
      'not one that is cut', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);

    await pumpOpener(
      tester,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var line = 0; line < 12; line++) Text('Saved release $line'),
        ],
      ),
    );
    await open(tester);

    tester.view.viewInsets = const FakeViewPadding(bottom: 360);
    await tester.pumpAndSettle();

    // The room a keyboard leaves on the smallest phone is less than this body
    // needs, so the body gives way by scrolling inside the dialog: its title
    // still stands above the keys, and its actions are reached by scrolling to
    // them rather than being cut off or overflowing the surface.
    const keyboardTop = 640.0 - 360;
    expect(
      tester.getRect(find.text('Clear the timeline cache?')).bottom,
      lessThanOrEqualTo(keyboardTop),
    );
    expect(find.text('Clear').hitTestable(), findsNothing);
    await tester.scrollUntilVisible(
      find.text('Clear'),
      80,
      scrollable: find.byType(Scrollable),
    );
    expect(find.text('Clear').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
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
    await pumpOpener(tester, content: const Text('Saved releases only'));
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
