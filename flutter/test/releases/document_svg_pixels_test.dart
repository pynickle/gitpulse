import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/l10n/generated/app_localizations.dart';
import 'package:gitpulse/presentation/gitpulse_theme.dart';
import 'package:gitpulse/releases/document_content.dart';
import 'package:gitpulse/releases/document_image_provider.dart';
import 'package:gitpulse/releases/release_document.dart';

/// Renders the tracked SVG fixtures through the mounted document and inspects
/// painted pixels. The bytes come from `docs/research/fixtures/readme-rendering`
/// so the test never depends on a live badge service.

/// Serves the tracked fixtures to the document image provider.
///
/// The transport is replaced rather than the renderer: fetch, sniff, resvg and
/// decode all run, only the bytes' origin is local and deterministic.
void _serveFixtures() {
  final root = Directory.current.parent.path;
  debugDocumentImageFetcher = (url) async {
    final requested = Uri.parse(url).pathSegments.last;
    final name = requested.contains('.') ? requested : '$requested.svg';
    final file = File('$root/docs/research/fixtures/readme-rendering/$name');
    return await file.exists() ? file.readAsBytes() : null;
  };
  addTearDown(() => debugDocumentImageFetcher = null);
}

class _Painted {
  _Painted(this.pixels, this.width, this.height, this.bounds);

  final Uint8List pixels;
  final int width;
  final int height;

  /// The document's own rectangle on the painted surface.
  final Rect bounds;

  Color at(double x, double y) {
    final column = (bounds.left + x).floor();
    final row = (bounds.top + y).floor();
    if (column < 0 || row < 0 || column >= width || row >= height) {
      return const Color(0x00000000);
    }
    final offset =
        (((bounds.top + y).floor()) * width + (bounds.left + x).floor()) * 4;
    return Color.fromARGB(
      pixels[offset + 3],
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2],
    );
  }

  /// Pixels in the rectangle ([x], [y], [width], [height]) matching [test].
  int count(
    double x,
    double y,
    double width,
    double height,
    bool Function(Color) test,
  ) {
    var found = 0;
    for (var row = y.floor(); row < (y + height).floor(); row++) {
      for (var column = x.floor(); column < (x + width).floor(); column++) {
        if (test(at(column.toDouble(), row.toDouble()))) found++;
      }
    }
    return found;
  }
}

Future<_Painted> _paint(
  WidgetTester tester,
  String source, {
  double width = 520,
  Brightness brightness = Brightness.light,
}) async {
  // A 4× surface and a 4× device: the document's layout stays in logical
  // pixels while the decoded image is rasterized for the real display density.
  tester.view
    ..devicePixelRatio = 4
    ..physicalSize = const Size(2080, 1200);
  addTearDown(tester.view.reset);
  final paintKey = ValueKey(
    'document-paint-${DateTime.now().microsecondsSinceEpoch}',
  );
  const address = 'http://fixtures.invalid';
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: gitPulseTheme(brightness),
        themeAnimationDuration: Duration.zero,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: RepaintBoundary(
            key: paintKey,
            child: SingleChildScrollView(
              child: SizedBox(
                width: width,
                child: ReleaseDocument(
                  source: source.replaceAll('FIXTURE', address),
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
    ),
  );
  for (var attempt = 0; attempt < 150; attempt++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 20)),
    );
    await tester.pump();
  }
  final raw = tester
      .widgetList<RawImage>(find.byType(RawImage))
      .map((i) => '${i.image?.width}x${i.image?.height}')
      .toList();
  final box = tester.getRect(find.byType(ReleaseDocument));
  final rows = <String>[];
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(paintKey),
  );
  final document = tester.renderObject<RenderBox>(find.byType(ReleaseDocument));
  final image = (await tester.runAsync(() => boundary.toImage(pixelRatio: 4)))!;
  try {
    final data = (await tester.runAsync(
      () => image.toByteData(format: ui.ImageByteFormat.rawRgba),
    ))!;
    final origin =
        document.localToGlobal(Offset.zero) -
        boundary.localToGlobal(Offset.zero);
    final painted = _Painted(
      data.buffer.asUint8List(),
      image.width,
      image.height,
      Rect.fromLTWH(
        origin.dx * 4,
        origin.dy * 4,
        document.size.width * 4,
        document.size.height * 4,
      ),
    );
    for (var y = 0; y < 200; y += 8) {
      var row = '';
      for (var x = 0; x < 480; x += 4) {
        final c = painted.at(x.toDouble(), y.toDouble());
        row += c.a == 0
            ? '.'
            : (c.r > 0.7 && c.g > 0.7
                  ? 'W'
                  : (c.g > 0.4 ? 'g' : (c.r > 0.4 ? 'r' : 'k')));
      }
      rows.add(row);
    }
    // ignore: avoid_print
    print('GRID raw=$raw box=$box ${rows.take(12).join('|')}');
    return painted;
  } finally {
    image.dispose();
  }
}

