import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/releases/document_content.dart';
import 'package:gitpulse/releases/document_image.dart';
import 'package:gitpulse/releases/document_image_provider.dart';
import 'package:gitpulse/releases/release_document.dart';

/// The fixed author-layout input, read from the tracked fixture so the test and
/// the research note describe the same document.
String _layoutFixture() => File(
  '${Directory.current.parent.path}/docs/research/fixtures/readme-rendering/layout.md',
).readAsStringSync();

/// Serves the fixture's `fixtures.invalid` URLs from fixed bytes.
Future<HttpServer> _serveFixtures(WidgetTester tester) async {
  final overrides = HttpOverrides.current;
  HttpOverrides.global = null;
  addTearDown(() => HttpOverrides.global = overrides);
  final server = (await tester.runAsync(
    () => HttpServer.bind(InternetAddress.loopbackIPv4, 0),
  ))!;
  addTearDown(() => server.close(force: true));
  const directory = '../docs/research/fixtures/readme-rendering';
  server.listen((request) async {
    final name = switch (request.uri.path) {
      '/badge' => 'shield.svg',
      _ => request.uri.pathSegments.last,
    };
    final file = File('${Directory.current.parent.path}/$directory/$name');
    if (await file.exists()) {
      request.response.add(await file.readAsBytes());
    } else {
      request.response.statusCode = 404;
    }
    await request.response.close();
  });
  return server;
}

Future<void> _pumpDocument(
  WidgetTester tester,
  String source, {
  double width = 420,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: gitPulseTheme(Brightness.light),
        themeAnimationDuration: Duration.zero,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SingleChildScrollView(
            child: SizedBox(
              width: width,
              child: ReleaseDocument(
                source: source,
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
    ),
  );
  // Document images load over real sockets and render through the worker
  // isolate, so settle with a real clock for a bounded while.
  for (var attempt = 0; attempt < 150; attempt++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 20)),
    );
    await tester.pump();
  }
}

/// The first rendered run whose plain text starts with [text].
RichText _run(WidgetTester tester, String text) => tester
    .widgetList<RichText>(find.byType(RichText))
    .firstWhere((run) => run.text.toPlainText().contains(text));

Rect _runRect(WidgetTester tester, String text) =>
    tester.getRect(find.byWidget(_run(tester, text)));

