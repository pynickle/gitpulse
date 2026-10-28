import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The two files the document WebView runs.
///
/// They are built from `tool/document_viewer` and committed, so the app ships
/// the renderer it was tested with and a checkout needs no JavaScript tooling.
class DocumentViewerAssets {
  const DocumentViewerAssets({required this.script, required this.stylesheet});

  final String script;
  final String stylesheet;
}

const _assetRoot = 'assets/document_viewer';

/// Reads the renderer and its stylesheet. `rootBundle` caches the strings, so
/// every document in a session reads them once.
Future<DocumentViewerAssets> loadDocumentViewerAssets() async {
  final script = await rootBundle.loadString('$_assetRoot/viewer.js');
  final stylesheet = await rootBundle.loadString('$_assetRoot/viewer.css');
  return DocumentViewerAssets(script: script, stylesheet: stylesheet);
}

/// Injected by tests so a viewer test does not depend on the asset bundle.
final documentViewerAssetsProvider = FutureProvider<DocumentViewerAssets>(
  (ref) => loadDocumentViewerAssets(),
);
