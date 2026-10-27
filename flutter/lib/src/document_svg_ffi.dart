import 'dart:ffi';
import 'dart:typed_data';

import 'package:ffi/ffi.dart';

/// Bindings to the document SVG renderer in `native/document_svg`.
///
/// The library is built and bundled by the Dart build hook (`hook/build.dart`)
/// under this file's asset id, so there is no `DynamicLibrary.open` path and no
/// per-platform asset bookkeeping here. See ADR 0027 for the boundary.

@Native<Pointer<Void> Function()>(symbol: 'gt_document_svg_renderer_new')
external Pointer<Void> _rendererNew();

@Native<Void Function(Pointer<Void>)>(symbol: 'gt_document_svg_renderer_free')
external void _rendererFree(Pointer<Void> renderer);

@Native<Int32 Function(Pointer<Void>, Pointer<Uint8>, UintPtr)>(
  symbol: 'gt_document_svg_renderer_add_font',
)
external int _addFont(Pointer<Void> renderer, Pointer<Uint8> data, int length);

@Native<
  Int32 Function(
    Pointer<Void>,
    Pointer<Uint8>,
    UintPtr,
    Float,
    Float,
    Pointer<SvgSize>,
  )
>(symbol: 'gt_document_svg_measure')
external int _measure(
  Pointer<Void> renderer,
  Pointer<Uint8> svg,
  int length,
  double maxWidth,
  double maxHeight,
  Pointer<SvgSize> out,
);

@Native<
  Int32 Function(
    Pointer<Void>,
    Pointer<Uint8>,
    UintPtr,
    Float,
    Float,
    Pointer<Utf8>,
    Pointer<RenderedImage>,
  )
>(symbol: 'gt_document_svg_render')
external int _render(
  Pointer<Void> renderer,
  Pointer<Uint8> svg,
  int length,
  double maxWidth,
  double maxHeight,
  Pointer<Utf8> currentColor,
  Pointer<RenderedImage> out,
);

@Native<Void Function(RenderedImage)>(symbol: 'gt_document_svg_pixels_free')
external void _freePixels(RenderedImage image);

/// The intrinsic size of a document and the size it should occupy in a box.
final class SvgSize extends Struct {
  @Float()
  external double width;

  @Float()
  external double height;

  @Float()
  external double fittedWidth;

  @Float()
  external double fittedHeight;
}

/// The result of [DocumentSvgRenderer.render]. Premultiplied RGBA,
/// `width * height * 4` bytes, released by the renderer itself.
final class RenderedImage extends Struct {
  @Uint32()
  external int width;

  @Uint32()
  external int height;

  external Pointer<Uint8> pixels;
}

/// Status codes; keep in step with `Status` in `native/document_svg/src/lib.rs`.
enum DocumentSvgStatus {
  ok,
  invalidArgument,
  parseFailed,
  renderFailed,
  tooLarge;

  static DocumentSvgStatus fromCode(int code) =>
      code >= 0 && code < values.length ? values[code] : renderFailed;
}

/// A local, user-facing rendering failure.
class DocumentSvgException implements Exception {
  const DocumentSvgException(this.status);

  final DocumentSvgStatus status;

  @override
  String toString() => 'DocumentSvgException(${status.name})';
}

/// A raster produced by the renderer.
class DocumentSvgImage {
  const DocumentSvgImage({
    required this.width,
    required this.height,
    required this.rgba,
  });

  final int width;
  final int height;

  /// Premultiplied RGBA, `width * height * 4` bytes.
  final Uint8List rgba;
}

/// A measured document size, copied out of the native struct.
class DocumentSvgSize {
  const DocumentSvgSize({
    required this.width,
    required this.height,
    required this.fittedWidth,
    required this.fittedHeight,
  });

  /// The document's own coordinate size.
  final double width;
  final double height;

  /// The size to display at after fitting the requested box.
  final double fittedWidth;
  final double fittedHeight;
}

/// A rendering core that owns its font set.
///
/// One instance lives in the rendering isolate and serves every document image;
/// creating it is the only place fonts enter the native side.
class DocumentSvgRenderer {
  DocumentSvgRenderer(Iterable<Uint8List> fonts) : _handle = _rendererNew() {
    for (final font in fonts) {
      final data = _copy(font);
      try {
        if (DocumentSvgStatus.fromCode(_addFont(_handle, data, font.length)) !=
            DocumentSvgStatus.ok) {
          // A host font the parser rejects is skipped: the remaining faces
          // still serve the document.
          continue;
        }
      } finally {
        malloc.free(data);
      }
    }
  }

  final Pointer<Void> _handle;
  bool _closed = false;

  /// Measures [svg] against a box of [maxWidth] × [maxHeight] device pixels.
  /// A zero maximum leaves that axis unconstrained. Returns null when the
  /// document cannot be parsed.
  DocumentSvgSize? measure(
    Uint8List svg, {
    required double maxWidth,
    required double maxHeight,
  }) {
    final data = _copy(svg);
    final out = calloc<SvgSize>();
    try {
      final status = DocumentSvgStatus.fromCode(
        _measure(_handle, data, svg.length, maxWidth, maxHeight, out),
      );
      if (status != DocumentSvgStatus.ok) return null;
      return DocumentSvgSize(
        width: out.ref.width,
        height: out.ref.height,
        fittedWidth: out.ref.fittedWidth,
        fittedHeight: out.ref.fittedHeight,
      );
    } finally {
      calloc.free(out);
      malloc.free(data);
    }
  }

  /// Rasterizes [svg] into at most [maxWidth] × [maxHeight] device pixels,
  /// painting `currentColor` with [currentColor] (a CSS colour such as
  /// `#101114`).
  DocumentSvgImage render(
    Uint8List svg, {
    required double maxWidth,
    required double maxHeight,
    required String currentColor,
  }) {
    final data = _copy(svg);
    final color = currentColor.toNativeUtf8();
    final out = calloc<RenderedImage>();
    try {
      final status = DocumentSvgStatus.fromCode(
        _render(_handle, data, svg.length, maxWidth, maxHeight, color, out),
      );
      if (status != DocumentSvgStatus.ok) throw DocumentSvgException(status);
      final image = out.ref;
      try {
        final bytes = Uint8List(image.width * image.height * 4);
        bytes.setAll(0, image.pixels.asTypedList(bytes.length));
        return DocumentSvgImage(
          width: image.width,
          height: image.height,
          rgba: bytes,
        );
      } finally {
        _freePixels(image);
      }
    } finally {
      calloc.free(out);
      malloc.free(color);
      malloc.free(data);
    }
  }

  /// Releases the native renderer. Every later call would be a use after free.
  void close() {
    if (_closed) return;
    _closed = true;
    _rendererFree(_handle);
  }

  static Pointer<Uint8> _copy(Uint8List bytes) {
    final pointer = malloc<Uint8>(bytes.length);
    pointer.asTypedList(bytes.length).setAll(0, bytes);
    return pointer;
  }
}