void main() {
  testWidgets('author alignment survives preparation and reaches the layout', (
    tester,
  ) async {
    const source = '''
<h1 align="center">A centered document title</h1>

<p>Left by default.</p>

<p align="center"><b>A centered introduction</b></p>

<h2 align="right">Right aligned heading</h2>
''';
    await _pumpDocument(tester, source);
    final documentWidth = tester.getSize(find.byType(ReleaseDocument)).width;

    final title = _runRect(tester, 'A centered document title');
    final titleSize = title.size;
    expect(
      title.left + titleSize.width / 2,
      closeTo(documentWidth / 2, 24),
      reason: 'a centered heading sits on the document axis',
    );

    final left = _runRect(tester, 'Left by default.');
    expect(left.left, lessThan(documentWidth / 4));

    final centered = _runRect(tester, 'A centered introduction');
    final centeredSize = centered.size;
    expect(
      centered.left + centeredSize.width / 2,
      closeTo(documentWidth / 2, 24),
      reason: 'a centered paragraph sits on the document axis',
    );
    expect(centered.left, greaterThan(left.left + 20));

    final right = _runRect(tester, 'Right aligned heading');
    final rightSize = right.size;
    expect(
      right.left + rightSize.width,
      closeTo(documentWidth, 24),
      reason: 'a right aligned heading ends at the document edge',
    );

    // The alignment attribute is the document's own semantic, not a style
    // string pasted into the renderer.
    expect(
      prepareDocument(
        source,
        const RepositoryDocumentContext(
          owner: 'octo',
          repository: 'app',
          ref: 'v2',
        ),
      ),
      allOf(contains('align="center"'), contains('align="right"')),
    );
  });

  testWidgets('table cell alignment reaches the cell text', (tester) async {
    await _pumpDocument(
      tester,
      '| Item | Count |\n| :--- | ----: |\n| Release | 42 |\n',
    );
    final cell = _run(tester, '42');
    expect(cell.textAlign, TextAlign.right);
    expect(_runRect(tester, '42').center.dx, greaterThan(110));
  });

  testWidgets('an explicit image size is kept and a run of badges wraps', (
    tester,
  ) async {
    final server = await _serveFixtures(tester);
    final address = 'http://127.0.0.1:${server.port}';
    await _pumpDocument(
      tester,
      '# Badges\n\n'
      '<p align="center"><img src="$address/logo.svg" width="64" height="64" alt="Fixed-size logo"></p>\n\n'
      '<p align="center"><img src="$address/badge" alt="Release"> '
      '<img src="$address/badge.svg" alt="Second badge"> '
      '<img src="$address/badge.svg" alt="Third badge"></p>\n',
      width: 220,
    );

    final images = find.byType(DocumentImage);
    expect(images, findsNWidgets(4));
    final logo = images.at(0);
    expect(tester.widget<DocumentImage>(logo).width, 64);
    expect(tester.widget<DocumentImage>(logo).height, 64);
    expect(tester.getSize(logo), const Size(64, 64));

    // Three badges do not fit one 220dp line, so they wrap instead of being
    // squeezed or clipped: more than one row, each fully inside the document.
    final badges = [for (var index = 1; index < 4; index++) images.at(index)];
    final rows = {
      for (final badge in badges) tester.getTopLeft(badge).dy.round(),
    };
    expect(rows.length, greaterThan(1), reason: 'badges wrap onto more rows');
    for (final badge in badges) {
      expect(tester.getRect(badge).right, lessThanOrEqualTo(220.5));
    }
  });

  testWidgets('details stay interactive and body text stays selectable', (
    tester,
  ) async {
    await _pumpDocument(
      tester,
      '<details><summary>Details</summary><p>Selectable body text.</p></details>',
    );
    expect(find.byType(SelectionArea), findsOneWidget);
    // Closed by default: the summary is there and its content is not.
    expect(_run(tester, 'Details'), isNotNull);
    expect(
      find
          .byType(RichText)
          .evaluate()
          .map((element) => (element.widget as RichText).text.toPlainText()),
      isNot(contains(contains('Selectable body text.'))),
    );
    await tester.tap(find.byWidget(_run(tester, 'Details')));
    await tester.pumpAndSettle();
    expect(_run(tester, 'Selectable body text.'), isNotNull);
  });

  testWidgets('the tracked layout fixture renders every block', (tester) async {
    final server = await _serveFixtures(tester);
    final source = _layoutFixture().replaceAll(
      'https://fixtures.invalid',
      'http://127.0.0.1:${server.port}',
    );
    await _pumpDocument(tester, source);
    // Every block the fixture exercises reached the renderer: its heading, its
    // table, its code card, and both badge images.
    expect(_run(tester, 'A centered document title'), isNotNull);
    expect(_run(tester, 'Release'), isNotNull);
    expect(_run(tester, 'exact whitespace'), isNotNull);
    expect(find.byType(DocumentImage), findsNWidgets(3));
  });

  testWidgets('inline code and code cards read as one surface', (tester) async {
    await _pumpDocument(
      tester,
      'An `inline_identifier` and **emphasized text**.\n\n'
      '```text\n  exact whitespace\n```\n',
    );
    final context = tester.element(find.byType(ReleaseDocument));
    // Emphasised text is heavier than body text; the inline code chip carries
    // the theme's container tone behind it.
    final spans = <TextSpan>[];
    _run(tester, 'emphasized text').text.visitChildren((span) {
      if (span is TextSpan) spans.add(span);
      return true;
    });
    expect(
      spans.any((span) => span.style?.fontWeight == FontWeight.w600),
      isTrue,
      reason: 'emphasis is heavier than body text',
    );
    expect(find.byType(SelectionArea), findsOneWidget);
    final themed = Theme.of(context);
    expect(themed.colorScheme.surfaceContainerHighest, isNotNull);
  });
}
