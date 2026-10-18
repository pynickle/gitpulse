import 'dart:convert';
import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/releases/document_content.dart';
import 'package:gitpulse/releases/release_document.dart';
import 'package:gitpulse/session/gitpulse_http.dart';

void main() {
  testWidgets(
    'native document images load without backend credentials and unavailable images keep their alt text',
    (tester) async {
      final overrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = overrides);
      final client = HttpClient();
      debugNetworkImageHttpClientProvider = () => client;
      addTearDown(() {
        debugNetworkImageHttpClientProvider = null;
        client.close(force: true);
      });
      final server = (await tester.runAsync(
        () => HttpServer.bind(InternetAddress.loopbackIPv4, 0),
      ))!;
      addTearDown(() => server.close(force: true));
      final seen = <HttpRequest>[];
      server.listen((request) async {
        seen.add(request);
        if (request.uri.path == '/image.png') {
          request.response.headers.contentType = ContentType('image', 'png');
          request.response.add(
            base64Decode(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            ),
          );
        } else {
          request.response.statusCode = 404;
        }
        await request.response.close();
      });
      final address = Uri.parse('http://127.0.0.1:${server.port}/');
      final jar = CookieJar();
      // The same hostname could hold a self-hosted backend cookie. The document
      // loader must not reuse its authenticated jar even on a matching host.
      await jar.saveFromResponse(address, [
        Cookie(sessionCookieName, 'private-session'),
        Cookie(csrfCookieName, 'private-csrf'),
      ]);
      final external = <String>[];
      await tester.pumpWidget(
        ProviderScope(
          overrides: [cookieJarProvider.overrideWithValue(jar)],
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: SingleChildScrollView(
                child: ReleaseDocument(
                  source:
                      '![Available](${address}image.png)\n\n![Missing diagram](${address}missing.png)\n\n<a href="#part">Jump</a><p id="part">Target</p>',
                  document: const RepositoryDocumentContext(
                    owner: 'octo',
                    repository: 'app',
                    ref: 'v2',
                  ),
                  onTapUrl: (url) async {
                    external.add(url);
                    return true;
                  },
                ),
              ),
            ),
          ),
        ),
      );
      for (var attempt = 0; attempt < 100; attempt++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 20)),
        );
        await tester.pump();
        if (tester
            .widgetList<RawImage>(find.byType(RawImage))
            .any((image) => image.image != null)) {
          break;
        }
      }
      expect(
        seen.map((request) => request.uri.path),
        containsAll(['/image.png', '/missing.png']),
      );
      for (final request in seen) {
        expect(request.headers.value('cookie'), isNull);
        expect(request.headers.value('authorization'), isNull);
        expect(request.headers.value(csrfHeaderName), isNull);
        expect(request.uri.hasQuery, isFalse);
      }
      expect(
        tester
            .widgetList<RawImage>(find.byType(RawImage))
            .where((image) => image.image != null),
        hasLength(1),
      );
      expect(find.text('Missing diagram'), findsOneWidget);
      await tester.tapAt(
        tester.getTopLeft(find.textContaining('Jump', findRichText: true)) +
            const Offset(10, 8),
      );
      await tester.pumpAndSettle();
      expect(external, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
      client.close(force: true);
      await tester.pump();
      debugNetworkImageHttpClientProvider = null;
    },
  );
}
