import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:fwfh_svg/fwfh_svg.dart';

import '../l10n/generated/app_localizations.dart';
import 'document_content.dart';
import 'native_code_block.dart';

class ReleaseDocument extends StatelessWidget {
  const ReleaseDocument({
    super.key,
    required this.source,
    required this.document,
    required this.onTapUrl,
  });

  final String source;
  final RepositoryDocumentContext document;
  final Future<bool> Function(String) onTapUrl;

  @override
  Widget build(BuildContext context) {
    final baseUrl = Uri(
      scheme: 'https',
      host: 'github.com',
      pathSegments: [
        document.owner,
        document.repository,
        'blob',
        document.ref,
        ...document.documentPath.split('/').where((part) => part.isNotEmpty),
      ],
    );
    return SelectionArea(
      child: HtmlWidget(
        prepareDocument(
          source,
          document,
          detailsLabel: AppLocalizations.of(context).releaseDetails,
        ),
        baseUrl: baseUrl,
        factoryBuilder: _DocumentWidgetFactory.new,
        customWidgetBuilder: (element) {
          if (element.localName != 'pre') return null;
          final code = element.querySelector('code');
          final classes = [...?code?.classes, ...element.classes];
          final language = classes
              .where((name) => name.startsWith('language-'))
              .firstOrNull;
          return NativeCodeBlock(
            source: (code ?? element).text,
            language: language?.substring('language-'.length) ?? '',
          );
        },
        onTapUrl: (url) {
          final uri = Uri.tryParse(url);
          if (uri != null &&
              uri.hasFragment &&
              uri.removeFragment() == baseUrl) {
            return Future.value(false);
          }
          return onTapUrl(url);
        },
        textStyle: Theme.of(context).textTheme.bodyMedium,
        // Core NetworkImage is deliberately independent of the authenticated Dio
        // client. No session cookies/CSRF headers reach document resources.
        onErrorBuilder: (context, element, error) => Text(
          element.attributes['alt'] ??
              AppLocalizations.of(context).releaseResourceUnavailable,
        ),
      ),
    );
  }
}

class _DocumentWidgetFactory extends WidgetFactory with SvgFactory {
  @override
  Widget? buildImageWidget(BuildTree meta, ImageSource src) {
    final image = super.buildImageWidget(meta, src);
    if (image is! SvgPicture) return image;
    // fwfh_svg supplies the same resource resolution as raster images, but its
    // default SvgPicture has no error builder. Keep unreadable badges local to
    // their alt text instead of reporting an unhandled renderer exception.
    return _DocumentSvg(
      image: image,
      onError: (context) =>
          super.onErrorBuilder(context, meta, null, src) ??
          const SizedBox.shrink(),
    );
  }

  @override
  Widget? onErrorBuilder(
    BuildContext context,
    BuildTree tree, [
    dynamic error,
    dynamic data,
  ]) {
    // Badge paths can omit .svg and contain dotted version numbers. Try raster
    // decoding first, then SVG unless the URL has a known raster extension.
    if (data is ImageSource) {
      final uri = safeContentUri(data.url, image: true);
      final raster = RegExp(
        r'\.(?:avif|bmp|gif|ico|jpe?g|png|webp)$',
        caseSensitive: false,
      );
      if (uri != null && !raster.hasMatch(uri.path)) {
        final loader = imageSvgFromNetwork(data.url);
        if (loader != null) {
          return _DocumentSvg(
            image: SvgPicture(
              loader,
              width: data.width,
              height: data.height,
              fit: BoxFit.fill,
              semanticsLabel: data.image?.alt ?? data.image?.title,
            ),
            onError: (context) =>
                super.onErrorBuilder(context, tree, error, data) ??
                const SizedBox.shrink(),
          );
        }
      }
    }
    return super.onErrorBuilder(context, tree, error, data);
  }
}

class _DocumentSvg extends StatefulWidget {
  const _DocumentSvg({required this.image, required this.onError});

  final SvgPicture image;
  final WidgetBuilder onError;

  @override
  State<_DocumentSvg> createState() => _DocumentSvgState();
}

class _DocumentSvgState extends State<_DocumentSvg> {
  Future<ByteData?>? _bytes;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _bytes ??= _load();
  }

  @override
  void didUpdateWidget(_DocumentSvg oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.image.bytesLoader != oldWidget.image.bytesLoader) {
      _bytes = _load();
    }
  }

  Future<ByteData?> _load() {
    final result = Completer<ByteData?>();
    // flutter_svg 2.3.0's cache and vector_graphics 1.2.3 attach unobserved
    // futures to failing loads. Compile before mounting the vector renderer,
    // and contain the cache's duplicate error in the resource-load zone.
    runZonedGuarded(
      () => widget.image.bytesLoader
          .loadBytes(context)
          .then(
            (bytes) {
              if (!result.isCompleted) result.complete(bytes);
            },
            onError: (Object error, StackTrace stack) {
              if (!result.isCompleted) result.complete(null);
            },
          ),
      (error, stack) {
        if (!result.isCompleted) result.complete(null);
      },
    );
    return result.future;
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<ByteData?>(
    future: _bytes,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return widget.image.placeholderBuilder?.call(context) ??
            const SizedBox.shrink();
      }
      final bytes = snapshot.data;
      if (bytes == null) return widget.onError(context);
      final image = widget.image;
      return SvgPicture(
        _CompiledSvg(bytes),
        width: image.width,
        height: image.height,
        fit: image.fit,
        semanticsLabel: image.semanticsLabel,
        excludeFromSemantics: image.excludeFromSemantics,
        errorBuilder: (context, error, stack) => widget.onError(context),
      );
    },
  );
}

class _CompiledSvg extends BytesLoader {
  const _CompiledSvg(this.bytes);

  final ByteData bytes;

  @override
  Future<ByteData> loadBytes(BuildContext? context) => SynchronousFuture(bytes);

  @override
  Object cacheKey(BuildContext? context) => bytes;
}
