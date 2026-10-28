import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:path/path.dart' as p;
import 'package:xml/xml.dart';
import 'package:yaml/yaml.dart';

const androidRes = 'android/app/src/main/res';
const androidNamespace = 'http://schemas.android.com/apk/res/android';

XmlDocument xml(String path) =>
    XmlDocument.parse(File(path).readAsStringSync());

List<Map<String, dynamic>> catalog(String platform) {
  final data = jsonDecode(
    File(p.join(iconDirectory(platform), 'Contents.json')).readAsStringSync(),
  ) as Map<String, dynamic>;
  return (data['images'] as List<dynamic>).cast<Map<String, dynamic>>();
}

String iconDirectory(String platform) =>
    p.join(platform, 'Runner', 'Assets.xcassets', 'AppIcon.appiconset');

img.Image png(String path, int size) {
  final image = img.decodePng(File(path).readAsBytesSync())!;
  expect((image.width, image.height), (size, size), reason: path);
  return image;
}

void main() {
  test('transparent mark preserves the web brand when composited on white', () {
    final original = png('../public/icon.png', 1024);
    final mark = png('tool/icons/generated/mark.png', 1024);
    final square = png('tool/icons/generated/square.png', 1024);
    expect(mark.getPixel(0, 0).a, 0);
    var maxError = 0;
    for (final pixel in mark) {
      final baseline = original.getPixel(pixel.x, pixel.y);
      final alpha = pixel.a / 255;
      for (var channel = 0; channel < 3; channel++) {
        final composite = (pixel[channel] * alpha + 255 * (1 - alpha)).round();
        maxError = math.max(
          maxError,
          (composite - baseline[channel]).abs().round(),
        );
        maxError = math.max(
          maxError,
          (square.getPixel(pixel.x, pixel.y)[channel] - baseline[channel])
              .abs()
              .round(),
        );
      }
    }
    expect(maxError, lessThanOrEqualTo(2));
  });

  test(
    'Android resolves legacy, adaptive and themed icons at every density',
    () {
      final application = xml('android/app/src/main/AndroidManifest.xml')
          .findAllElements('application')
          .single;
      expect(
        application.getAttribute('icon', namespaceUri: androidNamespace),
        '@mipmap/ic_launcher',
      );
      final adaptive = xml(
        p.join(androidRes, 'mipmap-anydpi-v26', 'ic_launcher.xml'),
      );
      expect(adaptive.rootElement.name.local, 'adaptive-icon');
      expect(
        adaptive
            .findAllElements('background')
            .single
            .getAttribute('drawable', namespaceUri: androidNamespace),
        '@color/ic_launcher_background',
      );
      final background = xml(p.join(androidRes, 'values', 'colors.xml'))
          .findAllElements('color')
          .singleWhere(
            (e) => e.getAttribute('name') == 'ic_launcher_background',
          );
      expect(background.innerText.toLowerCase(), '#ffffff');

      for (final layer in ['foreground', 'monochrome']) {
        final inset = adaptive
            .findAllElements(layer)
            .single
            .findElements('inset')
            .single;
        expect(
          inset.getAttribute('drawable', namespaceUri: androidNamespace),
          '@drawable/ic_launcher_$layer',
        );
        final percent = double.parse(
          inset
              .getAttribute('inset', namespaceUri: androidNamespace)!
              .replaceAll('%', ''),
        );
        expect(percent, inExclusiveRange(0, 16));
        final scale = 1 - 2 * percent / 100;
        for (final (density, size) in [
          ('mdpi', 108),
          ('hdpi', 162),
          ('xhdpi', 216),
          ('xxhdpi', 324),
          ('xxxhdpi', 432),
        ]) {
          final image = png(
            p.join(androidRes, 'drawable-$density', 'ic_launcher_$layer.png'),
            size,
          );
          expect(image.getPixel(0, 0).a, 0);
          var visiblePixels = 0;
          for (final pixel in image) {
            if (pixel.a < 32) continue;
            visiblePixels++;
            // Android guarantees a central 66dp circle on a 108dp layer.
            final dx = (pixel.x + .5 - size / 2) * scale / size;
            final dy = (pixel.y + .5 - size / 2) * scale / size;
            expect(dx * dx + dy * dy, lessThanOrEqualTo(math.pow(33 / 108, 2)));
            if (layer == 'monochrome') {
              expect((pixel.r, pixel.g, pixel.b), (0, 0, 0));
            }
          }
          expect(visiblePixels, greaterThan(size * size * .03));
        }
      }
      for (final (density, size) in [
        ('mdpi', 48),
        ('hdpi', 72),
        ('xhdpi', 96),
        ('xxhdpi', 144),
        ('xxxhdpi', 192),
      ]) {
        final image = png(
          p.join(androidRes, 'mipmap-$density', 'ic_launcher.png'),
          size,
        );
        expect(image.getPixel(0, 0).r, 255);
        // Centre of the left end dot, safely away from its antialiased edge.
        expect(
          image.getPixel(size ~/ 4, (size * .477).floor()).r,
          lessThan(100),
        );
      }
    },
  );

  test(
    'iOS catalog supplies light, transparent dark and contrasting tinted sets',
    () {
      final entries = catalog('ios');
      const sizes = {
        40,
        58,
        60,
        76,
        80,
        87,
        114,
        120,
        128,
        136,
        152,
        167,
        180,
        192,
        1024,
      };
      final variants = <String, Set<int>>{};
      for (final entry in entries) {
        final appearances = entry['appearances'] as List<dynamic>?;
        final appearance = appearances == null
            ? 'light'
            : (appearances.single as Map<String, dynamic>)['value'] as String;
        final size =
            (double.parse((entry['size'] as String).split('x').first) *
                    double.parse(
                      (entry['scale'] as String).replaceAll('x', ''),
                    ))
                .round();
        variants.putIfAbsent(appearance, () => {}).add(size);
        final image = png(
          p.join(iconDirectory('ios'), entry['filename'] as String),
          size,
        );
        if (appearance == 'light') {
          expect(image.hasAlpha, isFalse, reason: '${entry['filename']}');
        } else if (appearance == 'dark') {
          expect(image.getPixel(0, 0).a, 0);
          final dot = image.getPixel(size ~/ 4, (size * .477).floor());
          expect(dot.a, greaterThan(220));
          expect(dot.r, greaterThan(200));
        } else {
          expect(appearance, 'tinted');
          var darkest = 255;
          for (final pixel in image) {
            expect(pixel.r, pixel.g);
            expect(pixel.g, pixel.b);
            darkest = math.min(darkest, pixel.r.toInt());
          }
          expect(darkest, lessThan(100));
          expect(image.getPixel(0, 0).r, 255);
        }
      }
      expect(variants.keys.toSet(), {'light', 'dark', 'tinted'});
      for (final variant in variants.values) {
        expect(variant, sizes);
      }
      final marketing = entries.singleWhere(
        (e) => e['idiom'] == 'ios-marketing',
      );
      expect(marketing['size'], '1024x1024');
      expect(marketing['appearances'], isNull);
    },
  );

  test('oversized icon sources are excluded from Flutter runtime assets', () {
    final pubspec =
        loadYaml(File('pubspec.yaml').readAsStringSync()) as YamlMap;
    final flutter = pubspec['flutter'] as YamlMap;
    final assets = flutter['assets'] as YamlList?;
    final sources = Directory('tool/icons')
        .listSync(recursive: true)
        .whereType<File>()
        .map((f) => p.normalize(f.absolute.path))
        .toList();
    expect(sources, isNotEmpty);
    for (final asset in assets ?? <dynamic>[]) {
      final path = p.absolute(
        asset is String ? asset : (asset as YamlMap)['path'] as String,
      );
      for (final source in sources) {
        expect(
          p.equals(path, source) || p.isWithin(path, source),
          isFalse,
          reason: '$asset would bundle icon generation sources',
        );
      }
    }
  });
}
