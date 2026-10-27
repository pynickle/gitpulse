import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:html/dom.dart' as dom;

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_tokens.dart';
import 'document_content.dart';
import 'document_image.dart';
import 'document_image_provider.dart';
import 'document_svg_render_service.dart';
import 'native_code_block.dart';

/// The notes document's deliberate type scale. Body text is 15sp on a 24px
/// line, headings take three tiers (20, 17, 15) with tight space below them so
/// they group with the text they introduce, and indents are sized for a 360dp
/// phone instead of a browser default ladder. Applied through the renderer's
/// custom styles hook so block rendering, code blocks and tables stay the
/// renderer's own.
///
/// The numbers are the reading scale `GitPulseType` registers, read from there
/// rather than restated: this file owns how the scale is applied, the token file
/// owns what it is.
const _notesHeadingLineHeight = GitPulseType.readingHeadingLineHeight;

String _px(double value) => '${value}px';

/// A border between a reading surface and the code it quotes — one hairline
/// around the whole block card, in the theme's outline tone.
String _hairline(Color color) => '1px solid ${_cssColor(color)}';

Map<String, String>? _notesStyles(
  dom.Element element, {
  required Color quoteBarColor,
  required Color inlineCodeBackground,
  required Color codeBorderColor,
}) {
  switch (element.localName) {
    case 'p':
      return {'margin': '0 0 12px'};
    // Headings carry the hierarchy by weight as well as size: body stays at
    // the normal weight, headings and emphasis step up.
    case 'h1':
      return {
        'font-size': _px(GitPulseType.readingHeading1Size),
        'line-height': '$_notesHeadingLineHeight',
        'font-weight': '700',
        'margin': '0 0 10px',
      };
    case 'h2':
      return {
        'font-size': _px(GitPulseType.readingHeading2Size),
        'line-height': '$_notesHeadingLineHeight',
        'font-weight': '600',
        'margin': '0 0 8px',
      };
    // Fourth through sixth level collapse onto the third tier: no heading is
    // smaller than body text.
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return {
        'font-size': _px(GitPulseType.readingHeading3Size),
        'line-height': '$_notesHeadingLineHeight',
        'font-weight': '600',
        'margin': '0 0 6px',
      };
    case 'strong':
    case 'b':
      return {'font-weight': '600'};
    case 'code':
      // Inline code is a chip: the theme's own container tone, a small radius
      // and a little horizontal room, so it separates from prose without
      // becoming a block.
      return {
        'background-color': _cssColor(inlineCodeBackground),
        'border-radius': '4px',
        'padding': '1px 4px',
        'font-family': 'monospace',
        'font-size': '13px',
      };
    case 'pre':
      return {
        'margin': '0 0 12px',
        'border': _hairline(codeBorderColor),
        'border-radius': '8px',
      };
    case 'table':
      return {
        'margin': '0 0 12px',
        'border': _hairline(codeBorderColor),
        'border-radius': '6px',
      };
    case 'ul':
    case 'ol':
      return {'padding-inline-start': _px(GitPulseType.readingListIndent)};
    case 'blockquote':
      return {
        'margin': '0 0 12px',
        'padding-inline-start': _px(GitPulseType.readingQuoteIndent),
        'border-inline-start': '3px solid ${_cssColor(quoteBarColor)}',
      };
    case 'hr':
      return {'margin': '20px 0'};
    case 'img':
      return _imageStyles(element);
  }

  // An author's `align` is the only layout attribute the document keeps; it is
  // translated to the renderer's own text alignment here, and never pasted
  // into a style string.
  final align = element.attributes['align'];
  if (align == null) return null;
  if (element.localName == 'table') {
    return {
      'margin-inline-start': switch (align) {
        'center' => 'auto',
        'right' => 'auto',
        _ => '0',
      },
      'margin-inline-end': switch (align) {
        'center' => 'auto',
        'left' => 'auto',
        _ => '0',
      },
    };
  }
  return {'text-align': align};
}

Map<String, String>? _imageStyles(dom.Element element) {
  final align = element.attributes['align'];
  if (align == null) return null;
  if (align == 'left' || align == 'right') {
    // A floated image wraps the paragraph's own text around it.
    return {
      'float': align,
      'margin': align == 'left' ? '0 12px 6px 0' : '0 0 6px 12px',
    };
  }
  return {'margin-inline-start': 'auto', 'margin-inline-end': 'auto'};
}

String _cssColor(Color color) =>
    '#${(color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

class ReleaseDocument extends ConsumerWidget {
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
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
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
    final factory = _DocumentWidgetFactory(
      service: ref.watch(documentSvgRenderServiceProvider),
      currentColor: _cssColor(theme.colorScheme.onSurface),
      themeRevision: theme.brightness.index,
    );
    return SelectionArea(
      child: HtmlWidget(
        prepareDocument(
          source,
          document,
          detailsLabel: AppLocalizations.of(context).releaseDetails,
        ),
        baseUrl: baseUrl,
        factoryBuilder: () => factory,
        customStylesBuilder: (element) => _notesStyles(
          element,
          quoteBarColor: theme.colorScheme.outlineVariant,
          inlineCodeBackground: theme.colorScheme.surfaceContainerHighest,
          codeBorderColor: theme.colorScheme.outlineVariant,
        ),
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
        textStyle: gitPulseTypeReadingBody(context),
        onErrorBuilder: (context, element, error) => Text(
          element.attributes['alt'] ??
              AppLocalizations.of(context).releaseResourceUnavailable,
        ),
      ),
    );
  }
}

/// Builds document images through the Rust SVG renderer, and leaves every
/// other image to the core factory.
///
/// One provider serves both SVG and raster payloads, so an extensionless badge
/// URL is rendered instead of failing, and an unreadable one keeps its alt text
/// locally.
class _DocumentWidgetFactory extends WidgetFactory {
  _DocumentWidgetFactory({
    required this.service,
    required this.currentColor,
    required this.themeRevision,
  });

  final DocumentSvgRenderService service;

  /// The theme's `onSurface` colour, which replaces `currentColor` in an SVG.
  final String currentColor;

  /// Changes with the theme, so a themed raster is not reused across themes.
  final int themeRevision;

  @override
  Widget? buildImageWidget(BuildTree tree, ImageSource src) {
    final url = urlFull(src.url);
    if (url == null) return super.buildImageWidget(tree, src);
    final image = src.image;
    return DocumentImage(
      provider: DocumentImageProvider(
        url: url,
        service: service,
        width: src.width,
        height: src.height,
        currentColor: currentColor,
        revision: themeRevision,
      ),
      width: src.width,
      height: src.height,
      semanticLabel: image?.alt ?? image?.title,
      onError: (context) => Text(
        image?.alt ??
            image?.title ??
            AppLocalizations.of(context).releaseResourceUnavailable,
      ),
    );
  }
}
