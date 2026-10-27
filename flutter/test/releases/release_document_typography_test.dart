import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/releases/document_content.dart';
import 'package:gitpulse/releases/release_document.dart';

const _source = '''
# First level

Paragraph one.

## Second level

Paragraph two.

### Third level

#### Fourth level

##### Fifth level

###### Sixth level

- first item
- second item

> quoted text

---

Final paragraph.
''';

Future<void> pumpNotes(WidgetTester tester, {double width = 360}) async {
  tester.view.physicalSize = Size(width, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: gitPulseTheme(Brightness.light),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SingleChildScrollView(
            child: ReleaseDocument(
              source: _source,
              document: const RepositoryDocumentContext(
                owner: 'octo',
                repository: 'app',
                ref: 'v2',
              ),
              onTapUrl: (_) async => true,
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// The paragraph that actually paints [text], so measurements follow what a
/// reader sees rather than the styles handed to the renderer.
RenderParagraph paragraphOf(WidgetTester tester, String text) {
  final finder = find.byWidgetPredicate(
    (widget) => widget is RichText && widget.text.toPlainText().trim() == text,
  );
  expect(finder, findsOneWidget, reason: 'expected one paragraph for "$text"');
  return tester.renderObject<RenderParagraph>(finder);
}

TextStyle styleOf(WidgetTester tester, String text) =>
    paragraphOf(tester, text).text.style ?? const TextStyle();

double fontSizeOf(WidgetTester tester, String text) =>
    styleOf(tester, text).fontSize!;

void main() {
  testWidgets('headings follow one scale and none falls below body size', (
    tester,
  ) async {
    await pumpNotes(tester);
    final body = fontSizeOf(tester, 'Paragraph one.');
    final first = fontSizeOf(tester, 'First level');
    final second = fontSizeOf(tester, 'Second level');
    final third = fontSizeOf(tester, 'Third level');

    expect(first, greaterThan(second));
    expect(second, greaterThan(third));
    expect(third, greaterThanOrEqualTo(body));
    for (final deep in ['Fourth level', 'Fifth level', 'Sixth level']) {
      expect(fontSizeOf(tester, deep), third, reason: deep);
    }
    // Body text is the reader's unit: 15sp on a 24px line.
    expect(body, closeTo(15, .01));
    expect(body * styleOf(tester, 'Paragraph one.').height!, closeTo(24, .5));
  });

  testWidgets('a heading sits tight above the text it introduces', (
    tester,
  ) async {
    await pumpNotes(tester);
    for (final (heading, following) in [
      ('First level', 'Paragraph one.'),
      ('Second level', 'Paragraph two.'),
      ('Third level', 'Fourth level'),
    ]) {
      final gap =
          tester.getTopLeft(paragraphFinder(following)).dy -
          tester.getBottomLeft(paragraphFinder(heading)).dy;
      expect(gap, greaterThanOrEqualTo(0), reason: heading);
      expect(gap, lessThan(16), reason: heading);
    }
  });

  testWidgets('paragraphs are spaced apart and a rule separates blocks', (
    tester,
  ) async {
    await pumpNotes(tester);
    final gap =
        tester.getTopLeft(paragraphFinder('Paragraph two.')).dy -
        tester.getBottomLeft(paragraphFinder('Paragraph one.')).dy;
    expect(gap, greaterThan(8));
    // A horizontal rule keeps its own space above and below.
    final ruled =
        tester.getTopLeft(paragraphFinder('Final paragraph.')).dy -
        tester.getBottomLeft(paragraphFinder('quoted text')).dy;
    expect(ruled, greaterThan(30));
  });

  testWidgets('lists and quotes keep content and fit a narrow screen', (
    tester,
  ) async {
    await pumpNotes(tester);
    final left = tester.getTopLeft(paragraphFinder('Paragraph one.')).dx;
    final item = tester.getTopLeft(paragraphFinder('first item')).dx;
    final quote = tester.getTopLeft(paragraphFinder('quoted text')).dx;

    expect(find.textContaining('first item', findRichText: true), findsWidgets);
    expect(
      find.textContaining('second item', findRichText: true),
      findsWidgets,
    );
    expect(
      find.textContaining('quoted text', findRichText: true),
      findsWidgets,
    );
    // The browser default indents a list by 40px and a quote by 40px; on a
    // 360dp screen most of the width has to stay available for text.
    expect(item - left, inInclusiveRange(16, 36));
    expect(quote - left, inInclusiveRange(8, 20));
  });

  // The renderer's custom styles hook is the notes scale's only owner (ADR
  // 0018) and `GitPulseType` is the only place the app states a font size.
  // These two cases hold one to the other: each measured value is checked
  // against the token the document reads *and* against the number that token
  // registers, so a tier edited back into a literal, and a token edited without
  // the page it renders, both surface as a change a reader would see.
  testWidgets('each tier renders the size the reading scale registers', (
    tester,
  ) async {
    await pumpNotes(tester);

    for (final (tier, token, registered) in [
      ('Paragraph one.', GitPulseType.readingBodySize, 15.0),
      ('First level', GitPulseType.readingHeading1Size, 20.0),
      ('Second level', GitPulseType.readingHeading2Size, 17.0),
      ('Third level', GitPulseType.readingHeading3Size, 15.0),
      ('Fourth level', GitPulseType.readingHeading3Size, 15.0),
      ('Fifth level', GitPulseType.readingHeading3Size, 15.0),
      ('Sixth level', GitPulseType.readingHeading3Size, 15.0),
    ]) {
      expect(fontSizeOf(tester, tier), token, reason: '$tier token');
      expect(fontSizeOf(tester, tier), registered, reason: '$tier registered');
    }
  });

  testWidgets('line boxes and indents come from that same scale', (
    tester,
  ) async {
    await pumpNotes(tester);

    final body = styleOf(tester, 'Paragraph one.');
    expect(
      body.fontSize! * body.height!,
      closeTo(GitPulseType.readingBodyLineHeight, .01),
    );
    for (final heading in ['First level', 'Second level', 'Third level']) {
      expect(
        styleOf(tester, heading).height,
        closeTo(GitPulseType.readingHeadingLineHeight, .01),
        reason: heading,
      );
    }

    // Measured from the text, so this is where a list item and a quote
    // actually start rather than what the renderer was told. The quote's own
    // 3dp bar is drawn outside its indent, which is why its text sits one bar
    // plus one token in.
    const quoteBarWidth = 3.0;
    final left = tester.getTopLeft(paragraphFinder('Paragraph one.')).dx;
    expect(
      tester.getTopLeft(paragraphFinder('first item')).dx - left,
      GitPulseType.readingListIndent,
    );
    expect(
      tester.getTopLeft(paragraphFinder('quoted text')).dx - left,
      GitPulseType.readingQuoteIndent + quoteBarWidth,
    );
  });
}

Finder paragraphFinder(String text) => find.byWidgetPredicate(
  (widget) => widget is RichText && widget.text.toPlainText().trim() == text,
);
