import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
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

```sh
echo hi
```
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

  testWidgets('code blocks keep their language label and copy action', (
    tester,
  ) async {
    await pumpNotes(tester);
    expect(find.text('sh'), findsOneWidget);
    expect(find.byTooltip('Copy code'), findsOneWidget);
    expect(find.textContaining('echo hi'), findsOneWidget);
  });
}

Finder paragraphFinder(String text) => find.byWidgetPredicate(
  (widget) => widget is RichText && widget.text.toPlainText().trim() == text,
);
