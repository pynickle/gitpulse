import 'package:flutter/material.dart';

/// The GitPulse brand colors every surface shares.
abstract final class GitPulseColors {
  /// The GitHub-derived green that seeds the GitPulse Material color scheme.
  static const brand = Color(0xff238636);
}

/// The GitPulse Material 3 theme for [brightness].
ThemeData gitPulseTheme(Brightness brightness) => ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: GitPulseColors.brand,
    brightness: brightness,
  ),
);

/// Applies the desktop system typeface for [locale] to [theme], so headings,
/// body text, and buttons all share one Chinese or Latin family.
///
/// Applied after the app language resolves: the chosen language, not the
/// operating system, decides whether a Chinese typeface is needed.
ThemeData gitPulseTypography(ThemeData theme, {required Locale locale}) {
  final chinese = locale.languageCode == 'zh';
  final (fontFamily, fallbacks) = switch (theme.platform) {
    TargetPlatform.windows => (
      chinese ? 'Microsoft YaHei UI' : 'Segoe UI',
      const ['Microsoft YaHei UI', 'Microsoft JhengHei UI'],
    ),
    TargetPlatform.linux => (
      chinese ? 'Noto Sans CJK SC' : 'Noto Sans',
      const ['Noto Sans CJK SC', 'Noto Sans CJK TC'],
    ),
    _ => (null, const <String>[]),
  };
  if (fontFamily == null) return theme;
  return theme.copyWith(
    textTheme: theme.textTheme.apply(
      fontFamily: fontFamily,
      fontFamilyFallback: fallbacks,
    ),
    primaryTextTheme: theme.primaryTextTheme.apply(
      fontFamily: fontFamily,
      fontFamilyFallback: fallbacks,
    ),
  );
}
