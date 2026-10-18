import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/releases/document_content.dart';
import 'package:gitpulse/releases/release_document.dart';
import 'package:gitpulse/session/gitpulse_http.dart';

void main() {
  testWidgets(
    'SVG badges render safely and failed resources keep their alt text',
    (tester) async {
      final overrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = overrides);
      final server = (await tester.runAsync(
        () => HttpServer.bind(InternetAddress.loopbackIPv4, 0),
      ))!;
      addTearDown(() => server.close(force: true));
      final seen = <HttpRequest>[];
      final client = HttpClient();
      debugNetworkImageHttpClientProvider = () => client;
      addTearDown(() {
        debugNetworkImageHttpClientProvider = null;
        client.close(force: true);
      });
      server.listen((request) async {
        seen.add(request);
        request.response.headers.contentType = ContentType('image', 'svg+xml');
        if (request.uri.path == '/badge.svg' ||
            request.uri.path == '/badge' ||
            request.uri.path == '/badge/version-1.2.3-blue') {
          request.response.write(
            '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">'
            '<rect width="120" height="20" fill="#00ff00"/></svg>',
          );
        } else if (request.uri.path == '/broken.svg') {
          request.response.write('not SVG');
        } else {
          request.response.statusCode = 404;
        }
        await request.response.close();
      });
      final address = Uri.parse('http://127.0.0.1:${server.port}/');
      final jar = CookieJar();
      await jar.saveFromResponse(address, [
        Cookie(sessionCookieName, 'private-session'),
        Cookie(csrfCookieName, 'private-csrf'),
      ]);
      final semantics = tester.ensureSemantics();
      try {
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
                        '''
![Build passing](${address}badge.svg?style=flat)

![Missing badge](${address}missing.svg)

![Broken badge](${address}broken.svg)

![Extensionless badge](${address}badge)

![Version badge](${address}badge/version-1.2.3-blue)

<svg><script>unsafe()</script></svg>
<img src="file:///private/badge.svg" alt="Blocked badge">
''',
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
        for (var attempt = 0; attempt < 100; attempt++) {
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 20)),
          );
          await tester.pump();
          if (find.text('Broken badge').evaluate().isNotEmpty &&
              find.text('Missing badge').evaluate().isNotEmpty &&
              ['Build passing', 'Extensionless badge', 'Version badge'].every(
                (label) => find.bySemanticsLabel(label).evaluate().isNotEmpty,
              )) {
            break;
          }
        }
        expect(
          seen.map((request) => request.uri.path),
          unorderedEquals([
            '/badge.svg',
            '/missing.svg',
            '/broken.svg',
            '/badge',
            '/badge',
            '/badge/version-1.2.3-blue',
            '/badge/version-1.2.3-blue',
          ]),
        );
        for (final request in seen) {
          expect(request.headers.value('cookie'), isNull);
          expect(request.headers.value('authorization'), isNull);
          expect(request.headers.value(csrfHeaderName), isNull);
        }
        expect(find.bySemanticsLabel('Build passing'), findsWidgets);
        expect(find.bySemanticsLabel('Extensionless badge'), findsWidgets);
        expect(find.bySemanticsLabel('Version badge'), findsWidgets);
        expect(find.text('Missing badge'), findsOneWidget);
        expect(find.text('Broken badge'), findsOneWidget);
        expect(tester.takeException(), isNull);
        // Inspect the painted result, not merely the existence of an SVG widget.
        final boundary = tester.renderObject<RenderRepaintBoundary>(
          find.byType(RepaintBoundary).first,
        );
        final image = (await tester.runAsync(
          () => boundary.toImage(pixelRatio: 1),
        ))!;
        final data = (await tester.runAsync(
          () => image.toByteData(format: ui.ImageByteFormat.rawRgba),
        ))!;
        final pixels = data.buffer.asUint8List();
        var green = false;
        for (var i = 0; i < pixels.length; i += 4) {
          if (pixels[i] == 0 && pixels[i + 1] == 255 && pixels[i + 2] == 0) {
            green = true;
            break;
          }
        }
        image.dispose();
        expect(green, isTrue, reason: 'The SVG badge must actually paint');
        await tester.pumpWidget(const SizedBox.shrink());
      } finally {
        semantics.dispose();
        debugNetworkImageHttpClientProvider = null;
        client.close(force: true);
      }
    },
  );

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
