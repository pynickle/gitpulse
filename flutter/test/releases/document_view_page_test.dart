import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gitpulse/presentation/gitpulse_tokens.dart';
import 'package:gitpulse/releases/document_view_page.dart';
import 'package:gitpulse/releases/document_viewer_assets.dart';

const _assets = DocumentViewerAssets(
  script: 'RENDERER();',
  stylesheet: '.markdown-body{}',
);

const _strings = DocumentViewerStrings(
  copyCode: 'Copy code',
  copied: 'Copied',
  plainText: 'Plain text',
);

DocumentViewerStyle _style({
  bool dark = false,
  double scale = 1,
  double bottomInset = 0,
}) => DocumentViewerStyle(
  dark: dark,
  foreground: const Color(0xff112233),
  background: const Color(0xfffafafa),
  muted: const Color(0xff666666),
  rule: const Color(0xffdddddd),
  accent: const Color(0xff0055ff),
  codeBackground: const Color(0xfff2f2f2),
  inlineCodeBackground: const Color(0xffe8e8e8),
  textScale: TextScaler.linear(scale),
  bottomInset: bottomInset,
);

DocumentViewPage _page({
  String source = '# Title',
  String language = 'en-US',
  DocumentViewerStyle? style,
}) => buildDocumentViewPage(
  assets: _assets,
  source: source,
  baseUrl: 'https://github.com/octo/app/blob/v2/README.md',
  language: language,
  style: style ?? _style(),
  strings: _strings,
);

/// One custom property, read back out of the page it was written into.
double _cssPx(DocumentViewPage page, String name) {
  final match = RegExp('--$name:([0-9.]+)px;').firstMatch(page.html);
  expect(match, isNotNull, reason: '--$name is not on the page');
  return double.parse(match!.group(1)!);
}

double _cssNumber(DocumentViewPage page, String name) {
  final match = RegExp('--$name:([0-9.]+);').firstMatch(page.html);
  expect(match, isNotNull, reason: '--$name is not on the page');
  return double.parse(match!.group(1)!);
}

void main() {
  test('the reading scale reaches the page as the tokens register it', () {
    final page = _page();
    expect(_cssPx(page, 'gp-font-size'), GitPulseType.readingBodySize);
    expect(_cssPx(page, 'gp-heading-1'), GitPulseType.readingHeading1Size);
    expect(_cssPx(page, 'gp-heading-2'), GitPulseType.readingHeading2Size);
    expect(_cssPx(page, 'gp-heading-3'), GitPulseType.readingHeading3Size);
    expect(_cssPx(page, 'gp-list-indent'), GitPulseType.readingListIndent);
    expect(_cssPx(page, 'gp-quote-indent'), GitPulseType.readingQuoteIndent);
    expect(
      _cssNumber(page, 'gp-line-height'),
      closeTo(
        GitPulseType.readingBodyLineHeight / GitPulseType.readingBodySize,
        .001,
      ),
    );
    // No heading tier is smaller than the body text.
    expect(
      _cssPx(page, 'gp-heading-3'),
      greaterThanOrEqualTo(_cssPx(page, 'gp-font-size')),
    );
  });

  test("the reader's text scale grows every tier and indent", () {
    final page = _page(style: _style(scale: 2));
    expect(_cssPx(page, 'gp-font-size'), closeTo(30, .01));
    expect(_cssPx(page, 'gp-heading-1'), closeTo(40, .01));
    expect(_cssPx(page, 'gp-heading-2'), closeTo(34, .01));
    expect(_cssPx(page, 'gp-list-indent'), closeTo(40, .01));
    expect(
      _cssPx(page, 'gp-quote-indent'),
      closeTo(GitPulseType.readingQuoteIndent * 2, .01),
    );
  });

  test('the page is painted in the app theme and its own appearance', () {
    final light = _page();
    expect(light.html, contains('--gp-fg:#112233;'));
    expect(light.html, contains('--gp-bg:#fafafa;'));
    expect(light.html, contains('--gp-accent:#0055ff;'));
    expect(light.html, contains('data-appearance="light"'));

    final dark = _page(style: _style(dark: true));
    expect(dark.html, contains('data-appearance="dark"'));
  });

  test('the document travels as data and never as markup', () {
    final page = _page(source: '# Title\n\n<script>alert(1)</script>\n\nDone.');
    // The page owns exactly two script elements: the renderer and the one
    // statement that renders this document.
    expect(RegExp('</script>').allMatches(page.html).length, 2);
    expect(page.html, contains(r'<\/script>'));
    expect(page.renderScript, startsWith('window.gitpulseDocument.render('));
    expect(page.renderScript, contains(r'"source":"# Title'));
    expect(
      page.renderScript,
      contains('"base":"https://github.com/octo/app/blob/v2/README.md"'),
      reason: 'the payload carries the address, not markup',
    );
    expect(page.html, contains(page.renderScript));
  });

  test('a document may load images and media and nothing else', () {
    final html = _page().html;
    for (final directive in [
      "default-src 'none'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
      'img-src https: http:',
      'media-src https: http:',
      "connect-src 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ]) {
      expect(html, contains(directive));
    }
    expect(html, isNot(contains('unsafe-eval')));
    expect(html, isNot(contains("default-src *")));
  });

  test('the language tag cannot leave its attribute', () {
    expect(_page(language: 'zh-Hant').html, contains('lang="zh-Hant"'));
    expect(
      _page(language: 'en-US" onload="x').html,
      contains('lang="en-USonloadx"'),
    );
    expect(
      _page(language: 'en-US" onload="x').html,
      isNot(contains('onload=')),
    );
  });

  test('the document resolves against the address it was read from', () {
    expect(_page().baseUrl, 'https://github.com/octo/app/blob/v2/README.md');
    expect(
      _page().renderScript,
      contains('https://github.com/octo/app/blob/v2/README.md'),
    );
  });

  test('room under the last line belongs inside the document scroll', () {
    expect(
      _cssPx(_page(style: _style(bottomInset: 32)), 'gp-bottom-inset'),
      32,
    );
    expect(_cssPx(_page(), 'gp-bottom-inset'), 0);
  });
}
