import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/releases/document_fonts.dart';
import 'package:gitpulse/src/document_svg_ffi.dart';

void main() {
  test('the native renderer loads and paints a document', () {
    final fonts = discoverDocumentFonts()
        .map((font) => File(font.path).readAsBytesSync())
        .toList();
    expect(fonts, isNotEmpty, reason: 'the host must expose at least one font');
    final renderer = DocumentSvgRenderer(fonts);
    addTearDown(renderer.close);
    final svg = Uint8List.fromList(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20">'
      '<rect width="40" height="20" fill="currentColor"/></svg>'
          .codeUnits,
    );
    final image = renderer.render(
      svg,
      maxWidth: 80,
      maxHeight: 40,
      currentColor: '#ff0000',
    );
    expect((image.width, image.height), (80, 40));
    expect(image.rgba.sublist(0, 4), [255, 0, 0, 255]);
  });
}
