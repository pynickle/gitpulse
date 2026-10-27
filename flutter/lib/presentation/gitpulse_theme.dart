import 'package:flutter/material.dart';

/// The GitPulse brand colors every surface shares.
abstract final class GitPulseColors {
  /// The GitHub-derived green that seeds the GitPulse Material color scheme.
  static const brand = Color(0xff238636);
}

/// The only interactive tint the app paints: the highest surface container in
/// the scheme, laid on lightly for hover and keyboard focus.
///
/// It is a tonal move, not a scrim — light mode moves one step along the
/// surface ramp instead of darkening toward black, and dark mode brightens
/// instead of greying out. A press paints nothing at all (ADR 0023), so this
/// tone is the whole of the app's ink feedback and no surface sets its own
/// overlay colour.
Color gitPulseHoverTint(ColorScheme scheme) =>
    scheme.surfaceContainerHighest.withValues(alpha: 0.5);

/// The ink any pressable control paints, state by state: nothing at all while
/// it is pressed, and [gitPulseHoverTint] while it is hovered or focused.
///
/// `pressed` resolving to nothing is the app-wide rule (ADR 0023): the click
/// itself is the feedback, and Material's own component default — a 10% wash of
/// the control's foreground colour — is exactly the dark tinge this removes.
/// Hover and keyboard focus keep the tint because they answer a different
/// question: whether a surface is clickable, and where the focus sits.
///
/// [gitPulseTheme] installs this on the `IconButton`, `TextButton`,
/// `OutlinedButton` and `Checkbox` families. It is public only because
/// `ButtonStyle.styleFrom` with an explicit `foregroundColor` builds Material's
/// pressed wash at the call site, where a theme cannot reach it; such a control
/// passes this through `copyWith(overlayColor: …)` instead of setting an overlay
/// of its own.
WidgetStateProperty<Color?> gitPulseInkOverlay(ColorScheme scheme) {
  final tint = gitPulseHoverTint(scheme);
  return WidgetStateProperty.resolveWith(
    (states) => switch (states) {
      _ when states.contains(WidgetState.pressed) => Colors.transparent,
      _ when states.contains(WidgetState.hovered) => tint,
      _ when states.contains(WidgetState.focused) => tint,
      _ => null,
    },
  );
}

/// The GitPulse Material 3 theme for [brightness].
ThemeData gitPulseTheme(Brightness brightness) {
  final scheme = ColorScheme.fromSeed(
    seedColor: GitPulseColors.brand,
    brightness: brightness,
  );
  final overlay = gitPulseInkOverlay(scheme);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    // The plain ink response — list rows, chips, the timeline card — reads
    // these four, and `ListTileThemeData` has no overlay field to override
    // with, so the transparent press has to be the theme-wide default.
    highlightColor: Colors.transparent,
    splashColor: Colors.transparent,
    focusColor: gitPulseHoverTint(scheme),
    hoverColor: gitPulseHoverTint(scheme),
    // The button families resolve their own overlay and would otherwise keep
    // Material's darker default; filled and elevated buttons are left alone so a
    // primary action still answers a press.
    iconButtonTheme: IconButtonThemeData(
      style: ButtonStyle(overlayColor: overlay),
    ),
    textButtonTheme: TextButtonThemeData(
      style: ButtonStyle(overlayColor: overlay),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: ButtonStyle(overlayColor: overlay),
    ),
    // A Checkbox paints its own press reaction rather than reading the theme's
    // splash, so it takes the same answer here: nothing while pressed, the app's
    // tint while hovered or focused. Its box and check stay Material's own
    // scheme colours — the primary fill is the theme's.
    checkboxTheme: CheckboxThemeData(overlayColor: overlay),
  );
}

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
