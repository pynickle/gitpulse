import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/releases/document_content.dart';
import 'package:gitpulse/releases/document_viewer_assets.dart';
import 'package:gitpulse/releases/document_web_view.dart';
import 'package:gitpulse/releases/release_document.dart';

import '../support/document_viewer.dart';

const _source = '''
# Release notes

A [guide](../guide.md) and a ![chart](images/chart.png).
''';

/// The surface colour the page was painted with.
String? _background(String html) =>
    RegExp(r'--gp-bg:(#[0-9a-f]{6});').firstMatch(html)?.group(1);

class _Harness {
  _Harness(this.probe);

  final DocumentViewerProbe probe;
  final List<String> taps = [];
}

/// Mounts one document over the stand-in engine and returns what the page asked
/// the app for.
Future<_Harness> _pump(
  WidgetTester tester, {
  String source = _source,
  Brightness brightness = Brightness.light,
  bool withoutRenderer = false,
  _Harness? reuse,
}) async {
  final harness = reuse ?? _Harness(DocumentViewerProbe());
  await tester.pumpWidget(
    ProviderScope(
      overrides: withoutRenderer
          ? [
              documentViewerAssetsProvider.overrideWith(
                (ref) => Future<DocumentViewerAssets>.error(
                  StateError('the renderer asset is missing'),
                ),
              ),
              documentWebViewBuilderProvider.overrideWith(
                (ref) => harness.probe.call,
              ),
            ]
          : documentViewerOverrides(engine: harness.probe.call),
      child: MaterialApp(
        theme: gitPulseTheme(brightness),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: ReleaseDocument(
            source: source,
            document: const RepositoryDocumentContext(
              owner: 'octo',
              repository: 'app',
              ref: 'v2',
              documentPath: 'docs/README.md',
            ),
            onTapUrl: (url) async {
              harness.taps.add(url);
              return true;
            },
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
  return harness;
}

void main() {
  testWidgets('the engine is handed the document and the app theme', (
    tester,
  ) async {
    final light = await _pump(tester);
    expect(light.probe.last, isNotNull);
    final page = light.probe.last!.page;
    expect(page.html, contains('/* document renderer */'));
    expect(page.html, contains('/* document stylesheet */'));
    expect(page.renderScript, contains(r'# Release notes'));
    expect(page.renderScript, contains('docs/README.md'));
    expect(page.renderScript, contains('Copy code'));
    expect(page.html, contains('--gp-font-size:15.00px'));
    expect(page.html, contains('data-appearance="light"'));
    final lightBackground = _background(page.html);
    expect(lightBackground, isNotNull);

    final dark = await _pump(tester, reuse: light, brightness: Brightness.dark);
    expect(dark.probe.last!.page.html, contains('data-appearance="dark"'));
    expect(
      _background(dark.probe.last!.page.html),
      isNot(lightBackground),
      reason: 'the document is painted in the app surface it sits on',
    );
  });

  testWidgets('a relative address resolves through the repository', (
    tester,
  ) async {
    final harness = await _pump(tester);
    expect(
      harness.probe.bridge.resolve(const [
        DocumentResourceTarget(value: '../guide.md', image: false),
        DocumentResourceTarget(value: 'images/chart.png', image: true),
        DocumentResourceTarget(value: '#install', image: false),
      ]),
      [
        'https://github.com/octo/app/blob/v2/guide.md',
        'https://raw.githubusercontent.com/octo/app/v2/docs/images/chart.png',
        '#install',
      ],
    );
  });

  testWidgets('an active or local address never survives the bridge', (
    tester,
  ) async {
    final harness = await _pump(tester);
    expect(
      harness.probe.bridge.resolve(const [
        DocumentResourceTarget(value: 'javascript:alert(1)', image: false),
        DocumentResourceTarget(value: 'file:///etc/passwd', image: true),
        DocumentResourceTarget(
          value: 'data:image/png;base64,AAAA',
          image: true,
        ),
        DocumentResourceTarget(
          value: 'https://user:secret@github.com/octo/app',
          image: false,
        ),
        DocumentResourceTarget(value: '', image: false),
      ]),
      [null, null, null, null, null],
    );
  });

  testWidgets('a link the page reports leaves through the app, not the page', (
    tester,
  ) async {
    final harness = await _pump(tester);
    await harness.probe.bridge.open('https://example.com/target');
    expect(harness.taps, ['https://example.com/target']);
  });

  testWidgets("a code block's copy action writes the reader's clipboard", (
    tester,
  ) async {
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          copied = (call.arguments as Map)['text'] as String?;
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );

    final harness = await _pump(tester);
    harness.probe.bridge.copy('const answer = 42;');
    await tester.pump();
    expect(copied, 'const answer = 42;');
  });

  testWidgets('a document the page cannot render falls back to its text', (
    tester,
  ) async {
    final harness = await _pump(tester);
    expect(find.byType(DocumentSourceFallback), findsNothing);

    harness.probe.bridge.failed('the renderer threw');
    await tester.pump();

    expect(find.byType(DocumentSourceFallback), findsOneWidget);
    expect(
      find.textContaining('# Release notes', findRichText: true),
      findsWidgets,
    );
  });

  testWidgets(
    'a valid update recovers from a failed render on the same surface',
    (tester) async {
      final harness = await _pump(tester);
      harness.probe.bridge.failed('failed');
      await tester.pump();
      expect(find.byType(SelectionArea), findsOneWidget);
      await _pump(tester, reuse: harness, source: '# Updated');
      expect(find.byType(DocumentSourceFallback), findsNothing);
      expect(harness.probe.last!.page.source, '# Updated');
    },
  );

  testWidgets('a missing renderer still leaves the document readable', (
    tester,
  ) async {
    await _pump(tester, withoutRenderer: true);
    await tester.pump();
    expect(find.byType(DocumentSourceFallback), findsOneWidget);
    expect(
      find.textContaining('A [guide](../guide.md)', findRichText: true),
      findsWidgets,
    );
  });
}
