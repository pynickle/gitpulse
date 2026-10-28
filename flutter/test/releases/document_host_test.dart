import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/releases/document_content.dart';
import 'package:gitpulse/releases/document_viewer_assets.dart';
import 'package:gitpulse/releases/document_web_view.dart';
import 'package:gitpulse/releases/release_document.dart';

void main() {
  testWidgets(
    'real host waits for the engine, decodes the renderer protocol and updates in place',
    (tester) async {
      final fixture = jsonDecode(
        File('tool/document_viewer/protocol.json').readAsStringSync(),
      ) as Map;
      late DocumentEngineRequest engine;
      final shown = <Map<String, dynamic>>[];
      final taps = <String>[];
      Future<void> evaluate(String script) async {
        shown.add(
          jsonDecode(
            script.substring(
              'window.gitpulseDocument.render('.length,
              script.length - 2,
            ),
          ) as Map<String, dynamic>,
        );
      }

      final overrides = [
        documentViewerAssetsProvider.overrideWith(
          (ref) => const DocumentViewerAssets(script: '', stylesheet: ''),
        ),
        documentEngineBuilderProvider.overrideWith(
          (ref) => (context, request) {
            engine = request;
            return const SizedBox.expand();
          },
        ),
      ];
      Future<void> mount({
        String source = '# First',
        String revision = 'v2',
        bool dark = false,
        String language = 'en',
        double scale = 1,
        String identity = 'readme',
      }) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: overrides,
            child: MaterialApp(
              theme: gitPulseTheme(dark ? Brightness.dark : Brightness.light),
              locale: Locale(language),
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              home: MediaQuery(
                data: MediaQueryData(textScaler: TextScaler.linear(scale)),
                child: Scaffold(
                  body: ReleaseDocument(
                    source: source,
                    documentIdentity: identity,
                    document: RepositoryDocumentContext(
                      owner: 'octo',
                      repository: 'app',
                      ref: revision,
                      documentPath: 'docs/README.md',
                    ),
                    onTapUrl: (url) async {
                      taps.add(url);
                      return true;
                    },
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));
      }

      await mount();
      expect(shown, isEmpty);
      await mount(source: '# Latest before ready');
      engine.ready(evaluate);
      expect(shown.single['source'], '# Latest before ready');
      final message = jsonDecode(
        jsonEncode({'base': fixture['base'], 'targets': fixture['targets']}),
      ) as Map;
      expect(
        engine.message('resolveDocumentUrls', [message]),
        fixture['answers'],
      );
      expect(
        engine.message('resolveDocumentUrls', [
          {
            'base': fixture['base'],
            'targets': ['invalid'],
          },
        ]),
        [
          {'transient': true},
        ],
      );
      await mount(
        source: '# Updated',
        revision: 'v3',
        dark: true,
        language: 'zh',
        scale: 2,
      );
      expect(shown.last['source'], '# Updated');
      expect(shown.last['base'], contains('/v3/'));
      expect(shown.last['dark'], true);
      expect(shown.last['language'], 'zh');
      expect(shown.last['css'], contains('--gp-font-size:30.00px'));
      expect(shown.last['identity'], 'readme');
      expect(
        engine.message('resolveDocumentUrls', [message]),
        isNull,
        reason: 'old context cannot resolve against the new document',
      );
      engine.message('openDocumentUrl', ['https://example.com/a']);
      expect(taps, ['https://example.com/a']);
      engine.message('documentFailed', ['renderer failed']);
      await tester.pump();
      expect(find.byType(SelectionArea), findsOneWidget);
      expect(find.text('# Updated'), findsOneWidget);
      await mount(source: '# Recovered');
      engine.ready(evaluate);
      expect(find.byType(DocumentSourceFallback), findsNothing);
      expect(shown.last['source'], '# Recovered');
      await mount(source: '# Other', identity: 'other-document');
      expect(shown.last['identity'], 'other-document');
    },
  );
}
