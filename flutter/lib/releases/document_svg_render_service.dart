import 'dart:async';
import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../src/document_svg_ffi.dart';
import 'document_fonts.dart';

/// Rasterizes document SVG images through the Rust renderer.
///
/// `dart:ffi` calls are synchronous, so rendering happens in one long-lived
/// worker isolate that owns the native renderer and its fonts; the UI isolate
/// only decodes the returned PNG (`ui.instantiateImageCodec`), which is where
/// Flutter's own image pipeline belongs. A renderer survives the isolate, so
/// the fonts are read and loaded once instead of once per image.
class DocumentSvgRenderService {
  DocumentSvgRenderService({
    Future<Uint8List> Function(String path)? readFont,
    int cacheEntries = 48,
  }) : _readFont = readFont ?? _readFile,
       _cache = _LruCache(cacheEntries);

  final Future<Uint8List> Function(String path) _readFont;
  final _LruCache _cache;
  _RenderWorker? _worker;
  Future<_RenderWorker?>? _starting;
  bool _isolateUnavailable = false;

  static Future<Uint8List> _readFile(String path) => File(path).readAsBytes();

  /// Whether [svg] looks like an SVG document, judged from bytes rather than
  /// URL or content type: badges are served from extensionless paths and from
  /// error pages, so the payload is the only reliable signal.
  static bool looksLikeSvg(Uint8List bytes) {
    // Skip a UTF-8 BOM and leading XML prolog, comment or doctype, then look
    // for the root element's name within a small window.
    final head = bytes.length > 1024 ? bytes.sublist(0, 1024) : bytes;
    final text = String.fromCharCodes(head.where((byte) => byte < 128));
    final lower = text.toLowerCase();
    final start = lower.indexOf('<svg');
    if (start >= 0) return true;
    return lower.contains('<svg');
  }

  /// Rasterizes [svg] to fit [maxWidth] × [maxHeight] device pixels.
  ///
  /// Returns null when the document cannot be rendered, so the caller can keep
  /// its local alt-text fallback. Repeated requests for the same bytes, box and
  /// colour are served from memory without touching the renderer again.
  Future<RenderedSvg?> render(
    Uint8List svg, {
    required double maxWidth,
    required double maxHeight,
    required String currentColor,
  }) async {
    final key = _CacheKey(
      bytes: Object.hashAll([svg.length, ...svg.take(256)]),
      width: maxWidth.isFinite ? maxWidth.round() : 0,
      height: maxHeight.isFinite ? maxHeight.round() : 0,
      color: currentColor,
    );
    final cached = _cache.get(key);
    if (cached != null) return cached;
    final worker = await _start();
    if (worker == null) return null;
    final result = await worker.render(
      svg,
      maxWidth: maxWidth,
      maxHeight: maxHeight,
      currentColor: currentColor,
    );
    if (result != null) _cache.put(key, result);
    return result;
  }

  /// Measures [svg] against a box of [maxWidth] × [maxHeight] device pixels.
  /// A non-finite maximum leaves that axis unconstrained.
  Future<RenderedSvgSize?> measure(
    Uint8List svg, {
    required double maxWidth,
    required double maxHeight,
  }) async {
    final worker = await _start();
    if (worker == null) return null;
    return worker.measure(svg, maxWidth: maxWidth, maxHeight: maxHeight);
  }

  Future<_RenderWorker?> _start() async {
    if (_isolateUnavailable) return null;
    final existing = _worker;
    if (existing != null) return existing;
    return _starting ??= () async {
      try {
        final fonts = await _fontBytes();
        final worker = _RenderWorker();
        await worker.start(fonts);
        _worker = worker;
        return worker;
      } catch (_) {
        // A host without the native asset (or without any font at all) keeps
        // the document readable: images fall back to their alt text.
        _isolateUnavailable = true;
        _starting = null;
        return null;
      }
    }();
  }

  Future<List<Uint8List>> _fontBytes() async {
    final fonts = await Isolate.run(discoverDocumentFonts);
    final loaded = <Uint8List>[];
    for (final font in fonts) {
      try {
        loaded.add(await _readFont(font.path));
      } catch (_) {
        // An unreadable face is skipped; the others still serve the document.
      }
    }
    return loaded;
  }

  Future<void> dispose() async {
    final worker = _worker;
    _worker = null;
    _starting = null;
    await worker?.dispose();
  }
}

/// A measured document size, in device pixels.
class RenderedSvgSize {
  const RenderedSvgSize({
    required this.width,
    required this.height,
    required this.fittedWidth,
    required this.fittedHeight,
  });

  /// The document's own coordinate size.
  final double width;
  final double height;

  /// The size it should be drawn at inside the requested box.
  final double fittedWidth;
  final double fittedHeight;
}

/// A rasterized SVG, ready to decode.
class RenderedSvg {
  const RenderedSvg({
    required this.width,
    required this.height,
    required this.png,
  });