/// A 1× render of the fixture's intrinsic size (119×20) plus the logo area.
const _badgeLabel = Rect.fromLTWH(8, 6, 52, 8);
const _badgeLogo = Rect.fromLTWH(5, 3, 14, 14);

bool _isWhite(Color color) =>
    color.a > 0 && color.r > 0.78 && color.g > 0.78 && color.b > 0.78;

void main() {
  testWidgets('the complete badge paints its text and its embedded logo', (
    tester,
  ) async {
    _serveFixtures();
    final painted = await _paint(
      tester,
      '![Release v0.5.10](FIXTURE/shield.svg)',
    );
    // The label sits in the dark segment; the version in the green one.
    expect(
      painted.count(
        _badgeLabel.left * 4,
        _badgeLabel.top * 4,
        _badgeLabel.width * 4,
        _badgeLabel.height * 4,
        _isWhite,
      ),
      greaterThan(40),
      reason: 'the badge label is legible text, not cropped glyphs',
    );
    // The badge is drawn at its own 119×20 size: no white pixel leaks past its
    // bottom edge, which is what the old backend painted.
    expect(
      painted.count(-6, 20 * 4, 140 * 4, 6 * 4, _isWhite),
      0,
      reason: 'nothing is painted below the badge',
    );
    // The embedded GitHub logo is a light mark on the dark segment.
    expect(
      painted.count(
        _badgeLogo.left * 4,
        _badgeLogo.top * 4,
        _badgeLogo.width * 4,
        _badgeLogo.height * 4,
        _isWhite,
      ),
      greaterThan(30),
      reason: 'the embedded logo is drawn inside the badge',
    );
  });

  testWidgets('an extensionless badge URL renders as SVG', (tester) async {
    _serveFixtures();
    final painted = await _paint(tester, '![Release v0.5.10](FIXTURE/shield)');
    expect(
      painted.count(
        _badgeLabel.left * 4,
        _badgeLabel.top * 4,
        _badgeLabel.width * 4,
        _badgeLabel.height * 4,
        _isWhite,
      ),
      greaterThan(40),
    );
  });

  testWidgets('scaled text keeps the area of an unscaled equivalent', (
    tester,
  ) async {
    _serveFixtures();
    final transformed = await _paint(
      tester,
      '![Transformed](FIXTURE/text-transform.svg)',
    );
    final unscaled = await _paint(
      tester,
      '![Unscaled](FIXTURE/text-unscaled.svg)',
    );
    int white(_Painted painted) =>
        painted.count(0, 0, 119 * 4, 20 * 4, _isWhite);
    final scaled = white(transformed);
    final control = white(unscaled);
    expect(scaled, greaterThan(40));
    expect(
      scaled / control,
      inInclusiveRange(0.5, 2.0),
      reason: 'text scaled by 0.1 must not fill the badge viewport',
    );
  });

  testWidgets('currentColor follows the theme and explicit colours survive', (
    tester,
  ) async {
    _serveFixtures();
    for (final brightness in [Brightness.light, Brightness.dark]) {
      final painted = await _paint(
        tester,
        '![Logo](FIXTURE/logo.svg)',
        brightness: brightness,
      );
      final theme = gitPulseTheme(brightness);
      final themed = painted.at(4, 32);
      expect(
        themed,
        theme.colorScheme.onSurface,
        reason: 'the currentColor half takes the $brightness theme colour',
      );
      expect(
        painted.at(60, 32),
        const Color(0xff00ff00),
        reason: 'the explicit green half keeps its own colour',
      );
    }
  });
}
