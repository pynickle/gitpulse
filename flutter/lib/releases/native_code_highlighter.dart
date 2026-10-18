import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shiki_flutter/shiki_flutter.dart';

final nativeCodeHighlighterProvider = Provider<NativeCodeHighlighter>((ref) {
  final highlighter = NativeCodeHighlighter();
  ref.onDispose(highlighter.dispose);
  return highlighter;
});

class HighlightedCode {
  const HighlightedCode(this.span, this.background);

  final TextSpan span;
  final Color? background;
}

class NativeCodeHighlighter {
  NativeCodeHighlighter({ShikiHighlighter? highlighter})
    : _shiki = highlighter ?? ShikiHighlighter();

  // One worker and the package's bounded LRU token cache per app scope. Only
  // referenced grammars/themes are bundled; never enumerate the full catalog.
  final ShikiHighlighter _shiki;

  static CodeLanguage? _language(String label) => switch (label.toLowerCase()) {
    'sh' ||
    'bash' ||
    'shell' ||
    'zsh' ||
    'shellscript' => CodeLanguages.shellscript,
    'ps' || 'ps1' || 'pwsh' || 'powershell' => CodeLanguages.powershell,
    'ts' || 'typescript' => CodeLanguages.typescript,
    'tsx' => CodeLanguages.tsx,
    'js' || 'javascript' => CodeLanguages.javascript,
    'jsx' => CodeLanguages.jsx,
    'c' || 'h' => CodeLanguages.c,
    'c++' || 'cpp' || 'cc' || 'cxx' || 'hpp' => CodeLanguages.cpp,
    'cs' || 'csharp' || 'c#' => CodeLanguages.csharp,
    'html' || 'htm' => CodeLanguages.html,
    'css' => CodeLanguages.css,
    'json' || 'jsonc' => CodeLanguages.json,
    'yaml' || 'yml' => CodeLanguages.yaml,
    'dart' => CodeLanguages.dart,
    'py' || 'python' => CodeLanguages.python,
    'rust' || 'rs' => CodeLanguages.rust,
    'go' => CodeLanguages.go,
    'java' => CodeLanguages.java,
    _ => null,
  };

  Future<HighlightedCode?> highlight(
    String source,
    String language,
    Brightness brightness,
  ) async {
    final grammar = _language(language);
    if (grammar == null) return null;
    final theme = brightness == Brightness.dark
        ? ShikiThemes.githubDark
        : ShikiThemes.githubLight;
    _shiki
      ..ensureLanguage(grammar)
      ..ensureShikiTheme(theme);
    final tokens = await _shiki.codeToTokensAsync(
      source,
      TokenizeOptions(lang: grammar.id, theme: theme.id),
    );
    final registration = _shiki.getThemeRegistration(theme.id);
    final span = tokensToTextSpan(
      tokens,
      baseStyle: TextStyle(color: parseColor(registration.fg)),
    );
    // Selection must be source-accurate too, even if a grammar drops characters.
    if (span.toPlainText() != source) return null;
    return HighlightedCode(span, parseColor(registration.bg));
  }

  void dispose() => _shiki.dispose();
}
