import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'document_view_page.dart';

/// One URL a document asks the app to resolve, and whether it is a resource the
/// page loads or a link the reader can follow.
class DocumentResourceTarget {
  const DocumentResourceTarget({required this.value, required this.image});

  final String value;
  final bool image;
}

/// What a document page may ask the app for.
///
/// The page resolves no repository-relative URL on its own, opens no link, and
/// touches no clipboard: each of those is one policy, and all of them live in
/// Dart, where every other caller of them already does.
class DocumentWebViewBridge {
  const DocumentWebViewBridge({
    required this.resolve,
    required this.open,
    required this.copy,
    required this.failed,
  });

  /// Resolves a document's links and resources, in order. A null answer drops
  /// the attribute: the text stays, the address does not.
  final List<String?> Function(List<DocumentResourceTarget> targets) resolve;

  /// A link the reader tapped. The app decides where it goes.
  final Future<void> Function(String url) open;

  /// The code block's copy action, written to the real clipboard.
  final void Function(String text) copy;

  /// The page could not render the document.
  final void Function(String message) failed;
}

/// Everything a platform view needs to show one document.
class DocumentWebViewRequest {
  const DocumentWebViewRequest({
    required this.page,
    required this.bridge,
    required this.background,
  });

  final DocumentViewPage page;
  final DocumentWebViewBridge bridge;

  /// Painted behind the page, so the surface does not flash white in a dark app
  /// while the engine starts.
  final Color background;
}

/// Injected by tests: a WebView needs a real engine, which a widget test does
/// not have. Everything the widget decides — what the page says, which URLs
/// survive, where a tap goes — is asserted through this seam instead.
typedef DocumentWebViewBuilder = Widget Function(
  BuildContext context,
  DocumentWebViewRequest request,
);

Widget buildDocumentWebView(
  BuildContext context,
  DocumentWebViewRequest request,
) => _InAppWebViewDocument(request: request);

/// The platform view a document is shown in. A widget test has no engine, so it
/// replaces this with a stand-in and asserts what the app asked the engine to
/// show.
final documentWebViewBuilderProvider = Provider<DocumentWebViewBuilder>(
  (ref) => buildDocumentWebView,
);

/// Only platform operations are replaceable. Protocol decoding and update
/// orchestration stay in the real document host, including in host tests.
class DocumentEngineRequest {
  const DocumentEngineRequest({
    required this.page,
    required this.ready,
    required this.message,
    required this.navigate,
  });
  final DocumentViewPage page;
  final void Function(Future<void> Function(String) evaluate) ready;
  final Object? Function(String name, List<dynamic> args) message;
  final void Function(String url) navigate;
}

typedef DocumentEngineBuilder = Widget Function(
  BuildContext context,
  DocumentEngineRequest request,
);
final documentEngineBuilderProvider = Provider<DocumentEngineBuilder>(
  (ref) => _buildEngine,
);

class _InAppWebViewDocument extends ConsumerStatefulWidget {
  const _InAppWebViewDocument({required this.request});
  final DocumentWebViewRequest request;
  @override
  ConsumerState<_InAppWebViewDocument> createState() =>
      _InAppWebViewDocumentState();
}

class _InAppWebViewDocumentState extends ConsumerState<_InAppWebViewDocument> {
  Future<void> Function(String)? _evaluate;
  late final DocumentViewPage _initialPage = widget.request.page;