  final int width;
  final int height;

  /// A PNG whose pixel size is [width] × [height].
  final Uint8List png;

  @override
  bool operator ==(Object other) =>
      other is RenderedSvg &&
      other.width == width &&
      other.height == height &&
      other.png == png;

  @override
  int get hashCode => Object.hash(width, height, identityHashCode(png));
}

/// The app-wide render service. Tests override it with a counting fake.
final documentSvgRenderServiceProvider = Provider<DocumentSvgRenderService>((
  ref,
) {
  final service = DocumentSvgRenderService();
  ref.onDispose(service.dispose);
  return service;
});

final class _CacheKey {
  const _CacheKey({
    required this.bytes,
    required this.width,
    required this.height,
    required this.color,
  });

  final int bytes;
  final int width;
  final int height;
  final String color;

  @override
  bool operator ==(Object other) =>
      other is _CacheKey &&
      other.bytes == bytes &&
      other.width == width &&
      other.height == height &&
      other.color == color;

  @override
  int get hashCode => Object.hash(bytes, width, height, color);
}

/// A small insertion-ordered cache: enough to survive ordinary rebuilds and a
/// theme change back and forth, without becoming an offline image store.
final class _LruCache {
  _LruCache(this._capacity);

  final int _capacity;
  final _entries = <_CacheKey, RenderedSvg>{};

  RenderedSvg? get(_CacheKey key) {
    final value = _entries.remove(key);
    if (value != null) _entries[key] = value;
    return value;
  }

  void put(_CacheKey key, RenderedSvg value) {
    _entries.remove(key);
    _entries[key] = value;
    while (_entries.length > _capacity) {
      _entries.remove(_entries.keys.first);
    }
  }
}

/// One isolate that owns the native renderer for its whole life.
class _RenderWorker {
  SendPort? _send;
  final _responses = <int, Completer<_WorkerResponse>>{};
  int _nextId = 1;
  ReceivePort? _receive;
  Completer<void>? _ready;

  Future<void> start(List<Uint8List> fonts) async {
    _receive = ReceivePort();
    _ready = Completer<void>();
    await Isolate.spawn(_renderMain, (
      _receive!.sendPort,
      fonts,
    ), debugName: 'document-svg-renderer');
    _receive!.listen(_onMessage);
    // The worker reports readiness before serving; a spawn failure surfaces as
    // a timeout rather than a hang.
    await _ready!.future.timeout(const Duration(seconds: 20));
  }

  void _onMessage(Object? message) {
    if (message is SendPort) {
      _send = message;
      _ready?.complete();
      return;
    }
    if (message is! _WorkerResponse) return;
    _responses.remove(message.id)?.complete(message);
  }

  Future<RenderedSvgSize?> measure(
    Uint8List svg, {
    required double maxWidth,
    required double maxHeight,
  }) async {
    final send = _send;
    if (send == null) return null;
    final id = _nextId++;
    final completer = Completer<_WorkerResponse>();
    _responses[id] = completer;
    send.send(
      _MeasureRequest(
        id,
        TransferableTypedData.fromList([svg]),
        maxWidth,
        maxHeight,
      ),
    );
    return (await completer.future).size;
  }

  Future<RenderedSvg?> render(
    Uint8List svg, {
    required double maxWidth,
    required double maxHeight,
    required String currentColor,
  }) async {
    final send = _send;
    if (send == null) return null;
    final id = _nextId++;
    final completer = Completer<_WorkerResponse>();
    _responses[id] = completer;
    send.send((
      id,
      TransferableTypedData.fromList([svg]),
      maxWidth,
      maxHeight,
      currentColor,
    ));
    final response = await completer.future;
    return response.image;
  }

  Future<void> dispose() async {
    _send?.send(_shutdown);
    _receive?.close();
    _responses.clear();
  }
}

const _shutdown = 'shutdown';

class _WorkerResponse {
  _WorkerResponse(this.id, this.image, {this.size});

  final int id;
  final RenderedSvg? image;
  final RenderedSvgSize? size;
}

class _MeasureRequest {
  _MeasureRequest(this.id, this.svg, this.maxWidth, this.maxHeight);

  final int id;
  final TransferableTypedData svg;
  final double maxWidth;
  final double maxHeight;
}

