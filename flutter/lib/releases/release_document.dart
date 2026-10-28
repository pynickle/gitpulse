import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_tokens.dart';
import 'document_content.dart';
import 'document_view_page.dart';
import 'document_viewer_assets.dart';
import 'document_web_view.dart';

/// A repository document — a release's notes or a README — shown by the app's
/// document renderer.
///
/// The whole of the Markdown pipeline runs in a browser engine: parsing,
/// embedded author HTML, tables, and syntax highlighting. What stays here is the
/// app's part of it — the theme, the reading scale, where a relative address
/// points, and what a tap does — and the document is handed a page that contains
/// only the app's own script and stylesheet.
///
/// The document owns its own scrolling. It fills the box its host gives it,
/// because a platform view keeps the gestures that land on it: a document
/// stretched to its full height inside a Flutter scroll view could not be
/// scrolled on the platforms this app ships.
class ReleaseDocument extends ConsumerWidget {
  const ReleaseDocument({
    super.key,
    required this.source,
    required this.document,
    required this.onTapUrl,
    this.bottomInset = 0,
  });

  /// The document's Markdown, exactly as the author wrote it.
  final String source;

  /// Where the document was read from: the repository, revision and path its
  /// relative links resolve against.
  final RepositoryDocumentContext document;

  /// Where a link the reader taps goes. The page never navigates itself.
  final Future<bool> Function(String url) onTapUrl;

  /// Room under the last line, inside the document's own scroll.
  final double bottomInset;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final assets = ref.watch(documentViewerAssetsProvider);
    final builder = ref.watch(documentWebViewBuilderProvider);
    final style = DocumentViewerStyle.of(context, bottomInset: bottomInset);
    return assets.when(
      // The renderer is a bundled asset: this is one frame, not a network wait.
      loading: () => const SizedBox.shrink(),
      error: (error, stackTrace) => DocumentSourceFallback(source: source),
      data: (assets) => _DocumentSurface(
        builder: builder,
        source: source,
        document: document,
        onTapUrl: onTapUrl,
        background: style.background,
        page: buildDocumentViewPage(
          assets: assets,
          source: source,
          baseUrl: _githubBase(document).toString(),
          language: Localizations.localeOf(context).toLanguageTag(),
          style: style,
          strings: DocumentViewerStrings(
            copyCode: l10n.contentCopyCode,
            copied: l10n.contentCodeCopied,
            plainText: l10n.contentPlainText,
          ),
        ),
      ),
    );
  }
}

class _DocumentSurface extends StatefulWidget {
  const _DocumentSurface({
    required this.builder,
    required this.page,
    required this.source,
    required this.document,
    required this.onTapUrl,
    required this.background,
  });

  final DocumentWebViewBuilder builder;
  final DocumentViewPage page;
  final String source;
  final RepositoryDocumentContext document;
  final Future<bool> Function(String url) onTapUrl;
  final Color background;

  @override
  State<_DocumentSurface> createState() => _DocumentSurfaceState();
}

class _DocumentSurfaceState extends State<_DocumentSurface> {
  /// Set when the page itself reports that it could not render. A document the
  /// reader can still read as text beats an empty band.
  bool _unrendered = false;

  @override
  Widget build(BuildContext context) {
    if (_unrendered) return DocumentSourceFallback(source: widget.source);
    return widget.builder(
      context,
      DocumentWebViewRequest(
        page: widget.page,
        background: widget.background,
        bridge: DocumentWebViewBridge(
          resolve: (targets) => [
            for (final target in targets)
              widget.document
                  .resolve(target.value, image: target.image)
                  ?.toString(),
          ],
          open: (url) async {
            await widget.onTapUrl(url);
          },
          copy: writeDocumentClipboard,
          failed: (message) {
            if (!mounted) return;
            setState(() => _unrendered = true);
          },
        ),
      ),
    );
  }
}

/// The document as the author wrote it: what a reader gets when the renderer is
/// unavailable, and the only floor under the reading surface.
class DocumentSourceFallback extends StatelessWidget {
  const DocumentSourceFallback({super.key, required this.source});

  final String source;

  @override
  Widget build(BuildContext context) {
    return SelectionArea(
      child: SingleChildScrollView(
        child: Text(source, style: gitPulseTypeReadingBody(context)),
      ),
    );
  }
}

/// The address a document's relative links resolve against: its own path in its
/// repository, at the revision it was read from.
Uri _githubBase(RepositoryDocumentContext document) => Uri(
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
