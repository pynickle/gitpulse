import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_state_views.dart';
import 'package:gitpulse/presentation/gitpulse_progress.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';

/// The app's two progress indicators are its own faces (ADR 0032): a row's
/// indicator stands in the height of a glyph, and a page's indicator is the
/// whole content of a loading state. Neither is Material's spinner, which a
/// dependency bump is free to redraw.
void main() {
  Future<void> pumpThemed(WidgetTester tester, Widget child) =>
      tester.pumpWidget(
        MaterialApp(
          theme: gitPulseTheme(Brightness.light),
          home: Scaffold(body: Center(child: child)),
        ),
      );

  Size extentOf(WidgetTester tester, Type type) =>
      tester.getSize(find.byType(type));

  testWidgets('a row keeps its indicator at a glyph’s measure', (tester) async {
    await pumpThemed(tester, const GitPulseProgressInline());

    // A row's indicator stands where a 20dp mark would, so the row is not held
    // open by the progress it happens to be showing.
    expect(
      extentOf(tester, GitPulseProgressInline),
      const Size.square(GitPulseIconSize.action),
    );
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('a page’s indicator stands at the page state’s measure', (
    tester,
  ) async {
    await pumpThemed(tester, const GitPulseProgressPage());

    // The same measure as the glyph a message view leads with, so a loading
    // page and an empty page open at the same size.
    expect(
      extentOf(tester, GitPulseProgressPage),
      const Size.square(GitPulseIconSize.page),
    );
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('an indicator is announced when it is given a label', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await pumpThemed(
      tester,
      const GitPulseProgressInline(label: 'Clearing the timeline cache'),
    );

    expect(
      tester.getSemantics(find.byType(GitPulseProgressInline)),
      matchesSemantics(
        label: 'Clearing the timeline cache',
        isLiveRegion: true,
      ),
    );
    semantics.dispose();
  });

  testWidgets('an indicator keeps turning until it is taken away', (
    tester,
  ) async {
    await pumpThemed(tester, const GitPulseProgressInline());

    // The progress is indeterminate, so a ticker has to be live for the reader
    // to see movement at all.
    expect(tester.binding.transientCallbackCount, greaterThan(0));
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.binding.transientCallbackCount, greaterThan(0));

    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.binding.transientCallbackCount, 0);
  });

  testWidgets('the loading state is the page’s indicator, announced', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await pumpThemed(
      tester,
      const GitPulseLoadingView(label: 'Loading the Release Timeline'),
    );

    expect(find.byType(GitPulseProgressPage), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(
      tester.getSemantics(find.byType(GitPulseProgressPage)),
      matchesSemantics(
        label: 'Loading the Release Timeline',
        isLiveRegion: true,
      ),
    );
    semantics.dispose();
  });
}
