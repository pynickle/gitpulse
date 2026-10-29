import 'dart:convert';

import 'package:flutter/material.dart';

import '../presentation/gitpulse_preset.dart';
import '../presentation/gitpulse_theme.dart';
import '../presentation/gitpulse_tokens.dart';
import 'document_viewer_assets.dart';

/// The three labels the page itself writes: the copy action on a code block and
/// the two states it reports. Everything else in a document comes from its
/// author.
class DocumentViewerStrings {
  const DocumentViewerStrings({
    required this.copyCode,
    required this.copied,
    required this.plainText,
  });

  final String copyCode;
  final String copied;
  final String plainText;

  Map<String, String> toJson() => {
    'copyCode': copyCode,
    'copied': copied,
    'plainText': plainText,
  };
}

/// The colours and reading scale a document is painted with: the app's own, so
/// a README is not a white card dropped into a dark app.
class DocumentViewerStyle {
  const DocumentViewerStyle({
    required this.dark,
    required this.foreground,
    required this.background,
    required this.muted,
    required this.rule,
    required this.accent,
    required this.codeBackground,
    required this.inlineCodeBackground,
    required this.textScale,
    this.type = gitPulseTypeTable,
    this.bottomInset = 0,
  });

  factory DocumentViewerStyle.of(
    BuildContext context, {
    double bottomInset = 0,
    Color? background,
  }) {
    final theme = Theme.of(context);
    return DocumentViewerStyle(
      dark: theme.brightness == Brightness.dark,
      // Every tone the document paints is the app's own, read by the job it
      // does rather than by a Material role's name: a README is part of the app,
      // not a page dropped into it.
      foreground: toneText(context),
      background: background ?? toneSurface(context),
      muted: toneTextMuted(context),
      rule: toneRule(theme.colorScheme),
      accent: toneAccent(context),
      codeBackground: toneSurfaceMuted(context),
      inlineCodeBackground: toneSurfaceActive(context),
      textScale: MediaQuery.textScalerOf(context),
      type: gitPulseTypeTableOf(context),
      bottomInset: bottomInset,
    );
  }

  final bool dark;
  final Color foreground;
  final Color background;
  final Color muted;
  final Color rule;
  final Color accent;
  final Color codeBackground;
  final Color inlineCodeBackground;

  /// The reader's text scale, applied to the reading scale here rather than
  /// left to the platform's own page zoom, so the document grows exactly like
  /// the rest of the app.
  final TextScaler textScale;

  /// The Theme Preset's type table, whose reading rows this document is set in:
  /// the body's 15 on a 24 line and the three heading tiers are rows of the same
  /// table the chrome takes its type from (ADR 0031).
  final GitPulseTypeTable type;

  /// Room under the last line, inside the page's own scroll: a reading surface
  /// that ends flush with the window edge reads as clipped.
  final double bottomInset;

  String get cssVariables {
    String px(double value) => '${value.toStringAsFixed(2)}px';
    final body = textScale.scale(type.readingBody.size);
    final lineHeight = type.readingBody.height;
    return ':root{'
        '--gp-fg:${_hex(foreground)};'
        '--gp-bg:${_hex(background)};'
        '--gp-muted:${_hex(muted)};'
        '--gp-rule:${_hex(rule)};'
        '--gp-accent:${_hex(accent)};'
        '--gp-code-bg:${_hex(codeBackground)};'
        '--gp-inline-code-bg:${_hex(inlineCodeBackground)};'
        '--gp-font-size:${px(body)};'
        '--gp-line-height:${lineHeight.toStringAsFixed(2)};'
        '--gp-heading-1:${px(textScale.scale(type.readingHeading1.size))};'
        '--gp-heading-2:${px(textScale.scale(type.readingHeading2.size))};'
        '--gp-heading-3:${px(textScale.scale(type.readingHeading3.size))};'
        '--gp-list-indent:${px(textScale.scale(GitPulseSpace.readingListIndent))};'
        '--gp-quote-indent:${px(textScale.scale(GitPulseSpace.readingQuoteIndent))};'
        '--gp-code-font-size:${px(textScale.scale(13))};'
        '--gp-radius:${px(GitPulseRadius.row)};'
        '--gp-bottom-inset:${px(textScale.scale(bottomInset))};'
        // Half of `tight`: two wrapped rows of inline images end up one `tight`
        // apart, which is the smallest step the app's spacing scale has.
        '--gp-image-gap:${px(textScale.scale(GitPulseSpace.tight / 2))};'
        '}';
  }
}

String _hex(Color color) =>
    '#${(color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

/// A document may load images and media from the network and nothing else: no
/// scripts from anywhere but the page itself, no frames, no forms, no base URL
/// rewriting, and no way to reach the embedding app.
const _contentSecurityPolicy =
    "default-src 'none'; "
    "script-src 'unsafe-inline'; "
    "style-src 'unsafe-inline'; "
    'img-src https: http:; '
    'media-src https: http:; '
    "connect-src 'none'; "
    "frame-src 'none'; "
    "object-src 'none'; "
    "base-uri 'none'; "
    "form-action 'none'";

/// The page a document is shown in: the app-owned shell, the renderer, and this
/// document's payload.
class DocumentViewPage {
  const DocumentViewPage({
    required this.html,
    required this.renderScript,
    required this.baseUrl,
    required this.source,
  });

  final String html;

  /// The one statement that renders a payload. The page runs it once on load and
  /// the widget runs it again when the same page is handed a new document.
  final String renderScript;

  final String baseUrl;

  /// The Markdown this page shows. It is already inside [renderScript]; keeping
  /// it also on the page lets a test — or a reader-facing fallback — name the
  /// document without parsing the payload back out of it.
  final String source;
}

/// Builds the page for one document.
///
/// The Markdown never appears as markup: it travels as a JSON string into the
/// renderer, which sanitizes what it produces before anything is inserted. The
/// page holds only the app's own script and stylesheet.
DocumentViewPage buildDocumentViewPage({
  required DocumentViewerAssets assets,
  required String source,
  required String baseUrl,
  required String language,
  required DocumentViewerStyle style,
  required DocumentViewerStrings strings,
  String? identity,
}) {
  final payload = jsonEncode({
    'source': source,
    'identity': identity ?? baseUrl,
    'language': _languageTag(language),
    'dark': style.dark,
    'css': style.cssVariables,
    'base': baseUrl,
    'strings': strings.toJson(),
  }).replaceAll('</', r'<\/');
  final renderScript = 'window.gitpulseDocument.render($payload);';
  final html =
      '''
<!DOCTYPE html>
<html lang="${_languageTag(language)}" data-appearance="${style.dark ? 'dark' : 'light'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="$_contentSecurityPolicy">
<!-- The stylesheet first, the app's variables second: its own `:root` block is
     the fallback for a standalone preview, and must not shadow the app. -->
<style>${assets.stylesheet}</style>
<style>${style.cssVariables}</style>
</head>
<body>
<article id="document" class="markdown-body" aria-busy="true"></article>
<script>${assets.script}</script>
</body>
</html>
''';
  return DocumentViewPage(
    html: html,
    renderScript: renderScript,
    baseUrl: baseUrl,
    source: source,
  );
}

/// A language tag is the app's locale, and only its letters and separators: it
/// lands in an attribute, so nothing else may reach it.
String _languageTag(String value) =>
    value.replaceAll(RegExp('[^A-Za-z0-9-]'), '');
