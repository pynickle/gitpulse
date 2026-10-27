import 'dart:io';
import 'dart:typed_data' show BytesBuilder;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';

import 'document_svg_render_service.dart';

/// Decodes a document image for the HTML renderer.
///
/// The bytes are fetched once with a plain `HttpClient` — document images are
/// anonymous, so no session cookie, CSRF header or bearer token is attached.
/// SVG payloads, including extensionless badges and dynamic endpoints, go
/// through the Rust renderer sized for the display density; every other payload
/// is decoded as a raster, which keeps the ordinary bitmap path unchanged.
@immutable
class DocumentImageProvider extends ImageProvider<DocumentImageProvider> {
  const DocumentImageProvider({
    required this.url,
    required this.service,
    this.width,
    this.height,
    this.currentColor = '#000000',
    this.revision = 0,
    this.media = 1,
  });

  final String url;
  final DocumentSvgRenderService service;

  /// The display size in logical pixels the document asked for, if any. A
  /// badge without one keeps its intrinsic size.
  final double? width;
  final double? height;

  /// The theme's `onSurface` colour, applied to `currentColor` only.
  final String currentColor;

  /// Changes whenever the theme does, so a decoded image is not reused across
  /// themes.
  final int revision;

  /// Device pixels per logical pixel at resolution time.
  final double media;

  DocumentImageProvider _for(ImageConfiguration configuration) =>
      DocumentImageProvider(
        url: url,
        service: service,
        width: width,
        height: height,
        currentColor: currentColor,
        revision: revision,
        media:
            configuration.devicePixelRatio ??
            ui.PlatformDispatcher.instance.implicitView?.devicePixelRatio ??
            1,
      );

  @override
  Future<DocumentImageProvider> obtainKey(ImageConfiguration configuration) =>
      SynchronousFuture(_for(configuration));

  @override
  ImageStreamCompleter loadImage(
    DocumentImageProvider key,
    ImageDecoderCallback decode,
  ) => MultiFrameImageStreamCompleter(
    codec: _load(key, decode),
    scale: key.media,
    debugLabel: key.url,
  );

  Future<ui.Codec> _load(
    DocumentImageProvider key,
    ImageDecoderCallback decode,
  ) async {
    final bytes = await fetchDocumentBytes(key.url);
    if (bytes == null) {
      throw StateError('document image unavailable: ${key.url}');
    }
    return decode(await _bufferFor(key, bytes));
  }

  /// The bytes to hand the decoder: the original raster, or a rasterized SVG.
  Future<ui.ImmutableBuffer> _bufferFor(
    DocumentImageProvider key,
    Uint8List bytes,
  ) async {
    if (!DocumentSvgRenderService.looksLikeSvg(bytes)) {
      return ui.ImmutableBuffer.fromUint8List(bytes);
    }
    // A display size from the document is the box; without one the document's
    // own size wins, so a 119×20 badge is drawn at 119×20 in device pixels and
    // never stretched across the column.
    final rendered = await key.service.render(
      bytes,
      maxWidth: key.width == null ? 0 : key.width! * key.media,
      maxHeight: key.height == null ? 0 : key.height! * key.media,
      currentColor: key.currentColor,
    );
    if (rendered == null) {
      throw StateError('document image could not be rendered: ${key.url}');
    }
    return ui.ImmutableBuffer.fromUint8List(rendered.png);
  }

  @override
  bool operator ==(Object other) =>
      other is DocumentImageProvider &&
      other.url == url &&
      other.width == width &&
      other.height == height &&
      other.currentColor == currentColor &&
      other.revision == revision &&
      other.media == media &&
      identical(other.service, service);

  @override
  int get hashCode => Object.hash(
    url,
    width,
    height,
    currentColor,
    revision,
    media,
    identityHashCode(service),
  );

  @override
  String toString() => 'DocumentImageProvider($url)';
}

/// How a document image's bytes are obtained.
typedef DocumentImageBytesFetcher = Future<Uint8List?> Function(String url);

/// The largest image body a document may hand the decoder.
const documentImageByteLimit = 8 * 1024 * 1024;

/// Replaces the document image transport in tests, exactly as
/// `debugNetworkImageHttpClientProvider` does for `Image.network`.
@visibleForTesting
DocumentImageBytesFetcher? debugDocumentImageFetcher;

/// Fetches an image body without any of the app's authenticated plumbing.
Future<Uint8List?> fetchDocumentBytes(String url) async {
  final override = debugDocumentImageFetcher;
  if (override != null) return override(url);
  final uri = Uri.tryParse(url);
  if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
    return null;
  }
  final client = HttpClient()..connectionTimeout = const Duration(seconds: 20);
  try {
    final request = await client.getUrl(uri);
    final response = await request.close();
    if (response.statusCode < 200 || response.statusCode >= 300) {
      await response.drain<void>();
      return null;
    }
    final builder = BytesBuilder(copy: false);
    await for (final chunk in response) {
      builder.add(chunk);
      if (builder.length > documentImageByteLimit) {
        await response.drain<void>();
        return null;
      }
    }
    return builder.takeBytes();
  } catch (_) {
    return null;
  } finally {
    client.close(force: true);
  }
}
