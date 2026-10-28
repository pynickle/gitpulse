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

class _InAppWebViewDocument extends StatefulWidget {
  const _InAppWebViewDocument({required this.request});

  final DocumentWebViewRequest request;

  @override
  State<_InAppWebViewDocument> createState() => _InAppWebViewDocumentState();
}

class _InAppWebViewDocumentState extends State<_InAppWebViewDocument> {
  InAppWebViewController? _controller;

  @override
  void didUpdateWidget(_InAppWebViewDocument oldWidget) {
    super.didUpdateWidget(oldWidget);
    final page = widget.request.page;
    if (page.html != oldWidget.request.page.html) {
      // A new document, or the same one in another theme or text scale: the
      // page owns its stylesheet, so it is replaced rather than re-rendered.
      _controller?.loadData(
        data: page.html,
        mimeType: 'text/html',
        encoding: 'utf8',
        baseUrl: WebUri(page.baseUrl),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final request = widget.request;
    return ColoredBox(
      color: request.background,
      child: InAppWebView(
        initialData: InAppWebViewInitialData(
          data: request.page.html,
          mimeType: 'text/html',
          encoding: 'utf8',
          baseUrl: WebUri(request.page.baseUrl),
        ),
        initialSettings: InAppWebViewSettings(
          // The renderer is the only script this page runs; the document it
          // builds was sanitized in this same engine before it was inserted.
          javaScriptEnabled: true,
          javaScriptCanOpenWindowsAutomatically: false,
          supportMultipleWindows: false,
          useShouldOverrideUrlLoading: true,
          // A document reads the network for its own images and nothing else.
          allowFileAccess: false,
          allowContentAccess: false,
          allowFileAccessFromFileURLs: false,
          allowUniversalAccessFromFileURLs: false,
          thirdPartyCookiesEnabled: false,
          mediaPlaybackRequiresUserGesture: true,
          // The reader's text scale is applied by the page's own stylesheet, so
          // the platform must not apply it a second time.
          textZoom: 100,
          isInspectable: kDebugMode,
          verticalScrollBarEnabled: false,
        ),
        onWebViewCreated: (controller) {
          _controller = controller;
          _bind(controller);
        },
        // The page is rendered here rather than by a script inside it: the
        // bridge handlers are only registered once the view exists, and a page
        // that asks them anything before that gets nothing back. `onLoadStop` is
        // the first moment both are true.
        onLoadStop: (controller, url) {
          controller.evaluateJavascript(source: request.page.renderScript);
        },
        shouldOverrideUrlLoading: (controller, action) async {
          final url = action.request.url;
          if (url == null) return NavigationActionPolicy.CANCEL;
          if (url.scheme == 'about' || url.scheme == 'data') {
            return NavigationActionPolicy.ALLOW;
          }
          // The page never navigates: every address the reader reaches leaves
          // through the app's own link policy. The answer is immediate — the app
          // may push a route or open a browser, and the page must not wait on it.
          request.bridge.open(url.toString()).ignore();
          return NavigationActionPolicy.CANCEL;
        },
        onConsoleMessage: (controller, message) {
          if (kDebugMode) debugPrint('document: ${message.message}');
        },
      ),
    );
  }

  void _bind(InAppWebViewController controller) {
    final bridge = widget.request.bridge;
    controller.addJavaScriptHandler(
      handlerName: 'resolveDocumentUrls',
      callback: (List<dynamic> args) {
        final raw = args.isEmpty ? null : args.first;
        final targets = <DocumentResourceTarget>[
          if (raw is List)
            for (final target in raw)
              if (target is Map)
                DocumentResourceTarget(
                  value: '${target['value'] ?? ''}',
                  image: target['image'] == true,
                ),
        ];
        return bridge.resolve(targets);
      },
    );
    controller.addJavaScriptHandler(
      handlerName: 'openDocumentUrl',
      callback: (List<dynamic> args) {
        final url = args.isEmpty ? null : args.first;
        // The handler answers the page at once; the app's own navigation — a
        // pushed route, a release drawer, the system browser — runs after it.
        if (url is String) bridge.open(url).ignore();
        return null;
      },
    );
    controller.addJavaScriptHandler(
      handlerName: 'copyDocumentCode',
      callback: (List<dynamic> args) {
        final text = args.isEmpty ? null : args.first;
        if (text is String) bridge.copy(text);
        return null;
      },
    );
    controller.addJavaScriptHandler(
      handlerName: 'documentFailed',
      callback: (List<dynamic> args) {
        final message = args.isEmpty ? null : args.first;
        bridge.failed(message is String ? message : '');
        return null;
      },
    );
  }
}

/// The clipboard write a copy action performs, kept here so the bridge in
/// `release_document.dart` states only what it means.
void writeDocumentClipboard(String text) {
  Clipboard.setData(ClipboardData(text: text)).ignore();
}