  @override
  void didUpdateWidget(_InAppWebViewDocument oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.request.page.renderScript !=
        oldWidget.request.page.renderScript) {
      _render();
    }
  }

  void _render() {
    _evaluate?.call(widget.request.page.renderScript).catchError((
      Object error,
    ) {
      if (mounted) widget.request.bridge.failed(error.toString());
    });
  }

  Object? _message(String name, List<dynamic> args) {
    final bridge = widget.request.bridge;
    final raw = args.isEmpty ? null : args.first;
    switch (name) {
      case 'resolveDocumentUrls':
        if (raw is! Map ||
            raw['base'] != widget.request.page.baseUrl ||
            raw['targets'] is! List) {
          return null;
        }
        return [
          for (final target in raw['targets'] as List)
            if (target is Map &&
                target['value'] is String &&
                target['image'] is bool)
              bridge.resolve([
                DocumentResourceTarget(
                  value: target['value'] as String,
                  image: target['image'] as bool,
                ),
              ]).single
            else
              <String, bool>{'transient': true},
        ];
      case 'openDocumentUrl':
        if (raw is String) bridge.open(raw).ignore();
      case 'copyDocumentCode':
        if (raw is String) bridge.copy(raw);
      case 'documentFailed':
        bridge.failed(raw is String ? raw : '');
    }
    return null;
  }

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: widget.request.background,
    child: ref.watch(documentEngineBuilderProvider)(
      context,
      DocumentEngineRequest(
        page: _initialPage,
        ready: (evaluate) {
          _evaluate = evaluate;
          _render();
        },
        message: _message,
        navigate: (url) => widget.request.bridge.open(url).ignore(),
      ),
    ),
  );
}

/// The settings every document is drawn with.
///
/// [InAppWebViewSettings.useHybridComposition] is off, so the page is drawn into
/// a texture rather than as an Android View laid over Flutter's canvas. A
/// hybrid-composition WebView cannot take the opacity of the sheet it stands in —
/// it stayed lit while the Release Drawer's chrome and barrier faded — and it
/// tore down with one stale frame of the whole sheet, the flash a reader saw as
/// the drawer shut (ADR 0028). Texture-layer composition keeps the page inside
/// the app's own layer tree, so a sheet can move it or put it away like any other
/// surface.
InAppWebViewSettings documentWebViewSettings() => InAppWebViewSettings(
  useHybridComposition: false,
  transparentBackground: true,
  javaScriptEnabled: true,
  javaScriptCanOpenWindowsAutomatically: false,
  supportMultipleWindows: false,
  useShouldOverrideUrlLoading: true,
  allowFileAccess: false,
  allowContentAccess: false,
  allowFileAccessFromFileURLs: false,
  allowUniversalAccessFromFileURLs: false,
  thirdPartyCookiesEnabled: false,
  mediaPlaybackRequiresUserGesture: true,
  textZoom: 100,
  isInspectable: kDebugMode,
  verticalScrollBarEnabled: false,
);

Widget _buildEngine(BuildContext context, DocumentEngineRequest request) =>
    InAppWebView(
      initialData: InAppWebViewInitialData(
        data: request.page.html,
        mimeType: 'text/html',
        encoding: 'utf8',
        baseUrl: WebUri(request.page.baseUrl),
      ),
      initialSettings: documentWebViewSettings(),
      onWebViewCreated: (controller) {
        for (final name in [
          'resolveDocumentUrls',
          'openDocumentUrl',
          'copyDocumentCode',
          'documentFailed',
        ]) {
          controller.addJavaScriptHandler(
            handlerName: name,
            callback: (List<dynamic> args) => request.message(name, args),
          );
        }
      },
      onLoadStop: (controller, url) => request.ready((source) async {
        await controller.evaluateJavascript(source: source);
      }),
      shouldOverrideUrlLoading: (controller, action) async {
        final url = action.request.url;
        if (url != null && (url.scheme == 'about' || url.scheme == 'data')) {
          return NavigationActionPolicy.ALLOW;
        }
        if (url != null) request.navigate(url.toString());
        return NavigationActionPolicy.CANCEL;
      },
      onConsoleMessage: (controller, message) {
        if (kDebugMode) debugPrint('document: ${message.message}');
      },
    );

/// The clipboard write a copy action performs, kept here so the bridge in
/// `release_document.dart` states only what it means.
void writeDocumentClipboard(String text) {
  Clipboard.setData(ClipboardData(text: text)).ignore();
}
