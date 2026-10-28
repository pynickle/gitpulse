import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:gitpulse/releases/document_viewer_assets.dart';
import 'package:gitpulse/releases/document_web_view.dart';

/// Overrides for a widget test that mounts a document.
///
/// A document is shown by a WebView and a widget test has no browser engine, so
/// the engine is replaced by [engine] — which reports the page it was handed, so
/// a test can still find the document's own content. The renderer asset is
/// stubbed here: what the renderer does with a document is asserted against the
/// built asset itself in `tool/document_viewer/verify.mjs`.
List<Override> documentViewerOverrides({DocumentWebViewBuilder? engine}) => [
  // Answered synchronously: a document that waits a frame for its renderer is
  // not what a test is about.
  documentViewerAssetsProvider.overrideWith(
    (ref) => const DocumentViewerAssets(
      script: '/* document renderer */',
      stylesheet: '/* document stylesheet */',
    ),
  ),
  documentWebViewBuilderProvider.overrideWith(
    (ref) => engine ?? documentViewerTestEngine,
  ),
];

/// The document the most recent stand-in engine mounted.
///
/// A screen test uses it to act as the page does: report a link the reader
/// tapped, copy a code block, or report that the document could not be rendered.
DocumentViewerProbe? mountedDocument;

/// The document's own text, laid out as text: what a test finds where the reader
/// would see the rendered document.
Widget documentViewerTestEngine(
  BuildContext context,
  DocumentWebViewRequest request,
) {
  final probe = mountedDocument ??= DocumentViewerProbe();
  probe.last = request;
  return SingleChildScrollView(child: Text(request.page.source));
}

/// The engine that keeps the request instead of drawing it, so a test can act as
/// the page would: resolve an address, open a link, copy a code block, or report
/// that the document could not be rendered.
class DocumentViewerProbe {
  DocumentWebViewRequest? last;

  Widget call(BuildContext context, DocumentWebViewRequest request) {
    last = request;
    return const SizedBox.expand();
  }

  /// The bridge of the document currently on screen.
  DocumentWebViewBridge get bridge {
    final request = last;
    if (request == null) {
      throw StateError('no document has been mounted through this probe');
    }
    return request.bridge;
  }
}