void _renderMain((SendPort, List<Uint8List>) arguments) {
  final (reply, fonts) = arguments;
  final receive = ReceivePort();
  reply.send(receive.sendPort);
  DocumentSvgRenderer? renderer;
  try {
    renderer = DocumentSvgRenderer(fonts);
  } catch (_) {
    renderer = null;
  }
  receive.listen((message) {
    if (message is _MeasureRequest) {
      final svg = message.svg.materialize().asUint8List();
      final size = renderer?.measure(
        svg,
        maxWidth: message.maxWidth,
        maxHeight: message.maxHeight,
      );
      reply.send(
        _WorkerResponse(
          message.id,
          null,
          size: size == null
              ? null
              : RenderedSvgSize(
                  width: size.width,
                  height: size.height,
                  fittedWidth: size.fittedWidth,
                  fittedHeight: size.fittedHeight,
                ),
        ),
      );
      return;
    }
    if (message == _shutdown) {
      renderer?.close();
      receive.close();
      return;
    }
    if (message is! (int, TransferableTypedData, double, double, String)) {
      return;
    }
    final (id, svgData, maxWidth, maxHeight, color) = message;
    try {
      final svg = svgData.materialize().asUint8List();
      final image = renderer?.render(
        svg,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        currentColor: color,
      );
      reply.send(
        _WorkerResponse(
          id,
          image == null
              ? null
              : RenderedSvg(
                  width: image.width,
                  height: image.height,
                  png: encodeRgbaPng(image),
                ),
        ),
      );
    } catch (_) {
      reply.send(_WorkerResponse(id, null));
    }
  });
}

/// Encodes premultiplied RGBA to an 8-bit RGBA PNG.
///
/// PNG's colour model is straight (un-premultiplied) RGBA, so alpha is undone
/// while writing. A tiny encoder is enough for an already-decoded raster and
/// keeps the renderer independent of an image package.
Uint8List encodeRgbaPng(DocumentSvgImage image) {
  final width = image.width;
  final height = image.height;
  final rgba = image.rgba;
  final raw = Uint8List(height * (width * 4 + 1));
  var source = 0;
  var target = 0;
  for (var row = 0; row < height; row++) {
    raw[target++] = 0; // Filter: none.
    for (var column = 0; column < width; column++) {
      final alpha = rgba[source + 3];
      if (alpha == 0 || alpha == 255) {
        raw[target++] = rgba[source];
        raw[target++] = rgba[source + 1];
        raw[target++] = rgba[source + 2];
      } else {
        raw[target++] = (rgba[source] * 255 ~/ alpha).clamp(0, 255);
        raw[target++] = (rgba[source + 1] * 255 ~/ alpha).clamp(0, 255);
        raw[target++] = (rgba[source + 2] * 255 ~/ alpha).clamp(0, 255);
      }
      raw[target++] = alpha;
      source += 4;
    }
  }

  final header = BytesBuilder(copy: false)
    ..add(const [137, 80, 78, 71, 13, 10, 26, 10]);

  void chunk(String type, List<int> data) {
    final length = ByteData(4)..setUint32(0, data.length);
    final typeAndData = Uint8List(4 + data.length)
      ..setAll(0, type.codeUnits)
      ..setAll(4, data);
    final crc = ByteData(4)..setUint32(0, _crc32(typeAndData));
    header
      ..add(length.buffer.asUint8List())
      ..add(typeAndData)
      ..add(crc.buffer.asUint8List());
  }

  final ihdr = ByteData(13)
    ..setUint32(0, width)
    ..setUint32(4, height)
    ..setUint8(8, 8) // bit depth
    ..setUint8(9, 6) // colour type: truecolour with alpha
    ..setUint8(10, 0) // compression
    ..setUint8(11, 0) // filter
    ..setUint8(12, 0); // interlace
  chunk('IHDR', ihdr.buffer.asUint8List());
  chunk('IDAT', _zlibStored(raw));
  chunk('IEND', const []);
  return header.takeBytes();
}

/// zlib with stored (uncompressed) deflate blocks. Valid PNG data, and cheap:
/// the raster is sent to the UI isolate for decoding, not stored.
Uint8List _zlibStored(Uint8List data) {
  final blocks = <int>[0x78, 0x01];
  var offset = 0;
  const maxBlock = 65535;
  do {
    final length = (data.length - offset).clamp(0, maxBlock);
    final finalBlock = offset + length >= data.length;
    blocks
      ..add(finalBlock ? 1 : 0)
      ..add(length & 0xff)
      ..add((length >> 8) & 0xff)
      ..add((~length) & 0xff)
      ..add((~length >> 8) & 0xff)
      ..addAll(data.sublist(offset, offset + length));
    offset += length;
  } while (offset < data.length);
  var a = 1;
  var b = 0;
  for (final byte in data) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  final adler = (b << 16) | a;
  blocks
    ..add((adler >> 24) & 0xff)
    ..add((adler >> 16) & 0xff)
    ..add((adler >> 8) & 0xff)
    ..add(adler & 0xff);
  return Uint8List.fromList(blocks);
}

int _crc32(List<int> bytes) {
  var crc = 0xffffffff;
  for (final byte in bytes) {
    crc ^= byte;
    for (var bit = 0; bit < 8; bit++) {
      crc = (crc & 1) == 1 ? (crc >> 1) ^ 0xedb88320 : crc >> 1;
    }
  }
  return crc ^ 0xffffffff;
}
