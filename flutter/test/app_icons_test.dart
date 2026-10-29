import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

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
}
